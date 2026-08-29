import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { VideoCard } from '@/components/cards/video-card';
import { EmptyState, SectionHeader, Badge } from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { MediaFrame } from '@/components/ui/media-frame';
import { ButtonLink } from '@/components/ui/button';
import { cn, runtimeLabel, truncate } from '@/lib/utils';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Watch — movies, documentaries and exclusives',
  description:
    'Stream movies, documentaries, series and exclusive video from Boosie Network. Free titles, member titles and titles you can own.',
  alternates: { canonical: '/watch' },
  openGraph: { title: 'Watch | Boosie Network', url: '/watch' },
};

const PAGE_SIZE = 18;

const KINDS = [
  { key: 'MOVIE', label: 'Movies' },
  { key: 'DOCUMENTARY', label: 'Documentaries' },
  { key: 'SERIES', label: 'Series' },
  { key: 'EPISODE', label: 'Episodes' },
  { key: 'INTERVIEW', label: 'Interviews' },
  { key: 'MUSIC_VIDEO', label: 'Music videos' },
] as const;

type Kind = (typeof KINDS)[number]['key'];

export default async function WatchIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; access?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const kind = KINDS.find((entry) => entry.key === params.kind)?.key as Kind | undefined;
  const access =
    params.access === 'FREE' || params.access === 'MEMBERSHIP' || params.access === 'PURCHASE'
      ? params.access
      : undefined;

  const where = {
    status: 'PUBLISHED' as const,
    // Episodes belong to their series page unless explicitly browsed.
    ...(kind ? { kind } : { kind: { not: 'EPISODE' as const } }),
    ...(access ? { accessType: access } : {}),
  };

  const showFeature = page === 1 && !kind && !access;

  const [featured, total, videos] = await Promise.all([
    showFeature
      ? prisma.video.findFirst({
          where: { status: 'PUBLISHED', featured: true },
          orderBy: { releaseDate: 'desc' },
        })
      : Promise.resolve(null),
    prisma.video.count({ where }),
    prisma.video.findMany({
      where,
      orderBy: [{ featured: 'desc' }, { releaseDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const buildHref = (next: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    const merged = { kind: params.kind, access: params.access, ...next };
    for (const [key, value] of Object.entries(merged)) if (value) search.set(key, value);
    const query = search.toString();
    return `/watch${query ? `?${query}` : ''}`;
  };

  return (
    <div className="container-page py-12 sm:py-16">
      <header className="mb-10 border-b border-ink-700 pb-8">
        <p className="eyebrow">Boosie Network</p>
        <h1 className="mt-3 text-5xl leading-none sm:text-7xl">WATCH</h1>
        <p className="mt-4 max-w-2xl text-base text-bone-muted">
          Movies, documentaries, series and exclusives — some free, some included with membership,
          some yours to own for good.
        </p>
      </header>

      {featured ? (
        <section className="mb-16">
          <Link href={`/watch/${featured.slug}`} className="group block">
            <MediaFrame
              src={featured.backdropUrl ?? featured.posterUrl}
              alt={featured.title}
              seed={featured.title}
              ratio="hero"
              priority
              overlay
              className="border border-ink-600"
            >
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="gold">Featured</Badge>
                  <Badge>{featured.kind.replace('_', ' ')}</Badge>
                  {featured.accessType !== 'FREE' ? (
                    <Badge tone="warn">
                      {featured.accessType === 'MEMBERSHIP' ? 'Members' : 'Own it'}
                    </Badge>
                  ) : null}
                </div>
                <h2 className="mt-4 max-w-3xl text-4xl leading-[0.9] sm:text-6xl">
                  {featured.title}
                </h2>
                {featured.synopsis ? (
                  <p className="mt-4 max-w-xl text-sm text-bone-muted sm:text-base">
                    {truncate(featured.synopsis, 200)}
                  </p>
                ) : null}
                <span className="mt-6 inline-flex items-center gap-2 border-b border-gold-500 pb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-400 transition-colors group-hover:text-gold-300">
                  Watch now
                  {featured.durationSec ? ` · ${runtimeLabel(featured.durationSec)}` : ''}
                </span>
              </div>
            </MediaFrame>
          </Link>
        </section>
      ) : null}

      <nav
        className="no-scrollbar -mx-4 mb-10 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        aria-label="Filter titles"
      >
        <FilterChip href="/watch" active={!kind && !access}>
          All
        </FilterChip>
        {KINDS.map((entry) => (
          <FilterChip
            key={entry.key}
            href={buildHref({ kind: entry.key, page: undefined })}
            active={kind === entry.key}
          >
            {entry.label}
          </FilterChip>
        ))}
        <FilterChip href={buildHref({ access: 'FREE', page: undefined })} active={access === 'FREE'}>
          Free
        </FilterChip>
        <FilterChip
          href={buildHref({ access: 'MEMBERSHIP', page: undefined })}
          active={access === 'MEMBERSHIP'}
        >
          Members
        </FilterChip>
      </nav>

      {videos.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="No titles match this filter. Try another category, or browse everything."
          action={
            <ButtonLink href="/watch" variant="outline">
              Browse all titles
            </ButtonLink>
          }
        />
      ) : (
        <>
          <SectionHeader
            eyebrow={`${total} title${total === 1 ? '' : 's'}`}
            title={kind ? KINDS.find((entry) => entry.key === kind)!.label : 'Everything to watch'}
          />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        </>
      )}

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        buildHref={(nextPage) => buildHref({ page: nextPage === 1 ? undefined : String(nextPage) })}
      />
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'shrink-0 border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors',
        active
          ? 'border-gold-500 bg-gold-500 text-ink'
          : 'border-ink-600 text-bone-muted hover:border-gold-700 hover:text-bone',
      )}
    >
      {children}
    </Link>
  );
}
