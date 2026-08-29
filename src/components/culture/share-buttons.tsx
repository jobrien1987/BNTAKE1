'use client';

import * as React from 'react';
import { Check, Link2, Share2 } from 'lucide-react';

/**
 * Real share behaviour: native share sheet where supported, clipboard copy
 * everywhere else, plus direct intent links.
 */
export function ShareButtons({ title, path }: { title: string; path: string }) {
  const [copied, setCopied] = React.useState(false);
  const [url, setUrl] = React.useState('');

  React.useEffect(() => {
    setUrl(`${window.location.origin}${path}`);
  }, [path]);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User dismissed the sheet — fall through to copying.
      }
    }
    await copy();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={share}
        className="inline-flex items-center gap-2 border border-ink-600 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-bone-muted transition-colors hover:border-gold-700 hover:text-bone"
      >
        <Share2 className="h-3.5 w-3.5" /> Share
      </button>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-2 border border-ink-600 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-bone-muted transition-colors hover:border-gold-700 hover:text-bone"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-jade" /> : <Link2 className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy link'}
      </button>
      {url ? (
        <>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-ink-600 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-bone-muted transition-colors hover:border-gold-700 hover:text-bone"
          >
            X
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-ink-600 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-bone-muted transition-colors hover:border-gold-700 hover:text-bone"
          >
            Facebook
          </a>
        </>
      ) : null}
    </div>
  );
}
