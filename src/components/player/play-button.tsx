'use client';

import { Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlayer, type PlayerTrack } from './player-provider';

export interface PlayButtonProps {
  track: PlayerTrack;
  queue?: PlayerTrack[];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
  variant?: 'circle' | 'wide';
}

const SIZES = {
  sm: 'h-8 w-8',
  md: 'h-11 w-11',
  lg: 'h-14 w-14',
} as const;

export function PlayButton({
  track,
  queue,
  size = 'md',
  className,
  label,
  variant = 'circle',
}: PlayButtonProps) {
  const player = usePlayer();
  const active = player.isCurrent(track.id);
  const playing = active && player.isPlaying;

  const handleClick = () => {
    if (active) {
      player.toggle();
      return;
    }
    player.playTrack(track, queue);
  };

  if (variant === 'wide') {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
        className={cn(
          'inline-flex h-11 items-center gap-2 rounded-sm bg-gold-500 px-5 text-xs font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:bg-gold-400',
          className,
        )}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
        {label ?? (playing ? 'Pause' : 'Play')}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-gold-500 text-ink shadow-gold transition-all duration-200 ease-premium hover:scale-105 hover:bg-gold-400 active:scale-95',
        SIZES[size],
        className,
      )}
    >
      {playing ? (
        <Pause className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
      ) : (
        <Play className={cn('fill-current', size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5', 'ml-0.5')} />
      )}
    </button>
  );
}

export function NowPlayingBars({ className }: { className?: string }) {
  return (
    <span className={cn('flex h-3 items-end gap-0.5', className)} aria-hidden>
      {[0, 1, 2].map((bar) => (
        <span
          key={bar}
          className="w-0.5 origin-bottom animate-bar-pulse bg-gold-400"
          style={{ height: '100%', animationDelay: `${bar * 0.15}s` }}
        />
      ))}
    </span>
  );
}
