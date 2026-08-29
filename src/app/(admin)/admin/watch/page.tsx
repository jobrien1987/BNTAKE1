import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/server/auth/guards';
import { saveVideoAction } from '@/app/actions/admin/catalog';
import { setContentStatusAction } from '@/app/actions/admin/content';
import { EntityForm, STATUS_OPTIONS, ACCESS_OPTIONS } from '@/components/admin/entity-form';
import { AdminPageHeader, AdminTable, AdminTabs } from '@/components/admin/admin-shell';
import { InlineButtonForm } from '@/components/admin/inline-forms';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { formatCents } from '@/lib/money';
import { runtimeLabel } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Watch catalogue',
  robots: { index: false, follow: false },
};

const KINDS = [
  'MOVIE',
  'DOCUMENTARY',
  'SERIES',
  'EPISODE',
  'INTERVIEW',
  'MUSIC_VIDEO',
  'TRAILER',
] as const;

export default async function AdminWatchPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; status?: string }>;
}) {
  const params = await searchParams;
  await requirePermission('watch.write');

  const status = params.status;

  const [videos, editing] = await Promise.all([
    prisma.video.findMany({
      where: status ? { status: status as never } : {},
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    params.edit ? prisma.video.findUnique({ where: { id: params.edit } }) : Promise.resolve(null),
  ]);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Content"
        title="Watch"
        description="Movies, documentaries and video. The media URL is never sent to the browser — playback goes through an access-checked endpoint."
        action={
          params.edit ? (
            <ButtonLink href="/admin/watch" variant="outline" size="sm">
              Cancel edit
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="mb-10">
        <EntityForm
          action={saveVideoAction}
          title={editing ? `Edit ${editing.title}` : 'Add a title'}
          submitLabel={editing ? 'Save title' : 'Create title'}
          hidden={{ id: editing?.id }}
          fields={[
            { kind: 'text', name: 'title', label: 'Title', required: true, value: editing?.title },
            {
              kind: 'select',
              name: 'kind',
              label: 'Type',
              required: true,
              value: editing?.kind ?? 'MOVIE',
              options: KINDS.map((kind) => ({ value: kind, label: kind.replace('_', ' ') })),
            },
            {
              kind: 'textarea',
              name: 'synopsis',
              label: 'Synopsis',
              rows: 4,
              full: true,
              value: editing?.synopsis,
            },
            { kind: 'url', name: 'posterUrl', label: 'Poster URL', value: editing?.posterUrl },
            {
              kind: 'url',
              name: 'backdropUrl',
              label: 'Backdrop URL',
              value: editing?.backdropUrl,
            },
            { kind: 'url', name: 'trailerUrl', label: 'Trailer URL', value: editing?.trailerUrl },
            {
              kind: 'url',
              name: 'mediaUrl',
              label: 'Media file URL',
              hint: 'The full title. Served only through the gated playback endpoint.',
              value: editing?.mediaUrl,
            },
            {
              kind: 'number',
              name: 'durationSec',
              label: 'Duration (seconds)',
              min: 0,
              value: editing?.durationSec ?? 0,
            },
            {
              kind: 'date',
              name: 'releaseDate',
              label: 'Release date',
              value: editing?.releaseDate ? editing.releaseDate.toISOString().slice(0, 10) : '',
            },
            { kind: 'text', name: 'director', label: 'Director', value: editing?.director },
            {
              kind: 'text',
              name: 'contentRating',
              label: 'Content rating',
              placeholder: 'R, PG-13…',
              value: editing?.contentRating,
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
              hint: '1499 = $14.99',
              min: 0,
              value: editing?.priceCents ?? '',
            },
            {
              kind: 'select',
              name: 'status',
              label: 'Status',
              required: true,
              value: editing?.status ?? 'DRAFT',
              options: STATUS_OPTIONS,
            },
            {
              kind: 'textarea',
              name: 'seoDescription',
              label: 'SEO description',
              rows: 2,
              full: true,
              value: editing?.seoDescription,
            },
            {
              kind: 'checkbox',
              name: 'purchasable',
              label: 'Sell this title',
              value: editing?.purchasable,
            },
            { kind: 'checkbox', name: 'featured', label: 'Featured', value: editing?.featured },
          ]}
        />
      </div>

      <AdminTabs
        active={status ? `/admin/watch?status=${status}` : '/admin/watch'}
        items={[
          { label: 'All', href: '/admin/watch' },
          ...STATUS_OPTIONS.map((option) => ({
            label: option.label,
            href: `/admin/watch?status=${option.value}`,
          })),
        ]}
      />

      {videos.length === 0 ? (
        <EmptyState title="No titles" description="Add the first title above." />
      ) : (
        <AdminTable head={['Title', 'Type', 'Access', 'Views', 'Status', '']}>
          {videos.map((video) => (
            <tr key={video.id}>
              <td className="px-4 py-3">
                <p className="text-bone">{video.title}</p>
                <p className="text-xs text-bone-dim">
                  /{video.slug}
                  {video.durationSec ? ` · ${runtimeLabel(video.durationSec)}` : ''}
                </p>
                {!video.mediaUrl ? (
                  <span className="mt-1 inline-block">
                    <Badge tone="warn">No media file</Badge>
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-xs text-bone-dim">{video.kind.replace('_', ' ')}</td>
              <td className="px-4 py-3 text-xs text-bone-dim">
                {video.accessType}
                {video.purchasable && video.priceCents
                  ? ` · ${formatCents(video.priceCents)}`
                  : ''}
              </td>
              <td className="px-4 py-3 text-xs text-bone-dim">
                {video.viewCount.toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <Badge tone={video.status === 'PUBLISHED' ? 'success' : 'neutral'}>
                  {video.status}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-3">
                  <Link
                    href={`/admin/watch?edit=${video.id}`}
                    className="text-[11px] uppercase tracking-[0.14em] text-bone-dim hover:text-gold-300"
                  >
                    Edit
                  </Link>
                  <InlineButtonForm
                    action={setContentStatusAction}
                    hidden={{
                      entity: 'video',
                      id: video.id,
                      status: video.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED',
                    }}
                    label={video.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                  />
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
