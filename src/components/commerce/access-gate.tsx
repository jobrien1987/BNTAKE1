import { Lock, Sparkles } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { AddToCartButton } from '@/components/commerce/add-to-cart-button';
import { formatCents } from '@/lib/money';

/**
 * The one place a locked item explains itself. Access is always decided on the
 * server; this component only renders the outcome and the honest next step.
 */
export function AccessGate({
  reason,
  kind,
  refId,
  priceCents,
  purchasable,
  title,
  returnTo,
}: {
  reason: string;
  kind: 'SONG' | 'ALBUM' | 'VIDEO';
  refId: string;
  priceCents?: number | null;
  purchasable?: boolean;
  title: string;
  returnTo: string;
}) {
  const canBuy = Boolean(purchasable && priceCents && priceCents > 0);

  if (reason === 'MEMBERSHIP_REQUIRED') {
    return (
      <div className="panel px-6 py-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-gold-700/50 bg-gold-500/5 text-gold-500">
          <Sparkles className="h-5 w-5" />
        </div>
        <h3 className="text-lg tracking-tight">Included with membership</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-bone-dim">
          {title} is part of the member library. Join to stream it, plus everything else members
          get.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <ButtonLink href="/membership">See membership</ButtonLink>
          <ButtonLink href={`/login?returnTo=${encodeURIComponent(returnTo)}`} variant="outline">
            Already a member? Sign in
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (reason === 'PURCHASE_REQUIRED') {
    return (
      <div className="panel px-6 py-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-gold-700/50 bg-gold-500/5 text-gold-500">
          <Lock className="h-5 w-5" />
        </div>
        <h3 className="text-lg tracking-tight">Yours to own</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-bone-dim">
          {canBuy
            ? `Buy ${title} once and it stays in your library for good.`
            : `${title} is not available for purchase right now.`}
        </p>
        <div className="mx-auto mt-6 flex max-w-xs flex-col gap-3">
          {canBuy ? (
            <AddToCartButton
              kind={kind}
              refId={refId}
              label={`Buy for ${formatCents(priceCents)}`}
            />
          ) : null}
          <ButtonLink href="/membership" variant="outline">
            Or get it with membership
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="panel px-6 py-8 text-center">
      <h3 className="text-lg tracking-tight">Not available</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-bone-dim">
        This title isn&rsquo;t available to play right now. It may have been unpublished or moved.
      </p>
    </div>
  );
}
