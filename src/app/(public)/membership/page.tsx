import type { Metadata } from 'next';
import { listPlans } from '@/server/services/subscriptions';
import { getCurrentUser } from '@/server/auth/session';
import { getActiveSubscription } from '@/server/services/subscriptions';
import { paymentsEnabled } from '@/server/services/payments';
import { SubscribeButton } from '@/components/account/membership-actions';
import { Alert, Badge, SectionHeader } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Membership — join the network',
  description:
    'Boosie Network membership: the member library, early access, a shop discount and more. Plus creator plans for artists releasing music.',
  alternates: { canonical: '/membership' },
  openGraph: { title: 'Membership | Boosie Network', url: '/membership' },
};

export default async function MembershipPage() {
  const [fanPlans, creatorPlans, user] = await Promise.all([
    listPlans('FAN'),
    listPlans('CREATOR'),
    getCurrentUser(),
  ]);

  const subscription = user ? await getActiveSubscription(user.id) : null;
  const canPay = paymentsEnabled();

  return (
    <div className="container-page py-12 sm:py-16">
      <header className="mb-12 border-b border-ink-700 pb-8">
        <p className="eyebrow">Boosie Network</p>
        <h1 className="mt-3 text-5xl leading-none sm:text-7xl">MEMBERSHIP</h1>
        <p className="mt-4 max-w-2xl text-base text-bone-muted">
          Everything free stays free. Membership adds the member library, early access and a
          standing discount in the shop — and anything you buy outright is yours whether you stay a
          member or not.
        </p>
      </header>

      {!canPay ? (
        <div className="mb-10">
          <Alert tone="warn">
            Memberships cannot be purchased right now because payments have not been configured for
            this deployment.
          </Alert>
        </div>
      ) : null}

      <section className="mb-20">
        <SectionHeader eyebrow="For listeners" title="Fan plans" />

        <div className="grid gap-6 lg:grid-cols-3">
          {fanPlans.map((plan) => {
            const isCurrent = subscription?.planId === plan.id;
            const highlight = plan.key === 'INSIDER';

            return (
              <article
                key={plan.id}
                className={cn(
                  'panel flex flex-col p-6',
                  highlight && 'border-gold-600/60 shadow-gold',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-2xl uppercase tracking-tight text-bone">
                    {plan.name}
                  </h3>
                  {isCurrent ? <Badge tone="gold">Your plan</Badge> : null}
                  {!isCurrent && highlight ? <Badge tone="gold">Most popular</Badge> : null}
                </div>

                <p className="mt-4 font-display text-4xl text-gold-400">
                  {plan.priceCents === 0 ? 'Free' : formatCents(plan.priceCents)}
                  {plan.priceCents > 0 ? (
                    <span className="text-sm text-bone-dim"> /{plan.interval}</span>
                  ) : null}
                </p>

                {plan.tagline ? (
                  <p className="mt-2 text-sm text-bone-dim">{plan.tagline}</p>
                ) : null}

                {plan.perks.length > 0 ? (
                  <ul className="mt-6 flex-1 space-y-2 border-t border-ink-700 pt-5 text-sm text-bone-muted">
                    {plan.perks.map((perk) => (
                      <li key={perk} className="flex gap-2">
                        <span aria-hidden className="text-gold-500">
                          —
                        </span>
                        {perk}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex-1" />
                )}

                <div className="mt-6">
                  {isCurrent ? (
                    <ButtonLink href="/account/membership" variant="outline" className="w-full">
                      Manage plan
                    </ButtonLink>
                  ) : plan.priceCents === 0 ? (
                    user ? (
                      <p className="text-center text-xs uppercase tracking-[0.16em] text-bone-dim">
                        Included with your account
                      </p>
                    ) : (
                      <ButtonLink href="/register" variant="outline" className="w-full">
                        Create a free account
                      </ButtonLink>
                    )
                  ) : !user ? (
                    <ButtonLink
                      href={`/login?returnTo=${encodeURIComponent('/membership')}`}
                      className="w-full"
                    >
                      Sign in to join
                    </ButtonLink>
                  ) : canPay && plan.stripePriceId ? (
                    <SubscribeButton planId={plan.id} label={`Join ${plan.name}`} />
                  ) : (
                    <p className="text-center text-xs text-bone-dim">Not available yet.</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeader
          eyebrow="For artists"
          title="Creator plans"
          description="Release music on the network, sell merch through our fulfilment, and see how your catalogue performs."
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {creatorPlans.map((plan) => (
            <article key={plan.id} className="panel flex flex-col p-6">
              <h3 className="font-display text-2xl uppercase tracking-tight text-bone">
                {plan.name}
              </h3>

              <p className="mt-4 font-display text-4xl text-gold-400">
                {plan.priceCents === 0 ? 'Free' : formatCents(plan.priceCents)}
                {plan.priceCents > 0 ? (
                  <span className="text-sm text-bone-dim"> /{plan.interval}</span>
                ) : null}
              </p>

              {plan.tagline ? <p className="mt-2 text-sm text-bone-dim">{plan.tagline}</p> : null}

              {plan.perks.length > 0 ? (
                <ul className="mt-6 flex-1 space-y-2 border-t border-ink-700 pt-5 text-sm text-bone-muted">
                  {plan.perks.map((perk) => (
                    <li key={perk} className="flex gap-2">
                      <span aria-hidden className="text-gold-500">
                        —
                      </span>
                      {perk}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex-1" />
              )}

              <div className="mt-6">
                <ButtonLink href="/creator/join" variant="outline" className="w-full">
                  Apply as a creator
                </ButtonLink>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-6 max-w-2xl text-sm text-bone-dim">
          Creator applications are reviewed by hand. Billing only starts once you have been approved
          and chosen a plan.
        </p>
      </section>
    </div>
  );
}
