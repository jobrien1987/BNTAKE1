import 'server-only';
import { prisma } from '@/lib/prisma';
import { appUrl, env } from '@/lib/env';
import { paymentProvider, PaymentsNotConfiguredError } from '@/server/services/payments';
import type { SessionUser } from '@/server/auth/session';
import { notify } from '@/server/services/notifications';
import { recordAudit } from '@/server/audit';

export const DONATION_MIN_CENTS = 100;
export const DONATION_MAX_CENTS = 10_000_00;

export class DonationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DonationError';
  }
}

export interface DonationRequest {
  campaignId: string;
  amountCents: number;
  email: string;
  user: SessionUser | null;
  anonymous: boolean;
  message?: string | null;
}

/**
 * Starts a one-off donation payment. The amount is validated here rather than
 * trusted from the form, and the campaign total is only moved once the
 * processor confirms the payment via webhook.
 */
export async function startDonationCheckout(request: DonationRequest) {
  const provider = paymentProvider();
  if (!provider.isConfigured()) throw new PaymentsNotConfiguredError();

  if (
    !Number.isInteger(request.amountCents) ||
    request.amountCents < DONATION_MIN_CENTS ||
    request.amountCents > DONATION_MAX_CENTS
  ) {
    throw new DonationError('Enter a donation amount between $1 and $10,000.');
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: request.campaignId },
    select: { id: true, slug: true, title: true, status: true, donationEnabled: true },
  });

  if (!campaign) throw new DonationError('That campaign could not be found.');
  if (campaign.status !== 'ACTIVE' || !campaign.donationEnabled) {
    throw new DonationError('This campaign is not accepting donations right now.');
  }

  const session = await provider.createCheckoutSession({
    mode: 'payment',
    referenceId: campaign.id,
    customerEmail: request.email,
    currency: env.STRIPE_CURRENCY,
    successUrl: `${appUrl}/heartfelt/${campaign.slug}?donated=1`,
    cancelUrl: `${appUrl}/heartfelt/${campaign.slug}?canceled=1`,
    lineItems: [
      {
        name: `Donation — ${campaign.title}`,
        description: 'One-time donation to a Boosie Network Heartfelt campaign.',
        unitAmountCents: request.amountCents,
        quantity: 1,
      },
    ],
    metadata: {
      purpose: 'donation',
      campaignId: campaign.id,
      userId: request.user?.id ?? '',
      anonymous: request.anonymous ? '1' : '0',
      message: (request.message ?? '').slice(0, 200),
    },
  });

  return { redirectUrl: session.url };
}

/**
 * Records a confirmed donation. Idempotent on the processor's payment
 * reference, so a webhook retry cannot double-count a campaign total.
 */
export async function recordDonation(input: {
  campaignId: string;
  amountCents: number;
  paymentRef: string;
  email?: string | null;
  userId?: string | null;
  anonymous?: boolean;
  message?: string | null;
  currency?: string;
}) {
  const existing = await prisma.donation.findUnique({
    where: { paymentRef: input.paymentRef },
    select: { id: true },
  });
  if (existing) return existing;

  const donation = await prisma.$transaction(async (tx) => {
    const created = await tx.donation.create({
      data: {
        campaignId: input.campaignId,
        userId: input.userId || null,
        email: input.email || null,
        amountCents: input.amountCents,
        currency: input.currency ?? 'usd',
        anonymous: input.anonymous ?? false,
        message: input.message || null,
        paymentRef: input.paymentRef,
      },
    });

    await tx.campaign.update({
      where: { id: input.campaignId },
      data: { raisedCents: { increment: input.amountCents } },
    });

    return created;
  });

  if (input.userId) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: input.campaignId },
      select: { title: true, slug: true },
    });
    if (campaign) {
      await notify({
        userId: input.userId,
        type: 'SYSTEM',
        title: 'Thank you for your donation',
        body: `Your support for ${campaign.title} has been received.`,
        href: `/heartfelt/${campaign.slug}`,
      });
    }
  }

  await recordAudit({
    actorId: input.userId ?? null,
    action: 'donation.recorded',
    entityType: 'Campaign',
    entityId: input.campaignId,
    metadata: { amountCents: input.amountCents },
  });

  return donation;
}
