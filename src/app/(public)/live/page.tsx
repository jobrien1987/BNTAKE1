import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { flags } from '@/lib/env';
import { MediaFrame } from '@/components/ui/media-frame';
import { Badge, EmptyState, LiveDot, SectionHeader } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { formatCents } from '@/lib/money';
import { formatDateTime, truncate } from '@/lib/utils';

export const revalidate = 30;

export const metadata: Metadata = {
  title: 'Live — streams, premieres and replays',
  description:
    'Live streams, scheduled premieres and replays from Boosie Network artists and shows.',
  alternates: { canonical: '/live' },
  openGraph: { title: 'Live | Boosie Network', url: '/live' },
};

export default async function LiveIndexPage() {
  // The Live pillar always renders — the feature flag controls whether
  // playback is wired to a provider, not whether the schedule is visible.
  const [liveNow, upcoming, replays] = await Promise.all([
    prisma.liveStream.findMany({
      where: { status: 'LIVE' },
      orderBy: { startedAt: 'desc' },
      include: { artist: { select: { stageName: true, slug: true } } },
    }),
    prisma.liveStream.findMany({
      where: { status: 'SCHEDULED' },
      orderBy: { scheduledFor: 'asc' },
      take: 12,
      include: { artist: { select: { stageName: true, slug: true } } },
    }),
    prisma.liveStream.findMany({
      where: { status: 'ENDED', replayVideoId: { not: null } },
      orderBy: { endedAt: 'desc' },
      take: 12,
      include: {
        artist: { select: { stageName: true, slug: true } },
        replayVideo: { select: { slug: true, posterUrl: true, title: true } },
      },
    }),
  ]);

  const nothingScheduled =
    liveNow.length === 0 && upcoming.length === 0 && replays.length === 0;

  return (
    <div className="container-page py-12 sm:py-16">
      <header className="mb-10 border-b border-ink-700 pb-8">
        <p className="eyebrow">Boosie Network</p>
        <h1 className="mt-3 text-5xl leading-none sm:text-7xl">LIVE</h1>
        <p className="mt-4 max-w-2xl text-base text-bone-muted">
          Streams, premieres and listening sessions — and the replays afterwards.
        </p>
        {!flags.liveEnabled ? (
          <p className="mt-4 inline-block rounded-sm border border-gold-700/50 bg-gold-500/5 px-4 py-2 text-xs text-gold-300">
            Live playback is currently switched off for this deployment. Schedules and replays are
            still available.
          </p>
        ) : null}
      </header>

      {liveNow.length > 0 ? (
        <section className="mb-16">
          <SectionHeader eyebrow="On air now" title="Live right now" />
          <div className="grid gap-8 sm:grid-cols-2">
            {liveNow.map((stream) => (
              <Link key={stream.id} href={`/live/${stream.slug}`} className="group block">
                <MediaFrame
                  src={stream.posterUrl}
                  alt={stream.title}
                  seed={stream.title}
                  ratio="video"
                  overlay
                  className="border border-ink-600 transition-all duration-300 ease-premium group-hover:border-gold-700/70"
                >
                  <span className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-sm border border-blood/60 bg-blood/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ff8a92]">
                    <LiveDot /> Live
                  </span>
                </MediaFrame>
                <h3 className="mt-3 font-display text-xl uppercase tracking-tight text-bone transition-colors group-hover:text-gold-300">
                  {stream.title}
                </h3>
                {stream.artist ? (
                  <p className="text-sm text-bone-dim">{stream.artist.stageName}</p>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {upcoming.length > 0 ? (
        <section className="mb-16">
          <SectionHeader eyebrow="Save the date" title="Coming up" />
          <ul className="divide-y divide-ink-700 border-y border-ink-700">
            {upcoming.map((stream) => (
              <li key={stream.id}>
                <Link href={`/live/${stream.slug}`} className="group flex items-center gap-4 py-4">
                  <MediaFrame
                    src={stream.posterUrl}
                    alt={stream.title}
                    seed={stream.title}
                    ratio="video"
                    className="w-36 shrink-0 border border-ink-600"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>Scheduled</Badge>
                      {stream.accessType === 'MEMBERSHIP' ? (
                        <Badge tone="gold">Members</Badge>
                      ) : null}
                      {stream.accessType === 'PURCHASE' && stream.priceCents ? (
                        <Badge tone="warn">{formatCents(stream.priceCents)}</Badge>
                      ) : null}
                    </div>
                    <h3 className="mt-2 line-clamp-1 text-lg text-bone transition-colors group-hover:text-gold-300">
                      {stream.title}
                    </h3>
                    <p className="text-sm text-bone-dim">
                      {stream.artist ? `${stream.artist.stageName} · ` : ''}
                      {stream.scheduledFor
                        ? formatDateTime(stream.scheduledFor)
                        : 'Date to be announced'}
                    </p>
                    {stream.description ? (
                      <p className="mt-1 line-clamp-1 text-sm text-bone-dim">
                        {truncate(stream.description, 120)}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {replays.length > 0 ? (
        <section className="mb-16">
          <SectionHeader eyebrow="Missed it?" title="Replays" href="/watch" />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {replays.map((stream) => (
              <Link
                key={stream.id}
                href={
                  stream.replayVideo ? `/watch/${stream.replayVideo.slug}` : `/live/${stream.slug}`
                }
                className="group block"
              >
                <MediaFrame
                  src={stream.replayVideo?.posterUrl ?? stream.posterUrl}
                  alt={stream.title}
                  seed={stream.title}
                  ratio="video"
                  className="border border-ink-600 transition-all duration-300 ease-premium group-hover:border-gold-700/70"
                />
                <h3 className="mt-3 line-clamp-1 font-display text-sm uppercase tracking-tight text-bone transition-colors group-hover:text-gold-300">
                  {stream.title}
                </h3>
                {stream.endedAt ? (
                  <p className="text-xs text-bone-dim">{formatDateTime(stream.endedAt)}</p>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {nothingScheduled ? (
        <EmptyState
          title="Nothing scheduled right now"
          description="There are no live streams on the calendar yet. Follow your favourite artists and we'll let you know when something goes on air."
          action={
            <ButtonLink href="/listen" variant="outline">
              Browse artists
            </ButtonLink>
          }
        />
      ) : null}
    </div>
  );
}
