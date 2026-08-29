import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { RadioPlayButton } from '@/components/listen/radio-play-button';
import { MediaFrame } from '@/components/ui/media-frame';
import { Badge, EmptyState, LiveDot, SectionHeader } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { formatDateTime, relativeTime } from '@/lib/utils';

export const revalidate = 30;

export const metadata: Metadata = {
  title: 'Badazz Radio — always on',
  description:
    'Badazz Radio streams around the clock on Boosie Network. See what is playing now, the recently played log and the show schedule.',
  alternates: { canonical: '/radio' },
  openGraph: { title: 'Badazz Radio | Boosie Network', url: '/radio' },
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default async function RadioPage() {
  const station = await prisma.radioStation.findFirst({
    where: { active: true },
    include: {
      shows: { orderBy: { createdAt: 'asc' } },
      slots: {
        orderBy: [{ dayOfWeek: 'asc' }, { startMin: 'asc' }],
        include: { show: true },
      },
      plays: {
        orderBy: { playedAt: 'desc' },
        take: 20,
        include: { song: { select: { slug: true } } },
      },
    },
  });

  if (!station) {
    return (
      <div className="container-page py-16">
        <EmptyState
          title="Radio is not set up yet"
          description="No station has been configured. An administrator can create one from the admin area."
          action={
            <ButtonLink href="/listen" variant="outline">
              Browse music instead
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const nowPlaying = station.plays[0] ?? null;
  const recent = station.plays.slice(1);

  const slotsByDay = DAYS.map((label, day) => ({
    label,
    slots: station.slots.filter((slot) => slot.dayOfWeek === day),
  })).filter((entry) => entry.slots.length > 0);

  const formatMinute = (minute: number) => {
    const hours = Math.floor(minute / 60) % 24;
    const minutes = minute % 60;
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const display = hours % 12 === 0 ? 12 : hours % 12;
    return `${display}:${String(minutes).padStart(2, '0')} ${suffix}`;
  };

  return (
    <div className="container-page py-12 sm:py-16">
      <header className="mb-12 border-b border-ink-700 pb-8">
        <div className="flex items-center gap-2">
          <p className="eyebrow">Boosie Network</p>
          {station.isLive ? (
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ff8a92]">
              <LiveDot /> On air
            </span>
          ) : null}
        </div>
        <h1 className="mt-3 text-5xl leading-none sm:text-7xl">{station.name.toUpperCase()}</h1>
        {station.tagline ? (
          <p className="mt-4 max-w-2xl text-base text-bone-muted">{station.tagline}</p>
        ) : null}
      </header>

      <section className="mb-16">
        <div className="panel flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
          <MediaFrame
            src={nowPlaying?.artworkUrl ?? station.logoUrl}
            alt={nowPlaying?.trackTitle ?? station.name}
            seed={nowPlaying?.trackTitle ?? station.name}
            ratio="square"
            className="w-32 shrink-0 border border-ink-600"
          />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{nowPlaying ? 'Now playing' : 'Stream'}</p>
            {nowPlaying ? (
              <>
                <h2 className="mt-2 text-3xl leading-none sm:text-4xl">
                  {nowPlaying.song ? (
                    <Link
                      href={`/songs/${nowPlaying.song.slug}`}
                      className="transition-colors hover:text-gold-300"
                    >
                      {nowPlaying.trackTitle}
                    </Link>
                  ) : (
                    nowPlaying.trackTitle
                  )}
                </h2>
                <p className="mt-2 text-sm text-bone-muted">{nowPlaying.artistName}</p>
                <p className="mt-1 text-xs text-bone-dim">
                  Started {relativeTime(nowPlaying.playedAt)}
                </p>
              </>
            ) : (
              <p className="mt-2 max-w-lg text-sm text-bone-muted">
                Nothing has been logged on air yet. Press play to tune into the live stream.
              </p>
            )}
          </div>
          <div className="shrink-0 sm:w-52">
            <RadioPlayButton station={station} />
          </div>
        </div>
      </section>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-14">
          {station.description ? (
            <section>
              <SectionHeader eyebrow="The station" title="About" />
              <p className="whitespace-pre-line text-base leading-relaxed text-bone-muted">
                {station.description}
              </p>
            </section>
          ) : null}

          {station.shows.length > 0 ? (
            <section>
              <SectionHeader eyebrow="Programming" title="Shows" />
              <div className="grid gap-6 sm:grid-cols-2">
                {station.shows.map((show) => (
                  <article key={show.id} className="panel p-5">
                    <MediaFrame
                      src={show.imageUrl}
                      alt={show.title}
                      seed={show.title}
                      ratio="video"
                      className="mb-4 border border-ink-600"
                    />
                    <h3 className="font-display text-lg uppercase tracking-tight text-bone">
                      {show.title}
                    </h3>
                    {show.host ? (
                      <p className="mt-1 text-xs text-bone-dim">Hosted by {show.host}</p>
                    ) : null}
                    {show.description ? (
                      <p className="mt-3 text-sm leading-relaxed text-bone-muted">
                        {show.description}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {slotsByDay.length > 0 ? (
            <section>
              <SectionHeader eyebrow="Weekly" title="Schedule" />
              <div className="space-y-6">
                {slotsByDay.map((day) => (
                  <div key={day.label}>
                    <h3 className="eyebrow mb-2">{day.label}</h3>
                    <ul className="divide-y divide-ink-700 border-y border-ink-700">
                      {day.slots.map((slot) => (
                        <li
                          key={slot.id}
                          className="flex items-center justify-between gap-4 py-3 text-sm"
                        >
                          <span className="text-bone">{slot.show?.title ?? 'Badazz Radio mix'}</span>
                          <span className="shrink-0 tabular-nums text-bone-dim">
                            {formatMinute(slot.startMin)} – {formatMinute(slot.endMin)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside>
          <h2 className="eyebrow mb-4">Recently played</h2>
          {recent.length === 0 ? (
            <p className="panel px-5 py-8 text-center text-sm text-bone-dim">
              The play log fills up as tracks go out on air.
            </p>
          ) : (
            <ul className="space-y-3">
              {recent.map((play) => (
                <li key={play.id} className="flex items-center gap-3">
                  <MediaFrame
                    src={play.artworkUrl}
                    alt={play.trackTitle}
                    seed={play.trackTitle}
                    ratio="square"
                    className="h-11 w-11 shrink-0 border border-ink-600"
                  />
                  <div className="min-w-0 flex-1">
                    {play.song ? (
                      <Link
                        href={`/songs/${play.song.slug}`}
                        className="block truncate text-sm text-bone transition-colors hover:text-gold-300"
                      >
                        {play.trackTitle}
                      </Link>
                    ) : (
                      <p className="truncate text-sm text-bone">{play.trackTitle}</p>
                    )}
                    <p className="truncate text-xs text-bone-dim">{play.artistName}</p>
                  </div>
                  <time
                    dateTime={play.playedAt.toISOString()}
                    title={formatDateTime(play.playedAt)}
                    className="shrink-0 text-[11px] tabular-nums text-bone-dim"
                  >
                    {relativeTime(play.playedAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}

          {!station.streamUrl ? (
            <div className="mt-6">
              <Badge tone="warn">Stream URL not configured</Badge>
              <p className="mt-2 text-xs text-bone-dim">
                An administrator needs to set the station stream URL before live playback works.
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
