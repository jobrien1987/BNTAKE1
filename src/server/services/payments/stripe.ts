import 'server-only';
import Stripe from 'stripe';
import { env } from '@/lib/env';
import {
  PaymentsNotConfiguredError,
  type CheckoutSession,
  type CreateCheckoutInput,
  type PaymentProvider,
  type ProviderEvent,
  type ProviderEventType,
} from './types';

let client: Stripe | null = null;

export function stripeClient(): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new PaymentsNotConfiguredError();
  if (!client) {
    client = new Stripe(env.STRIPE_SECRET_KEY, { typescript: true, maxNetworkRetries: 2 });
  }
  return client;
}

const EVENT_MAP: Record<string, ProviderEventType> = {
  'checkout.session.completed': 'checkout.completed',
  'checkout.session.async_payment_succeeded': 'checkout.completed',
  'customer.subscription.created': 'subscription.updated',
  'customer.subscription.updated': 'subscription.updated',
  'customer.subscription.deleted': 'subscription.deleted',
  'invoice.paid': 'invoice.paid',
  'invoice.payment_failed': 'invoice.payment_failed',
  'charge.refunded': 'charge.refunded',
};

export const stripeProvider: PaymentProvider = {
  id: 'stripe',

  isConfigured() {
    return Boolean(env.STRIPE_SECRET_KEY);
  },

  async ensureCustomer({ email, name, userId, existingId }) {
    const stripe = stripeClient();
    if (existingId) return existingId;
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: { userId },
    });
    return customer.id;
  },

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const stripe = stripeClient();

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = input.priceId
      ? [{ price: input.priceId, quantity: 1 }]
      : (input.lineItems ?? []).map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: input.currency,
            unit_amount: item.unitAmountCents,
            product_data: {
              name: item.name,
              ...(item.description ? { description: item.description } : {}),
              ...(item.imageUrl && item.imageUrl.startsWith('http') ? { images: [item.imageUrl] } : {}),
            },
          },
        }));

    if (lineItems.length === 0) {
      throw new Error('Cannot create a checkout session with no line items.');
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: input.mode,
        line_items: lineItems,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        client_reference_id: input.referenceId,
        metadata: input.metadata,
        ...(input.customerId
          ? { customer: input.customerId }
          : input.customerEmail
            ? { customer_email: input.customerEmail }
            : {}),
        ...(input.collectShipping
          ? { shipping_address_collection: { allowed_countries: ['US', 'CA'] } }
          : {}),
        ...(input.mode === 'subscription'
          ? { subscription_data: { metadata: input.metadata } }
          : { payment_intent_data: { metadata: input.metadata } }),
      },
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
    );

    if (!session.url) throw new Error('Stripe did not return a checkout URL.');
    return { id: session.id, url: session.url };
  },

  async createBillingPortalSession(customerId: string, returnUrl: string) {
    const stripe = stripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  },

  async parseWebhook(payload: string, signature: string | null): Promise<ProviderEvent> {
    const stripe = stripeClient();
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
    }
    if (!signature) throw new Error('Missing Stripe signature header.');

    const event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);

    return {
      id: event.id,
      rawType: event.type,
      type: EVENT_MAP[event.type] ?? 'unhandled',
      data: event.data.object as unknown as Record<string, unknown>,
    };
  },
};
