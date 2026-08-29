import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/server/auth/session';
import { PostCard } from '@/components/community/post-card';
import { CommentForm, CommentList } from '@/components/community/comment-thread';
import { Breadcrumbs, SectionHeader } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { truncate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    select: { body: true, hidden: true, author: { select: { name: true } } },
  });

  if (!post || post.hidden) {
    return { title: 'Post not found', robots: { index: false, follow: false } };
  }

  return {
    title: `${post.author.name} on Boosie Network`,
    description: truncate(post.body, 155),
    alternates: { canonical: `/community/post/${id}` },
  };
}

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, username: true, avatarUrl: true, role: true } },
      reactions: user ? { where: { userId: user.id }, select: { id: true } } : false,
      comments: {
        where: { hidden: false },
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, name: true, username: true, avatarUrl: true } },
        },
      },
    },
  });

  const isModerator =
    user?.role === 'MODERATOR' || user?.role === 'ADMIN' || user?.role === 'OWNER';

  if (!post || (post.hidden && !isModerator)) notFound();

  return (
    <div className="container-page py-12 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <Breadcrumbs
          items={[{ label: 'Community', href: '/community' }, { label: 'Post' }]}
        />

        <PostCard
          signedIn={Boolean(user)}
          canDelete={post.authorId === user?.id || isModerator}
          showFullBody
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

        <section className="mt-10">
          <SectionHeader
            eyebrow="Discussion"
            title={`${post.comments.length} comment${post.comments.length === 1 ? '' : 's'}`}
          />

          {user ? (
            <CommentForm postId={post.id} />
          ) : (
            <div className="panel flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-bone-muted">Sign in to join the conversation.</p>
              <ButtonLink href={`/login?returnTo=/community/post/${post.id}`} size="sm">
                Sign in
              </ButtonLink>
            </div>
          )}

          <div className="mt-6">
            <CommentList
              comments={post.comments}
              postId={post.id}
              currentUserId={user?.id ?? null}
              isModerator={isModerator}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
