import type { Metadata } from 'next';
import Link from 'next/link';
import { getCartView } from '@/server/services/cart';
import { getCurrentUser } from '@/server/auth/session';
import { paymentsEnabled } from '@/server/services/payments';
import { CartLines } from '@/components/commerce/cart-lines';
import { CheckoutForm } from '@/components/commerce/checkout-form';
import { EmptyState, Alert } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { formatCents } from '@/lib/money';
import { SHIPPING } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your cart',
  description: 'Review your items and check out.',
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const [cart, user] = await Promise.all([getCartView(), getCurrentUser()]);
  const canCheckout = paymentsEnabled();

  if (cart.lines.length === 0) {
    return (
      <div className="container-page py-16">
        <h1 className="mb-10 text-5xl leading-none sm:text-6xl">YOUR CART</h1>
        <EmptyState
          title="Your cart is empty"
          description="Merch, vinyl, movies and music all live in the same cart. Add something and it'll show up here."
          action={
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/shop">Browse the shop</ButtonLink>
              <ButtonLink href="/listen" variant="outline">
                Browse music
              </ButtonLink>
            </div>
          }
        />
      </div>
    );
  }

  const freeShippingGap = SHIPPING.freeThresholdCents - cart.totals.subtotalCents;

  return (
    <div className="container-page py-12 sm:py-16">
      <h1 className="mb-10 text-5xl leading-none sm:text-6xl">YOUR CART</h1>

      {cart.issues.length > 0 ? (
        <div className="mb-8 space-y-3">
          {cart.issues.map((issue) => (
            <Alert key={issue} tone="warn">
              {issue}
            </Alert>
          ))}
        </div>
      ) : null}

      {!canCheckout ? (
        <div className="mb-8">
          <Alert tone="warn">
            Checkout is unavailable because payments have not been configured for this deployment.
            Your cart is saved and will still be here once they are.
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px]">
        <CartLines lines={cart.lines} />

        <aside className="space-y-6">
          <div className="panel p-6">
            <h2 className="eyebrow mb-5">Order summary</h2>

            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-bone-dim">
                  Subtotal ({cart.itemCount} item{cart.itemCount === 1 ? '' : 's'})
                </dt>
                <dd className="tabular-nums text-bone">{formatCents(cart.totals.subtotalCents)}</dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-bone-dim">Shipping</dt>
                <dd className="tabular-nums text-bone">
                  {cart.requiresShipping
                    ? cart.totals.shippingCents === 0
                      ? 'Free'
                      : formatCents(cart.totals.shippingCents)
                    : 'No shipping'}
                </dd>
              </div>

              <div className="flex justify-between gap-4 border-t border-ink-700 pt-3">
                <dt className="font-display text-lg uppercase tracking-tight text-bone">Total</dt>
                <dd className="font-display text-lg tabular-nums text-gold-400">
                  {formatCents(cart.totals.totalCents)}
                </dd>
              </div>
            </dl>

            {cart.requiresShipping && freeShippingGap > 0 ? (
              <p className="mt-4 text-xs text-bone-dim">
                Add {formatCents(freeShippingGap)} more for free shipping.
              </p>
            ) : null}

            <p className="mt-4 text-xs text-bone-dim">
              Taxes are calculated at checkout where applicable.
            </p>
          </div>

          {canCheckout ? (
            <CheckoutForm
              requiresShipping={cart.requiresShipping}
              defaultEmail={user?.email ?? ''}
              defaultName={user?.name ?? ''}
              blocked={cart.hasIssues}
            />
          ) : (
            <ButtonLink href="/shop" variant="outline" className="w-full">
              Continue browsing
            </ButtonLink>
          )}

          {!user ? (
            <p className="text-center text-xs text-bone-dim">
              <Link href="/login?returnTo=/cart" className="text-gold-400 hover:text-gold-300">
                Sign in
              </Link>{' '}
              to keep digital purchases in your library.
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
