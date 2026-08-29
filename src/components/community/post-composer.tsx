'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createPostAction } from '@/app/actions/community';
import { MediaFrame } from '@/components/ui/media-frame';
import { SubmitButton, FormMessage } from '@/components/ui/form';
import { initialActionState } from '@/lib/action-state';

const MAX_LENGTH = 2000;

export function PostComposer({
  authorName,
  avatarUrl,
}: {
  authorName: string;
  avatarUrl?: string | null;
}) {
  const [state, formAction] = useActionState(createPostAction, initialActionState);
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
      <div className="flex gap-4">
        <MediaFrame
          src={avatarUrl}
          alt={authorName}
          seed={authorName}
          ratio="square"
          className="h-11 w-11 shrink-0 rounded-full border border-ink-600"
        />
        <div className="min-w-0 flex-1">
          <label htmlFor="post-body" className="sr-only">
            Write a post
          </label>
          <textarea
            id="post-body"
            name="body"
            rows={3}
            maxLength={MAX_LENGTH}
            required
            placeholder="What's on your mind?"
            className="w-full resize-y border border-ink-600 bg-ink-800 px-4 py-3 text-sm text-bone placeholder:text-bone-dim focus:border-gold-700 focus:outline-none focus:ring-2 focus:ring-gold-500/40"
          />

          <div className="mt-3 flex items-center justify-between gap-4">
            <p className="text-xs text-bone-dim">Up to {MAX_LENGTH.toLocaleString()} characters.</p>
            <SubmitButton size="sm" pendingLabel="Posting…">
              Post
            </SubmitButton>
          </div>
        </div>
      </div>

      {state.error || state.success ? (
        <div className="mt-4">
          <FormMessage state={state} />
        </div>
      ) : null}
    </form>
  );
}
