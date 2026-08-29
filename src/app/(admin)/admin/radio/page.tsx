import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/server/auth/guards';
import { saveRadioStationAction } from '@/app/actions/admin/catalog';
import { EntityForm } from '@/components/admin/entity-form';
import { AdminPageHeader, AdminTable } from '@/components/admin/admin-shell';
import { Alert, Badge, EmptyState } from '@/components/ui/primitives';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Radio',
  robots: { index: false, follow: false },
};

export default async function AdminRadioPage() {
  await requirePermission('music.write');

  const station = await prisma.radioStation.findFirst({
    orderBy: { createdAt: 'asc' },
    include: {
      plays: {
        orderBy: { playedAt: 'desc' },
        take: 20,
      },
      shows: true,
      _count: { select: { plays: true, shows: true } },
    },
  });

  return (
    <div>
      <AdminPageHeader
        eyebrow="Content"
        title="Badazz Radio"
        description="Station configuration and the play log. Without a stream URL the player stays disabled rather than showing a dead button."
      />

      {station && !station.streamUrl ? (
        <div className="mb-6">
          <Alert tone="warn">
            No stream URL is set, so listeners see an explanatory disabled state instead of a play
            button.
          </Alert>
        </div>
      ) : null}

      <div className="mb-10">
        <EntityForm
          action={saveRadioStationAction}
          title={station ? `Edit ${station.name}` : 'Create the station'}
          submitLabel={station ? 'Save station' : 'Create station'}
          hidden={{ id: station?.id }}
          fields={[
            {
              kind: 'text',
              name: 'name',
              label: 'Station name',
              required: true,
              value: station?.name ?? 'Badazz Radio',
            },
            { kind: 'text', name: 'tagline', label: 'Tagline', value: station?.tagline },
            {
              kind: 'textarea',
              name: 'description',
              label: 'Description',
              rows: 4,
              full: true,
              value: station?.description,
            },
            { kind: 'url', name: 'logoUrl', label: 'Logo URL', value: station?.logoUrl },
            {
              kind: 'url',
              name: 'heroImageUrl',
              label: 'Hero image URL',
              value: station?.heroImageUrl,
            },
            {
              kind: 'url',
              name: 'streamUrl',
              label: 'Stream URL',
              hint: 'The live audio stream (for example an Icecast or HLS endpoint).',
              full: true,
              value: station?.streamUrl,
            },
            { kind: 'checkbox', name: 'isLive', label: 'Currently on air', value: station?.isLive },
            { kind: 'checkbox', name: 'active', label: 'Active', value: station?.active ?? true },
          ]}
        />
      </div>

      {station ? (
        <section>
          <h2 className="eyebrow mb-4">
            Recent plays ({station._count.plays.toLocaleString()} logged)
          </h2>

          {station.plays.length === 0 ? (
            <EmptyState
              title="No plays logged"
              description="The play log fills as tracks go out on air."
            />
          ) : (
            <AdminTable head={['Track', 'Artist', 'Played']}>
              {station.plays.map((play) => (
                <tr key={play.id}>
                  <td className="px-4 py-3 text-bone">
                    {play.trackTitle}
                    {play.songId ? (
                      <span className="ml-2">
                        <Badge>Catalogue</Badge>
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-bone-dim">{play.artistName}</td>
                  <td className="px-4 py-3 text-xs text-bone-dim">
                    {formatDateTime(play.playedAt)}
                  </td>
                </tr>
              ))}
            </AdminTable>
          )}
        </section>
      ) : null}
    </div>
  );
}
