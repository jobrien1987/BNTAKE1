import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '@/server/auth/guards';
import { can } from '@/lib/rbac';
import { flags } from '@/lib/env';
import { AdminPageHeader } from '@/components/admin/admin-shell';
import { Alert, Badge, Stat } from '@/components/ui/primitives';
import { formatCents } from '@/lib/money';
import { formatDateTime, relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin dashboard',
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const user = await requireStaff('/admin');

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    userCount,
    newUsers,
    paidOrders,
    revenue,
    openReports,
    pendingCreators,
    inReviewSongs,
    activeSubs,
    recentOrders,
    recentAudit,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.order.count({ where: { status: { in: ['PAID', 'FULFILLED'] } } }),
    prisma.order.aggregate({
      where: { status: { in: ['PAID', 'FULFILLED'] }, paidAt: { gte: since } },
      _sum: { totalCents: true },
    }),
    prisma.report.count({ where: { status: 'OPEN' } }),
    prisma.creatorProfile.count({ where: { status: 'PENDING' } }),
    prisma.song.count({ where: { status: 'IN_REVIEW' } }),
    prisma.subscription.count({ where: { status: { in: ['ACTIVE', 'TRIALING'] } } }),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalCents: true,
        createdAt: true,
        email: true,
      },
    }),
    can(user.role, 'audit.read')
      ? prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: { actor: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const warnings: string[] = [];
  if (!flags.stripeEnabled) warnings.push('Payments are not configured — checkout is disabled.');
  if (flags.stripeEnabled && !flags.stripeWebhookConfigured) {
    warnings.push(
      'STRIPE_WEBHOOK_SECRET is missing — orders will never be marked paid and entitlements will not be granted.',
    );
  }
  if (!flags.storageRemote) {
    warnings.push('Storage is using the local disk fallback. Configure S3 for production.');
  }
  if (!flags.emailConfigured) {
    warnings.push('No email provider configured — password resets and receipts only log to console.');
  }

  return (
    <div>
      <AdminPageHeader
        eyebrow="Overview"
        title="Dashboard"
        description={`Signed in as ${user.name} (${user.role}).`}
      />

      {warnings.length > 0 ? (
        <div className="mb-8 space-y-3">
          {warnings.map((warning) => (
            <Alert key={warning} tone="warn" title="Configuration">
              {warning}
            </Alert>
          ))}
        </div>
      ) : null}

      <section className="mb-10">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Members" value={userCount.toLocaleString()} hint={`+${newUsers} in 30d`} />
          <Stat label="Active subs" value={activeSubs.toLocaleString()} />
          <Stat label="Paid orders" value={paidOrders.toLocaleString()} />
          <Stat
            label="Revenue (30d)"
            value={formatCents(revenue._sum.totalCents ?? 0)}
          />
          <Stat label="Open reports" value={String(openReports)} />
          <Stat label="Awaiting review" value={String(inReviewSongs + pendingCreators)} />
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="eyebrow mb-4">Needs attention</h2>
          <ul className="space-y-2 text-sm">
            {openReports > 0 ? (
              <TaskRow
                href="/admin/community"
                label={`${openReports} open moderation report${openReports === 1 ? '' : 's'}`}
              />
            ) : null}
            {pendingCreators > 0 ? (
              <TaskRow
                href="/admin/creators"
                label={`${pendingCreators} creator application${pendingCreators === 1 ? '' : 's'} pending`}
              />
            ) : null}
            {inReviewSongs > 0 ? (
              <TaskRow
                href="/admin/music"
                label={`${inReviewSongs} track${inReviewSongs === 1 ? '' : 's'} submitted for review`}
              />
            ) : null}
            {openReports === 0 && pendingCreators === 0 && inReviewSongs === 0 ? (
              <li className="text-bone-dim">Nothing waiting. The queue is clear.</li>
            ) : null}
          </ul>
        </section>

        <section>
          <h2 className="eyebrow mb-4">Recent orders</h2>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-bone-dim">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-ink-700 border-y border-ink-700">
              {recentOrders.map((order) => (
                <li key={order.id} className="flex items-center gap-3 py-3 text-sm">
                  <span className="min-w-0 flex-1 truncate text-bone">{order.orderNumber}</span>
                  <Badge>{order.status}</Badge>
                  <span className="shrink-0 tabular-nums text-bone-dim">
                    {formatCents(order.totalCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {recentAudit.length > 0 ? (
        <section className="mt-10">
          <h2 className="eyebrow mb-4">Recent activity</h2>
          <ul className="divide-y divide-ink-700 border-y border-ink-700">
            {recentAudit.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate text-bone-muted">
                  <span className="text-bone">{entry.actor?.name ?? 'System'}</span> — {entry.action}
                  {entry.entityType ? ` · ${entry.entityType}` : ''}
                </span>
                <time
                  dateTime={entry.createdAt.toISOString()}
                  title={formatDateTime(entry.createdAt)}
                  className="shrink-0 text-xs text-bone-dim"
                >
                  {relativeTime(entry.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function TaskRow({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-3 border border-ink-700 px-4 py-3 transition-colors hover:border-gold-700/70"
      >
        <span className="text-bone">{label}</span>
        <span className="text-[11px] uppercase tracking-[0.16em] text-gold-400">Review</span>
      </Link>
    </li>
  );
}
