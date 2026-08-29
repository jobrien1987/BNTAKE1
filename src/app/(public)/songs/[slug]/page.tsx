import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/server/auth/session';
import { evaluateAccess, hasEntitlement } from '@/server/services/entitlements';
import { PlayButton } from '@/components/player/play-button';
import { SongRow, songToTrack } from '@/components/cards/music-cards';
import { AddToCartButton } from '@/components/commerce/add-to-cart-button';
import { AccessGate } from '@/components/commerce/access-gate';
import { MediaFrame } from '@/components/ui/media-frame';
import { Badge, Breadcrumbs, SectionHeader } from '@/components/ui/primitives';
import { formatCents } from '@/lib/money';
import { formatDate, formatDuration } from '@/lib/utils';
import { appUrl } from '@/lib/env';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const song = await prisma.song.findUnique({
    where: { slug },
    select: {
      title: true,
      artworkUrl: true,
      status: true,
      artist: { select: { stageName: true } },
    },
  });

  if (!song || song.status !== 'PUBLISHED') {
    return { title: 'Song not found', robots: { index: false, follow: false } };
  }

  const description = `Listen to ${song.title} by ${song.artist.stageName} on Boosie Network.`;

  return {
    title: `${song.title} — ${song.artist.stageName}`,
    description,
    alternates: { canonical: `/songs/${slug}` },
    openGraph: {
      title: song.title,
      description,
      url: `/songs/${slug}`,
      type: 'music.song',
      images: song.artworkUrl ? [song.artworkUrl] : undefined,
    },
  };
}

