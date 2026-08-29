import 'server-only';
import { prisma } from '@/lib/prisma';
import { appUrl } from '@/lib/env';
import { paymentProvider, PaymentsNotConfiguredError } from './payments';
import { notify } from './notifications';
import { track } from './analytics';
import { recordAudit } from '@/server/audit';
import type { SessionUser } from '@/server/auth/session';
import type { Plan, SubscriptionStatus } from '@prisma/client';

export async function listPlans(kind: 'FAN' | 'CREATOR') {
  return prisma.plan.findMany({
    where: { kind, visible: true, active: true },
    orderBy: { position: 'asc' },
  });
}

export async function getActiveSubscription(userId: string, kind: 'FAN' | 'CREATOR' = 'FAN') {
  return prisma.subscription.findFirst({
    where: { userId, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] }, plan: { kind } },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });
}

export class PlanNotPurchasableError extends Error {
  constructor(plan: Plan) {
    super(
      plan.priceCents === 0
        ? 'This tier is free — no checkout required.'
        : `The ${plan.name} plan has no Stripe price configured yet.`,
    );
    this.name = 'PlanNotPurchasableError';
  }
}

export async function startSubscriptionCheckout(user: SessionUser, planId: string) {
  const provider = paymentProvider();
  if (!provider.isConfigured()) throw new PaymentsNotConfiguredError();

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan || !plan.active) throw new Error('That plan is not available.');
  if (plan.priceCents === 0 || !plan.stripePriceId) throw new PlanNotPurchasableError(plan);

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { stripeCustomerId: true, email: true, name: true },
  });
  if (!dbUser) throw new Error('Account not found.');

  const customerId = await provider.ensureCustomer({
    email: dbUser.email,
    name: dbUser.name,
    userId: user.id,
    existingId: dbUser.stripeCustomerId,
  });
  if (customerId !== dbUser.stripeCustomerId) {
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }

  const returnPath = plan.kind === 'CREATOR' ? '/creator' : '/account/membership';

  const session = await provider.createCheckoutSession({
    mode: 'subscription',
    referenceId: user.id,
    customerId,
    priceId: plan.stripePriceId,
    currency: plan.currency,
    successUrl: `${appUrl}${returnPath}?subscribed=1`,
    cancelUrl: `${appUrl}${returnPath}?canceled=1`,
    metadata: { userId: user.id, planId: plan.id, planKey: plan.key, kind: 'subscription' },
  });

  await track({
    name: 'subscription_started',
    userId: user.id,
    entityType: 'plan',
    entityId: plan.id,
  });

  return session.url;
}

export async function openBillingPortal(userId: string, returnPath = '/account/membership') {
  const provider = paymentProvider();
  if (!provider.isConfigured()) throw new PaymentsNotConfiguredError();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });
  if (!user?.stripeCustomerId) throw new Error('No billing account yet.');
  const session = await provider.createBillingPortalSession(
    user.stripeCustomerId,
    `${appUrl}${returnPath}`,
  );
  return session.url;
}

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: 'ACTIVE',
  trialing: 'TRIALING',
  past_due: 'PAST_DUE',
  canceled: 'CANCELED',
  unpaid: 'PAST_DUE',
  incomplete: 'INCOMPLETE',
  incomplete_expired: 'EXPIRED',
  paused: 'CANCELED',
};

export interface SubscriptionSyncInput {
  stripeSubscriptionId: string;
  stripeCustomerId: string | null;
  status: string;
  currentPeriodStart: number | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: number | null;
  metadata: Record<string, string | undefined>;
  priceId: string | null;
}

