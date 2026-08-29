import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/guards';
import { getActiveSubscription } from '@/server/services/subscriptions';
import { Alert, Badge, EmptyState, SectionHeader, Stat } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { formatCents } from '@/lib/money';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Creator dashboard',
  robots: { index: false, follow: false },
};

export default async function CreatorDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ subscribed?: string; canceled?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser('/creator');

  const profile = await prisma.creatorProfile.findUnique({
    where: { userId: user.id },
    include: {
      artist: {
        include: {
          _count: { select: { songs: true, albums: true, follows: true } },
        },
      },
    },
  });

  const subscription = await getActiveSubscription(user.id, 'CREATOR');

  const pending = profile?.artist
    ? await prisma.song.count({
        where: { artistId: profile.artist.id, status: 'IN_REVIEW' },
      })
    : 0;

  const totalPlays = profile?.artist
    ? await prisma.song.aggregate({
        where: { artistId: profile.artist.id },
        _sum: { playCount: true },
      })
    : null;

  return (
    <div className="space-y-12">
      {params.subscribed ? (
        <Alert tone="success" title="Subscription active">
          Your creator plan is being activated. Give it a few seconds to confirm.
        </Alert>
      ) : null}
      {params.canceled ? (
        <Alert tone="info">Checkout was cancelled. Nothing has been charged.</Alert>
      ) : null}

      {!profile?.artist ? (
        <EmptyState
          title="Set up your artist profile"
          description="Your artist page is what listeners see. Create it before uploading music."
          action={<ButtonLink href="/creator/profile">Create artist profile</ButtonLink>}
        />
      ) : (
        <>
          <section>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Tracks" value={String(profile.artist._count.songs)} />
              <Stat label="Albums" value={String(profile.artist._count.albums)} />
              <Stat label="Followers" value={String(profile.artist._count.follows)} />
              <Stat
                label="Total plays"
                value={String(totalPlays?._sum.playCount ?? 0)}
              />
            </div>
          </section>

          <section>
            <SectionHeader
              eyebrow="Your page"
              title={profile.artist.stageName}
              href={
                profile.artist.status === 'PUBLISHED'
                  ? `/artists/${profile.artist.slug}`
                  : undefined
              }
              hrefLabel="View public page"
            />
            <div className="panel p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  tone={profile.artist.status === 'PUBLISHED' ? 'success' : 'warn'}
                >
                  {profile.artist.status}
                </Badge>
                {profile.artist.verified ? <Badge tone="gold">Verified</Badge> : null}
              </div>

              {profile.artist.status !== 'PUBLISHED' ? (
                <p className="mt-4 text-sm text-bone-dim">
                  Your artist page is not public yet. Network staff review new pages before they go
                  live — you can keep building your catalogue in the meantime.
                </p>
              ) : null}

              {pending > 0 ? (
                <p className="mt-4 text-sm text-gold-300">
                  {pending} track{pending === 1 ? '' : 's'} awaiting review.
                </p>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                <ButtonLink href="/creator/music" size="sm">
                  Manage music
                </ButtonLink>
                <ButtonLink href="/creator/albums" variant="outline" size="sm">
                  Manage albums
                </ButtonLink>
                <ButtonLink href="/creator/profile" variant="outline" size="sm">
                  Edit profile
                </ButtonLink>
              </div>
            </div>
          </section>
        </>
      )}

      <section>
        <SectionHeader
          eyebrow="Plan"
          title={subscription ? subscription.plan.name : 'No creator subscription'}
        />
        {subscription ? (
          <div className="panel p-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="Status" value={subscription.status} />
              <Stat
                label="Price"
                value={`${formatCents(subscription.plan.priceCents)}/${subscription.plan.interval}`}
              />
              <Stat
                label={subscription.cancelAtPeriodEnd ? 'Ends' : 'Renews'}
                value={
                  subscription.currentPeriodEnd
                    ? formatDate(subscription.currentPeriodEnd)
                    : 'Unknown'
                }
              />
            </div>
            <p className="mt-5 text-sm text-bone-dim">
              Manage billing from your{' '}
              <Link href="/account/membership" className="text-gold-400 hover:text-gold-300">
                account
              </Link>
              .
            </p>
          </div>
        ) : (
          <EmptyState
            title="You're on the free creator tier"
            description="A paid creator plan unlocks higher upload limits, merch selling and advanced analytics."
            action={<ButtonLink href="/membership">See creator plans</ButtonLink>}
          />
        )}
      </section>
    </div>
  );
}
