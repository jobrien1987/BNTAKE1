import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/server/auth/guards';
import { can } from '@/lib/rbac';
import { updateOrderStatusAction } from '@/app/actions/admin/commerce';
import { AdminPageHeader, AdminTable, AdminTabs } from '@/components/admin/admin-shell';
import { InlineSelectForm } from '@/components/admin/inline-forms';
import { Badge, EmptyState, Stat } from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { formatCents } from '@/lib/money';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Orders',
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 25;
const STATUSES = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'FULFILLED',
  'CANCELED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
] as const;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const actor = await requirePermission('orders.read');

  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const status = STATUSES.includes(params.status as (typeof STATUSES)[number])
    ? (params.status as (typeof STATUSES)[number])
    : undefined;

  const where = status ? { status } : {};

  const [total, orders, revenue, pendingCount] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        items: { select: { id: true, titleSnapshot: true, quantity: true } },
        user: { select: { name: true, username: true } },
      },
    }),
    prisma.order.aggregate({
      where: { status: { in: ['PAID', 'FULFILLED'] } },
      _sum: { totalCents: true },
    }),
    prisma.order.count({ where: { status: 'PENDING' } }),
  ]);

  const canWrite = can(actor.role, 'orders.write');

  return (
    <div>
      <AdminPageHeader
        eyebrow="Commerce"
        title="Orders"
        description="Payment state is set by the payment processor's webhook. Staff move orders through fulfilment."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Total orders" value={total.toLocaleString()} />
        <Stat label="Lifetime revenue" value={formatCents(revenue._sum.totalCents ?? 0)} />
        <Stat label="Awaiting payment" value={String(pendingCount)} />
      </div>

      <AdminTabs
        active={status ? `/admin/orders?status=${status}` : '/admin/orders'}
        items={[
          { label: 'All', href: '/admin/orders' },
          ...STATUSES.map((entry) => ({ label: entry, href: `/admin/orders?status=${entry}` })),
        ]}
      />

      {orders.length === 0 ? (
        <EmptyState title="No orders" description="Orders appear here as soon as they are placed." />
      ) : (
        <AdminTable head={['Order', 'Customer', 'Items', 'Total', 'Status']}>
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="px-4 py-3">
                <p className="text-bone">{order.orderNumber}</p>
                <p className="text-xs text-bone-dim">{formatDateTime(order.createdAt)}</p>
              </td>

              <td className="px-4 py-3 text-xs">
                <p className="text-bone">{order.user?.name ?? 'Guest'}</p>
                <p className="text-bone-dim">{order.email}</p>
              </td>

              <td className="px-4 py-3 text-xs text-bone-dim">
                {order.items.slice(0, 2).map((item) => (
                  <p key={item.id} className="truncate">
                    {item.quantity}× {item.titleSnapshot}
                  </p>
                ))}
                {order.items.length > 2 ? <p>+{order.items.length - 2} more</p> : null}
              </td>

              <td className="px-4 py-3 tabular-nums text-bone">
                {formatCents(order.totalCents)}
                {order.refundedCents > 0 ? (
                  <p className="text-xs text-[#ff9aa2]">
                    −{formatCents(order.refundedCents)} refunded
                  </p>
                ) : null}
              </td>

              <td className="px-4 py-3">
                {canWrite ? (
                  <InlineSelectForm
                    action={updateOrderStatusAction}
                    name="status"
                    value={order.status}
                    label={`Status for ${order.orderNumber}`}
                    hidden={{ orderId: order.id }}
                    options={[
                      { value: 'PENDING', label: 'Pending' },
                      { value: 'PAID', label: 'Paid' },
                      { value: 'FULFILLED', label: 'Fulfilled' },
                      { value: 'CANCELED', label: 'Canceled' },
                    ]}
                  />
                ) : (
                  <Badge>{order.status}</Badge>
                )}
              </td>
            </tr>
          ))}
        </AdminTable>
      )}

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        buildHref={(nextPage) => {
          const search = new URLSearchParams();
          if (status) search.set('status', status);
          if (nextPage > 1) search.set('page', String(nextPage));
          const qs = search.toString();
          return `/admin/orders${qs ? `?${qs}` : ''}`;
        }}
      />
    </div>
  );
}
