'use client';

import Link from 'next/link';
import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, MessageCircle, Trash2 } from 'lucide-react';
import { MediaFrame } from '@/components/ui/media-frame';
import { Badge } from '@/components/ui/primitives';
import { deletePostAction, togglePostLikeAction } from '@/app/actions/community';
import { relativeTime, cn } from '@/lib/utils';

export interface PostCardData {
  id: string;
  body: string;
  imageUrl: string | null;
  likeCount: number;
  commentCount: number;
  createdAt: Date | string;
  author: {
    id: string;
    name: string;
    username: string;
    avatarUrl: string | null;
    role: string;
  };
  likedByMe: boolean;
}

export function PostCard({
  post,
  signedIn,
  canDelete,
  showFullBody = false,
}: {
  post: PostCardData;
  signedIn: boolean;
  canDelete: boolean;
  showFullBody?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [liked, setLiked] = useOptimistic(post.likedByMe);
  const [likeCount, setLikeCount] = useOptimistic(post.likeCount);

  const isStaffAuthor = ['ADMIN', 'OWNER', 'EDITOR', 'MODERATOR'].includes(post.author.role);

  return (
    <article className="panel p-5">
      <div className="flex gap-4">
        <Link href={`/community/member/${post.author.username}`} className="shrink-0">
          <MediaFrame
            src={post.author.avatarUrl}
            alt={post.author.name}
            seed={post.author.name}
            ratio="square"
            className="h-11 w-11 rounded-full border border-ink-600"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/community/member/${post.author.username}`}
              className="text-sm text-bone transition-colors hover:text-gold-300"
            >
              {post.author.name}
            </Link>
            <span className="text-xs text-bone-dim">@{post.author.username}</span>
            {isStaffAuthor ? <Badge tone="gold">Network</Badge> : null}
            <span aria-hidden className="text-ink-400">
              ·
            </span>
            <time dateTime={new Date(post.createdAt).toISOString()} className="text-xs text-bone-dim">
              {relativeTime(post.createdAt)}
            </time>
          </div>

          <p
            className={cn(
              'mt-3 whitespace-pre-line text-sm leading-relaxed text-bone-muted',
              !showFullBody && 'line-clamp-6',
            )}
          >
            {post.body}
          </p>

          {post.imageUrl ? (
            <MediaFrame
              src={post.imageUrl}
              alt="Attached image"
              seed={post.id}
              ratio="video"
              className="mt-4 border border-ink-600"
            />
          ) : null}

          <div className="mt-4 flex items-center gap-5">
            {signedIn ? (
              <button
                type="button"
                aria-pressed={liked}
                aria-label={liked ? 'Unlike this post' : 'Like this post'}
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    setLiked(!liked);
                    setLikeCount(likeCount + (liked ? -1 : 1));
                    const formData = new FormData();
                    formData.set('postId', post.id);
                    await togglePostLikeAction(formData);
                    router.refresh();
                  });
                }}
                className={cn(
                  'flex items-center gap-1.5 text-xs transition-colors',
                  liked ? 'text-[#ff8a92]' : 'text-bone-dim hover:text-bone',
                )}
              >
                <Heart className={cn('h-4 w-4', liked && 'fill-current')} />
                {likeCount}
              </button>
            ) : (
              <Link
                href="/login?returnTo=/community"
                className="flex items-center gap-1.5 text-xs text-bone-dim transition-colors hover:text-bone"
              >
                <Heart className="h-4 w-4" />
                {likeCount}
              </Link>
            )}

            <Link
              href={`/community/post/${post.id}`}
              className="flex items-center gap-1.5 text-xs text-bone-dim transition-colors hover:text-bone"
            >
              <MessageCircle className="h-4 w-4" />
              {post.commentCount}
            </Link>

            {canDelete ? (
              <form
                action={async (formData: FormData) => {
                  await deletePostAction(formData);
                  router.refresh();
                }}
                className="ml-auto"
              >
                <input type="hidden" name="postId" value={post.id} />
                <button
                  type="submit"
                  aria-label="Delete this post"
                  className="flex items-center gap-1.5 text-xs text-bone-dim transition-colors hover:text-[#ff8a92]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
