import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { paymentProvider, paymentsEnabled } from '@/server/services/payments';
import { markOrderPaid, markOrderRefunded } from '@/server/services/orders';
import { markSubscriptionDeleted, syncSubscription } from '@/server/services/subscriptions';
import { notify } from '@/server/services/notifications';
import { recordDonation } from '@/server/services/donations';
import type { ProviderEvent } from '@/server/services/payments';

export const dynamic = 'force-dynamic';
// Signature verification needs the byte-exact body, so this route must not be
// parsed or cached by the framework.
export const runtime = 'nodejs';

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asStringRecord(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(asRecord(value))) {
    if (typeof entry === 'string') out[key] = entry;
  }
  return out;
}

export async function POST(request: Request) {
  if (!paymentsEnabled()) {
    return NextResponse.json({ error: 'Payments are not configured.' }, { status: 503 });
  }

  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event;
  try {
    event = await paymentProvider().parseWebhook(payload, signature);
  } catch (error) {
    console.error('[stripe] signature verification failed', error);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  // Idempotency: Stripe retries aggressively, and every handler below writes
  // money-adjacent state. Recording the event id first means a retry is a
  // no-op rather than a double grant.
  const alreadyProcessed = await prisma.webhookEvent.findUnique({ where: { id: event.id } });
  if (alreadyProcessed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handleEvent(event);
  } catch (error) {
    console.error(`[stripe] handler failed for ${event.rawType}`, error);
    // Returning 500 asks Stripe to retry; the event is deliberately not
    // recorded so the retry is allowed to run.
    return NextResponse.json({ error: 'Handler failed.' }, { status: 500 });
  }

  await prisma.webhookEvent
    .create({ data: { id: event.id, provider: 'stripe', type: event.rawType } })
    .catch(() => undefined);

  return NextResponse.json({ received: true });
}

async function handleEvent(event: ProviderEvent) {
  const data = asRecord(event.data);

  switch (event.type) {
    case 'checkout.completed': {
      const metadata = asStringRecord(data.metadata);

      // Subscription checkouts are finalised by the customer.subscription.*
      // events, which carry the full subscription object. Nothing to do here.
      if (
        metadata.purpose === 'subscription' ||
        metadata.kind === 'subscription' ||
        asString(data.subscription)
      ) {
        return;
      }

      if (metadata.purpose === 'donation') {
        const campaignId = metadata.campaignId;
        const amount = typeof data.amount_total === 'number' ? data.amount_total : 0;
        if (!campaignId || amount <= 0) {
          console.warn('[stripe] donation checkout missing campaign or amount', event.id);
          return;
        }

        await recordDonation({
          campaignId,
          amountCents: amount,
          paymentRef: asString(data.id) ?? event.id,
          email:
            asString(data.customer_email) ??
            asString(asRecord(data.customer_details).email),
          userId: metadata.userId || null,
          anonymous: metadata.anonymous === '1',
          message: metadata.message || null,
          currency: asString(data.currency) ?? 'usd',
        });
        return;
      }

      const orderId = metadata.orderId ?? asString(data.client_reference_id);
      if (!orderId) {
        console.warn('[stripe] checkout.completed without an order reference', event.id);
        return;
      }

      const shipping = asRecord(data.shipping_details);
      const address = asRecord(shipping.address);

      await markOrderPaid({
        orderId,
        paymentRef: asString(data.id) ?? event.id,
        paymentIntentId: asString(data.payment_intent),
        amountTotalCents: typeof data.amount_total === 'number' ? data.amount_total : null,
        shipping: {
          name: asString(shipping.name),
          line1: asString(address.line1),
          line2: asString(address.line2),
          city: asString(address.city),
          state: asString(address.state),
          postalCode: asString(address.postal_code),
          country: asString(address.country),
        },
      });
      return;
    }

    case 'subscription.updated': {
      // The data object here is the subscription itself.
      const subscriptionId = asString(data.id);
      if (!subscriptionId) return;

      await syncSubscription({
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: asString(data.customer),
        status: asString(data.status) ?? 'incomplete',
        currentPeriodStart:
          typeof data.current_period_start === 'number' ? data.current_period_start : null,
        currentPeriodEnd:
          typeof data.current_period_end === 'number' ? data.current_period_end : null,
        cancelAtPeriodEnd: data.cancel_at_period_end === true,
        canceledAt: typeof data.canceled_at === 'number' ? data.canceled_at : null,
        metadata: asStringRecord(data.metadata),
        priceId: firstPriceId(data),
      });
      return;
    }

    case 'subscription.deleted': {
      const subscriptionId = asString(data.id);
      if (subscriptionId) await markSubscriptionDeleted(subscriptionId);
      return;
    }

    case 'invoice.paid':
    case 'invoice.payment_failed': {
      // Renewals and failures both also emit customer.subscription.updated,
      // which is where state is mirrored. Invoices are only used to tell the
      // member that a payment needs attention.
      if (event.type !== 'invoice.payment_failed') return;

      const customerId = asString(data.customer);
      if (!customerId) return;

      const subscription = await prisma.subscription.findFirst({
        where: { stripeCustomerId: customerId },
        orderBy: { createdAt: 'desc' },
        select: { userId: true },
      });
      if (!subscription) return;

      await notify({
        userId: subscription.userId,
        type: 'SYSTEM',
        title: 'We could not process your membership payment',
        body: 'Update your payment method to keep your membership active.',
        href: '/account/membership',
      });
      return;
    }

    case 'charge.refunded': {
      const paymentIntentId = asString(data.payment_intent);
      const refunded = typeof data.amount_refunded === 'number' ? data.amount_refunded : 0;
      if (paymentIntentId) await markOrderRefunded(paymentIntentId, refunded);
      return;
    }

    default:
      // Unhandled types are acknowledged so Stripe stops retrying them.
      return;
  }
}

/** Pulls the price id out of a subscription's first line item, if present. */
function firstPriceId(subscription: Record<string, unknown>): string | null {
  const items = asRecord(subscription.items);
  const list = Array.isArray(items.data) ? items.data : [];
  const first = asRecord(list[0]);
  const price = asRecord(first.price);
  return asString(price.id);
}
