'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { ShoppingBag } from 'lucide-react';
import { addToCartAction } from '@/app/actions/cart';
import { initialActionState } from '@/lib/action-state';
import { SubmitButton } from '@/components/ui/form';

export interface AddToCartButtonProps {
  kind: 'PRODUCT' | 'DIGITAL_PRODUCT' | 'SONG' | 'ALBUM' | 'VIDEO';
  productId?: string;
  variantId?: string | null;
  refId?: string;
  quantity?: number;
  label?: string;
  disabled?: boolean;
  disabledLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'gold' | 'outline' | 'solid';
  className?: string;
}

export function AddToCartButton({
  kind,
  productId,
  variantId,
  refId,
  quantity = 1,
  label = 'Add to cart',
  disabled = false,
  disabledLabel = 'Unavailable',
  size = 'md',
  variant = 'gold',
  className,
}: AddToCartButtonProps) {
  const [state, formAction] = useActionState(addToCartAction, initialActionState);
  const router = useRouter();

  React.useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-sm border border-ink-500 px-5 text-xs font-semibold uppercase tracking-[0.14em] text-bone-dim"
      >
        {disabledLabel}
      </button>
    );
  }

  return (
    <form action={formAction} className={className}>
      <input type="hidden" name="kind" value={kind} />
      {productId ? <input type="hidden" name="productId" value={productId} /> : null}
      {variantId ? <input type="hidden" name="variantId" value={variantId} /> : null}
      {refId ? <input type="hidden" name="refId" value={refId} /> : null}
      <input type="hidden" name="quantity" value={quantity} />
      <SubmitButton variant={variant} size={size} pendingLabel="Adding…" className="w-full">
        <ShoppingBag className="h-4 w-4" />
        {label}
      </SubmitButton>
      {state.error ? <p className="mt-2 text-xs text-[#ff9aa2]">{state.error}</p> : null}
      {state.success ? <p className="mt-2 text-xs text-[#8ff0c4]">{state.success}</p> : null}
    </form>
  );
}
