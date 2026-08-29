'use client';

import { useEffect } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[boosie-network] unhandled error', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow">Something broke</p>
      <h1 className="mt-4 font-display text-5xl leading-none sm:text-7xl">
        WE HIT A <span className="gold-text">SNAG</span>
      </h1>
      <p className="mt-5 max-w-md text-sm text-bone-dim">
        The page couldn’t finish loading. Try again — if it keeps happening, our team has been notified.
      </p>
      {error.digest ? (
        <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-ink-400">Ref {error.digest}</p>
      ) : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="outline">
          Go home
        </ButtonLink>
      </div>
    </div>
  );
}
