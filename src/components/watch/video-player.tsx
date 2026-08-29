'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { MediaFrame } from '@/components/ui/media-frame';

interface PlaybackResponse {
  allowed: boolean;
  reason?: string;
  playbackUrl?: string | null;
  provider?: string;
  error?: string;
}

/**
 * Playback is requested from the server at press time rather than embedded in
 * the page, so the entitlement check runs per view and a signed URL is never
 * rendered into HTML that could be cached or shared.
 */
export function VideoPlayer({
  videoId,
  title,
  posterUrl,
}: {
  videoId: string;
  title: string;
  posterUrl?: string | null;
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [source, setSource] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const start = useCallback(async () => {
    setState('loading');
    setMessage(null);

    try {
      const response = await fetch(`/api/media/video/${videoId}`, { cache: 'no-store' });
      const data = (await response.json()) as PlaybackResponse;

      if (!response.ok || !data.allowed) {
        setState('error');
        setMessage(
          data.reason === 'MEMBERSHIP_REQUIRED'
            ? 'This title is included with membership.'
            : data.reason === 'PURCHASE_REQUIRED'
              ? 'Purchase this title to watch it.'
              : 'This title is not available to play right now.',
        );
        return;
      }

      if (!data.playbackUrl) {
        setState('error');
        setMessage(data.error ?? 'No video file has been attached to this title yet.');
        return;
      }

      setSource(data.playbackUrl);
      setState('ready');
    } catch {
      setState('error');
      setMessage('Playback could not be started. Check your connection and try again.');
    }
  }, [videoId]);

  useEffect(() => {
    if (state === 'ready' && videoRef.current) {
      videoRef.current.play().catch(() => undefined);
    }
  }, [state]);

  if (state === 'ready' && source) {
    return (
      <div className="relative aspect-video w-full overflow-hidden border border-ink-600 bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={source}
          controls
          playsInline
          poster={posterUrl ?? undefined}
          className="h-full w-full"
        />
      </div>
    );
  }

  return (
    <MediaFrame
      src={posterUrl}
      alt={title}
      seed={title}
      ratio="video"
      className="border border-ink-600"
      overlay
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        <button
          type="button"
          onClick={start}
          disabled={state === 'loading'}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-500 text-ink transition-transform duration-300 ease-premium hover:scale-105 disabled:opacity-60"
          aria-label={`Play ${title}`}
        >
          {state === 'loading' ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink border-t-transparent" />
          ) : (
            <Play className="ml-1 h-7 w-7 fill-current" />
          )}
        </button>
        {message ? (
          <p className="max-w-sm px-6 text-center text-sm text-bone-muted">{message}</p>
        ) : null}
      </div>
    </MediaFrame>
  );
}
