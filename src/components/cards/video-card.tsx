import Link from 'next/link';
import { Play } from 'lucide-react';
import { MediaFrame } from '@/components/ui/media-frame';
import { Badge } from '@/components/ui/primitives';
import { cn, runtimeLabel } from '@/lib/utils';
import { formatCents } from '@/lib/money';

export interface VideoCardData {
  slug: string;
  title: string;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  kind: string;
  durationSec?: number;
  releaseDate?: Date | string | null;
  accessType: 'FREE' | 'MEMBERSHIP' | 'PURCHASE';
  priceCents?: number | null;
}

export function VideoCard({
  video,
  orientation = 'poster',
  className,
}: {
  video: VideoCardData;
  orientation?: 'poster' | 'landscape';
  className?: string;
}) {
  const year = video.releaseDate ? new Date(video.releaseDate).getFullYear() : null;

  return (
    <Link href={`/watch/${video.slug}`} className={cn('group block', className)}>
      <MediaFrame
        src={orientation === 'poster' ? video.posterUrl : (video.backdropUrl ?? video.posterUrl)}
        alt={video.title}
        seed={video.title}
        ratio={orientation === 'poster' ? 'poster' : 'video'}
        className="border border-ink-600 transition-all duration-300 ease-premium group-hover:border-gold-700/70 group-hover:shadow-lift"
      >
        <span className="absolute inset-0 flex items-center justify-center bg-ink/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-500 text-ink">
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          </span>
        </span>
        <span className="absolute left-2 top-2 flex flex-wrap gap-1">
          {video.accessType === 'MEMBERSHIP' ? <Badge tone="gold">Members</Badge> : null}
          {video.accessType === 'PURCHASE' && video.priceCents ? (
            <Badge tone="gold">{formatCents(video.priceCents)}</Badge>
          ) : null}
        </span>
      </MediaFrame>

      <h3 className="mt-3 line-clamp-2 font-display text-sm uppercase leading-tight tracking-tight text-bone transition-colors group-hover:text-gold-300 sm:text-base">
        {video.title}
      </h3>
      <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-bone-dim">
        {[video.kind.replace(/_/g, ' '), year, video.durationSec ? runtimeLabel(video.durationSec) : null]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </Link>
  );
}
