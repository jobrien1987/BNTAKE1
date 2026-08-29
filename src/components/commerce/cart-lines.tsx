'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus, X } from 'lucide-react';
import { MediaFrame } from '@/components/ui/media-frame';
import { Badge } from '@/components/ui/primitives';
import { removeCartItemAction, updateCartItemAction } from '@/app/actions/cart';
import { formatCents } from '@/lib/money';
import type { CartLine } from '@/server/services/cart';

export function CartLines({ lines }: { lines: CartLine[] }) {
  return (
    <ul className="divide-y divide-ink-700 border-y border-ink-700">
      {lines.map((line) => (
        <CartLineRow key={line.itemId} line={line} />
      ))}
    </ul>
  );
}

function CartLineRow({ line }: { line: CartLine }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const submit = (action: (formData: FormData) => Promise<void>, formData: FormData) => {
    startTransition(async () => {
      await action(formData);
      router.refresh();
    });
  };

  const changeQuantity = (quantity: number) => {
    const formData = new FormData();
    formData.set('itemId', line.itemId);
    formData.set('quantity', String(quantity));
    submit(updateCartItemAction, formData);
  };

  const maxQuantity = line.availableInventory ?? 25;

  return (
    <li className="flex gap-4 py-6" aria-busy={isPending}>
      <Link href={line.href} className="shrink-0">
        <MediaFrame
          src={line.imageUrl}
          alt={line.title}
          seed={line.title}
          ratio="square"
          className="w-24 border border-ink-600 sm:w-28"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={line.href}
              className="line-clamp-2 text-base text-bone transition-colors hover:text-gold-300"
            >
              {line.title}
            </Link>
            {line.variantLabel ? (
              <p className="mt-1 text-xs text-bone-dim">{line.variantLabel}</p>
            ) : null}
            {!line.requiresShipping ? (
              <span className="mt-2 inline-block">
                <Badge tone="gold">Digital</Badge>
              </span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => {
              const formData = new FormData();
              formData.set('itemId', line.itemId);
              submit(removeCartItemAction, formData);
            }}
            aria-label={`Remove ${line.title} from cart`}
            className="shrink-0 p-1 text-bone-dim transition-colors hover:text-[#ff8a92]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {line.stockWarning ? (
          <p className="mt-2 text-xs text-gold-300">{line.stockWarning}</p>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-4 pt-4">
          {line.requiresShipping ? (
            <div className="flex items-center border border-ink-600">
              <button
                type="button"
                disabled={isPending || line.quantity <= 1}
                onClick={() => changeQuantity(line.quantity - 1)}
                aria-label="Decrease quantity"
                className="px-3 py-2 text-bone-muted transition-colors hover:text-bone disabled:opacity-30"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-10 text-center text-sm tabular-nums text-bone">
                {line.quantity}
              </span>
              <button
                type="button"
                disabled={isPending || line.quantity >= maxQuantity}
                onClick={() => changeQuantity(line.quantity + 1)}
                aria-label="Increase quantity"
                className="px-3 py-2 text-bone-muted transition-colors hover:text-bone disabled:opacity-30"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <span className="text-xs text-bone-dim">Quantity 1</span>
          )}

          <div className="text-right">
            <p className="font-display text-lg tabular-nums text-bone">
              {formatCents(line.lineTotalCents)}
            </p>
            {line.quantity > 1 ? (
              <p className="text-xs tabular-nums text-bone-dim">
                {formatCents(line.unitPriceCents)} each
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
