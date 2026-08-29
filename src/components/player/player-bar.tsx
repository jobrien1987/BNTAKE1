'use client';

import Link from 'next/link';
import {
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';
import { MediaFrame } from '@/components/ui/media-frame';
import { usePlayer } from './player-provider';

/**
 * Persistent player. Compact on mobile with an expandable full-screen sheet,
 * full transport controls from `sm` up.
 */
export function PlayerBar() {
  const player = usePlayer();
  const track = player.current;

  if (!track) return null;

  const duration = player.duration || track.durationSec || 0;
  const progress = duration > 0 ? (player.currentTime / duration) * 100 : 0;

  return (
    <>
      {player.expanded ? (
        <div className="fixed inset-0 z-[70] flex flex-col bg-ink-900/98 backdrop-blur-xl sm:hidden">
          <div className="flex items-center justify-between px-4 py-4">
            <button
              type="button"
              onClick={() => player.setExpanded(false)}
              className="rounded-sm p-2 text-bone-muted"
              aria-label="Minimise player"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
            <span className="eyebrow">Now playing</span>
            <button
              type="button"
              onClick={player.close}
              className="rounded-sm p-2 text-bone-muted"
              aria-label="Close player"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-1 flex-col justify-center px-6 pb-10">
            <MediaFrame
              src={track.artworkUrl}
              alt={track.title}
              seed={track.title}
              ratio="square"
              className="mx-auto w-full max-w-sm shadow-lift"
            />
            <div className="mt-8 text-center">
              <p className="font-display text-2xl uppercase tracking-tight text-bone">{track.title}</p>
              {track.artistSlug ? (
                <Link
                  href={`/artists/${track.artistSlug}`}
                  onClick={() => player.setExpanded(false)}
                  className="mt-1 inline-block text-sm text-gold-400"
                >
                  {track.artistName}
                </Link>
              ) : (
                <p className="mt-1 text-sm text-bone-dim">{track.artistName}</p>
              )}
            </div>

            <ProgressBar
              value={player.currentTime}
              max={duration}
              onSeek={player.seek}
              className="mt-8"
              disabled={track.isRadio}
            />
            <div className="mt-2 flex justify-between text-[11px] tabular-nums text-bone-dim">
              <span>{track.isRadio ? 'LIVE' : formatDuration(player.currentTime)}</span>
              <span>{track.isRadio ? 'Badazz Radio' : formatDuration(duration)}</span>
            </div>

            <div className="mt-8 flex items-center justify-center gap-8">
              <button
                type="button"
                onClick={player.previous}
                className="text-bone-muted transition-colors hover:text-bone"
                aria-label="Previous track"
              >
                <SkipBack className="h-7 w-7 fill-current" />
              </button>
              <button
                type="button"
                onClick={player.toggle}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-500 text-ink shadow-gold"
                aria-label={player.isPlaying ? 'Pause' : 'Play'}
              >
                {player.isPlaying ? (
                  <Pause className="h-7 w-7" />
                ) : (
                  <Play className="ml-1 h-7 w-7 fill-current" />
                )}
              </button>
              <button
                type="button"
                onClick={player.next}
                className="text-bone-muted transition-colors hover:text-bone"
                aria-label="Next track"
              >
                <SkipForward className="h-7 w-7 fill-current" />
              </button>
            </div>

            {player.error ? (
              <p className="mt-6 text-center text-xs text-[#ff9aa2]">{player.error}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-[60] border-t border-ink-600 bg-ink-900/95 backdrop-blur-xl safe-bottom',
          player.expanded ? 'hidden sm:block' : '',
        )}
      >
        <div className="h-0.5 w-full bg-ink-700">
          <div
            className="h-full bg-gold-500 transition-[width] duration-200"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>

        <div className="container-page flex items-center gap-3 py-2.5">
          <button
            type="button"
            onClick={() => player.setExpanded(true)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left sm:flex-none sm:w-64"
          >
            <MediaFrame
              src={track.artworkUrl}
              alt={track.title}
              seed={track.title}
              ratio="square"
              className="h-11 w-11 shrink-0 rounded-sm"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-bone">{track.title}</span>
              <span className="block truncate text-xs text-bone-dim">{track.artistName}</span>
            </span>
            <ChevronUp className="ml-auto h-4 w-4 shrink-0 text-bone-dim sm:hidden" />
          </button>

          <div className="hidden flex-1 items-center gap-4 sm:flex">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={player.previous}
                className="text-bone-dim transition-colors hover:text-bone"
                aria-label="Previous track"
              >
                <SkipBack className="h-4 w-4 fill-current" />
              </button>
              <button
                type="button"
                onClick={player.toggle}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-500 text-ink transition-colors hover:bg-gold-400"
                aria-label={player.isPlaying ? 'Pause' : 'Play'}
              >
                {player.isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="ml-0.5 h-4 w-4 fill-current" />
                )}
              </button>
              <button
                type="button"
                onClick={player.next}
                className="text-bone-dim transition-colors hover:text-bone"
                aria-label="Next track"
              >
                <SkipForward className="h-4 w-4 fill-current" />
              </button>
            </div>

            <span className="w-10 text-right text-[11px] tabular-nums text-bone-dim">
              {track.isRadio ? 'LIVE' : formatDuration(player.currentTime)}
            </span>
            <ProgressBar
              value={player.currentTime}
              max={duration}
              onSeek={player.seek}
              className="flex-1"
              disabled={track.isRadio}
            />
            <span className="w-10 text-[11px] tabular-nums text-bone-dim">
              {track.isRadio ? '' : formatDuration(duration)}
            </span>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <button
              type="button"
              onClick={player.toggleMute}
              className="text-bone-dim transition-colors hover:text-bone"
              aria-label={player.muted ? 'Unmute' : 'Mute'}
            >
              {player.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={player.muted ? 0 : player.volume}
              onChange={(event) => player.setVolume(Number(event.target.value))}
              aria-label="Volume"
              className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-ink-500 accent-[#d4af37]"
            />
          </div>

          <button
            type="button"
            onClick={player.toggle}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-500 text-ink sm:hidden"
            aria-label={player.isPlaying ? 'Pause' : 'Play'}
          >
            {player.isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            )}
          </button>

          <button
            type="button"
            onClick={player.close}
            className="hidden text-bone-dim transition-colors hover:text-bone sm:block"
            aria-label="Close player"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Keeps page content clear of the fixed player. */}
      <div aria-hidden className="h-[68px]" />
    </>
  );
}

function ProgressBar({
  value,
  max,
  onSeek,
  className,
  disabled,
}: {
  value: number;
  max: number;
  onSeek: (seconds: number) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="range"
      min={0}
      max={Math.max(max, 1)}
      step={1}
      value={Math.min(value, max || 1)}
      disabled={disabled || max <= 0}
      onChange={(event) => onSeek(Number(event.target.value))}
      aria-label="Seek"
      className={cn(
        'h-1 cursor-pointer appearance-none rounded-full bg-ink-500 accent-[#d4af37] disabled:cursor-default disabled:opacity-50',
        className,
      )}
    />
  );
}
