import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/server/auth/session';
import { MediaFrame } from '@/components/ui/media-frame';
import { Alert, Badge } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { formatCents } from '@/lib/money';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Order confirmed',
  robots: { index: false, follow: false },
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderNumber } = await searchParams;
  if (!orderNumber) notFound();

  const [order, user] = await Promise.all([
    prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true },
    }),
    getCurrentUser(),
  ]);

  if (!order) notFound();

  // A guest can see their own confirmation via the order number in the return
  // URL, but a signed-in user must own the order to view it.
  if (order.userId && order.userId !== user?.id) notFound();

  const hasDigital = order.items.some((item) => !item.requiresShipping);
  const hasPhysical = order.items.some((item) => item.requiresShipping);
  const stillProcessing = order.status === 'PENDING';

  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow">Thank you</p>
        <h1 className="mt-3 text-5xl leading-none sm:text-6xl">ORDER CONFIRMED</h1>
        <p className="mt-4 text-base text-bone-muted">
          Order <span className="text-gold-400">{order.orderNumber}</span> placed{' '}
          {formatDate(order.createdAt)}. A receipt is on its way to {order.email}.
        </p>

        {stillProcessing ? (
          <div className="mt-8">
            <Alert tone="warn" title="Finalising your payment">
              Your payment is still being confirmed by the processor. This page updates once it
              settles — usually within a minute. Digital items unlock automatically at that point.
            </Alert>
          </div>
        ) : null}

        <div className="panel mt-10 p-6">
          <h2 className="eyebrow mb-5">What you ordered</h2>

          <ul className="divide-y divide-ink-700">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-4 py-4">
                <MediaFrame
                  src={item.imageSnapshot}
                  alt={item.titleSnapshot}
                  seed={item.titleSnapshot}
                  ratio="square"
                  className="w-16 shrink-0 border border-ink-600"
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
                <p className="shrink-0 text-sm tabular-nums text-bone">
                  {formatCents(item.totalCents)}
                </p>
              </li>
            ))}
          </ul>

          <dl className="mt-5 space-y-2 border-t border-ink-700 pt-5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-bone-dim">Subtotal</dt>
              <dd className="tabular-nums text-bone">{formatCents(order.subtotalCents)}</dd>
            </div>
            {order.shippingCents > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-bone-dim">Shipping</dt>
                <dd className="tabular-nums text-bone">{formatCents(order.shippingCents)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 border-t border-ink-700 pt-2">
              <dt className="font-display text-lg uppercase tracking-tight text-bone">Total</dt>
              <dd className="font-display text-lg tabular-nums text-gold-400">
                {formatCents(order.totalCents)}
              </dd>
            </div>
          </dl>
        </div>

        {hasPhysical && order.shippingLine1 ? (
          <div className="mt-8">
            <h2 className="eyebrow mb-3">Shipping to</h2>
            <address className="text-sm not-italic leading-relaxed text-bone-muted">
              {order.shippingName}
              <br />
              {order.shippingLine1}
              {order.shippingLine2 ? (
                <>
                  <br />
                  {order.shippingLine2}
                </>
              ) : null}
              <br />
              {[order.shippingCity, order.shippingState, order.shippingPostal]
                .filter(Boolean)
                .join(', ')}
              <br />
              {order.shippingCountry}
            </address>
          </div>
        ) : null}

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          {hasDigital ? (
            user ? (
              <ButtonLink href="/account/library">Open your library</ButtonLink>
            ) : (
              <ButtonLink href="/register">Create an account to keep your downloads</ButtonLink>
            )
          ) : null}
          {user ? (
            <ButtonLink href="/account/orders" variant="outline">
              View all orders
            </ButtonLink>
          ) : null}
          <ButtonLink href="/shop" variant="outline">
            Keep shopping
          </ButtonLink>
        </div>

        {hasDigital && !user ? (
          <p className="mt-6 text-xs text-bone-dim">
            Digital items are tied to {order.email}. Register with that address and everything you
            bought appears in your library automatically.{' '}
            <Link href="/register" className="text-gold-400 hover:text-gold-300">
              Create an account
            </Link>
            .
          </p>
        ) : null}

        <div className="mt-8">
          <Badge>{order.status}</Badge>
        </div>
      </div>
    </div>
  );
}
