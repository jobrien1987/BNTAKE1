import 'server-only';
import { prisma } from '@/lib/prisma';
import { appUrl, env } from '@/lib/env';
import { paymentProvider, PaymentsNotConfiguredError } from './payments';
import { getCartView } from './cart';
import { createPendingOrder } from './orders';
import { track } from './analytics';
import type { SessionUser } from '@/server/auth/session';

export interface CheckoutRequest {
  user: SessionUser | null;
  email: string;
  shipping?: {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  } | null;
}

export interface CheckoutResult {
  redirectUrl: string;
  orderId: string;
}

/**
 * Server-authoritative checkout: the cart is re-priced from the database, an
 * order is persisted, and only then is a payment session created.
 */
export async function startCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
  const provider = paymentProvider();
  if (!provider.isConfigured()) throw new PaymentsNotConfiguredError();

  const cart = await getCartView();
  if (cart.lines.length === 0) throw new Error('Your cart is empty.');

  const blocking = cart.lines.filter((line) => line.stockWarning === 'Out of stock');
  if (blocking.length > 0) {
    throw new Error(`${blocking[0].title} is out of stock. Remove it to continue.`);
  }

  if (cart.requiresShipping && !request.shipping?.line1) {
    throw new Error('A shipping address is required for physical items.');
  }

  const order = await createPendingOrder({
    cart,
    userId: request.user?.id ?? null,
    email: request.email,
    shipping: request.shipping ?? null,
    currency: env.STRIPE_CURRENCY,
  });

  let customerId: string | null = null;
  if (request.user) {
    const dbUser = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: { stripeCustomerId: true, name: true, email: true },
    });
    customerId = await provider.ensureCustomer({
      email: dbUser?.email ?? request.email,
      name: dbUser?.name,
      userId: request.user.id,
      existingId: dbUser?.stripeCustomerId ?? null,
    });
    if (customerId !== dbUser?.stripeCustomerId) {
      await prisma.user.update({
        where: { id: request.user.id },
        data: { stripeCustomerId: customerId },
      });
    }
  }

  const lineItems = cart.lines.map((line) => ({
    name: line.variantLabel ? `${line.title} (${line.variantLabel})` : line.title,
    unitAmountCents: line.unitPriceCents,
    quantity: line.quantity,
    imageUrl: line.imageUrl ?? undefined,
  }));

  if (cart.totals.shippingCents > 0) {
    lineItems.push({
      name: 'Shipping',
      unitAmountCents: cart.totals.shippingCents,
      quantity: 1,
      imageUrl: undefined,
    });
  }

  const session = await provider.createCheckoutSession({
    mode: 'payment',
    referenceId: order.id,
    customerEmail: customerId ? undefined : request.email,
    customerId,
    lineItems,
    currency: order.currency,
    successUrl: `${appUrl}/checkout/success?order=${order.orderNumber}&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${appUrl}/cart?canceled=1`,
    metadata: { orderId: order.id, orderNumber: order.orderNumber, kind: 'order' },
    idempotencyKey: `order_${order.id}`,
  });

  await track({
    name: 'checkout_started',
    userId: request.user?.id ?? null,
    entityType: 'order',
    entityId: order.id,
    metadata: { totalCents: order.totalCents },
  });

  return { redirectUrl: session.url, orderId: order.id };
}
