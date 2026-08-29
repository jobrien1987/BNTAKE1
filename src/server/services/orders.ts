import 'server-only';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { calculateTotals } from '@/lib/money';
import { formatCentsExact } from '@/lib/money';
import { grantEntitlementsForOrderItems } from './entitlements';
import { notify } from './notifications';
import { sendOrderReceiptEmail } from './email';
import { track } from './analytics';
import { recordAudit } from '@/server/audit';
import type { CartView } from './cart';
import type { Order, Prisma } from '@prisma/client';

export function generateOrderNumber() {
  const date = new Date();
  const stamp = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(
    date.getUTCDate(),
  ).padStart(2, '0')}`;
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `BN-${stamp}-${random}`;
}

export interface CreateOrderInput {
  cart: CartView;
  userId: string | null;
  email: string;
  shipping?: {
    name?: string | null;
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;
  currency?: string;
}

/**
 * Creates a PENDING order from a re-priced cart. Item snapshots mean later
 * edits to a product never rewrite history.
 */
export async function createPendingOrder(input: CreateOrderInput): Promise<Order> {
  if (input.cart.lines.length === 0) throw new Error('Cannot create an order with no items.');

  const totals = calculateTotals({
    subtotalCents: input.cart.lines.reduce((sum, line) => sum + line.lineTotalCents, 0),
    requiresShipping: input.cart.requiresShipping,
  });

  return prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      userId: input.userId,
      email: input.email.toLowerCase(),
      status: 'PENDING',
      currency: input.currency ?? 'usd',
      subtotalCents: totals.subtotalCents,
      shippingCents: totals.shippingCents,
      taxCents: totals.taxCents,
      discountCents: totals.discountCents,
      totalCents: totals.totalCents,
      requiresShipping: input.cart.requiresShipping,
      shippingName: input.shipping?.name ?? null,
      shippingLine1: input.shipping?.line1 ?? null,
      shippingLine2: input.shipping?.line2 ?? null,
      shippingCity: input.shipping?.city ?? null,
      shippingState: input.shipping?.state ?? null,
      shippingPostal: input.shipping?.postalCode ?? null,
      shippingCountry: input.shipping?.country ?? null,
      items: {
        create: input.cart.lines.map((line) => ({
          kind: line.kind,
          refId: line.refId,
          productId: line.productId,
          variantId: line.variantId,
          titleSnapshot: line.title,
          variantSnapshot: line.variantLabel,
          imageSnapshot: line.imageUrl,
          skuSnapshot: line.sku,
          unitPriceCents: line.unitPriceCents,
          quantity: line.quantity,
          totalCents: line.lineTotalCents,
          requiresShipping: line.requiresShipping,
        })),
      },
    },
  });
}

export interface MarkPaidInput {
  orderId: string;
  paymentRef: string;
  paymentIntentId?: string | null;
  shipping?: CreateOrderInput['shipping'];
  amountTotalCents?: number | null;
}

/**
 * Idempotent transition to PAID: decrements inventory, grants entitlements and
 * clears the cart. Safe to call twice for the same Stripe event.
 */
export async function markOrderPaid(input: MarkPaidInput) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { items: true },
  });
  if (!order) throw new Error(`Order not found: ${input.orderId}`);
  if (order.status !== 'PENDING') return order; // already processed

  const updated = await prisma.$transaction(async (tx) => {
    // Inventory is only ever decremented at payment time, never on add-to-cart.
    for (const item of order.items) {
      if (item.kind !== 'PRODUCT' || !item.productId) continue;

      if (item.variantId) {
        const result = await tx.productVariant.updateMany({
          where: { id: item.variantId, inventory: { gte: item.quantity } },
          data: { inventory: { decrement: item.quantity } },
        });
        if (result.count === 0) {
          await tx.productVariant.updateMany({
            where: { id: item.variantId },
            data: { inventory: 0 },
          });
        }
      }

      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { trackInventory: true, inventory: true },
      });
      if (product?.trackInventory) {
        const result = await tx.product.updateMany({
          where: { id: item.productId, inventory: { gte: item.quantity } },
          data: { inventory: { decrement: item.quantity } },
        });
        if (result.count === 0) {
          await tx.product.updateMany({ where: { id: item.productId }, data: { inventory: 0 } });
        }
      }
    }

    if (order.userId) {
      await grantEntitlementsForOrderItems(
        order.userId,
        order.id,
        order.items.map((item) => ({ kind: item.kind, refId: item.refId })),
        tx,
      );
    }

    const requiresFulfilment = order.items.some((item) => item.requiresShipping);

    return tx.order.update({
      where: { id: order.id },
      data: {
        status: requiresFulfilment ? 'PROCESSING' : 'PAID',
        paidAt: new Date(),
        paymentRef: input.paymentRef,
        paymentIntentId: input.paymentIntentId ?? null,
        shippingName: input.shipping?.name ?? order.shippingName,
        shippingLine1: input.shipping?.line1 ?? order.shippingLine1,
        shippingLine2: input.shipping?.line2 ?? order.shippingLine2,
        shippingCity: input.shipping?.city ?? order.shippingCity,
        shippingState: input.shipping?.state ?? order.shippingState,
        shippingPostal: input.shipping?.postalCode ?? order.shippingPostal,
        shippingCountry: input.shipping?.country ?? order.shippingCountry,
      },
      include: { items: true },
    });
  });

  const cart = await prisma.cart.findFirst({
    where: order.userId ? { userId: order.userId } : { id: '__none__' },
  });
  if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  await track({
    name: 'purchase',
    userId: order.userId,
    entityType: 'order',
    entityId: order.id,
    metadata: { totalCents: order.totalCents, itemCount: order.items.length },
  });

  if (order.userId) {
    await notify({
      userId: order.userId,
      type: 'ORDER',
      title: `Order ${order.orderNumber} confirmed`,
      body: `Total ${formatCentsExact(order.totalCents, order.currency)}`,
      href: `/account/orders`,
    });
  }

  await sendOrderReceiptEmail(
    order.email,
    order.orderNumber,
    formatCentsExact(order.totalCents, order.currency),
  ).catch(() => undefined);

  await recordAudit({
    action: 'order.paid',
    entityType: 'Order',
    entityId: order.id,
    metadata: { orderNumber: order.orderNumber, totalCents: order.totalCents },
  });

  return updated;
}

export async function markOrderRefunded(paymentIntentId: string, amountRefundedCents: number) {
  const order = await prisma.order.findFirst({ where: { paymentIntentId } });
  if (!order) return null;
  const fullyRefunded = amountRefundedCents >= order.totalCents;
  return prisma.order.update({
    where: { id: order.id },
    data: {
      refundedCents: amountRefundedCents,
      status: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
    },
  });
}

export function orderInclude(): Prisma.OrderInclude {
  return { items: true, user: { select: { id: true, name: true, email: true } } };
}
