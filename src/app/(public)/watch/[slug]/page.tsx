import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/server/auth/session';
import { evaluateAccess } from '@/server/services/entitlements';
import { VideoPlayer } from '@/components/watch/video-player';
import { AccessGate } from '@/components/commerce/access-gate';
import { VideoCard } from '@/components/cards/video-card';
import { MediaFrame } from '@/components/ui/media-frame';
import { Badge, Breadcrumbs, SectionHeader } from '@/components/ui/primitives';
import { AddToCartButton } from '@/components/commerce/add-to-cart-button';
import { formatCents } from '@/lib/money';
import { formatDate, runtimeLabel, truncate } from '@/lib/utils';
import { appUrl } from '@/lib/env';

export const revalidate = 60;

async function loadVideo(slug: string) {
  return prisma.video.findUnique({
    where: { slug },
    include: {
      cast: { orderBy: { position: 'asc' } },
      genres: true,
      artists: { select: { id: true, stageName: true, slug: true, profileImageUrl: true } },
      series: { select: { title: true, slug: true } },
      episodes: {
        where: { status: 'PUBLISHED' },
        orderBy: [{ seasonNumber: 'asc' }, { episodeNumber: 'asc' }],
      },
      soundtrackAlbum: {
        select: { title: true, slug: true, artworkUrl: true, artist: { select: { stageName: true } } },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const video = await prisma.video.findUnique({
    where: { slug },
    select: {
      title: true,
      synopsis: true,
      seoDescription: true,
      posterUrl: true,
      backdropUrl: true,
      status: true,
    },
  });

  if (!video || video.status !== 'PUBLISHED') {
    return { title: 'Title not found', robots: { index: false, follow: false } };
  }

  const description =
    video.seoDescription ?? (video.synopsis ? truncate(video.synopsis, 155) : 'Watch on Boosie Network.');
  const image = video.backdropUrl ?? video.posterUrl ?? undefined;

  return {
    title: video.title,
    description,
    alternates: { canonical: `/watch/${slug}` },
    openGraph: {
      title: video.title,
      description,
      url: `/watch/${slug}`,
      type: 'video.movie',
      images: image ? [image] : undefined,
    },
  };
}

export default async function WatchDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [video, user] = await Promise.all([loadVideo(slug), getCurrentUser()]);

  if (!video) notFound();

  const decision = await evaluateAccess({
    accessType: video.accessType,
    kind: 'VIDEO',
    refId: video.id,
    userId: user?.id ?? null,
    role: user?.role ?? null,
    published: video.status === 'PUBLISHED',
  });

  if (!decision.allowed && decision.reason === 'UNAVAILABLE') notFound();

  const related = await prisma.video.findMany({
    where: {
      status: 'PUBLISHED',
      id: { not: video.id },
      seriesId: null,
      ...(video.genres.length > 0
        ? { genres: { some: { id: { in: video.genres.map((genre) => genre.id) } } } }
        : { kind: video.kind }),
    },
    take: 6,
    orderBy: { releaseDate: 'desc' },
  });

  const returnTo = `/watch/${slug}`;
  const year = video.releaseDate ? new Date(video.releaseDate).getFullYear() : null;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': video.kind === 'MOVIE' ? 'Movie' : 'VideoObject',
    name: video.title,
    description: video.synopsis ?? undefined,
    image: video.posterUrl ? [video.posterUrl] : undefined,
    datePublished: video.releaseDate?.toISOString(),
    director: video.director ? { '@type': 'Person', name: video.director } : undefined,
    url: `${appUrl.replace(/\/+$/, '')}/watch/${slug}`,
    actor: video.cast.map((member) => ({ '@type': 'Person', name: member.name })),
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="container-page py-8 sm:py-12">
        <Breadcrumbs
          items={[
            { label: 'Watch', href: '/watch' },
            ...(video.series
              ? [{ label: video.series.title, href: `/watch/${video.series.slug}` }]
              : []),
            { label: video.title },
          ]}
        />

        <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            {decision.allowed ? (
              <VideoPlayer videoId={video.id} title={video.title} posterUrl={video.backdropUrl ?? video.posterUrl} />
            ) : (
              <div className="space-y-6">
                <MediaFrame
                  src={video.backdropUrl ?? video.posterUrl}
                  alt={video.title}
                  seed={video.title}
                  ratio="video"
                  overlay
                  className="border border-ink-600"
                />
                <AccessGate
                  reason={decision.reason}
                  kind="VIDEO"
                  refId={video.id}
                  priceCents={video.priceCents}
                  purchasable={video.purchasable}
                  title={video.title}
                  returnTo={returnTo}
                />
              </div>
            )}

            <div className="mt-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{video.kind.replace('_', ' ')}</Badge>
                {video.contentRating ? <Badge>{video.contentRating}</Badge> : null}
                {video.accessType === 'MEMBERSHIP' ? <Badge tone="gold">Members</Badge> : null}
                {video.accessType === 'FREE' ? <Badge tone="success">Free</Badge> : null}
                {video.genres.map((genre) => (
                  <Badge key={genre.id}>{genre.name}</Badge>
                ))}
              </div>

              <h1 className="mt-4 text-4xl leading-[0.92] sm:text-6xl">{video.title}</h1>

              <p className="mt-3 text-sm text-bone-dim">
                {[
                  year ? String(year) : null,
                  video.durationSec ? runtimeLabel(video.durationSec) : null,
                  video.director ? `Directed by ${video.director}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>

              {video.synopsis ? (
                <p className="mt-6 max-w-2xl text-base leading-relaxed text-bone-muted">
                  {video.synopsis}
                </p>
              ) : null}
            </div>

            {video.cast.length > 0 ? (
              <section className="mt-12">
                <SectionHeader eyebrow="Featuring" title="Cast" />
                <div className="grid grid-cols-3 gap-5 sm:grid-cols-4 lg:grid-cols-6">
                  {video.cast.map((member) => (
                    <div key={member.id}>
                      <MediaFrame
                        src={member.imageUrl}
                        alt={member.name}
                        seed={member.name}
                        ratio="square"
                        className="border border-ink-600"
                      />
                      <p className="mt-2 line-clamp-1 text-sm text-bone">{member.name}</p>
                      {member.role ? (
                        <p className="line-clamp-1 text-xs text-bone-dim">{member.role}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {video.episodes.length > 0 ? (
              <section className="mt-12">
                <SectionHeader eyebrow="Series" title="Episodes" />
                <ul className="divide-y divide-ink-700 border-y border-ink-700">
                  {video.episodes.map((episode) => (
                    <li key={episode.id}>
                      <Link
                        href={`/watch/${episode.slug}`}
                        className="group flex items-center gap-4 py-4"
                      >
                        <MediaFrame
                          src={episode.posterUrl}
                          alt={episode.title}
                          seed={episode.title}
                          ratio="video"
                          className="w-32 shrink-0 border border-ink-600"
                        />
                        <div className="min-w-0">
                          <p className="text-xs text-bone-dim">
                            {episode.seasonNumber ? `S${episode.seasonNumber}` : ''}
                            {episode.episodeNumber ? ` E${episode.episodeNumber}` : ''}
                          </p>
                          <p className="line-clamp-1 text-base text-bone transition-colors group-hover:text-gold-300">
                            {episode.title}
                          </p>
                          {episode.synopsis ? (
                            <p className="mt-1 line-clamp-2 text-sm text-bone-dim">
                              {truncate(episode.synopsis, 140)}
                            </p>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="space-y-8">
            <div className="panel p-5">
              <MediaFrame
                src={video.posterUrl}
                alt={video.title}
                seed={video.title}
                ratio="poster"
                className="mb-5 border border-ink-600"
              />

              {video.purchasable && video.priceCents ? (
                <div className="space-y-3">
                  <p className="font-display text-2xl text-bone">{formatCents(video.priceCents)}</p>
                  <p className="text-xs text-bone-dim">
                    Buy once. It stays in your library and streams any time.
                  </p>
                  <AddToCartButton kind="VIDEO" refId={video.id} label="Add to cart" />
                </div>
              ) : video.accessType === 'MEMBERSHIP' ? (
                <p className="text-sm text-bone-dim">
                  Included with membership. Members stream the full library.
                </p>
              ) : (
                <p className="text-sm text-bone-dim">Free to watch on Boosie Network.</p>
              )}

              {video.releaseDate ? (
                <dl className="mt-6 space-y-2 border-t border-ink-700 pt-4 text-xs">
                  <div className="flex justify-between gap-4">
                    <dt className="text-bone-dim">Released</dt>
                    <dd className="text-bone">{formatDate(video.releaseDate)}</dd>
                  </div>
                  {video.durationSec ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-bone-dim">Runtime</dt>
                      <dd className="text-bone">{runtimeLabel(video.durationSec)}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </div>

            {video.artists.length > 0 ? (
              <div>
                <h2 className="eyebrow mb-3">Artists</h2>
                <ul className="space-y-3">
                  {video.artists.map((artist) => (
                    <li key={artist.id}>
                      <Link
                        href={`/artists/${artist.slug}`}
                        className="group flex items-center gap-3"
                      >
                        <MediaFrame
                          src={artist.profileImageUrl}
                          alt={artist.stageName}
                          seed={artist.stageName}
                          ratio="square"
                          className="w-11 shrink-0 rounded-full border border-ink-600"
                        />
                        <span className="text-sm text-bone transition-colors group-hover:text-gold-300">
                          {artist.stageName}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {video.soundtrackAlbum ? (
              <div>
                <h2 className="eyebrow mb-3">Soundtrack</h2>
                <Link href={`/albums/${video.soundtrackAlbum.slug}`} className="group flex gap-3">
                  <MediaFrame
                    src={video.soundtrackAlbum.artworkUrl}
                    alt={video.soundtrackAlbum.title}
                    seed={video.soundtrackAlbum.title}
                    ratio="square"
                    className="w-16 shrink-0 border border-ink-600"
                  />
                  <span className="min-w-0">
                    <span className="block line-clamp-1 text-sm text-bone transition-colors group-hover:text-gold-300">
                      {video.soundtrackAlbum.title}
                    </span>
                    <span className="block text-xs text-bone-dim">
                      {video.soundtrackAlbum.artist.stageName}
                    </span>
                  </span>
                </Link>
              </div>
            ) : null}
          </aside>
        </div>

        {related.length > 0 ? (
          <section className="mt-20">
            <SectionHeader eyebrow="Keep watching" title="More like this" href="/watch" />
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
              {related.map((item) => (
                <VideoCard key={item.id} video={item} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
