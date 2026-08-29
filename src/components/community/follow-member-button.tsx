'use client';

import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, Ban } from 'lucide-react';
import { toggleUserFollowAction, toggleBlockAction } from '@/app/actions/community';
import { buttonClasses } from '@/components/ui/button';

export function FollowMemberButton({
  userId,
  memberName,
  initialFollowing,
  initialBlocked,
}: {
  userId: string;
  memberName: string;
  initialFollowing: boolean;
  initialBlocked: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [following, setFollowing] = useOptimistic(initialFollowing);
  const [blocked, setBlocked] = useOptimistic(initialBlocked);

  const run = (action: (formData: FormData) => Promise<void>, optimistic: () => void) => {
    startTransition(async () => {
      optimistic();
      const formData = new FormData();
      formData.set('userId', userId);
      await action(formData);
      router.refresh();
    });
  };

  if (blocked) {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(toggleBlockAction, () => setBlocked(false))}
        className={buttonClasses('outline', 'md', 'w-full')}
      >
        <Ban className="h-4 w-4" />
        Unblock
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-pressed={following}
        aria-label={following ? `Unfollow ${memberName}` : `Follow ${memberName}`}
        disabled={isPending}
        onClick={() => run(toggleUserFollowAction, () => setFollowing(!following))}
        className={buttonClasses(following ? 'outline' : 'gold', 'md', 'w-full')}
      >
        {following ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {following ? 'Following' : 'Follow'}
      </button>

      <button
        type="button"
        disabled={isPending}
        onClick={() => run(toggleBlockAction, () => setBlocked(true))}
        className="w-full text-center text-[11px] uppercase tracking-[0.16em] text-bone-dim transition-colors hover:text-[#ff8a92]"
      >
        Block this member
      </button>
    </div>
  );
}
