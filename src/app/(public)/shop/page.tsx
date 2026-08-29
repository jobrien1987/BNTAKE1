import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ProductCard } from '@/components/cards/product-card';
import { EmptyState, SectionHeader } from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { MediaFrame } from '@/components/ui/media-frame';
import { ButtonLink } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Shop — merch, vinyl and digital drops',
  description:
    'Official Boosie Network merch, physical goods and digital products. Shipped worldwide, digital delivered instantly to your library.',
  alternates: { canonical: '/shop' },
  openGraph: { title: 'Shop | Boosie Network', url: '/shop' },
};

const PAGE_SIZE = 24;

const SORTS = {
  newest: { label: 'Newest', orderBy: { createdAt: 'desc' as const } },
  price_asc: { label: 'Price: low to high', orderBy: { priceCents: 'asc' as const } },
  price_desc: { label: 'Price: high to low', orderBy: { priceCents: 'desc' as const } },
};

type SortKey = keyof typeof SORTS;

export default async function ShopIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; collection?: string; sort?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const sort: SortKey = params.sort && params.sort in SORTS ? (params.sort as SortKey) : 'newest';

  const where = {
    active: true,
    ...(params.category ? { category: { slug: params.category } } : {}),
    ...(params.collection ? { collections: { some: { slug: params.collection } } } : {}),
  };

  const [categories, collections, total, products, featured] = await Promise.all([
    prisma.productCategory.findMany({ orderBy: { position: 'asc' } }),
    prisma.collection.findMany({ where: { featured: true }, orderBy: { name: 'asc' }, take: 6 }),
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ featured: 'desc' }, SORTS[sort].orderBy],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        images: { take: 1, orderBy: { position: 'asc' } },
        category: { select: { name: true } },
      },
    }),
    page === 1 && !params.category && !params.collection
      ? prisma.product.findFirst({
          where: { active: true, featured: true },
          include: { images: { take: 1, orderBy: { position: 'asc' } } },
        })
      : Promise.resolve(null),
  ]);

  const buildHref = (next: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    const merged = {
      category: params.category,
      collection: params.collection,
      sort: params.sort,
      ...next,
    };
    for (const [key, value] of Object.entries(merged)) if (value) search.set(key, value);
    const query = search.toString();
    return `/shop${query ? `?${query}` : ''}`;
  };

  return (
    <div className="container-page py-12 sm:py-16">
      <header className="mb-10 border-b border-ink-700 pb-8">
        <p className="eyebrow">Boosie Network</p>
        <h1 className="mt-3 text-5xl leading-none sm:text-7xl">SHOP</h1>
        <p className="mt-4 max-w-2xl text-base text-bone-muted">
          Official merch, physical goods and digital drops. Digital items land in your library the
          moment payment clears.
        </p>
      </header>

      {featured ? (
        <section className="mb-14">
          <Link href={`/shop/${featured.slug}`} className="group block">
            <div className="grid items-center gap-8 border border-ink-700 p-6 sm:grid-cols-2 sm:p-10">
              <MediaFrame
                src={featured.images[0]?.url}
                alt={featured.title}
                seed={featured.title}
                ratio="square"
                priority
                className="border border-ink-600"
              />
              <div>
                <p className="eyebrow">Featured drop</p>
                <h2 className="mt-3 text-4xl leading-none sm:text-5xl">{featured.title}</h2>
                {featured.description ? (
                  <p className="mt-4 line-clamp-3 text-sm text-bone-muted">{featured.description}</p>
                ) : null}
                <span className="mt-6 inline-block border-b border-gold-500 pb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-400 transition-colors group-hover:text-gold-300">
                  View product
                </span>
              </div>
            </div>
          </Link>
        </section>
      ) : null}

      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <nav
          className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
          aria-label="Product categories"
        >
          <Chip href="/shop" active={!params.category && !params.collection}>
            All
          </Chip>
          {categories.map((category) => (
            <Chip
              key={category.id}
              href={buildHref({ category: category.slug, collection: undefined, page: undefined })}
              active={params.category === category.slug}
            >
              {category.name}
            </Chip>
          ))}
          {collections.map((collection) => (
            <Chip
              key={collection.id}
              href={buildHref({ collection: collection.slug, category: undefined, page: undefined })}
              active={params.collection === collection.slug}
            >
              {collection.name}
            </Chip>
          ))}
        </nav>

        <div className="flex shrink-0 gap-2">
          {(Object.keys(SORTS) as SortKey[]).map((key) => (
            <Link
              key={key}
              href={buildHref({ sort: key === 'newest' ? undefined : key, page: undefined })}
              className={cn(
                'border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors',
                sort === key
                  ? 'border-gold-500 text-gold-300'
                  : 'border-ink-600 text-bone-dim hover:border-gold-700 hover:text-bone',
              )}
            >
              {SORTS[key].label}
            </Link>
          ))}
        </div>
      </div>

      {products.length === 0 ? (
        <EmptyState
          title="Nothing in this section yet"
          description="No products match this filter. Try another category or browse everything."
          action={
            <ButtonLink href="/shop" variant="outline">
              Browse all products
            </ButtonLink>
          }
        />
      ) : (
        <>
          <SectionHeader
            eyebrow={`${total} product${total === 1 ? '' : 's'}`}
            title="Everything in stock"
          />
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={{
                  ...product,
                  imageUrl: product.images[0]?.url ?? null,
                  categoryName: product.category?.name ?? null,
                }}
              />
            ))}
          </div>
        </>
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

function Chip({
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
