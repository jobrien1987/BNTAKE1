import type { Metadata } from 'next';
import Link from 'next/link';
import { globalSearch, SEARCH_GROUP_LABELS, type SearchGroupKey } from '@/server/services/search';
import { MediaFrame } from '@/components/ui/media-frame';
import { EmptyState, SectionHeader } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search across culture, music, video, shop and campaigns.',
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  const results = query ? await globalSearch(query, 12) : null;

  const groups = results
    ? (Object.keys(results.groups) as SearchGroupKey[]).filter(
        (key) => results.groups[key].length > 0,
      )
    : [];

  return (
    <div className="container-page py-12 sm:py-16">
      <header className="mb-10 border-b border-ink-700 pb-8">
        <p className="eyebrow">Search</p>
        <h1 className="mt-3 text-4xl leading-none sm:text-6xl">
          {query ? `“${query}”` : 'Search the network'}
        </h1>
        {results ? (
          <p className="mt-3 text-sm text-bone-dim">
            {results.total} result{results.total === 1 ? '' : 's'}
          </p>
        ) : null}
      </header>

      <form method="get" className="mb-12 flex max-w-xl gap-3">
        <label className="sr-only" htmlFor="q">
          Search
        </label>
        <input
          id="q"
          name="q"
          defaultValue={query}
          placeholder="Songs, artists, stories, movies, merch…"
          className="h-12 w-full rounded-sm border border-ink-600 bg-ink-800 px-4 text-sm text-bone placeholder:text-bone-dim focus:border-gold-700 focus:outline-none focus:ring-2 focus:ring-gold-500/40"
        />
        <button
          type="submit"
          className="h-12 shrink-0 rounded-sm bg-gold-500 px-6 text-xs font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:bg-gold-400"
        >
          Search
        </button>
      </form>

      {!query ? (
        <EmptyState
          title="What are you looking for?"
          description="Search across Culture, Watch, Listen, Shop and Heartfelt in one place."
          action={
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/culture" variant="outline">
                Browse Culture
              </ButtonLink>
              <ButtonLink href="/listen" variant="outline">
                Browse Listen
              </ButtonLink>
            </div>
          }
        />
      ) : groups.length === 0 ? (
        <EmptyState
          title="Nothing matched"
          description={`We couldn't find anything for “${query}”. Try fewer words or a different spelling.`}
          action={<ButtonLink href="/search">Start over</ButtonLink>}
        />
      ) : (
        <div className="space-y-14">
          {groups.map((group) => (
            <section key={group}>
              <SectionHeader
                eyebrow={`${results!.groups[group].length} found`}
                title={SEARCH_GROUP_LABELS[group]}
              />

              <ul className="divide-y divide-ink-700 border-y border-ink-700">
                {results!.groups[group].map((result) => (
                  <li key={`${group}-${result.id}`}>
                    <Link href={result.href} className="group flex items-center gap-4 py-4">
                      <MediaFrame
                        src={result.imageUrl}
                        alt={result.title}
                        seed={result.title}
                        ratio="square"
                        className="h-14 w-14 shrink-0 border border-ink-600"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-bone transition-colors group-hover:text-gold-300">
                          {result.title}
                        </p>
                        {result.subtitle ? (
                          <p className="truncate text-xs text-bone-dim">{result.subtitle}</p>
                        ) : null}
                      </div>
                      {result.meta ? (
                        <span className="shrink-0 text-xs text-bone-dim">{result.meta}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
