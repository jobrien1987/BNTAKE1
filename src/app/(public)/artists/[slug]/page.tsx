import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/server/auth/session';
import { AlbumCard, SongRow } from '@/components/cards/music-cards';
import { VideoCard } from '@/components/cards/video-card';
import { ProductCard } from '@/components/cards/product-card';
import { ArticleCard } from '@/components/cards/article-card';
import { FollowArtistButton } from '@/components/listen/follow-artist-button';
import { MediaFrame } from '@/components/ui/media-frame';
import { Badge, Breadcrumbs, SectionHeader, EmptyState } from '@/components/ui/primitives';
import { truncate } from '@/lib/utils';
import { appUrl } from '@/lib/env';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const artist = await prisma.artist.findUnique({
    where: { slug },
    select: { stageName: true, bio: true, profileImageUrl: true, heroImageUrl: true, status: true },
  });

  if (!artist || artist.status !== 'PUBLISHED') {
    return { title: 'Artist not found', robots: { index: false, follow: false } };
  }

  const description = artist.bio
    ? truncate(artist.bio, 155)
    : `${artist.stageName} on Boosie Network — music, videos and releases.`;

  return {
    title: artist.stageName,
    description,
    alternates: { canonical: `/artists/${slug}` },
    openGraph: {
      title: artist.stageName,
      description,
      url: `/artists/${slug}`,
      type: 'profile',
      images: artist.heroImageUrl ?? artist.profileImageUrl ? [artist.heroImageUrl ?? artist.profileImageUrl!] : undefined,
    },
  };
}

