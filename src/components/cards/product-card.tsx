import Link from 'next/link';
import { MediaFrame } from '@/components/ui/media-frame';
import { Badge } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { formatCents } from '@/lib/money';

export interface ProductCardData {
  slug: string;
  title: string;
  priceCents: number;
  salePriceCents?: number | null;
  imageUrl?: string | null;
  inventory?: number;
  trackInventory?: boolean;
  isDigital?: boolean;
  categoryName?: string | null;
}

export function ProductCard({ product, className }: { product: ProductCardData; className?: string }) {
  const onSale = product.salePriceCents != null && product.salePriceCents < product.priceCents;
  const soldOut = product.trackInventory !== false && (product.inventory ?? 0) <= 0 && !product.isDigital;

  return (
    <Link href={`/shop/${product.slug}`} className={cn('group block', className)}>
      <MediaFrame
        src={product.imageUrl}
        alt={product.title}
        seed={product.title}
        ratio="square"
        className="border border-ink-600 bg-ink-800 transition-all duration-300 ease-premium group-hover:border-gold-700/70 group-hover:shadow-lift"
      >
        <span className="absolute left-2 top-2 flex flex-col gap-1">
          {onSale ? <Badge tone="live">Sale</Badge> : null}
          {soldOut ? <Badge tone="neutral">Sold out</Badge> : null}
          {product.isDigital ? <Badge tone="gold">Digital</Badge> : null}
        </span>
      </MediaFrame>

      <h3 className="mt-3 line-clamp-2 text-sm font-medium text-bone transition-colors group-hover:text-gold-300">
        {product.title}
      </h3>
      <p className="mt-1 flex items-baseline gap-2 text-sm">
        <span className={cn('tabular-nums', onSale ? 'text-gold-400' : 'text-bone-muted')}>
          {formatCents(onSale ? product.salePriceCents! : product.priceCents)}
        </span>
        {onSale ? (
          <span className="text-xs tabular-nums text-bone-dim line-through">
            {formatCents(product.priceCents)}
          </span>
        ) : null}
      </p>
    </Link>
  );
}
