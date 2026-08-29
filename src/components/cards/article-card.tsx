import Link from 'next/link';
import { MediaFrame } from '@/components/ui/media-frame';
import { Badge } from '@/components/ui/primitives';
import { cn, formatDate } from '@/lib/utils';

export interface ArticleCardData {
  slug: string;
  title: string;
  dek?: string | null;
  excerpt?: string | null;
  thumbnailUrl?: string | null;
  heroImageUrl?: string | null;
  publishedAt?: Date | string | null;
  readMinutes?: number;
  breaking?: boolean;
  categoryName?: string | null;
  authorName?: string | null;
}

export function ArticleCard({
  article,
  variant = 'standard',
  className,
}: {
  article: ArticleCardData;
  variant?: 'standard' | 'lead' | 'row' | 'compact';
  className?: string;
}) {
  const image = article.thumbnailUrl ?? article.heroImageUrl ?? null;

  if (variant === 'row') {
    return (
      <Link
        href={`/culture/${article.slug}`}
        className={cn('group flex gap-4 border-b border-ink-700 py-4', className)}
      >
        <MediaFrame
          src={image}
          alt={article.title}
          seed={article.title}
          ratio="square"
          className="h-20 w-20 shrink-0 sm:h-24 sm:w-24"
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            {article.breaking ? <Badge tone="live">Breaking</Badge> : null}
            {article.categoryName ? (
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-600">
                {article.categoryName}
              </span>
            ) : null}
          </div>
          <h3 className="line-clamp-2 font-display text-base leading-tight tracking-tight text-bone transition-colors group-hover:text-gold-300 sm:text-lg">
            {article.title}
          </h3>
          <p className="mt-1.5 text-[11px] uppercase tracking-[0.14em] text-bone-dim">
            {formatDate(article.publishedAt)}
            {article.readMinutes ? ` · ${article.readMinutes} min read` : ''}
          </p>
        </div>
      </Link>
    );
  }

  if (variant === 'compact') {
    return (
      <Link href={`/culture/${article.slug}`} className={cn('group block', className)}>
        <h3 className="line-clamp-3 font-display text-sm leading-tight tracking-tight text-bone transition-colors group-hover:text-gold-300">
          {article.title}
        </h3>
        <p className="mt-1.5 text-[10px] uppercase tracking-[0.16em] text-bone-dim">
          {formatDate(article.publishedAt)}
        </p>
      </Link>
    );
  }

  const lead = variant === 'lead';

  return (
    <Link
      href={`/culture/${article.slug}`}
      className={cn('group block', className)}
      aria-label={article.title}
    >
      <MediaFrame
        src={lead ? (article.heroImageUrl ?? image) : image}
        alt={article.title}
        seed={article.title}
        ratio={lead ? 'video' : 'wide'}
        className="mb-4 transition-transform duration-500 ease-premium group-hover:scale-[1.01]"
        overlay={lead}
      >
        {article.breaking ? (
          <span className="absolute left-3 top-3">
            <Badge tone="live">Breaking</Badge>
          </span>
        ) : null}
      </MediaFrame>

      <div className="flex items-center gap-2">
        {article.categoryName ? (
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-500">
            {article.categoryName}
          </span>
        ) : null}
        <span className="text-[10px] uppercase tracking-[0.16em] text-bone-dim">
          {formatDate(article.publishedAt)}
        </span>
      </div>

      <h3
        className={cn(
          'mt-2 font-display leading-[1.05] tracking-tight text-bone transition-colors group-hover:text-gold-300',
          lead ? 'text-3xl sm:text-4xl lg:text-5xl' : 'text-xl sm:text-2xl',
        )}
      >
        {article.title}
      </h3>

      {(article.dek || article.excerpt) && (
        <p
          className={cn(
            'mt-3 text-bone-dim',
            lead ? 'line-clamp-3 text-base' : 'line-clamp-2 text-sm',
          )}
        >
          {article.dek ?? article.excerpt}
        </p>
      )}

      {article.authorName ? (
        <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-bone-dim">
          By {article.authorName}
        </p>
      ) : null}
    </Link>
  );
}
