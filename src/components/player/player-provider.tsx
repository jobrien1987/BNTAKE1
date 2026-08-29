'use client';

import * as React from 'react';

export interface PlayerTrack {
  id: string;
  title: string;
  artistName: string;
  artistSlug?: string | null;
  songSlug?: string | null;
  artworkUrl?: string | null;
  /** Always an internal endpoint that enforces access server-side. */
  streamUrl: string;
  durationSec?: number;
  isRadio?: boolean;
}

interface PlayerState {
  queue: PlayerTrack[];
  index: number;
  current: PlayerTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  expanded: boolean;
  error: string | null;
}

interface PlayerContextValue extends PlayerState {
  playTrack: (track: PlayerTrack, queue?: PlayerTrack[]) => void;
  playQueue: (queue: PlayerTrack[], startIndex?: number) => void;
  toggle: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  setExpanded: (value: boolean) => void;
  close: () => void;
  isCurrent: (trackId: string) => boolean;
}

const PlayerContext = React.createContext<PlayerContextValue | null>(null);

export function usePlayer() {
  const context = React.useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used inside <PlayerProvider>.');
  return context;
}

/**
 * Mounted once in the root layout so playback survives client-side navigation.
 */
export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [state, setState] = React.useState<PlayerState>({
    queue: [],
    index: -1,
    current: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.85,
    muted: false,
    expanded: false,
    error: null,
  });

  const patch = React.useCallback((updates: Partial<PlayerState>) => {
    setState((previous) => ({ ...previous, ...updates }));
  }, []);

  const load = React.useCallback(
    (queue: PlayerTrack[], index: number) => {
      const track = queue[index];
      if (!track) return;
      patch({ queue, index, current: track, error: null, currentTime: 0, duration: track.durationSec ?? 0 });
      // The audio element source is bound declaratively below; play on next tick.
      window.setTimeout(() => {
        const audio = audioRef.current;
        if (!audio) return;
        void audio.play().catch(() => {
          patch({ isPlaying: false, error: 'Playback was blocked by the browser. Press play.' });
        });
      }, 0);
    },
    [patch],
  );

  const playTrack = React.useCallback(
    (track: PlayerTrack, queue?: PlayerTrack[]) => {
      const list = queue && queue.length ? queue : [track];
      const index = Math.max(
        0,
        list.findIndex((item) => item.id === track.id),
      );
      load(list, index);
    },
    [load],
  );

  const playQueue = React.useCallback(
    (queue: PlayerTrack[], startIndex = 0) => {
      if (queue.length === 0) return;
      load(queue, Math.min(Math.max(startIndex, 0), queue.length - 1));
    },
    [load],
  );

  const toggle = React.useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !state.current) return;
    if (audio.paused) {
      void audio.play().catch(() => patch({ error: 'Unable to play this track right now.' }));
    } else {
      audio.pause();
    }
  }, [patch, state.current]);

  const pause = React.useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const next = React.useCallback(() => {
    setState((previous) => {
      if (previous.index < 0 || previous.queue.length === 0) return previous;
      const nextIndex = previous.index + 1;
      if (nextIndex >= previous.queue.length) return { ...previous, isPlaying: false };
      const track = previous.queue[nextIndex];
      window.setTimeout(() => audioRef.current?.play().catch(() => undefined), 0);
      return { ...previous, index: nextIndex, current: track, currentTime: 0, error: null };
    });
  }, []);

  const previous = React.useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 4) {
      audio.currentTime = 0;
      return;
    }
    setState((prev) => {
      if (prev.index <= 0) return prev;
      const previousIndex = prev.index - 1;
      window.setTimeout(() => audioRef.current?.play().catch(() => undefined), 0);
      return { ...prev, index: previousIndex, current: prev.queue[previousIndex], currentTime: 0, error: null };
    });
  }, []);

  const seek = React.useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
  }, []);

  const setVolume = React.useCallback(
    (value: number) => {
      const clamped = Math.min(Math.max(value, 0), 1);
      if (audioRef.current) audioRef.current.volume = clamped;
      patch({ volume: clamped, muted: clamped === 0 });
    },
    [patch],
  );

  const toggleMute = React.useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    patch({ muted: audio.muted });
  }, [patch]);

  const setExpanded = React.useCallback((value: boolean) => patch({ expanded: value }), [patch]);

  const close = React.useCallback(() => {
    audioRef.current?.pause();
    patch({ queue: [], index: -1, current: null, isPlaying: false, expanded: false, currentTime: 0 });
  }, [patch]);

  const isCurrent = React.useCallback((trackId: string) => state.current?.id === trackId, [state.current]);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = state.volume;
  }, [state.volume]);

  // Media Session integration for lock-screen controls on mobile.
  React.useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !state.current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: state.current.title,
      artist: state.current.artistName,
      album: 'Boosie Network',
      artwork: state.current.artworkUrl ? [{ src: state.current.artworkUrl, sizes: '512x512' }] : [],
    });
    navigator.mediaSession.setActionHandler('play', () => audioRef.current?.play());
    navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
    navigator.mediaSession.setActionHandler('nexttrack', () => next());
    navigator.mediaSession.setActionHandler('previoustrack', () => previous());
  }, [state.current, next, previous]);

  const value: PlayerContextValue = {
    ...state,
    playTrack,
    playQueue,
    toggle,
    pause,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    setExpanded,
    close,
    isCurrent,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        src={state.current?.streamUrl}
        preload="metadata"
        onPlay={() => patch({ isPlaying: true })}
        onPause={() => patch({ isPlaying: false })}
        onTimeUpdate={(event) => patch({ currentTime: event.currentTarget.currentTime })}
        onLoadedMetadata={(event) =>
          patch({
            duration: Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0,
          })
        }
        onEnded={() => next()}
        onError={() =>
          state.current
            ? patch({
                isPlaying: false,
                error: 'This track is unavailable. It may require a purchase or membership.',
              })
            : undefined
        }
      />
    </PlayerContext.Provider>
  );
}
