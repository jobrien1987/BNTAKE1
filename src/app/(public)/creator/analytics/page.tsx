import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/guards';
import { getActiveSubscription } from '@/server/services/subscriptions';
import { MediaFrame } from '@/components/ui/media-frame';
import { Alert, EmptyState, SectionHeader, Stat } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your analytics',
  robots: { index: false, follow: false },
};

export default async function CreatorAnalyticsPage() {
  const user = await requireUser('/creator/analytics');

  const profile = await prisma.creatorProfile.findUnique({
    where: { userId: user.id },
    include: { artist: true },
  });

  if (!profile?.artist) {
    return (
      <EmptyState
        title="No artist profile yet"
        description="Analytics start once your artist page exists and has published music."
        action={<ButtonLink href="/creator/profile">Create artist profile</ButtonLink>}
      />
    );
  }

  const subscription = await getActiveSubscription(user.id, 'CREATOR');
  const advanced = subscription?.plan.advancedAnalytics ?? false;

  const artistId = profile.artist.id;

  const [topSongs, totals, followerCount, albumCount] = await Promise.all([
    prisma.song.findMany({
      where: { artistId, status: 'PUBLISHED' },
      orderBy: { playCount: 'desc' },
      take: advanced ? 25 : 5,
      select: { id: true, title: true, artworkUrl: true, playCount: true, slug: true },
    }),
    prisma.song.aggregate({
      where: { artistId },
      _sum: { playCount: true },
      _count: { _all: true },
    }),
    prisma.artistFollow.count({ where: { artistId } }),
    prisma.album.count({ where: { artistId, status: 'PUBLISHED' } }),
  ]);

  const totalPlays = totals._sum.playCount ?? 0;

  return (
    <div className="space-y-12">
      <section>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total plays" value={totalPlays.toLocaleString()} />
          <Stat label="Tracks" value={String(totals._count._all)} />
          <Stat label="Published albums" value={String(albumCount)} />
          <Stat label="Followers" value={followerCount.toLocaleString()} />
        </div>
      </section>

      {!advanced ? (
        <Alert tone="info" title="Advanced analytics">
          Your current plan shows top-line numbers and your five most played tracks. A plan with
          advanced analytics expands this view.
        </Alert>
      ) : null}

      <section>
        <SectionHeader
          eyebrow="Most played"
          title={advanced ? 'Full track breakdown' : 'Top tracks'}
        />

        {topSongs.length === 0 ? (
          <EmptyState
            title="No published tracks yet"
            description="Play counts start accruing once your music is live on the network."
          />
        ) : (
          <ul className="divide-y divide-ink-700 border-y border-ink-700">
            {topSongs.map((song, index) => {
              const share = totalPlays > 0 ? Math.round((song.playCount / totalPlays) * 100) : 0;

              return (
                <li key={song.id} className="flex items-center gap-4 py-4">
                  <span className="w-6 shrink-0 text-center text-xs tabular-nums text-bone-dim">
                    {index + 1}
                  </span>
                  <MediaFrame
                    src={song.artworkUrl}
                    alt={song.title}
                    seed={song.title}
                    ratio="square"
                    className="h-11 w-11 shrink-0 border border-ink-600"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-bone">{song.title}</p>
                    <div
                      className="mt-2 h-1 w-full overflow-hidden rounded-full bg-ink-700"
                      role="presentation"
                    >
                      <div className="h-full bg-gold-sheen" style={{ width: `${share}%` }} />
                    </div>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-bone">
                    {song.playCount.toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
