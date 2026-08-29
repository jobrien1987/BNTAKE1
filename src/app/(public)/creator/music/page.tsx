import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/guards';
import { SongForm, DeleteSongButton } from '@/components/creator/song-form';
import { MediaFrame } from '@/components/ui/media-frame';
import { Badge, EmptyState, SectionHeader } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { formatCents } from '@/lib/money';
import { formatDuration } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your music',
  robots: { index: false, follow: false },
};

const STATUS_TONE: Record<string, 'success' | 'warn' | 'neutral'> = {
  PUBLISHED: 'success',
  IN_REVIEW: 'warn',
  DRAFT: 'neutral',
  ARCHIVED: 'neutral',
};

export default async function CreatorMusicPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const user = await requireUser('/creator/music');

  const profile = await prisma.creatorProfile.findUnique({
    where: { userId: user.id },
    include: { artist: true },
  });

  if (!profile?.artist) {
    return (
      <EmptyState
        title="Set up your artist profile first"
        description="Music is attached to your artist page, so that has to exist before you can upload."
        action={<ButtonLink href="/creator/profile">Create artist profile</ButtonLink>}
      />
    );
  }

  const [songs, albums] = await Promise.all([
    prisma.song.findMany({
      where: { artistId: profile.artist.id },
      orderBy: [{ createdAt: 'desc' }],
      include: { album: { select: { title: true } } },
    }),
    prisma.album.findMany({
      where: { artistId: profile.artist.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true },
    }),
  ]);

  const editing = edit ? songs.find((song) => song.id === edit) : null;

  return (
    <div className="space-y-12">
      <section>
        <SectionHeader
          eyebrow={editing ? 'Edit track' : 'New track'}
          title={editing ? editing.title : 'Add a track'}
          description="Save a draft while you work, then submit it for review when it's ready. Network staff publish approved tracks."
        />

        <div className="panel p-6">
          <SongForm
            albums={albums}
            values={{
              id: editing?.id,
              title: editing?.title ?? '',
              albumId: editing?.albumId ?? '',
              trackNumber: editing?.trackNumber != null ? String(editing.trackNumber) : '',
              durationSec: String(editing?.durationSec ?? 0),
              artworkUrl: editing?.artworkUrl ?? '',
              audioUrl: editing?.audioUrl ?? '',
              previewUrl: editing?.previewUrl ?? '',
              explicit: editing?.explicit ?? false,
              accessType: (editing?.accessType ?? 'FREE') as 'FREE' | 'MEMBERSHIP' | 'PURCHASE',
              priceCents: editing?.priceCents != null ? String(editing.priceCents) : '',
              purchasable: editing?.purchasable ?? false,
              status: editing?.status,
            }}
          />
        </div>

        {editing ? (
          <div className="mt-4">
            <ButtonLink href="/creator/music" variant="quiet" size="sm">
              Cancel editing
            </ButtonLink>
          </div>
        ) : null}
      </section>

      <section>
        <SectionHeader
          eyebrow={`${songs.length} track${songs.length === 1 ? '' : 's'}`}
          title="Your catalogue"
        />

        {songs.length === 0 ? (
          <EmptyState
            title="No tracks yet"
            description="Add your first track using the form above."
          />
        ) : (
          <ul className="divide-y divide-ink-700 border-y border-ink-700">
            {songs.map((song) => (
              <li key={song.id} className="flex items-center gap-4 py-4">
                <MediaFrame
                  src={song.artworkUrl}
                  alt={song.title}
                  seed={song.title}
                  ratio="square"
                  className="h-12 w-12 shrink-0 border border-ink-600"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-bone">{song.title}</p>
                  <p className="text-xs text-bone-dim">
                    {[
                      song.album?.title,
                      song.durationSec ? formatDuration(song.durationSec) : null,
                      song.purchasable && song.priceCents ? formatCents(song.priceCents) : null,
                      `${song.playCount} plays`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>

                <Badge tone={STATUS_TONE[song.status] ?? 'neutral'}>{song.status}</Badge>

                <div className="flex shrink-0 items-center gap-4">
                  <ButtonLink href={`/creator/music?edit=${song.id}`} variant="quiet" size="sm">
                    Edit
                  </ButtonLink>
                  {song.status === 'DRAFT' || song.status === 'IN_REVIEW' ? (
                    <DeleteSongButton id={song.id} />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
