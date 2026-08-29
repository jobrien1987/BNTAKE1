import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/guards';
import { AlbumForm, DeleteAlbumButton } from '@/components/creator/album-form';
import { MediaFrame } from '@/components/ui/media-frame';
import { Badge, EmptyState, SectionHeader } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { formatCents } from '@/lib/money';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your albums',
  robots: { index: false, follow: false },
};

const STATUS_TONE: Record<string, 'success' | 'warn' | 'neutral'> = {
  PUBLISHED: 'success',
  IN_REVIEW: 'warn',
  DRAFT: 'neutral',
  ARCHIVED: 'neutral',
};

export default async function CreatorAlbumsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const user = await requireUser('/creator/albums');

  const profile = await prisma.creatorProfile.findUnique({
    where: { userId: user.id },
    include: { artist: true },
  });

  if (!profile?.artist) {
    return (
      <EmptyState
        title="Set up your artist profile first"
        description="Albums belong to your artist page, so that has to exist first."
        action={<ButtonLink href="/creator/profile">Create artist profile</ButtonLink>}
      />
    );
  }

  const albums = await prisma.album.findMany({
    where: { artistId: profile.artist.id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { songs: true } } },
  });

  const editing = edit ? albums.find((album) => album.id === edit) : null;

  return (
    <div className="space-y-12">
      <section>
        <SectionHeader
          eyebrow={editing ? 'Edit album' : 'New album'}
          title={editing ? editing.title : 'Create an album'}
          description="Create the album first, then attach tracks to it from the music page."
        />

        <div className="panel p-6">
          <AlbumForm
            values={{
              id: editing?.id,
              title: editing?.title ?? '',
              description: editing?.description ?? '',
              artworkUrl: editing?.artworkUrl ?? '',
              releaseDate: editing?.releaseDate
                ? editing.releaseDate.toISOString().slice(0, 10)
                : '',
              accessType: (editing?.accessType ?? 'FREE') as 'FREE' | 'MEMBERSHIP' | 'PURCHASE',
              priceCents: editing?.priceCents != null ? String(editing.priceCents) : '',
              purchasable: editing?.purchasable ?? false,
              status: editing?.status,
            }}
          />
        </div>

        {editing ? (
          <div className="mt-4">
            <ButtonLink href="/creator/albums" variant="quiet" size="sm">
              Cancel editing
            </ButtonLink>
          </div>
        ) : null}
      </section>

      <section>
        <SectionHeader
          eyebrow={`${albums.length} album${albums.length === 1 ? '' : 's'}`}
          title="Your releases"
        />

        {albums.length === 0 ? (
          <EmptyState title="No albums yet" description="Create your first release above." />
        ) : (
          <ul className="divide-y divide-ink-700 border-y border-ink-700">
            {albums.map((album) => (
              <li key={album.id} className="flex items-center gap-4 py-4">
                <MediaFrame
                  src={album.artworkUrl}
                  alt={album.title}
                  seed={album.title}
                  ratio="square"
                  className="h-14 w-14 shrink-0 border border-ink-600"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-bone">{album.title}</p>
                  <p className="text-xs text-bone-dim">
                    {[
                      `${album._count.songs} track${album._count.songs === 1 ? '' : 's'}`,
                      album.releaseDate ? formatDate(album.releaseDate) : null,
                      album.purchasable && album.priceCents ? formatCents(album.priceCents) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>

                <Badge tone={STATUS_TONE[album.status] ?? 'neutral'}>{album.status}</Badge>

                <div className="flex shrink-0 items-center gap-4">
                  <ButtonLink href={`/creator/albums?edit=${album.id}`} variant="quiet" size="sm">
                    Edit
                  </ButtonLink>
                  {album.status === 'DRAFT' || album.status === 'IN_REVIEW' ? (
                    <DeleteAlbumButton id={album.id} />
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
