import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/server/auth/session';
import { PostComposer } from '@/components/community/post-composer';
import { PostCard } from '@/components/community/post-card';
import { MediaFrame } from '@/components/ui/media-frame';
import { EmptyState, SectionHeader } from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { ButtonLink } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Community — the network feed',
  description: 'Talk with the network. Post, reply and follow the people you want to hear from.',
  alternates: { canonical: '/community' },
  openGraph: { title: 'Community | Boosie Network', url: '/community' },
};

const PAGE_SIZE = 20;

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const user = await getCurrentUser();
  const followingOnly = params.filter === 'following' && Boolean(user);

  // Blocking is mutual for visibility: a member never sees posts from someone
  // they blocked, nor from someone who blocked them.
  const blocks = user
    ? await prisma.block.findMany({
        where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] },
        select: { blockerId: true, blockedId: true },
      })
    : [];

  const hiddenAuthorIds = Array.from(
    new Set(
      blocks.flatMap((block) => [block.blockerId, block.blockedId]).filter((id) => id !== user?.id),
    ),
  );

  const followingIds = followingOnly
    ? (
        await prisma.follow.findMany({
          where: { followerId: user!.id },
          select: { followingId: true },
        })
      ).map((follow) => follow.followingId)
    : [];

  const where = {
    hidden: false,
    ...(hiddenAuthorIds.length > 0 ? { authorId: { notIn: hiddenAuthorIds } } : {}),
    ...(followingOnly ? { authorId: { in: [...followingIds, user!.id] } } : {}),
  };

  const [total, posts, activeMembers] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        author: { select: { id: true, name: true, username: true, avatarUrl: true, role: true } },
        reactions: user ? { where: { userId: user.id }, select: { id: true } } : false,
      },
    }),
    prisma.user.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { posts: { _count: 'desc' } },
      take: 8,
      select: { id: true, name: true, username: true, avatarUrl: true, _count: { select: { posts: true } } },
    }),
  ]);

  const buildHref = (nextPage: number) => {
    const search = new URLSearchParams();
    if (params.filter) search.set('filter', params.filter);
    if (nextPage > 1) search.set('page', String(nextPage));
    const query = search.toString();
    return `/community${query ? `?${query}` : ''}`;
  };

  return (
    <div className="container-page py-12 sm:py-16">
      <header className="mb-10 border-b border-ink-700 pb-8">
        <p className="eyebrow">Boosie Network</p>
        <h1 className="mt-3 text-5xl leading-none sm:text-7xl">COMMUNITY</h1>
        <p className="mt-4 max-w-2xl text-base text-bone-muted">
          The network feed. Say your piece, back the people you rate and keep it respectful.
        </p>
      </header>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {user ? (
            <div className="mb-8">
              <PostComposer authorName={user.name} avatarUrl={user.avatarUrl} />
            </div>
          ) : (
            <div className="panel mb-8 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-bone-muted">
                Sign in to post, reply and follow other members.
              </p>
              <div className="flex shrink-0 gap-3">
                <ButtonLink href="/login?returnTo=/community" size="sm">
                  Sign in
                </ButtonLink>
                <ButtonLink href="/register" variant="outline" size="sm">
                  Join
                </ButtonLink>
              </div>
            </div>
          )}

          {user ? (
            <nav className="mb-6 flex gap-2" aria-label="Feed filter">
              <FeedTab href="/community" active={!followingOnly}>
                Everyone
              </FeedTab>
              <FeedTab href="/community?filter=following" active={followingOnly}>
                Following
              </FeedTab>
            </nav>
          ) : null}

          {posts.length === 0 ? (
            <EmptyState
              title={followingOnly ? 'Your following feed is quiet' : 'No posts yet'}
              description={
                followingOnly
                  ? 'Follow more members and their posts will show up here.'
                  : 'Be the first to post something. The feed fills up fast.'
              }
              action={
                followingOnly ? (
                  <ButtonLink href="/community" variant="outline">
                    See everyone
                  </ButtonLink>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-5">
              {posts.map((post) => {
                const canDelete =
                  post.authorId === user?.id ||
                  user?.role === 'MODERATOR' ||
                  user?.role === 'ADMIN' ||
                  user?.role === 'OWNER';

                return (
                  <PostCard
                    key={post.id}
                    signedIn={Boolean(user)}
                    canDelete={Boolean(canDelete)}
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
                );
              })}
            </div>
          )}

          <Pagination page={page} pageSize={PAGE_SIZE} total={total} buildHref={buildHref} />
        </div>

        <aside className="space-y-8">
          <div>
            <SectionHeader eyebrow="The rules" title="Keep it clean" className="mb-4" />
            <ul className="space-y-2 text-sm leading-relaxed text-bone-dim">
              <li>No harassment, hate speech or threats.</li>
              <li>No spam, scams or impersonation.</li>
              <li>Report anything that crosses the line — moderators review every report.</li>
            </ul>
          </div>

          {activeMembers.length > 0 ? (
            <div>
              <h2 className="eyebrow mb-4">Most active</h2>
              <ul className="space-y-3">
                {activeMembers.map((member) => (
                  <li key={member.id}>
                    <Link
                      href={`/community/member/${member.username}`}
                      className="group flex items-center gap-3"
                    >
                      <MediaFrame
                        src={member.avatarUrl}
                        alt={member.name}
                        seed={member.name}
                        ratio="square"
                        className="h-10 w-10 shrink-0 rounded-full border border-ink-600"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-bone transition-colors group-hover:text-gold-300">
                          {member.name}
                        </span>
                        <span className="block text-xs text-bone-dim">
                          {member._count.posts} post{member._count.posts === 1 ? '' : 's'}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function FeedTab({
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
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'border-b-2 border-gold-500 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-300'
          : 'border-b-2 border-transparent pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-bone-dim hover:text-bone'
      }
    >
      {children}
    </Link>
  );
}
