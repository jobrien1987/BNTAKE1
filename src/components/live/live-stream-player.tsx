'use client';

import { useEffect, useRef } from 'react';

/**
 * Plays an HLS live stream. Browsers with native HLS (Safari, iOS) play the
 * playlist directly; everywhere else hls.js is loaded on demand so the bundle
 * does not carry it for pages that never stream.
 */
export function LiveStreamPlayer({
  playbackUrl,
  title,
  posterUrl,
}: {
  playbackUrl: string;
  title: string;
  posterUrl?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const isHls = playbackUrl.includes('.m3u8');
    let destroy: (() => void) | undefined;

    if (!isHls || video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playbackUrl;
    } else {
      let cancelled = false;
      import('hls.js')
        .then(({ default: Hls }) => {
          if (cancelled || !Hls.isSupported()) return;
          const hls = new Hls({ lowLatencyMode: true });
          hls.loadSource(playbackUrl);
          hls.attachMedia(video);
          destroy = () => hls.destroy();
        })
        .catch(() => {
          // Fall back to letting the browser try the URL directly.
          video.src = playbackUrl;
        });
      return () => {
        cancelled = true;
        destroy?.();
      };
    }

    return () => destroy?.();
  }, [playbackUrl]);

  return (
    <div className="relative aspect-video w-full overflow-hidden border border-ink-600 bg-black">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        controls
        autoPlay
        playsInline
        poster={posterUrl ?? undefined}
        aria-label={title}
        className="h-full w-full"
      />
    </div>
  );
}
