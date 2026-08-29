import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/guards';
import { getLibrary, hasActiveMembership } from '@/server/services/entitlements';
import { unreadCount } from '@/server/services/notifications';
import { Stat, SectionHeader, EmptyState, Badge } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { MediaFrame } from '@/components/ui/media-frame';
import { formatCents } from '@/lib/money';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Account overview',
  robots: { index: false, follow: false },
};

export default async function AccountOverviewPage() {
  const user = await requireUser('/account');

  const [library, membership, unread, recentOrders, followingCount] = await Promise.all([
    getLibrary(user.id),
    hasActiveMembership(user.id),
    unreadCount(user.id),
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { items: { take: 1 } },
    }),
    prisma.artistFollow.count({ where: { userId: user.id } }),
  ]);

  return (
    <div className="space-y-12">
      <section>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="In your library" value={String(library.total)} />
          <Stat label="Orders" value={String(recentOrders.length)} hint="Most recent" />
          <Stat label="Artists followed" value={String(followingCount)} />
          <Stat label="Unread" value={String(unread)} hint="Notifications" />
        </div>
      </section>

      <section>
        <SectionHeader
          eyebrow="Membership"
          title={membership ? membership.plan.name : 'No active membership'}
          href="/account/membership"
          hrefLabel="Manage"
        />
        {membership ? (
          <div className="panel p-6">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="gold">{membership.status}</Badge>
              <span className="text-sm text-bone-muted">
                {formatCents(membership.plan.priceCents)} / {membership.plan.interval}
              </span>
            </div>
            {membership.currentPeriodEnd ? (
              <p className="mt-3 text-sm text-bone-dim">
                {membership.cancelAtPeriodEnd ? 'Ends' : 'Renews'}{' '}
                {formatDate(membership.currentPeriodEnd)}
              </p>
            ) : null}
          </div>
        ) : (
          <EmptyState
            title="You're on the free tier"
            description="Membership unlocks the member library, early access and a shop discount."
            action={<ButtonLink href="/membership">See membership options</ButtonLink>}
          />
        )}
      </section>

      <section>
        <SectionHeader
          eyebrow="Recently bought"
          title="Your orders"
          href="/account/orders"
          hrefLabel="All orders"
        />
        {recentOrders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="Anything you buy — merch, music, movies — shows up here."
            action={<ButtonLink href="/shop">Visit the shop</ButtonLink>}
          />
        ) : (
          <ul className="divide-y divide-ink-700 border-y border-ink-700">
            {recentOrders.map((order) => (
              <li key={order.id}>
                <Link href="/account/orders" className="group flex items-center gap-4 py-4">
                  <MediaFrame
                    src={order.items[0]?.imageSnapshot}
                    alt={order.items[0]?.titleSnapshot ?? order.orderNumber}
                    seed={order.orderNumber}
                    ratio="square"
                    className="h-14 w-14 shrink-0 border border-ink-600"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-bone transition-colors group-hover:text-gold-300">
                      {order.orderNumber}
                    </p>
                    <p className="text-xs text-bone-dim">{formatDate(order.createdAt)}</p>
                  </div>
                  <Badge>{order.status}</Badge>
                  <span className="shrink-0 text-sm tabular-nums text-bone">
                    {formatCents(order.totalCents)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
