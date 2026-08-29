'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { MediaFrame } from '@/components/ui/media-frame';
import { SubmitButton, FormMessage } from '@/components/ui/form';
import { createCommentAction, deleteCommentAction } from '@/app/actions/community';
import { initialActionState } from '@/lib/action-state';
import { relativeTime } from '@/lib/utils';

export interface CommentData {
  id: string;
  body: string;
  createdAt: Date | string;
  likeCount: number;
  author: {
    id: string;
    name: string;
    username: string;
    avatarUrl: string | null;
  };
}

export function CommentForm({ postId }: { postId: string }) {
  const [state, formAction] = useActionState(createCommentAction, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form ref={formRef} action={formAction} className="panel p-5">
      <input type="hidden" name="postId" value={postId} />

      <label htmlFor="comment-body" className="eyebrow mb-3 block">
        Add a comment
      </label>
      <textarea
        id="comment-body"
        name="body"
        rows={3}
        maxLength={1000}
        required
        placeholder="Say something"
        className="w-full resize-y border border-ink-600 bg-ink-800 px-4 py-3 text-sm text-bone placeholder:text-bone-dim focus:border-gold-700 focus:outline-none focus:ring-2 focus:ring-gold-500/40"
      />

      <div className="mt-3 flex justify-end">
        <SubmitButton size="sm" pendingLabel="Posting…">
          Comment
        </SubmitButton>
      </div>

      {state.error || state.success ? (
        <div className="mt-4">
          <FormMessage state={state} />
        </div>
      ) : null}
    </form>
  );
}

export function CommentList({
  comments,
  postId,
  currentUserId,
  isModerator,
}: {
  comments: CommentData[];
  postId: string;
  currentUserId: string | null;
  isModerator: boolean;
}) {
  const router = useRouter();

  if (comments.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-bone-dim">
        No comments yet. Start the conversation.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-ink-700">
      {comments.map((comment) => (
        <li key={comment.id} className="flex gap-4 py-5">
          <Link href={`/community/member/${comment.author.username}`} className="shrink-0">
            <MediaFrame
              src={comment.author.avatarUrl}
              alt={comment.author.name}
              seed={comment.author.name}
              ratio="square"
              className="h-9 w-9 rounded-full border border-ink-600"
            />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/community/member/${comment.author.username}`}
                className="text-sm text-bone transition-colors hover:text-gold-300"
              >
                {comment.author.name}
              </Link>
              <time
                dateTime={new Date(comment.createdAt).toISOString()}
                className="text-xs text-bone-dim"
              >
                {relativeTime(comment.createdAt)}
              </time>
            </div>

            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-bone-muted">
              {comment.body}
            </p>
          </div>

          {currentUserId === comment.author.id || isModerator ? (
            <form
              action={async (formData: FormData) => {
                await deleteCommentAction(formData);
                router.refresh();
              }}
              className="shrink-0"
            >
              <input type="hidden" name="commentId" value={comment.id} />
              <input type="hidden" name="postId" value={postId} />
              <button
                type="submit"
                aria-label="Delete this comment"
                className="p-1 text-bone-dim transition-colors hover:text-[#ff8a92]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
