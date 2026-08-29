'use client';

import { useState } from 'react';
import { MediaFrame } from '@/components/ui/media-frame';
import { AddToCartButton } from '@/components/commerce/add-to-cart-button';
import { Badge } from '@/components/ui/primitives';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

export interface VariantOption {
  id: string;
  name: string;
  priceCents: number | null;
  inventory: number;
  size: string | null;
  color: string | null;
  active: boolean;
}

export interface GalleryImage {
  id: string;
  url: string;
  altText: string | null;
}

/**
 * Gallery and variant selection live together because the chosen variant
 * decides the price and stock message. The displayed price is a convenience —
 * checkout re-prices every line from the database before charging anything.
 */
export function ProductPurchasePanel({
  productId,
  title,
  images,
  priceCents,
  salePriceCents,
  variants,
  trackInventory,
  inventory,
  isDigital,
}: {
  productId: string;
  title: string;
  images: GalleryImage[];
  priceCents: number;
  salePriceCents: number | null;
  variants: VariantOption[];
  trackInventory: boolean;
  inventory: number;
  isDigital: boolean;
}) {
  const sellableVariants = variants.filter((variant) => variant.active);
  const [activeImage, setActiveImage] = useState(0);
  const [variantId, setVariantId] = useState<string | null>(sellableVariants[0]?.id ?? null);

  const variant = sellableVariants.find((entry) => entry.id === variantId) ?? null;

  const basePrice = salePriceCents ?? priceCents;
  const effectivePrice = variant?.priceCents ?? basePrice;
  const onSale = salePriceCents != null && salePriceCents < priceCents && !variant?.priceCents;

  const availableStock = variant ? variant.inventory : inventory;
  const soldOut = !isDigital && trackInventory && availableStock <= 0;
  const lowStock = !isDigital && trackInventory && availableStock > 0 && availableStock <= 5;

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div>
        <MediaFrame
          src={images[activeImage]?.url}
          alt={images[activeImage]?.altText ?? title}
          seed={title}
          ratio="square"
          priority
          className="border border-ink-600"
        />
        {images.length > 1 ? (
          <div className="mt-4 grid grid-cols-5 gap-3">
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setActiveImage(index)}
                aria-label={`View image ${index + 1} of ${images.length}`}
                aria-current={index === activeImage}
                className={cn(
                  'border transition-colors',
                  index === activeImage
                    ? 'border-gold-500'
                    : 'border-ink-600 hover:border-gold-700/70',
                )}
              >
                <MediaFrame
                  src={image.url}
                  alt={image.altText ?? `${title} image ${index + 1}`}
                  seed={`${title}-${index}`}
                  ratio="square"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <div className="flex flex-wrap items-baseline gap-3">
          <p className="font-display text-4xl text-bone">{formatCents(effectivePrice)}</p>
          {onSale ? (
            <>
              <p className="text-lg text-bone-dim line-through">{formatCents(priceCents)}</p>
              <Badge tone="gold">On sale</Badge>
            </>
          ) : null}
        </div>

        {sellableVariants.length > 0 ? (
          <fieldset className="mt-8">
            <legend className="eyebrow mb-3">Options</legend>
            <div className="flex flex-wrap gap-2">
              {sellableVariants.map((entry) => {
                const entrySoldOut = trackInventory && entry.inventory <= 0;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    disabled={entrySoldOut}
                    onClick={() => setVariantId(entry.id)}
                    aria-pressed={entry.id === variantId}
                    className={cn(
                      'border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors',
                      entry.id === variantId
                        ? 'border-gold-500 bg-gold-500 text-ink'
                        : 'border-ink-600 text-bone-muted hover:border-gold-700 hover:text-bone',
                      entrySoldOut && 'cursor-not-allowed line-through opacity-40 hover:border-ink-600',
                    )}
                  >
                    {entry.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        <div className="mt-8 max-w-sm">
          <AddToCartButton
            kind={isDigital ? 'DIGITAL_PRODUCT' : 'PRODUCT'}
            productId={productId}
            variantId={variantId}
            refId={productId}
            disabled={soldOut}
            disabledLabel="Sold out"
            label={isDigital ? 'Buy now' : 'Add to cart'}
          />
        </div>

        <p className="mt-4 text-xs text-bone-dim">
          {isDigital
            ? 'Digital product — delivered to your library as soon as payment clears.'
            : soldOut
              ? 'This option is sold out. Try another option or check back soon.'
              : lowStock
                ? `Only ${availableStock} left in stock.`
                : 'Ships worldwide. Free shipping on orders over $100.'}
        </p>
      </div>
    </div>
  );
}
