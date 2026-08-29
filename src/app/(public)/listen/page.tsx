import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { AlbumCard, ArtistCard, SongRow } from '@/components/cards/music-cards';
import { RadioPlayButton } from '@/components/listen/radio-play-button';
import { EmptyState, SectionHeader } from '@/components/ui/primitives';
import { MediaFrame } from '@/components/ui/media-frame';
import { ButtonLink } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Listen — songs, albums, artists and radio',
  description:
    'Stream songs and albums from Boosie Network artists, browse the roster and tune into Badazz Radio.',
  alternates: { canonical: '/listen' },
  openGraph: { title: 'Listen | Boosie Network', url: '/listen' },
};

export default async function ListenPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string }>;
}) {
  const { genre: genreSlug } = await searchParams;

  const genreFilter = genreSlug ? { genres: { some: { slug: genreSlug } } } : {};

  const [genres, featuredAlbums, latestAlbums, featuredSongs, artists, playlists, station] =
    await Promise.all([
      prisma.genre.findMany({ orderBy: { name: 'asc' }, take: 14 }),
      prisma.album.findMany({
        where: { status: 'PUBLISHED', featured: true, ...genreFilter },
        include: { artist: { select: { stageName: true, slug: true } } },
        orderBy: { releaseDate: 'desc' },
        take: 6,
      }),
      prisma.album.findMany({
        where: { status: 'PUBLISHED', ...genreFilter },
        include: { artist: { select: { stageName: true, slug: true } } },
        orderBy: [{ releaseDate: 'desc' }, { createdAt: 'desc' }],
        take: 12,
      }),
      prisma.song.findMany({
        where: { status: 'PUBLISHED', ...genreFilter },
        include: { artist: { select: { stageName: true, slug: true } } },
        orderBy: [{ featured: 'desc' }, { playCount: 'desc' }],
        take: 10,
      }),
      prisma.artist.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: [{ featured: 'desc' }, { followerCount: 'desc' }],
        take: 12,
      }),
      prisma.playlist.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
        take: 6,
        include: { _count: { select: { items: true } } },
      }),
      prisma.radioStation.findFirst({ where: { active: true } }),
    ]);

  const tracks = featuredSongs.map((song) => ({
    id: song.id,
    slug: song.slug,
    title: song.title,
    artworkUrl: song.artworkUrl,
    artistName: song.artist.stageName,
    artistSlug: song.artist.slug,
    durationSec: song.durationSec,
    explicit: song.explicit,
    priceCents: song.priceCents,
    purchasable: song.purchasable,
    accessType: song.accessType,
  }));

  return (
    <div className="container-page py-12 sm:py-16">
      <header className="mb-10 border-b border-ink-700 pb-8">
        <p className="eyebrow">Boosie Network</p>
        <h1 className="mt-3 text-5xl leading-none sm:text-7xl">LISTEN</h1>
        <p className="mt-4 max-w-2xl text-base text-bone-muted">
          Songs, albums and the artists behind them — plus Badazz Radio running around the clock.
        </p>
      </header>

      {genres.length > 0 ? (
        <nav
          className="no-scrollbar -mx-4 mb-12 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
          aria-label="Genres"
        >
          <GenreChip href="/listen" active={!genreSlug}>
            All
          </GenreChip>
          {genres.map((genre) => (
            <GenreChip
              key={genre.id}
              href={`/listen?genre=${genre.slug}`}
              active={genreSlug === genre.slug}
            >
              {genre.name}
            </GenreChip>
          ))}
        </nav>
      ) : null}

      {station ? (
        <section className="mb-16">
          <div className="panel flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
            <MediaFrame
              src={station.logoUrl}
              alt={station.name}
              seed={station.name}
              ratio="square"
              className="w-28 shrink-0 border border-ink-600"
            />
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Always on</p>
              <h2 className="mt-2 text-3xl leading-none sm:text-4xl">{station.name}</h2>
              {station.tagline ? (
                <p className="mt-2 text-sm text-bone-dim">{station.tagline}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:w-48">
              <RadioPlayButton station={station} />
              <ButtonLink href="/radio" variant="outline" size="sm">
                Station page
              </ButtonLink>
            </div>
          </div>
        </section>
      ) : null}

      {featuredAlbums.length > 0 ? (
        <section className="mb-16">
          <SectionHeader eyebrow="Editor's picks" title="Featured albums" />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {featuredAlbums.map((album) => (
              <AlbumCard
                key={album.id}
                album={{
                  ...album,
                  artistName: album.artist.stageName,
                  artistSlug: album.artist.slug,
                }}
              />
            ))}
          </div>
        </section>
      ) : null}

      {tracks.length > 0 ? (
        <section className="mb-16">
          <SectionHeader eyebrow="On rotation" title="Tracks to start with" />
          <div className="panel">
            {tracks.map((song, index) => (
              <SongRow key={song.id} song={song} index={index} queue={tracks} />
            ))}
          </div>
        </section>
      ) : null}

      {latestAlbums.length > 0 ? (
        <section className="mb-16">
          <SectionHeader eyebrow="New" title="Latest releases" />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {latestAlbums.map((album) => (
              <AlbumCard
                key={album.id}
                album={{
                  ...album,
                  artistName: album.artist.stageName,
                  artistSlug: album.artist.slug,
                }}
              />
            ))}
          </div>
        </section>
      ) : null}

      {artists.length > 0 ? (
        <section className="mb-16">
          <SectionHeader eyebrow="The roster" title="Artists" />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 lg:grid-cols-6">
            {artists.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        </section>
      ) : null}

      {playlists.length > 0 ? (
        <section className="mb-16">
          <SectionHeader eyebrow="Curated" title="Playlists" />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {playlists.map((playlist) => (
              <div key={playlist.id}>
                <MediaFrame
                  src={playlist.artworkUrl}
                  alt={playlist.title}
                  seed={playlist.title}
                  ratio="square"
                  className="border border-ink-600"
                />
                <h3 className="mt-3 line-clamp-1 font-display text-sm uppercase tracking-tight text-bone">
                  {playlist.title}
                </h3>
                <p className="mt-0.5 text-xs text-bone-dim">
                  {playlist._count.items} track{playlist._count.items === 1 ? '' : 's'}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {featuredAlbums.length === 0 &&
      latestAlbums.length === 0 &&
      tracks.length === 0 &&
      artists.length === 0 ? (
        <EmptyState
          title="No music published yet"
          description="Once music is published it appears here. Check back soon."
          action={
            <ButtonLink href="/culture" variant="outline">
              Read Culture instead
            </ButtonLink>
          }
        />
      ) : null}
    </div>
  );
}

function GenreChip({
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
