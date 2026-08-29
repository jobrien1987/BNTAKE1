import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/server/auth/session';
import { evaluateAccess, hasEntitlement } from '@/server/services/entitlements';
import { SongRow, AlbumCard } from '@/components/cards/music-cards';
import { AddToCartButton } from '@/components/commerce/add-to-cart-button';
import { AccessGate } from '@/components/commerce/access-gate';
import { MediaFrame } from '@/components/ui/media-frame';
import { Badge, Breadcrumbs, SectionHeader } from '@/components/ui/primitives';
import { formatCents } from '@/lib/money';
import { formatDate, formatDuration, truncate } from '@/lib/utils';
import { appUrl } from '@/lib/env';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const album = await prisma.album.findUnique({
    where: { slug },
    select: {
      title: true,
      description: true,
      artworkUrl: true,
      status: true,
      artist: { select: { stageName: true } },
    },
  });

  if (!album || album.status !== 'PUBLISHED') {
    return { title: 'Album not found', robots: { index: false, follow: false } };
  }

  const description = album.description
    ? truncate(album.description, 155)
    : `${album.title} by ${album.artist.stageName} — stream and own it on Boosie Network.`;

  return {
    title: `${album.title} — ${album.artist.stageName}`,
    description,
    alternates: { canonical: `/albums/${slug}` },
    openGraph: {
      title: album.title,
      description,
      url: `/albums/${slug}`,
      type: 'music.album',
      images: album.artworkUrl ? [album.artworkUrl] : undefined,
    },
  };
}

export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();

  const album = await prisma.album.findUnique({
    where: { slug },
    include: {
      artist: true,
      genres: true,
      songs: {
        where: { status: 'PUBLISHED' },
        orderBy: [{ trackNumber: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  const isStaff = user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.role === 'EDITOR';
  if (!album || (album.status !== 'PUBLISHED' && !isStaff)) notFound();

  const decision = await evaluateAccess({
    accessType: album.accessType,
    kind: 'ALBUM',
    refId: album.id,
    userId: user?.id ?? null,
    role: user?.role ?? null,
    published: album.status === 'PUBLISHED',
  });

  const owned = user ? await hasEntitlement(user.id, 'ALBUM', album.id) : false;

  const moreFromArtist = await prisma.album.findMany({
    where: { artistId: album.artistId, status: 'PUBLISHED', id: { not: album.id } },
    orderBy: { releaseDate: 'desc' },
    take: 6,
  });

  const tracks = album.songs.map((song) => ({
    id: song.id,
    slug: song.slug,
    title: song.title,
    artworkUrl: song.artworkUrl ?? album.artworkUrl,
    artistName: album.artist.stageName,
    artistSlug: album.artist.slug,
    durationSec: song.durationSec,
    explicit: song.explicit,
    priceCents: song.priceCents,
    purchasable: song.purchasable,
    accessType: song.accessType,
  }));

  const totalSeconds = album.songs.reduce((sum, song) => sum + song.durationSec, 0);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'MusicAlbum',
    name: album.title,
    byArtist: { '@type': 'MusicGroup', name: album.artist.stageName },
    datePublished: album.releaseDate?.toISOString(),
    image: album.artworkUrl ?? undefined,
    numTracks: album.songs.length,
    url: `${appUrl.replace(/\/+$/, '')}/albums/${slug}`,
  };

  return (
    <div className="container-page py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <Breadcrumbs
        items={[
          { label: 'Listen', href: '/listen' },
          { label: album.artist.stageName, href: `/artists/${album.artist.slug}` },
          { label: album.title },
        ]}
      />

      <div className="grid gap-10 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div>
          <MediaFrame
            src={album.artworkUrl}
            alt={album.title}
            seed={album.title}
            ratio="square"
            priority
            className="border border-ink-600"
          />

          <div className="mt-6 space-y-3">
            {owned ? (
              <div className="rounded-sm border border-jade/40 bg-jade/10 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#8ff0c4]">
                In your library
              </div>
            ) : album.purchasable && album.priceCents ? (
              <>
                <p className="font-display text-3xl text-bone">{formatCents(album.priceCents)}</p>
                <p className="text-xs text-bone-dim">
                  Buying the album adds every track on it to your library.
                </p>
                <AddToCartButton kind="ALBUM" refId={album.id} label="Buy album" />
              </>
            ) : null}
          </div>

          <dl className="mt-8 space-y-2 border-t border-ink-700 pt-5 text-xs">
            {album.releaseDate ? (
              <div className="flex justify-between gap-4">
                <dt className="text-bone-dim">Released</dt>
                <dd className="text-bone">{formatDate(album.releaseDate)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-bone-dim">Tracks</dt>
              <dd className="text-bone">{album.songs.length}</dd>
            </div>
            {totalSeconds > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-bone-dim">Length</dt>
                <dd className="text-bone">{formatDuration(totalSeconds)}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="gold">Album</Badge>
            {album.accessType === 'MEMBERSHIP' ? <Badge>Members</Badge> : null}
            {album.status !== 'PUBLISHED' ? <Badge tone="warn">{album.status}</Badge> : null}
            {album.genres.map((genre) => (
              <Badge key={genre.id}>{genre.name}</Badge>
            ))}
          </div>

          <h1 className="mt-4 text-5xl leading-[0.9] sm:text-7xl">{album.title}</h1>

          <Link
            href={`/artists/${album.artist.slug}`}
            className="mt-3 inline-block text-lg text-bone-muted transition-colors hover:text-gold-300"
          >
            {album.artist.stageName}
          </Link>

          {album.description ? (
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-bone-muted">
              {album.description}
            </p>
          ) : null}

          <section className="mt-10">
            <SectionHeader eyebrow="Tracklist" title={`${album.songs.length} tracks`} />

            {tracks.length === 0 ? (
              <p className="panel px-6 py-10 text-center text-sm text-bone-dim">
                No tracks have been published on this album yet.
              </p>
            ) : (
              <div className="panel">
                {tracks.map((song, index) => (
                  <SongRow
                    key={song.id}
                    song={song}
                    index={index}
                    queue={tracks}
                    showArtwork={false}
                  />
                ))}
              </div>
            )}
          </section>

          {!decision.allowed && album.accessType !== 'FREE' ? (
            <div className="mt-8">
              <AccessGate
                reason={decision.reason}
                kind="ALBUM"
                refId={album.id}
                priceCents={album.priceCents}
                purchasable={album.purchasable}
                title={album.title}
                returnTo={`/albums/${slug}`}
              />
            </div>
          ) : null}
        </div>
      </div>

      {moreFromArtist.length > 0 ? (
        <section className="mt-20">
          <SectionHeader
            eyebrow="Discography"
            title={`More from ${album.artist.stageName}`}
            href={`/artists/${album.artist.slug}`}
          />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {moreFromArtist.map((item) => (
              <AlbumCard
                key={item.id}
                album={{
                  ...item,
                  artistName: album.artist.stageName,
                  artistSlug: album.artist.slug,
                }}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