export default async function SongPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();

  const song = await prisma.song.findUnique({
    where: { slug },
    include: {
      artist: true,
      album: { select: { title: true, slug: true, artworkUrl: true } },
      featuredArtists: { select: { id: true, stageName: true, slug: true } },
      genres: true,
    },
  });

  const isStaff = user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.role === 'EDITOR';
  if (!song || (song.status !== 'PUBLISHED' && !isStaff)) notFound();

  const decision = await evaluateAccess({
    accessType: song.accessType,
    kind: 'SONG',
    refId: song.id,
    userId: user?.id ?? null,
    role: user?.role ?? null,
    published: song.status === 'PUBLISHED',
  });

  const owned = user ? await hasEntitlement(user.id, 'SONG', song.id) : false;

  const artworkUrl = song.artworkUrl ?? song.album?.artworkUrl ?? null;

  const trackData = {
    id: song.id,
    slug: song.slug,
    title: song.title,
    artworkUrl,
    artistName: song.artist.stageName,
    artistSlug: song.artist.slug,
    durationSec: song.durationSec,
    explicit: song.explicit,
    priceCents: song.priceCents,
    purchasable: song.purchasable,
    accessType: song.accessType,
  };

  const moreTracks = await prisma.song.findMany({
    where: { artistId: song.artistId, status: 'PUBLISHED', id: { not: song.id } },
    orderBy: { playCount: 'desc' },
    take: 6,
  });

  const moreTrackData = moreTracks.map((item) => ({
    id: item.id,
    slug: item.slug,
    title: item.title,
    artworkUrl: item.artworkUrl,
    artistName: song.artist.stageName,
    artistSlug: song.artist.slug,
    durationSec: item.durationSec,
    explicit: item.explicit,
    priceCents: item.priceCents,
    purchasable: item.purchasable,
    accessType: item.accessType,
  }));

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    name: song.title,
    byArtist: { '@type': 'MusicGroup', name: song.artist.stageName },
    duration: song.durationSec ? `PT${song.durationSec}S` : undefined,
    inAlbum: song.album ? { '@type': 'MusicAlbum', name: song.album.title } : undefined,
    url: `${appUrl.replace(/\/+$/, '')}/songs/${slug}`,
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
          { label: song.artist.stageName, href: `/artists/${song.artist.slug}` },
          { label: song.title },
        ]}
      />

      <div className="grid gap-10 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div>
          <MediaFrame
            src={artworkUrl}
            alt={song.title}
            seed={song.title}
            ratio="square"
            priority
            className="border border-ink-600"
          />

          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3">
              <PlayButton track={songToTrack(trackData)} size="lg" />
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.16em] text-bone-dim">
                  {decision.allowed ? 'Play' : 'Preview'}
                </p>
                <p className="text-sm text-bone">{formatDuration(song.durationSec)}</p>
              </div>
            </div>

            {owned ? (
              <div className="rounded-sm border border-jade/40 bg-jade/10 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#8ff0c4]">
                In your library
              </div>
            ) : song.purchasable && song.priceCents ? (
              <>
                <p className="font-display text-3xl text-bone">{formatCents(song.priceCents)}</p>
                <AddToCartButton kind="SONG" refId={song.id} label="Buy track" />
              </>
            ) : null}
          </div>

          <dl className="mt-8 space-y-2 border-t border-ink-700 pt-5 text-xs">
            {song.releaseDate ? (
              <div className="flex justify-between gap-4">
                <dt className="text-bone-dim">Released</dt>
                <dd className="text-bone">{formatDate(song.releaseDate)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-bone-dim">Plays</dt>
              <dd className="text-bone">{song.playCount.toLocaleString()}</dd>
            </div>
          </dl>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="gold">Track</Badge>
            {song.explicit ? <Badge>Explicit</Badge> : null}
            {song.accessType === 'MEMBERSHIP' ? <Badge tone="warn">Members</Badge> : null}
            {song.genres.map((genre) => (
              <Badge key={genre.id}>{genre.name}</Badge>
            ))}
          </div>

          <h1 className="mt-4 text-5xl leading-[0.9] sm:text-7xl">{song.title}</h1>

          <p className="mt-3 text-lg text-bone-muted">
            <Link
              href={`/artists/${song.artist.slug}`}
              className="transition-colors hover:text-gold-300"
            >
              {song.artist.stageName}
            </Link>
            {song.featuredArtists.length > 0 ? (
              <>
                <span className="text-bone-dim"> feat. </span>
                {song.featuredArtists.map((featured, index) => (
                  <span key={featured.id}>
                    {index > 0 ? ', ' : ''}
                    <Link
                      href={`/artists/${featured.slug}`}
                      className="transition-colors hover:text-gold-300"
                    >
                      {featured.stageName}
                    </Link>
                  </span>
                ))}
              </>
            ) : null}
          </p>

          {song.album ? (
            <Link
              href={`/albums/${song.album.slug}`}
              className="mt-6 inline-flex items-center gap-3 border border-ink-600 p-3 transition-colors hover:border-gold-700/70"
            >
              <MediaFrame
                src={song.album.artworkUrl}
                alt={song.album.title}
                seed={song.album.title}
                ratio="square"
                className="h-12 w-12"
              />
              <span>
                <span className="block text-[11px] uppercase tracking-[0.16em] text-bone-dim">
                  From the album
                </span>
                <span className="block text-sm text-bone">{song.album.title}</span>
              </span>
            </Link>
          ) : null}

          {!decision.allowed ? (
            <div className="mt-8">
              <AccessGate
                reason={decision.reason}
                kind="SONG"
                refId={song.id}
                priceCents={song.priceCents}
                purchasable={song.purchasable}
                title={song.title}
                returnTo={`/songs/${slug}`}
              />
            </div>
          ) : null}

          {moreTrackData.length > 0 ? (
            <section className="mt-12">
              <SectionHeader
                eyebrow="Keep listening"
                title={`More from ${song.artist.stageName}`}
                href={`/artists/${song.artist.slug}`}
              />
              <div className="panel">
                {moreTrackData.map((item, index) => (
                  <SongRow key={item.id} song={item} index={index} queue={moreTrackData} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
