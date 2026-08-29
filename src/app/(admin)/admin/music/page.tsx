import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/server/auth/guards';
import { setContentStatusAction } from '@/app/actions/admin/content';
import { AdminPageHeader, AdminTable, AdminTabs } from '@/components/admin/admin-shell';
import { InlineButtonForm } from '@/components/admin/inline-forms';
import { Badge, EmptyState, Stat } from '@/components/ui/primitives';
import { formatCents } from '@/lib/money';
import { formatDuration } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Music catalogue',
  robots: { index: false, follow: false },
};

export default async function AdminMusicPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string }>;
}) {
  const params = await searchParams;
  await requirePermission('music.write');

  const tab = params.tab === 'albums' ? 'albums' : 'songs';
  const status = params.status;
  const where = status ? { status: status as never } : {};

  const [songs, albums, inReview] = await Promise.all([
    tab === 'songs'
      ? prisma.song.findMany({
          where,
          orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
          take: 100,
          include: {
            artist: { select: { stageName: true, slug: true } },
            album: { select: { title: true } },
          },
        })
      : Promise.resolve([]),
    tab === 'albums'
      ? prisma.album.findMany({
          where,
          orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
          take: 100,
          include: {
            artist: { select: { stageName: true } },
            _count: { select: { songs: true } },
          },
        })
      : Promise.resolve([]),
    prisma.song.count({ where: { status: 'IN_REVIEW' } }),
  ]);

  const statusTabs = [
    { label: 'All', href: `/admin/music?tab=${tab}` },
    ...['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED'].map((entry) => ({
      label: entry,
      href: `/admin/music?tab=${tab}&status=${entry}`,
    })),
  ];

  return (
    <div>
      <AdminPageHeader
        eyebrow="Content"
        title="Music"
        description="Songs and albums across the roster, including creator submissions awaiting review."
      />

      {inReview > 0 ? (
        <div className="mb-6 max-w-xs">
          <Stat label="Awaiting review" value={String(inReview)} hint="creator submissions" />
        </div>
      ) : null}

      <AdminTabs
        active={`/admin/music?tab=${tab}`}
        items={[
          { label: 'Songs', href: '/admin/music?tab=songs' },
          { label: 'Albums', href: '/admin/music?tab=albums' },
        ]}
      />

      <AdminTabs
        active={status ? `/admin/music?tab=${tab}&status=${status}` : `/admin/music?tab=${tab}`}
        items={statusTabs}
      />

      {tab === 'songs' ? (
        songs.length === 0 ? (
          <EmptyState
            title="No songs"
            description="Creators add tracks from their dashboard, or staff can create artists and music directly."
          />
        ) : (
          <AdminTable head={['Track', 'Artist', 'Access', 'Plays', 'Status', '']}>
            {songs.map((song) => (
              <tr key={song.id}>
                <td className="px-4 py-3">
                  <p className="text-bone">{song.title}</p>
                  <p className="text-xs text-bone-dim">
                    {[song.album?.title, formatDuration(song.durationSec)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {!song.audioUrl ? (
                    <span className="mt-1 inline-block">
                      <Badge tone="warn">No audio file</Badge>
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-xs">
                  <Link
                    href={`/artists/${song.artist.slug}`}
                    className="text-bone-dim hover:text-gold-300"
                  >
                    {song.artist.stageName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs text-bone-dim">
                  {song.accessType}
                  {song.purchasable && song.priceCents ? ` · ${formatCents(song.priceCents)}` : ''}
                </td>
                <td className="px-4 py-3 text-xs text-bone-dim">
                  {song.playCount.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={song.status === 'PUBLISHED' ? 'success' : 'neutral'}>
                    {song.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <InlineButtonForm
                    action={setContentStatusAction}
                    hidden={{
                      entity: 'song',
                      id: song.id,
                      status: song.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED',
                    }}
                    label={song.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                  />
                </td>
              </tr>
            ))}
          </AdminTable>
        )
      ) : albums.length === 0 ? (
        <EmptyState title="No albums" description="Albums appear here once created." />
      ) : (
        <AdminTable head={['Album', 'Artist', 'Tracks', 'Price', 'Status', '']}>
          {albums.map((album) => (
            <tr key={album.id}>
              <td className="px-4 py-3">
                <p className="text-bone">{album.title}</p>
                <p className="text-xs text-bone-dim">/{album.slug}</p>
              </td>
              <td className="px-4 py-3 text-xs text-bone-dim">{album.artist.stageName}</td>
              <td className="px-4 py-3 text-xs text-bone-dim">{album._count.songs}</td>
              <td className="px-4 py-3 text-xs text-bone-dim">
                {album.purchasable && album.priceCents ? formatCents(album.priceCents) : '—'}
              </td>
              <td className="px-4 py-3">
                <Badge tone={album.status === 'PUBLISHED' ? 'success' : 'neutral'}>
                  {album.status}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <InlineButtonForm
                  action={setContentStatusAction}
                  hidden={{
                    entity: 'album',
                    id: album.id,
                    status: album.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED',
                  }}
                  label={album.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                />
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
