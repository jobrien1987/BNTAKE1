import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/guards';
import { ArtistCard } from '@/components/cards/music-cards';
import { MediaFrame } from '@/components/ui/media-frame';
import { EmptyState, SectionHeader } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Following',
  robots: { index: false, follow: false },
};

export default async function FollowingPage() {
  const user = await requireUser('/account/following');

  const [artistFollows, memberFollows] = await Promise.all([
    prisma.artistFollow.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { artist: true },
    }),
    prisma.follow.findMany({
      where: { followerId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        following: { select: { id: true, name: true, username: true, avatarUrl: true } },
      },
    }),
  ]);

  if (artistFollows.length === 0 && memberFollows.length === 0) {
    return (
      <EmptyState
        title="You're not following anyone yet"
        description="Follow artists to hear about new releases, and members to shape your community feed."
        action={
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/listen">Browse artists</ButtonLink>
            <ButtonLink href="/community" variant="outline">
              Browse the feed
            </ButtonLink>
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-14">
      {artistFollows.length > 0 ? (
        <section>
          <SectionHeader eyebrow="Music" title="Artists you follow" />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {artistFollows.map((follow) => (
              <ArtistCard key={follow.id} artist={follow.artist} />
            ))}
          </div>
        </section>
      ) : null}

      {memberFollows.length > 0 ? (
        <section>
          <SectionHeader eyebrow="Community" title="Members you follow" />
          <ul className="divide-y divide-ink-700 border-y border-ink-700">
            {memberFollows.map((follow) => (
              <li key={follow.id}>
                <Link
                  href={`/community/member/${follow.following.username}`}
                  className="group flex items-center gap-4 py-4"
                >
                  <MediaFrame
                    src={follow.following.avatarUrl}
                    alt={follow.following.name}
                    seed={follow.following.name}
                    ratio="square"
                    className="h-11 w-11 shrink-0 rounded-full border border-ink-600"
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-bone transition-colors group-hover:text-gold-300">
                      {follow.following.name}
                    </p>
                    <p className="text-xs text-bone-dim">@{follow.following.username}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
