import Link from 'next/link';
import { MediaFrame } from '@/components/ui/media-frame';
import { Badge } from '@/components/ui/primitives';
import { PlayButton, NowPlayingBars } from '@/components/player/play-button';
import type { PlayerTrack } from '@/components/player/player-provider';
import { cn, formatDuration } from '@/lib/utils';
import { formatCents } from '@/lib/money';

export interface AlbumCardData {
  slug: string;
  title: string;
  artworkUrl?: string | null;
  artistName: string;
  artistSlug: string;
  releaseDate?: Date | string | null;
  priceCents?: number | null;
  purchasable?: boolean;
}

export function AlbumCard({ album, className }: { album: AlbumCardData; className?: string }) {
  const year = album.releaseDate ? new Date(album.releaseDate).getFullYear() : null;
  return (
    <Link href={`/albums/${album.slug}`} className={cn('group block', className)}>
      <MediaFrame
        src={album.artworkUrl}
        alt={album.title}
        seed={album.title}
        ratio="square"
        className="border border-ink-600 transition-all duration-300 ease-premium group-hover:border-gold-700/70 group-hover:shadow-lift"
      >
        {album.purchasable && album.priceCents ? (
          <span className="absolute right-2 top-2">
            <Badge tone="gold">{formatCents(album.priceCents)}</Badge>
          </span>
        ) : null}
      </MediaFrame>
      <h3 className="mt-3 line-clamp-1 font-display text-sm uppercase tracking-tight text-bone transition-colors group-hover:text-gold-300 sm:text-base">
        {album.title}
      </h3>
      <p className="mt-0.5 line-clamp-1 text-xs text-bone-dim">
        {album.artistName}
        {year ? ` · ${year}` : ''}
      </p>
    </Link>
  );
}

export interface SongRowData {
  id: string;
  slug: string;
  title: string;
  artworkUrl?: string | null;
  artistName: string;
  artistSlug: string;
  durationSec: number;
  explicit?: boolean;
  priceCents?: number | null;
  purchasable?: boolean;
  accessType?: 'FREE' | 'MEMBERSHIP' | 'PURCHASE';
}

export function songToTrack(song: SongRowData): PlayerTrack {
  return {
    id: song.id,
    title: song.title,
    artistName: song.artistName,
    artistSlug: song.artistSlug,
    songSlug: song.slug,
    artworkUrl: song.artworkUrl ?? null,
    streamUrl: `/api/media/song/${song.id}`,
    durationSec: song.durationSec,
  };
}

export function SongRow({
  song,
  index,
  queue,
  className,
  showArtwork = true,
}: {
  song: SongRowData;
  index?: number;
  queue?: SongRowData[];
  className?: string;
  showArtwork?: boolean;
}) {
  const track = songToTrack(song);
  const trackQueue = queue?.map(songToTrack);

  return (
    <div
      className={cn(
        'group flex items-center gap-3 border-b border-ink-700 px-2 py-2.5 transition-colors hover:bg-ink-800/70',
        className,
      )}
    >
      {typeof index === 'number' ? (
        <span className="w-6 shrink-0 text-center text-xs tabular-nums text-bone-dim group-hover:hidden">
          {index + 1}
        </span>
      ) : null}
      <div className={cn(typeof index === 'number' ? 'hidden group-hover:block' : '', 'shrink-0')}>
        <PlayButton track={track} queue={trackQueue} size="sm" />
      </div>

      {showArtwork ? (
        <MediaFrame
          src={song.artworkUrl}
          alt={song.title}
          seed={song.title}
          ratio="square"
          className="h-11 w-11 shrink-0"
        />
      ) : null}

      <div className="min-w-0 flex-1">
        <Link
          href={`/songs/${song.slug}`}
          className="block truncate text-sm text-bone transition-colors hover:text-gold-300"
        >
          {song.title}
          {song.explicit ? (
            <span className="ml-2 rounded-sm border border-ink-500 px-1 text-[9px] uppercase text-bone-dim">
              E
            </span>
          ) : null}
        </Link>
        <Link
          href={`/artists/${song.artistSlug}`}
          className="block truncate text-xs text-bone-dim transition-colors hover:text-gold-400"
        >
          {song.artistName}
        </Link>
      </div>

      {song.accessType === 'MEMBERSHIP' ? <Badge tone="gold">Members</Badge> : null}
      {song.purchasable && song.priceCents ? (
        <span className="hidden text-xs tabular-nums text-gold-400 sm:block">
          {formatCents(song.priceCents)}
        </span>
      ) : null}
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-bone-dim">
        {formatDuration(song.durationSec)}
      </span>
    </div>
  );
}

export { NowPlayingBars };

export interface ArtistCardData {
  slug: string;
  stageName: string;
  profileImageUrl?: string | null;
  location?: string | null;
  verified?: boolean;
}

export function ArtistCard({ artist, className }: { artist: ArtistCardData; className?: string }) {
  return (
    <Link href={`/artists/${artist.slug}`} className={cn('group block text-center', className)}>
      <MediaFrame
        src={artist.profileImageUrl}
        alt={artist.stageName}
        seed={artist.stageName}
        ratio="square"
        className="rounded-full border border-ink-600 transition-all duration-300 ease-premium group-hover:border-gold-600 group-hover:shadow-gold"
      />
      <h3 className="mt-3 line-clamp-1 font-display text-sm uppercase tracking-tight text-bone transition-colors group-hover:text-gold-300 sm:text-base">
        {artist.stageName}
      </h3>
      {artist.location ? (
        <p className="mt-0.5 line-clamp-1 text-[10px] uppercase tracking-[0.16em] text-bone-dim">
          {artist.location}
        </p>
      ) : null}
    </Link>
  );
}
