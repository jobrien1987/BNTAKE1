import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ArticleCard } from '@/components/cards/article-card';
import { EmptyState, SectionHeader } from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Culture — hip-hop, music and entertainment news',
  description:
    'Breaking culture, exclusives and reporting on hip-hop, music, movies and the artists moving the culture forward.',
  alternates: { canonical: '/culture' },
  openGraph: { title: 'Culture | Boosie Network', url: '/culture' },
};

const PAGE_SIZE = 12;

export default async function CultureIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const categorySlug = params.category;
  const filter = params.filter;

  const where = {
    status: 'PUBLISHED' as const,
    ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    ...(filter === 'breaking' ? { breaking: true } : {}),
    ...(filter === 'exclusives' ? { featured: true } : {}),
  };

  const [categories, total, articles, breaking] = await Promise.all([
    prisma.category.findMany({ orderBy: { position: 'asc' } }),
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { category: { select: { name: true } }, author: { select: { name: true } } },
    }),
    page === 1 && !categorySlug && !filter
      ? prisma.article.findMany({
          where: { status: 'PUBLISHED', breaking: true },
          orderBy: { publishedAt: 'desc' },
          take: 3,
          include: { category: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const buildHref = (next: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    const merged = { category: categorySlug, filter, ...next };
    for (const [key, value] of Object.entries(merged)) if (value) search.set(key, value);
    const query = search.toString();
    return `/culture${query ? `?${query}` : ''}`;
  };

  return (
    <div className="container-page py-12 sm:py-16">
      <header className="mb-10 border-b border-ink-700 pb-8">
        <p className="eyebrow">Boosie Network</p>
        <h1 className="mt-3 text-5xl leading-none sm:text-7xl">CULTURE</h1>
        <p className="mt-4 max-w-2xl text-base text-bone-muted">
          Reporting on hip-hop, music, film and the artists moving the culture — written and edited
          by the Boosie Network newsroom.
        </p>
      </header>

      <nav className="no-scrollbar -mx-4 mb-10 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Culture categories">
        <FilterChip href="/culture" active={!categorySlug && !filter}>
          Latest
        </FilterChip>
        <FilterChip href={buildHref({ filter: 'breaking', category: undefined })} active={filter === 'breaking'}>
          Breaking
        </FilterChip>
        <FilterChip href={buildHref({ filter: 'exclusives', category: undefined })} active={filter === 'exclusives'}>
          Exclusives
        </FilterChip>
        {categories.map((category) => (
          <FilterChip
            key={category.id}
            href={buildHref({ category: category.slug, filter: undefined })}
            active={categorySlug === category.slug}
          >
            {category.name}
          </FilterChip>
        ))}
      </nav>

      {breaking.length > 0 ? (
        <section className="mb-14">
          <SectionHeader eyebrow="Right now" title="Breaking" />
          <div className="grid gap-8 sm:grid-cols-3">
            {breaking.map((article) => (
              <ArticleCard
                key={article.id}
                article={{ ...article, categoryName: article.category?.name ?? null }}
              />
            ))}
          </div>
        </section>
      ) : null}

      {articles.length === 0 ? (
        <EmptyState
          title="No stories here yet"
          description="Nothing has been published in this section. Try another category or check back soon."
        />
      ) : (
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={{
                ...article,
                categoryName: article.category?.name ?? null,
                authorName: article.author?.name ?? null,
              }}
            />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        buildHref={(nextPage) => buildHref({ page: nextPage === 1 ? undefined : String(nextPage) })}
      />
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'shrink-0 border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors',
        active
          ? 'border-gold-500 bg-gold-500 text-ink'
          : 'border-ink-600 text-bone-muted hover:border-gold-700 hover:text-bone',
      )}
    >
      {children}
    </Link>
  );
}