/** Stripe is the source of truth for subscription state; we mirror it. */
export async function syncSubscription(input: SubscriptionSyncInput) {
  const status = STATUS_MAP[input.status] ?? 'INCOMPLETE';

  let plan = input.metadata.planId
    ? await prisma.plan.findUnique({ where: { id: input.metadata.planId } })
    : null;
  if (!plan && input.priceId) {
    plan = await prisma.plan.findFirst({ where: { stripePriceId: input.priceId } });
  }
  if (!plan) {
    console.error('[subscriptions] could not resolve plan for subscription', input.stripeSubscriptionId);
    return null;
  }

  let userId = input.metadata.userId ?? null;
  if (!userId && input.stripeCustomerId) {
    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: input.stripeCustomerId },
      select: { id: true },
    });
    userId = user?.id ?? null;
  }
  if (!userId) {
    console.error('[subscriptions] could not resolve user for subscription', input.stripeSubscriptionId);
    return null;
  }

  const subscription = await prisma.subscription.upsert({
    where: { stripeSubscriptionId: input.stripeSubscriptionId },
    create: {
      userId,
      planId: plan.id,
      status,
      stripeSubscriptionId: input.stripeSubscriptionId,
      stripeCustomerId: input.stripeCustomerId,
      currentPeriodStart: input.currentPeriodStart ? new Date(input.currentPeriodStart * 1000) : null,
      currentPeriodEnd: input.currentPeriodEnd ? new Date(input.currentPeriodEnd * 1000) : null,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      canceledAt: input.canceledAt ? new Date(input.canceledAt * 1000) : null,
    },
    update: {
      planId: plan.id,
      status,
      stripeCustomerId: input.stripeCustomerId,
      currentPeriodStart: input.currentPeriodStart ? new Date(input.currentPeriodStart * 1000) : null,
      currentPeriodEnd: input.currentPeriodEnd ? new Date(input.currentPeriodEnd * 1000) : null,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      canceledAt: input.canceledAt ? new Date(input.canceledAt * 1000) : null,
      endedAt: status === 'CANCELED' || status === 'EXPIRED' ? new Date() : null,
    },
  });

  await applyPlanSideEffects(userId, plan, status);

  return subscription;
}

/**
 * Creator plans grant the matching role while the subscription is live and
 * remove it when billing lapses. Staff roles are never downgraded here.
 */
async function applyPlanSideEffects(userId: string, plan: Plan, status: SubscriptionStatus) {
  if (plan.kind !== 'CREATOR') return;
  const active = status === 'ACTIVE' || status === 'TRIALING';

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return;
  const isStaffRole = ['EDITOR', 'MODERATOR', 'ADMIN', 'OWNER'].includes(user.role);

  if (active) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isCreator: true,
        role: isStaffRole ? user.role : plan.key === 'ARTIST_PRO' ? 'ARTIST_PRO' : 'ARTIST',
      },
    });
    await prisma.creatorProfile.updateMany({
      where: { userId },
      data: {
        tier: plan.key === 'ARTIST_PRO' ? 'ARTIST_PRO' : 'ARTIST',
        status: 'APPROVED',
        approvedAt: new Date(),
      },
    });
    await notify({
      userId,
      type: 'SUBSCRIPTION',
      title: `${plan.name} is active`,
      body: 'Your creator tools are unlocked.',
      href: '/creator',
    });
  } else if (status === 'CANCELED' || status === 'EXPIRED') {
    await prisma.user.update({
      where: { id: userId },
      data: { isCreator: false, role: isStaffRole ? user.role : 'USER' },
    });
    await prisma.creatorProfile.updateMany({ where: { userId }, data: { status: 'SUSPENDED' } });
  }

  await recordAudit({
    actorId: userId,
    action: 'subscription.synced',
    entityType: 'Subscription',
    entityId: plan.id,
    metadata: { planKey: plan.key, status },
  });
}

export async function markSubscriptionDeleted(stripeSubscriptionId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
    include: { plan: true },
  });
  if (!subscription) return;
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: 'CANCELED', endedAt: new Date() },
  });
  await applyPlanSideEffects(subscription.userId, subscription.plan, 'CANCELED');
}
