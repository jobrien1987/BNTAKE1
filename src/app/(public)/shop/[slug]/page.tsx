import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ProductPurchasePanel } from '@/components/commerce/product-purchase-panel';
import { ProductCard } from '@/components/cards/product-card';
import { Badge, Breadcrumbs, SectionHeader } from '@/components/ui/primitives';
import { truncate } from '@/lib/utils';
import { appUrl } from '@/lib/env';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug },
    select: {
      title: true,
      description: true,
      active: true,
      images: { take: 1, orderBy: { position: 'asc' }, select: { url: true } },
    },
  });

  if (!product || !product.active) {
    return { title: 'Product not found', robots: { index: false, follow: false } };
  }

  const description = product.description
    ? truncate(product.description, 155)
    : `${product.title} — official merch from Boosie Network.`;

  return {
    title: product.title,
    description,
    alternates: { canonical: `/shop/${slug}` },
    openGraph: {
      title: product.title,
      description,
      url: `/shop/${slug}`,
      type: 'website',
      images: product.images[0]?.url ? [product.images[0].url] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { position: 'asc' } },
      variants: { orderBy: { position: 'asc' } },
      category: { select: { name: true, slug: true } },
      collections: { select: { name: true, slug: true } },
      artists: { select: { id: true, stageName: true, slug: true } },
    },
  });

  if (!product || !product.active) notFound();

  const related = await prisma.product.findMany({
    where: {
      active: true,
      id: { not: product.id },
      ...(product.categoryId ? { categoryId: product.categoryId } : {}),
    },
    take: 4,
    include: { images: { take: 1, orderBy: { position: 'asc' } } },
  });

  const inStock =
    product.isDigital ||
    !product.trackInventory ||
    product.inventory > 0 ||
    product.variants.some((variant) => variant.active && variant.inventory > 0);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description ?? undefined,
    image: product.images.map((image) => image.url),
    sku: product.sku ?? undefined,
    offers: {
      '@type': 'Offer',
      price: ((product.salePriceCents ?? product.priceCents) / 100).toFixed(2),
      priceCurrency: product.currency.toUpperCase(),
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `${appUrl.replace(/\/+$/, '')}/shop/${slug}`,
    },
  };

  return (
    <div className="container-page py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <Breadcrumbs
        items={[
          { label: 'Shop', href: '/shop' },
          ...(product.category
            ? [{ label: product.category.name, href: `/shop?category=${product.category.slug}` }]
            : []),
          { label: product.title },
        ]}
      />

      <div className="mb-8 flex flex-wrap items-center gap-2">
        {product.category ? <Badge>{product.category.name}</Badge> : null}
        {product.isDigital ? <Badge tone="gold">Digital</Badge> : null}
        {product.collections.map((collection) => (
          <Badge key={collection.slug}>{collection.name}</Badge>
        ))}
      </div>

      <h1 className="mb-10 text-5xl leading-[0.9] sm:text-7xl">{product.title}</h1>

      <ProductPurchasePanel
        productId={product.id}
        title={product.title}
        images={product.images.map((image) => ({
          id: image.id,
          url: image.url,
          altText: image.altText,
        }))}
        priceCents={product.priceCents}
        salePriceCents={product.salePriceCents}
        variants={product.variants.map((variant) => ({
          id: variant.id,
          name: variant.name,
          priceCents: variant.priceCents,
          inventory: variant.inventory,
          size: variant.size,
          color: variant.color,
          active: variant.active,
        }))}
        trackInventory={product.trackInventory}
        inventory={product.inventory}
        isDigital={product.isDigital}
      />

      {product.description ? (
        <section className="mt-16 max-w-2xl">
          <SectionHeader eyebrow="Details" title="About this product" />
          <p className="whitespace-pre-line text-base leading-relaxed text-bone-muted">
            {product.description}
          </p>
        </section>
      ) : null}

      {product.artists.length > 0 ? (
        <section className="mt-12">
          <h2 className="eyebrow mb-3">Artists</h2>
          <div className="flex flex-wrap gap-3">
            {product.artists.map((artist) => (
              <Link
                key={artist.id}
                href={`/artists/${artist.slug}`}
                className="border border-ink-600 px-4 py-2 text-sm text-bone-muted transition-colors hover:border-gold-700 hover:text-bone"
              >
                {artist.stageName}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {related.length > 0 ? (
        <section className="mt-20">
          <SectionHeader eyebrow="You may also like" title="More from the shop" href="/shop" />
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {related.map((item) => (
              <ProductCard
                key={item.id}
                product={{ ...item, imageUrl: item.images[0]?.url ?? null }}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
