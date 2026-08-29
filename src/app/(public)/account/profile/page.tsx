import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/guards';
import { ProfileForm } from '@/components/account/profile-form';
import { SectionHeader } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Edit profile',
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const sessionUser = await requireUser('/account/profile');

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      name: true,
      username: true,
      bio: true,
      avatarUrl: true,
      bannerUrl: true,
      location: true,
    },
  });

  if (!user) throw new Error('Account not found.');

  return (
    <div className="max-w-xl">
      <SectionHeader
        eyebrow="Public profile"
        title="How the community sees you"
        description="This information appears on your member profile and next to everything you post."
      />

      <ProfileForm
        defaults={{
          name: user.name,
          username: user.username,
          bio: user.bio ?? '',
          location: user.location ?? '',
          avatarUrl: user.avatarUrl ?? '',
          bannerUrl: user.bannerUrl ?? '',
        }}
      />

      <p className="mt-8 text-xs text-bone-dim">
        View your public profile at{' '}
        <Link
          href={`/community/member/${user.username}`}
          className="text-gold-400 hover:text-gold-300"
        >
          /community/member/{user.username}
        </Link>
      </p>
    </div>
  );
}
