'use client';

import { Pause, Play } from 'lucide-react';
import { usePlayer } from '@/components/player/player-provider';

export interface RadioStationSummary {
  id: string;
  name: string;
  streamUrl: string | null;
  logoUrl: string | null;
}

/**
 * Radio playback goes through the same persistent player as the rest of the
 * network. When no stream URL is configured the control is disabled with an
 * explanation instead of pretending to play.
 */
export function RadioPlayButton({
  station,
  className,
}: {
  station: RadioStationSummary;
  className?: string;
}) {
  const player = usePlayer();
  const trackId = `radio:${station.id}`;
  const active = player.isCurrent(trackId);
  const playing = active && player.isPlaying;

  if (!station.streamUrl) {
    return (
      <div className={className}>
        <button
          type="button"
          disabled
          className="inline-flex h-11 cursor-not-allowed items-center gap-2 rounded-sm border border-ink-500 px-5 text-xs font-semibold uppercase tracking-[0.14em] text-bone-dim"
        >
          <Play className="h-4 w-4" /> Stream offline
        </button>
        <p className="mt-2 max-w-xs text-xs text-bone-dim">
          Add a stream URL in Admin → Radio to put this station on air.
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`inline-flex h-11 items-center gap-2 rounded-sm bg-gold-500 px-5 text-xs font-semibold uppercase tracking-[0.14em] text-ink shadow-gold transition-colors hover:bg-gold-400 ${className ?? ''}`}
      onClick={() => {
        if (active) {
          player.toggle();
          return;
        }
        player.playTrack({
          id: trackId,
          title: station.name,
          artistName: 'Live radio',
          artworkUrl: station.logoUrl,
          streamUrl: station.streamUrl as string,
          isRadio: true,
        });
      }}
    >
      {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
      {playing ? 'Pause radio' : 'Listen live'}
    </button>
  );
}
