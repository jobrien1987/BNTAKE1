import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/guards';
import { MediaFrame } from '@/components/ui/media-frame';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { formatCents } from '@/lib/money';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your orders',
  robots: { index: false, follow: false },
};

const TONES: Record<string, 'success' | 'warn' | 'danger' | 'neutral'> = {
  PAID: 'success',
  FULFILLED: 'success',
  PENDING: 'warn',
  CANCELED: 'danger',
  REFUNDED: 'danger',
  PARTIALLY_REFUNDED: 'warn',
};

export default async function OrdersPage() {
  const user = await requireUser('/account/orders');

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });

  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        description="Once you buy something it shows up here with its full receipt and shipping status."
        action={<ButtonLink href="/shop">Visit the shop</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-8">
      {orders.map((order) => (
        <article key={order.id} className="panel p-6">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-700 pb-4">
            <div>
              <p className="font-display text-lg uppercase tracking-tight text-bone">
                {order.orderNumber}
              </p>
              <p className="mt-1 text-xs text-bone-dim">
                Placed {formatDate(order.createdAt)}
                {order.paidAt ? ` · Paid ${formatDate(order.paidAt)}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={TONES[order.status] ?? 'neutral'}>{order.status}</Badge>
              <span className="font-display text-lg tabular-nums text-gold-400">
                {formatCents(order.totalCents)}
              </span>
            </div>
          </header>

          <ul className="divide-y divide-ink-700">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 py-4">
                <MediaFrame
                  src={item.imageSnapshot}
                  alt={item.titleSnapshot}
                  seed={item.titleSnapshot}
                  ratio="square"
                  className="h-14 w-14 shrink-0 border border-ink-600"
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm text-bone">{item.titleSnapshot}</p>
                  {item.variantSnapshot ? (
                    <p className="text-xs text-bone-dim">{item.variantSnapshot}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-bone-dim">
                    Qty {item.quantity}
                    {!item.requiresShipping ? ' · Digital' : ''}
                  </p>
                </div>
                <span className="shrink-0 text-sm tabular-nums text-bone">
                  {formatCents(item.totalCents)}
                </span>
              </li>
            ))}
          </ul>

          <footer className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-ink-700 pt-4 text-xs text-bone-dim">
            <div>
              {order.requiresShipping && order.shippingLine1 ? (
                <span>
                  Shipping to {order.shippingCity}
                  {order.shippingState ? `, ${order.shippingState}` : ''}
                </span>
              ) : (
                <span>Digital order — no shipping</span>
              )}
            </div>
            {order.items.some((item) => !item.requiresShipping) && order.status !== 'PENDING' ? (
              <ButtonLink href="/account/library" variant="quiet" size="sm">
                Open library
              </ButtonLink>
            ) : null}
          </footer>
        </article>
      ))}
    </div>
  );
}
