import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/server/auth/guards';
import { getLibrary } from '@/server/services/entitlements';
import { AlbumCard, SongRow } from '@/components/cards/music-cards';
import { VideoCard } from '@/components/cards/video-card';
import { MediaFrame } from '@/components/ui/media-frame';
import { EmptyState, SectionHeader } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your library',
  robots: { index: false, follow: false },
};

export default async function LibraryPage() {
  const user = await requireUser('/account/library');
  const library = await getLibrary(user.id);

  if (library.total === 0) {
    return (
      <EmptyState
        title="Your library is empty"
        description="Music, movies and digital products you buy live here permanently — no expiry, no re-purchase."
        action={
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/listen">Browse music</ButtonLink>
            <ButtonLink href="/watch" variant="outline">
              Browse titles
            </ButtonLink>
          </div>
        }
      />
    );
  }

  const tracks = library.songs.map((song) => ({
    id: song.id,
    slug: song.slug,
    title: song.title,
    artworkUrl: song.artworkUrl,
    artistName: song.artist.stageName,
    artistSlug: song.artist.slug,
    durationSec: song.durationSec,
    explicit: song.explicit,
    priceCents: song.priceCents,
    purchasable: false,
    accessType: song.accessType,
  }));

  return (
    <div className="space-y-14">
      <p className="text-sm text-bone-dim">
        {library.total} item{library.total === 1 ? '' : 's'} you own. These stay in your library for
        good.
      </p>

      {library.albums.length > 0 ? (
        <section>
          <SectionHeader eyebrow="Owned" title="Albums" />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {library.albums.map((album) => (
              <AlbumCard
                key={album.id}
                album={{
                  ...album,
                  artistName: album.artist.stageName,
                  artistSlug: album.artist.slug,
                  purchasable: false,
                }}
              />
            ))}
          </div>
        </section>
      ) : null}

      {tracks.length > 0 ? (
        <section>
          <SectionHeader eyebrow="Owned" title="Tracks" />
          <div className="panel">
            {tracks.map((song, index) => (
              <SongRow key={song.id} song={song} index={index} queue={tracks} />
            ))}
          </div>
        </section>
      ) : null}

      {library.videos.length > 0 ? (
        <section>
          <SectionHeader eyebrow="Owned" title="Movies and documentaries" />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {library.videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        </section>
      ) : null}

      {library.otherVideos.length > 0 ? (
        <section>
          <SectionHeader eyebrow="Owned" title="Other video" />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {library.otherVideos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        </section>
      ) : null}

      {library.digitalProducts.length > 0 ? (
        <section>
          <SectionHeader eyebrow="Owned" title="Digital products" />
          <ul className="divide-y divide-ink-700 border-y border-ink-700">
            {library.digitalProducts.map((product) => (
              <li key={product.id} className="flex items-center gap-4 py-4">
                <MediaFrame
                  src={product.images[0]?.url}
                  alt={product.title}
                  seed={product.title}
                  ratio="square"
                  className="h-14 w-14 shrink-0 border border-ink-600"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/shop/${product.slug}`}
                    className="text-sm text-bone transition-colors hover:text-gold-300"
                  >
                    {product.title}
                  </Link>
                </div>
                {product.digitalAssetUrl ? (
                  <a
                    href={product.digitalAssetUrl}
                    className="shrink-0 border border-gold-700/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-300 transition-colors hover:border-gold-500 hover:text-gold-200"
                    download
                  >
                    Download
                  </a>
                ) : (
                  <span className="shrink-0 text-xs text-bone-dim">No download file attached</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
