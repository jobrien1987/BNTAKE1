'use client';

import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus } from 'lucide-react';
import { toggleArtistFollowAction } from '@/app/actions/community';
import { buttonClasses } from '@/components/ui/button';

export function FollowArtistButton({
  artistId,
  artistName,
  initialFollowing,
  signedIn,
  returnTo,
}: {
  artistId: string;
  artistName: string;
  initialFollowing: boolean;
  signedIn: boolean;
  returnTo: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [following, setFollowing] = useOptimistic(initialFollowing);

  if (!signedIn) {
    return (
      <a
        href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
        className={buttonClasses('outline', 'md', 'w-full')}
      >
        <Plus className="h-4 w-4" />
        Follow
      </a>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={following}
      aria-label={following ? `Unfollow ${artistName}` : `Follow ${artistName}`}
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          setFollowing(!following);
          const formData = new FormData();
          formData.set('artistId', artistId);
          await toggleArtistFollowAction(formData);
          router.refresh();
        });
      }}
      className={buttonClasses(following ? 'outline' : 'gold', 'md', 'w-full')}
    >
      {following ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      {following ? 'Following' : 'Follow'}
    </button>
  );
}
