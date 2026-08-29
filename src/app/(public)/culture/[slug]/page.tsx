import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { sanitizeRichText, toPlainText } from '@/server/services/sanitize';
import { getCurrentUser } from '@/server/auth/session';
import { track } from '@/server/services/analytics';
import { isStaff } from '@/lib/rbac';
import { appUrl } from '@/lib/env';
import { MediaFrame } from '@/components/ui/media-frame';
import { Badge, Breadcrumbs, Divider } from '@/components/ui/primitives';
import { ArticleCard } from '@/components/cards/article-card';
import { ProductCard } from '@/components/cards/product-card';
import { SongRow } from '@/components/cards/music-cards';
import { ShareButtons } from '@/components/culture/share-buttons';
import { formatDate } from '@/lib/utils';

export const revalidate = 120;

async function loadArticle(slug: string, allowUnpublished: boolean) {
  const article = await prisma.article.findUnique({
    where: { slug },
    include: {
      author: true,
      category: true,
      tags: true,
      relatedProducts: { include: { images: { take: 1, orderBy: { position: 'asc' } } } },
      relatedSongs: { include: { artist: { select: { stageName: true, slug: true } } } },
      relatedArtists: true,
    },
  });
  if (!article) return null;
  if (article.status !== 'PUBLISHED' && !allowUnpublished) return null;
  return article;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await prisma.article.findUnique({
    where: { slug },
    select: {
      title: true,
      seoTitle: true,
      seoDescription: true,
      dek: true,
      excerpt: true,
      body: true,
      socialImageUrl: true,
      heroImageUrl: true,
      publishedAt: true,
      updatedAt: true,
      status: true,
    },
  });
  if (!article) return { title: 'Story not found' };

  const description =
    article.seoDescription ?? article.dek ?? article.excerpt ?? toPlainText(article.body, 155);
  const image = article.socialImageUrl ?? article.heroImageUrl ?? undefined;

  return {
    title: article.seoTitle ?? article.title,
    description,
    alternates: { canonical: `/culture/${slug}` },
    robots: article.status === 'PUBLISHED' ? undefined : { index: false, follow: false },
    openGraph: {
      type: 'article',
      title: article.seoTitle ?? article.title,
      description,
      url: `${appUrl}/culture/${slug}`,
      images: image ? [image] : undefined,
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
    },
    twitter: {
      card: 'summary_large_image',
      title: article.seoTitle ?? article.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const article = await loadArticle(slug, isStaff(user?.role));
  if (!article) notFound();

  const [related, moreFromCategory] = await Promise.all([
    prisma.article.findMany({
      where: {
        status: 'PUBLISHED',
        id: { not: article.id },
        OR: [
          { categoryId: article.categoryId ?? undefined },
          { tags: { some: { id: { in: article.tags.map((tag) => tag.id) } } } },
        ],
      },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      include: { category: { select: { name: true } } },
    }),
    prisma.article.findMany({
      where: { status: 'PUBLISHED', id: { not: article.id } },
      orderBy: { publishedAt: 'desc' },
      take: 4,
      include: { category: { select: { name: true } } },
    }),
  ]);

  // Fire-and-forget view counting; never blocks the render.
  void prisma.article
    .update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);
  void track({
    name: 'article_view',
    userId: user?.id ?? null,
    entityType: 'article',
    entityId: article.id,
    path: `/culture/${slug}`,
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.dek ?? article.excerpt ?? toPlainText(article.body, 200),
    image: article.heroImageUrl ? [article.heroImageUrl] : undefined,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author: article.author ? { '@type': 'Person', name: article.author.name } : undefined,
    publisher: { '@type': 'Organization', name: 'Boosie Network' },
    mainEntityOfPage: `${appUrl}/culture/${slug}`,
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: appUrl },
      { '@type': 'ListItem', position: 2, name: 'Culture', item: `${appUrl}/culture` },
      { '@type': 'ListItem', position: 3, name: article.title, item: `${appUrl}/culture/${slug}` },
    ],
  };

  return (
    <article className="pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      {article.status !== 'PUBLISHED' ? (
        <div className="bg-gold-500 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-ink">
          Preview — this story is {article.status.toLowerCase()} and not publicly visible
        </div>
      ) : null}

      <div className="container-page pt-8">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Culture', href: '/culture' },
            ...(article.category
              ? [{ label: article.category.name, href: `/culture?category=${article.category.slug}` }]
              : []),
            { label: article.title },
          ]}
        />
      </div>

      <header className="container-page max-w-4xl">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          {article.breaking ? <Badge tone="live">Breaking</Badge> : null}
          {article.category ? (
            <Link
              href={`/culture?category=${article.category.slug}`}
              className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-500 hover:text-gold-300"
            >
              {article.category.name}
            </Link>
          ) : null}
        </div>

        <h1 className="text-balance text-4xl leading-[0.95] sm:text-6xl">{article.title}</h1>
        {article.dek ? (
          <p className="mt-5 max-w-3xl text-pretty text-lg leading-relaxed text-bone-muted">
            {article.dek}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-y border-ink-700 py-4">
          <div className="flex items-center gap-3">
            {article.author ? (
              <>
                <MediaFrame
                  src={article.author.avatarUrl}
                  alt={article.author.name}
                  seed={article.author.name}
                  ratio="square"
                  className="h-10 w-10 rounded-full"
                />
                <div>
                  <p className="text-sm text-bone">{article.author.name}</p>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-bone-dim">
                    {formatDate(article.publishedAt ?? article.createdAt)} · {article.readMinutes} min read
                  </p>
                </div>
              </>
            ) : (
              <p className="text-[11px] uppercase tracking-[0.16em] text-bone-dim">
                {formatDate(article.publishedAt ?? article.createdAt)} · {article.readMinutes} min read
              </p>
            )}
          </div>
          <ShareButtons title={article.title} path={`/culture/${slug}`} />
        </div>
      </header>

      {article.heroImageUrl ? (
        <figure className="container-page mt-10">
          <MediaFrame
            src={article.heroImageUrl}
            alt={article.title}
            seed={article.title}
            ratio="video"
            priority
            className="w-full"
          />
        </figure>
      ) : null}

      <div className="container-page mt-12 grid gap-14 lg:grid-cols-[minmax(0,720px)_1fr]">
        <div>
          <div
            className="prose-editorial"
            dangerouslySetInnerHTML={{ __html: sanitizeRichText(article.body) }}
          />

          {article.tags.length > 0 ? (
            <div className="mt-12 flex flex-wrap gap-2 border-t border-ink-700 pt-8">
              {article.tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/search?q=${encodeURIComponent(tag.name)}`}
                  className="border border-ink-600 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-bone-dim transition-colors hover:border-gold-700 hover:text-bone"
                >
                  #{tag.name}
                </Link>
              ))}
            </div>
          ) : null}

          <div className="mt-10">
            <ShareButtons title={article.title} path={`/culture/${slug}`} />
          </div>
        </div>

        <aside className="space-y-10 lg:sticky lg:top-24 lg:self-start">
          {article.relatedSongs.length > 0 ? (
            <section>
              <p className="eyebrow mb-4">Listen</p>
              <div className="panel px-1 py-1">
                {article.relatedSongs.map((song) => (
                  <SongRow
                    key={song.id}
                    song={{
                      id: song.id,
                      slug: song.slug,
                      title: song.title,
                      artworkUrl: song.artworkUrl,
                      artistName: song.artist.stageName,
                      artistSlug: song.artist.slug,
                      durationSec: song.durationSec,
                      explicit: song.explicit,
                      accessType: song.accessType,
                    }}
                    queue={article.relatedSongs.map((item) => ({
                      id: item.id,
                      slug: item.slug,
                      title: item.title,
                      artworkUrl: item.artworkUrl,
                      artistName: item.artist.stageName,
                      artistSlug: item.artist.slug,
                      durationSec: item.durationSec,
                    }))}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {article.relatedProducts.length > 0 ? (
            <section>
              <p className="eyebrow mb-4">Shop the story</p>
              <div className="grid grid-cols-2 gap-4">
                {article.relatedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={{
                      slug: product.slug,
                      title: product.title,
                      priceCents: product.priceCents,
                      salePriceCents: product.salePriceCents,
                      imageUrl: product.images[0]?.url ?? null,
                      inventory: product.inventory,
                      trackInventory: product.trackInventory,
                      isDigital: product.isDigital,
                    }}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {article.relatedArtists.length > 0 ? (
            <section>
              <p className="eyebrow mb-4">Artists in this story</p>
              <ul className="space-y-3">
                {article.relatedArtists.map((artist) => (
                  <li key={artist.id}>
                    <Link
                      href={`/artists/${artist.slug}`}
                      className="flex items-center gap-3 text-sm text-bone-muted hover:text-gold-300"
                    >
                      <MediaFrame
                        src={artist.profileImageUrl}
                        alt={artist.stageName}
                        seed={artist.stageName}
                        ratio="square"
                        className="h-9 w-9 rounded-full"
                      />
                      {artist.stageName}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <p className="eyebrow mb-4">More from Culture</p>
            <div className="space-y-5">
              {moreFromCategory.map((item) => (
                <ArticleCard key={item.id} variant="compact" article={item} />
              ))}
            </div>
          </section>
        </aside>
      </div>

      {related.length > 0 ? (
        <section className="container-page mt-20">
          <Divider className="mb-10" />
          <h2 className="mb-8 text-2xl sm:text-3xl">Related stories</h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {related.map((item) => (
              <ArticleCard
                key={item.id}
                article={{ ...item, categoryName: item.category?.name ?? null }}
              />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
