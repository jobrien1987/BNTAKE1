import type { Metadata } from 'next';
import { requireUser } from '@/server/auth/guards';
import { getActiveSubscription, listPlans } from '@/server/services/subscriptions';
import { paymentsEnabled } from '@/server/services/payments';
import { SubscribeButton, ManageBillingButton } from '@/components/account/membership-actions';
import { Alert, Badge, SectionHeader, Stat } from '@/components/ui/primitives';
import { formatCents } from '@/lib/money';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your membership',
  robots: { index: false, follow: false },
};

export default async function MembershipPage({
  searchParams,
}: {
  searchParams: Promise<{ subscribed?: string; canceled?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser('/account/membership');

  const [subscription, plans] = await Promise.all([
    getActiveSubscription(user.id),
    listPlans('FAN'),
  ]);

  const canPay = paymentsEnabled();

  return (
    <div className="space-y-12">
      {params.subscribed ? (
        <Alert tone="success" title="You're in">
          Your membership is being activated. It can take a few seconds for the confirmation to
          arrive from our payment processor — refresh if it isn&rsquo;t showing yet.
        </Alert>
      ) : null}
      {params.canceled ? (
        <Alert tone="info">Checkout was cancelled. Nothing has been charged.</Alert>
      ) : null}

      {!canPay ? (
        <Alert tone="warn">
          Memberships cannot be purchased because payments have not been configured for this
          deployment.
        </Alert>
      ) : null}

      <section>
        <SectionHeader
          eyebrow="Current plan"
          title={subscription ? subscription.plan.name : 'Free'}
          description={
            subscription
              ? undefined
              : 'You have full access to everything free on the network. Membership adds the member library and more.'
          }
        />

        {subscription ? (
          <div className="panel p-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="Status" value={subscription.status} />
              <Stat
                label="Price"
                value={`${formatCents(subscription.plan.priceCents)}/${subscription.plan.interval}`}
              />
              <Stat
                label={subscription.cancelAtPeriodEnd ? 'Ends' : 'Renews'}
                value={
                  subscription.currentPeriodEnd
                    ? formatDate(subscription.currentPeriodEnd)
                    : 'Unknown'
                }
              />
            </div>

            {subscription.cancelAtPeriodEnd ? (
              <div className="mt-5">
                <Alert tone="warn">
                  Your membership is set to end at the close of the current period. You keep access
                  until then, and anything you bought outright stays in your library either way.
                </Alert>
              </div>
            ) : null}

            {subscription.plan.perks.length > 0 ? (
              <ul className="mt-6 space-y-2 border-t border-ink-700 pt-5 text-sm text-bone-muted">
                {subscription.plan.perks.map((perk) => (
                  <li key={perk}>{perk}</li>
                ))}
              </ul>
            ) : null}

            {canPay ? (
              <div className="mt-6">
                <ManageBillingButton />
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section>
        <SectionHeader
          eyebrow="Plans"
          title={subscription ? 'Change your plan' : 'Choose a plan'}
        />

        <div className="grid gap-6 sm:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = subscription?.planId === plan.id;

            return (
              <article
                key={plan.id}
                className={
                  isCurrent
                    ? 'panel border-gold-600/60 p-6'
                    : 'panel p-6'
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-xl uppercase tracking-tight text-bone">
                    {plan.name}
                  </h3>
                  {isCurrent ? <Badge tone="gold">Current</Badge> : null}
                </div>

                <p className="mt-3 font-display text-3xl text-gold-400">
                  {plan.priceCents === 0 ? 'Free' : formatCents(plan.priceCents)}
                  {plan.priceCents > 0 ? (
                    <span className="text-sm text-bone-dim"> /{plan.interval}</span>
                  ) : null}
                </p>

                {plan.tagline ? (
                  <p className="mt-2 text-sm text-bone-dim">{plan.tagline}</p>
                ) : null}

                {plan.perks.length > 0 ? (
                  <ul className="mt-5 space-y-2 text-sm text-bone-muted">
                    {plan.perks.map((perk) => (
                      <li key={perk}>{perk}</li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-6">
                  {isCurrent ? (
                    <p className="text-center text-xs uppercase tracking-[0.16em] text-bone-dim">
                      Your current plan
                    </p>
                  ) : plan.priceCents === 0 ? (
                    <p className="text-center text-xs uppercase tracking-[0.16em] text-bone-dim">
                      Included by default
                    </p>
                  ) : canPay && plan.stripePriceId ? (
                    <SubscribeButton
                      planId={plan.id}
                      label={subscription ? 'Switch to this plan' : `Join ${plan.name}`}
                    />
                  ) : (
                    <p className="text-center text-xs text-bone-dim">
                      Not available for purchase yet.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