export default async function ArtistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();

  const artist = await prisma.artist.findUnique({
    where: { slug },
    include: {
      albums: {
        where: { status: 'PUBLISHED' },
        orderBy: { releaseDate: 'desc' },
      },
      songs: {
        where: { status: 'PUBLISHED' },
        orderBy: [{ featured: 'desc' }, { playCount: 'desc' }],
        take: 10,
      },
      videos: { where: { status: 'PUBLISHED' }, orderBy: { releaseDate: 'desc' }, take: 6 },
      products: {
        where: { active: true },
        include: { images: { take: 1, orderBy: { position: 'asc' } } },
        take: 6,
      },
      articles: {
        where: { status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        take: 3,
        include: { category: { select: { name: true } } },
      },
      _count: { select: { follows: true, songs: true, albums: true } },
    },
  });

  const isStaff = user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.role === 'EDITOR';
  if (!artist || (artist.status !== 'PUBLISHED' && !isStaff)) notFound();

  const following = user
    ? Boolean(
        await prisma.artistFollow.findUnique({
          where: { userId_artistId: { userId: user.id, artistId: artist.id } },
          select: { id: true },
        }),
      )
    : false;

  const tracks = artist.songs.map((song) => ({
    id: song.id,
    slug: song.slug,
    title: song.title,
    artworkUrl: song.artworkUrl,
    artistName: artist.stageName,
    artistSlug: artist.slug,
    durationSec: song.durationSec,
    explicit: song.explicit,
    priceCents: song.priceCents,
    purchasable: song.purchasable,
    accessType: song.accessType,
  }));

  const socials = [
    { label: 'Website', href: artist.websiteUrl },
    { label: 'Instagram', href: artist.instagramUrl },
    { label: 'X', href: artist.twitterUrl },
    { label: 'YouTube', href: artist.youtubeUrl },
    { label: 'Spotify', href: artist.spotifyUrl },
  ].filter((entry): entry is { label: string; href: string } => Boolean(entry.href));

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: artist.stageName,
    description: artist.bio ?? undefined,
    image: artist.profileImageUrl ?? undefined,
    url: `${appUrl.replace(/\/+$/, '')}/artists/${slug}`,
    sameAs: socials.map((entry) => entry.href),
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="relative">
        <MediaFrame
          src={artist.heroImageUrl ?? artist.profileImageUrl}
          alt={artist.stageName}
          seed={artist.stageName}
          ratio="wide"
          priority
          overlay
          className="max-h-[420px]"
        />
      </div>

      <div className="container-page -mt-20 pb-16 sm:-mt-28">
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end">
          <MediaFrame
            src={artist.profileImageUrl}
            alt={artist.stageName}
            seed={artist.stageName}
            ratio="square"
            className="w-32 shrink-0 border-2 border-ink-600 sm:w-44"
          />
          <div className="min-w-0 flex-1 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              {artist.verified ? <Badge tone="gold">Verified</Badge> : null}
              {artist.status !== 'PUBLISHED' ? <Badge tone="warn">{artist.status}</Badge> : null}
              {artist.location ? <Badge>{artist.location}</Badge> : null}
            </div>
            <h1 className="mt-3 text-5xl leading-none sm:text-7xl">{artist.stageName}</h1>
            <p className="mt-3 text-sm text-bone-dim">
              {artist._count.follows.toLocaleString()} follower
              {artist._count.follows === 1 ? '' : 's'} · {artist._count.songs} song
              {artist._count.songs === 1 ? '' : 's'} · {artist._count.albums} album
              {artist._count.albums === 1 ? '' : 's'}
            </p>
          </div>
          <div className="shrink-0 pb-2 sm:w-48">
            <FollowArtistButton
              artistId={artist.id}
              artistName={artist.stageName}
              initialFollowing={following}
              signedIn={Boolean(user)}
              returnTo={`/artists/${slug}`}
            />
          </div>
        </div>

        <Breadcrumbs
          items={[{ label: 'Listen', href: '/listen' }, { label: artist.stageName }]}
        />

        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-16">
            {tracks.length > 0 ? (
              <section>
                <SectionHeader eyebrow="Most played" title="Top tracks" />
                <div className="panel">
                  {tracks.map((song, index) => (
                    <SongRow key={song.id} song={song} index={index} queue={tracks} />
                  ))}
                </div>
              </section>
            ) : null}

            {artist.albums.length > 0 ? (
              <section>
                <SectionHeader eyebrow="Discography" title="Albums" />
                <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
                  {artist.albums.map((album) => (
                    <AlbumCard
                      key={album.id}
                      album={{
                        ...album,
                        artistName: artist.stageName,
                        artistSlug: artist.slug,
                      }}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {artist.videos.length > 0 ? (
              <section>
                <SectionHeader eyebrow="On screen" title="Video" href="/watch" />
                <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
                  {artist.videos.map((video) => (
                    <VideoCard key={video.id} video={video} />
                  ))}
                </div>
              </section>
            ) : null}

            {artist.products.length > 0 ? (
              <section>
                <SectionHeader eyebrow="Merch" title="Shop this artist" href="/shop" />
                <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
                  {artist.products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={{ ...product, imageUrl: product.images[0]?.url ?? null }}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {artist.articles.length > 0 ? (
              <section>
                <SectionHeader eyebrow="In the news" title="Coverage" href="/culture" />
                <div className="grid gap-8 sm:grid-cols-3">
                  {artist.articles.map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={{ ...article, categoryName: article.category?.name ?? null }}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {tracks.length === 0 && artist.albums.length === 0 && artist.videos.length === 0 ? (
              <EmptyState
                title="Nothing published yet"
                description={`${artist.stageName} doesn't have published music on the network yet. Follow to be notified when that changes.`}
              />
            ) : null}
          </div>

          <aside className="space-y-8">
            {artist.bio ? (
              <div>
                <h2 className="eyebrow mb-3">About</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-bone-muted">
                  {artist.bio}
                </p>
              </div>
            ) : null}

            {socials.length > 0 ? (
              <div>
                <h2 className="eyebrow mb-3">Elsewhere</h2>
                <ul className="space-y-2">
                  {socials.map((entry) => (
                    <li key={entry.label}>
                      <a
                        href={entry.href}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-sm text-bone-muted transition-colors hover:text-gold-300"
                      >
                        {entry.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
