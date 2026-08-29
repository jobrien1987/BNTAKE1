import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/server/auth/session';
import { PostCard } from '@/components/community/post-card';
import { FollowMemberButton } from '@/components/community/follow-member-button';
import { MediaFrame } from '@/components/ui/media-frame';
import { Badge, Breadcrumbs, EmptyState, Stat } from '@/components/ui/primitives';
import { formatDate, truncate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const member = await prisma.user.findUnique({
    where: { username },
    select: { name: true, bio: true, status: true },
  });

  if (!member || member.status === 'BANNED') {
    return { title: 'Member not found', robots: { index: false, follow: false } };
  }

  return {
    title: `${member.name} (@${username})`,
    description: member.bio ? truncate(member.bio, 155) : `${member.name} on Boosie Network.`,
    alternates: { canonical: `/community/member/${username}` },
  };
}

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const viewer = await getCurrentUser();

  const member = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      name: true,
      username: true,
      bio: true,
      avatarUrl: true,
      bannerUrl: true,
      location: true,
      role: true,
      status: true,
      isCreator: true,
      createdAt: true,
      _count: { select: { posts: true, followers: true, following: true } },
      creatorProfile: {
        select: { artist: { select: { stageName: true, slug: true } } },
      },
    },
  });

  const isStaffViewer = viewer?.role === 'ADMIN' || viewer?.role === 'OWNER';
  if (!member || (member.status === 'BANNED' && !isStaffViewer)) notFound();

  const [posts, following, blocked] = await Promise.all([
    prisma.post.findMany({
      where: { authorId: member.id, hidden: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        author: { select: { id: true, name: true, username: true, avatarUrl: true, role: true } },
        reactions: viewer ? { where: { userId: viewer.id }, select: { id: true } } : false,
      },
    }),
    viewer && viewer.id !== member.id
      ? prisma.follow.findUnique({
          where: {
            followerId_followingId: { followerId: viewer.id, followingId: member.id },
          },
          select: { id: true },
        })
      : Promise.resolve(null),
    viewer && viewer.id !== member.id
      ? prisma.block.findUnique({
          where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: member.id } },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  const isSelf = viewer?.id === member.id;
  const isStaffMember = ['ADMIN', 'OWNER', 'EDITOR', 'MODERATOR'].includes(member.role);

  return (
    <div>
      <MediaFrame
        src={member.bannerUrl}
        alt={`${member.name} banner`}
        seed={`${member.name}-banner`}
        ratio="wide"
        overlay
        className="max-h-[320px]"
      />

      <div className="container-page -mt-16 pb-16 sm:-mt-20">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
          <MediaFrame
            src={member.avatarUrl}
            alt={member.name}
            seed={member.name}
            ratio="square"
            className="w-24 shrink-0 rounded-full border-2 border-ink-600 sm:w-32"
          />

          <div className="min-w-0 flex-1 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              {isStaffMember ? <Badge tone="gold">Network</Badge> : null}
              {member.isCreator ? <Badge>Creator</Badge> : null}
              {member.status !== 'ACTIVE' ? <Badge tone="danger">{member.status}</Badge> : null}
            </div>
            <h1 className="mt-2 text-4xl leading-none sm:text-5xl">{member.name}</h1>
            <p className="mt-1 text-sm text-bone-dim">@{member.username}</p>
          </div>

          {!isSelf && viewer ? (
            <div className="shrink-0 pb-2 sm:w-44">
              <FollowMemberButton
                userId={member.id}
                memberName={member.name}
                initialFollowing={Boolean(following)}
                initialBlocked={Boolean(blocked)}
              />
            </div>
          ) : null}
        </div>

        <Breadcrumbs
          items={[{ label: 'Community', href: '/community' }, { label: member.name }]}
        />

        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            {posts.length === 0 ? (
              <EmptyState
                title="No posts yet"
                description={`${member.name} hasn't posted anything to the feed.`}
              />
            ) : (
              <div className="space-y-5">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    signedIn={Boolean(viewer)}
                    canDelete={
                      isSelf ||
                      viewer?.role === 'MODERATOR' ||
                      viewer?.role === 'ADMIN' ||
                      viewer?.role === 'OWNER'
                    }
                    post={{
                      id: post.id,
                      body: post.body,
                      imageUrl: post.imageUrl,
                      likeCount: post.likeCount,
                      commentCount: post.commentCount,
                      createdAt: post.createdAt,
                      author: post.author,
                      likedByMe: Array.isArray(post.reactions) && post.reactions.length > 0,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-8">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Posts" value={String(member._count.posts)} />
              <Stat label="Followers" value={String(member._count.followers)} />
              <Stat label="Following" value={String(member._count.following)} />
            </div>

            {member.bio ? (
              <div>
                <h2 className="eyebrow mb-3">About</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-bone-muted">
                  {member.bio}
                </p>
              </div>
            ) : null}

            <dl className="space-y-2 text-xs">
              {member.location ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-bone-dim">Location</dt>
                  <dd className="text-bone">{member.location}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-bone-dim">Member since</dt>
                <dd className="text-bone">{formatDate(member.createdAt)}</dd>
              </div>
            </dl>

            {member.creatorProfile?.artist ? (
              <div>
                <h2 className="eyebrow mb-3">Artist page</h2>
                <a
                  href={`/artists/${member.creatorProfile.artist.slug}`}
                  className="text-sm text-gold-400 transition-colors hover:text-gold-300"
                >
                  {member.creatorProfile.artist.stageName}
                </a>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
