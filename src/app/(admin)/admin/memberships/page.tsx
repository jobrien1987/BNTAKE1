import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/server/auth/guards';
import { flags } from '@/lib/env';
import { PlanForm } from '@/components/admin/plan-form';
import { AdminPageHeader } from '@/components/admin/admin-shell';
import { Alert, EmptyState, Stat } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Memberships',
  robots: { index: false, follow: false },
};

export default async function AdminMembershipsPage() {
  await requirePermission('memberships.manage');

  const [plans, subscriptionCounts] = await Promise.all([
    prisma.plan.findMany({ orderBy: [{ kind: 'asc' }, { position: 'asc' }] }),
    prisma.subscription.groupBy({
      by: ['planId'],
      where: { status: { in: ['ACTIVE', 'TRIALING'] } },
      _count: { _all: true },
    }),
  ]);

  const countByPlan = new Map(
    subscriptionCounts.map((entry) => [entry.planId, entry._count._all] as const),
  );

  const fanPlans = plans.filter((plan) => plan.kind === 'FAN');
  const creatorPlans = plans.filter((plan) => plan.kind === 'CREATOR');

  return (
    <div>
      <AdminPageHeader
        eyebrow="Commerce"
        title="Membership plans"
        description="Prices and capabilities are stored here, never hardcoded. Changing a price affects new checkouts; existing subscribers keep the price they signed up at until Stripe changes it."
      />

      {!flags.stripeEnabled ? (
        <div className="mb-8">
          <Alert tone="warn">
            Payments are not configured, so plans cannot be sold. You can still edit them.
          </Alert>
        </div>
      ) : null}

      {plans.length === 0 ? (
        <EmptyState
          title="No plans configured"
          description="Run the seed script to create the default plan structure."
        />
      ) : (
        <div className="space-y-12">
          <section>
            <h2 className="eyebrow mb-4">Fan plans</h2>
            <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {fanPlans.map((plan) => (
                <Stat
                  key={plan.id}
                  label={plan.name}
                  value={String(countByPlan.get(plan.id) ?? 0)}
                  hint="active"
                />
              ))}
            </div>
            <div className="space-y-6">
              {fanPlans.map((plan) => (
                <PlanForm
                  key={plan.id}
                  plan={{
                    ...plan,
                    tagline: plan.tagline ?? '',
                    stripePriceId: plan.stripePriceId ?? '',
                  }}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="eyebrow mb-4">Creator plans</h2>
            <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {creatorPlans.map((plan) => (
                <Stat
                  key={plan.id}
                  label={plan.name}
                  value={String(countByPlan.get(plan.id) ?? 0)}
                  hint="active"
                />
              ))}
            </div>
            <div className="space-y-6">
              {creatorPlans.map((plan) => (
                <PlanForm
                  key={plan.id}
                  plan={{
                    ...plan,
                    tagline: plan.tagline ?? '',
                    stripePriceId: plan.stripePriceId ?? '',
                  }}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
