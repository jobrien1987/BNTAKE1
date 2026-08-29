'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Search, X } from 'lucide-react';
import { MediaFrame } from '@/components/ui/media-frame';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  imageUrl: string | null;
  meta: string | null;
}

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
      return () => window.clearTimeout(timer);
    }
    setQuery('');
    setResults([]);
    return undefined;
  }, [open]);

  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=3`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Search failed');
        const data = (await response.json()) as { results: SearchResult[] };
        setResults(data.results ?? []);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, open]);

  if (!open) return null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    onClose();
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div className="fixed inset-0 z-[75] flex flex-col bg-ink/95 backdrop-blur-xl" role="dialog" aria-modal="true" aria-label="Search">
      <div className="container-page flex items-center gap-3 border-b border-ink-600 py-5">
        <Search className="h-5 w-5 shrink-0 text-gold-500" />
        <form onSubmit={submit} className="flex-1">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search culture, music, movies, merch…"
            className="w-full border-0 bg-transparent py-2 font-display text-xl uppercase tracking-tight text-bone placeholder:text-bone-dim/60 focus:outline-none sm:text-3xl"
            aria-label="Search query"
          />
        </form>
        <button type="button" onClick={onClose} className="p-2 text-bone-muted hover:text-bone" aria-label="Close search">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="container-page flex-1 overflow-y-auto py-6">
        {query.trim().length < 2 ? (
          <p className="text-sm text-bone-dim">Type at least two characters to search the network.</p>
        ) : loading && results.length === 0 ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="skeleton h-16 w-full" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <p className="text-sm text-bone-dim">
            Nothing found for “{query}”. Try a different spelling or browse the pillars.
          </p>
        ) : (
          <ul className="divide-y divide-ink-700">
            {results.map((result) => (
              <li key={`${result.href}-${result.id}`}>
                <Link
                  href={result.href}
                  onClick={onClose}
                  className="flex items-center gap-4 py-3 transition-colors hover:bg-ink-800/60"
                >
                  <MediaFrame
                    src={result.imageUrl}
                    alt={result.title}
                    seed={result.title}
                    ratio="square"
                    className="h-12 w-12 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-bone">{result.title}</span>
                    {result.subtitle ? (
                      <span className="block truncate text-xs text-bone-dim">{result.subtitle}</span>
                    ) : null}
                  </span>
                  {result.meta ? (
                    <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-gold-600">
                      {result.meta}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {query.trim().length >= 2 ? (
          <button
            type="button"
            onClick={submit}
            className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-400 hover:text-gold-300"
          >
            See all results →
          </button>
        ) : null}
      </div>
    </div>
  );
}
