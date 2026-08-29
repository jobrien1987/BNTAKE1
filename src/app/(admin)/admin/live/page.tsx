import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/server/auth/guards';
import { flags } from '@/lib/env';
import { saveLiveStreamAction } from '@/app/actions/admin/catalog';
import { EntityForm, ACCESS_OPTIONS } from '@/components/admin/entity-form';
import { AdminPageHeader, AdminTable } from '@/components/admin/admin-shell';
import { Alert, Badge, EmptyState } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Live streams',
  robots: { index: false, follow: false },
};

const LIVE_STATUSES = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'LIVE', label: 'Live' },
  { value: 'ENDED', label: 'Ended' },
  { value: 'CANCELED', label: 'Canceled' },
];

export default async function AdminLivePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  await requirePermission('watch.write');

  const [streams, artists, editing] = await Promise.all([
    prisma.liveStream.findMany({
      orderBy: [{ status: 'asc' }, { scheduledFor: 'desc' }],
      take: 60,
      include: { artist: { select: { stageName: true } } },
    }),
    prisma.artist.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { stageName: 'asc' },
      select: { id: true, stageName: true },
    }),
    edit ? prisma.liveStream.findUnique({ where: { id: edit } }) : Promise.resolve(null),
  ]);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Content"
        title="Live"
        description="Schedule streams and attach a playback URL from your streaming provider."
        action={
          edit ? (
            <ButtonLink href="/admin/live" variant="outline" size="sm">
              Cancel edit
            </ButtonLink>
          ) : undefined
        }
      />

      {!flags.liveEnabled ? (
        <div className="mb-6">
          <Alert tone="warn">
            Live playback is disabled by the FEATURE_LIVE_ENABLED flag. Schedules and replays still
            render publicly; only playback is switched off.
          </Alert>
        </div>
      ) : null}

      <div className="mb-10">
        <EntityForm
          action={saveLiveStreamAction}
          title={editing ? `Edit ${editing.title}` : 'Schedule a stream'}
          submitLabel={editing ? 'Save stream' : 'Create stream'}
          hidden={{ id: editing?.id }}
          fields={[
            { kind: 'text', name: 'title', label: 'Title', required: true, value: editing?.title },
            {
              kind: 'select',
              name: 'status',
              label: 'Status',
              required: true,
              value: editing?.status ?? 'SCHEDULED',
              options: LIVE_STATUSES,
            },
            {
              kind: 'textarea',
              name: 'description',
              label: 'Description',
              rows: 4,
              full: true,
              value: editing?.description,
            },
            { kind: 'url', name: 'posterUrl', label: 'Poster URL', value: editing?.posterUrl },
            {
              kind: 'url',
              name: 'playbackUrl',
              label: 'Playback URL',
              hint: 'HLS playlist (.m3u8) or direct stream from your provider.',
              value: editing?.playbackUrl,
            },
            {
              kind: 'text',
              name: 'provider',
              label: 'Provider',
              placeholder: 'mux, cloudflare, custom…',
              value: editing?.provider,
            },
            {
              kind: 'datetime',
              name: 'scheduledFor',
              label: 'Scheduled for',
              value: editing?.scheduledFor
                ? new Date(
                    editing.scheduledFor.getTime() -
                      editing.scheduledFor.getTimezoneOffset() * 60_000,
                  )
                    .toISOString()
                    .slice(0, 16)
                : '',
            },
            {
              kind: 'select',
              name: 'artistId',
              label: 'Artist',
              value: editing?.artistId ?? '',
              options: [
                { value: '', label: 'No artist' },
                ...artists.map((artist) => ({ value: artist.id, label: artist.stageName })),
              ],
            },
            {
              kind: 'select',
              name: 'accessType',
              label: 'Access',
              required: true,
              value: editing?.accessType ?? 'FREE',
              options: ACCESS_OPTIONS,
            },
            {
              kind: 'number',
              name: 'priceCents',
              label: 'Price (cents)',
              min: 0,
              value: editing?.priceCents ?? '',
            },
          ]}
        />
      </div>

      {streams.length === 0 ? (
        <EmptyState title="Nothing scheduled" description="Create the first stream above." />
      ) : (
        <AdminTable head={['Stream', 'Artist', 'Scheduled', 'Access', 'Status', '']}>
          {streams.map((stream) => (
            <tr key={stream.id}>
              <td className="px-4 py-3">
                <p className="text-bone">{stream.title}</p>
                <p className="text-xs text-bone-dim">/{stream.slug}</p>
                {stream.status === 'LIVE' && !stream.playbackUrl ? (
                  <span className="mt-1 inline-block">
                    <Badge tone="warn">No playback URL</Badge>
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-xs text-bone-dim">
                {stream.artist?.stageName ?? '—'}
              </td>
              <td className="px-4 py-3 text-xs text-bone-dim">
                {stream.scheduledFor ? formatDateTime(stream.scheduledFor) : '—'}
              </td>
              <td className="px-4 py-3 text-xs text-bone-dim">{stream.accessType}</td>
              <td className="px-4 py-3">
                <Badge tone={stream.status === 'LIVE' ? 'live' : 'neutral'}>{stream.status}</Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-3">
                  <Link
                    href={`/admin/live?edit=${stream.id}`}
                    className="text-[11px] uppercase tracking-[0.14em] text-bone-dim hover:text-gold-300"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/live/${stream.slug}`}
                    className="text-[11px] uppercase tracking-[0.14em] text-bone-dim hover:text-gold-300"
                  >
                    View
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
