import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Pagination({
  page,
  pageSize,
  total,
  buildHref,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  buildHref: (page: number) => string;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const windowStart = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => windowStart + index).filter(
    (value) => value <= totalPages,
  );

  return (
    <nav className={cn('mt-12 flex items-center justify-center gap-2', className)} aria-label="Pagination">
      {page > 1 ? (
        <Link
          href={buildHref(page - 1)}
          className="border border-ink-600 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-bone-muted transition-colors hover:border-gold-700 hover:text-bone"
        >
          Prev
        </Link>
      ) : null}

      {pages.map((value) => (
        <Link
          key={value}
          href={buildHref(value)}
          aria-current={value === page ? 'page' : undefined}
          className={cn(
            'min-w-10 border px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors',
            value === page
              ? 'border-gold-500 bg-gold-500 text-ink'
              : 'border-ink-600 text-bone-muted hover:border-gold-700 hover:text-bone',
          )}
        >
          {value}
        </Link>
      ))}

      {page < totalPages ? (
        <Link
          href={buildHref(page + 1)}
          className="border border-ink-600 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-bone-muted transition-colors hover:border-gold-700 hover:text-bone"
        >
          Next
        </Link>
      ) : null}
    </nav>
  );
}
