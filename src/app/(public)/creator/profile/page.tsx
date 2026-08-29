import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/guards';
import { ArtistProfileForm } from '@/components/creator/artist-profile-form';
import { Alert, Badge, SectionHeader } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Artist profile',
  robots: { index: false, follow: false },
};

export default async function CreatorProfilePage() {
  const user = await requireUser('/creator/profile');

  const profile = await prisma.creatorProfile.findUnique({
    where: { userId: user.id },
    include: { artist: true },
  });

  const artist = profile?.artist ?? null;

  return (
    <div>
      <SectionHeader
        eyebrow={artist ? 'Edit' : 'Set up'}
        title="Your artist page"
        description="This is what listeners see on the network. Slugs are generated once and stay stable so links never break."
      />

      {artist ? (
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <Badge tone={artist.status === 'PUBLISHED' ? 'success' : 'warn'}>{artist.status}</Badge>
          <span className="text-xs text-bone-dim">/artists/{artist.slug}</span>
        </div>
      ) : (
        <div className="mb-8">
          <Alert tone="info">
            Saving this form creates your artist page as a draft. Network staff review new pages
            before they appear publicly.
          </Alert>
        </div>
      )}

      <ArtistProfileForm
        defaults={{
          stageName: artist?.stageName ?? profile?.displayName ?? '',
          bio: artist?.bio ?? '',
          location: artist?.location ?? '',
          profileImageUrl: artist?.profileImageUrl ?? '',
          heroImageUrl: artist?.heroImageUrl ?? '',
          websiteUrl: artist?.websiteUrl ?? '',
          instagramUrl: artist?.instagramUrl ?? '',
          twitterUrl: artist?.twitterUrl ?? '',
          youtubeUrl: artist?.youtubeUrl ?? '',
          spotifyUrl: artist?.spotifyUrl ?? '',
        }}
      />
    </div>
  );
}
