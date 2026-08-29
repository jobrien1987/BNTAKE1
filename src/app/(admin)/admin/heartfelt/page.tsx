import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/server/auth/guards';
import { flags } from '@/lib/env';
import { saveCampaignAction } from '@/app/actions/admin/catalog';
import { EntityForm } from '@/components/admin/entity-form';
import { AdminPageHeader, AdminTable } from '@/components/admin/admin-shell';
import { Alert, Badge, EmptyState } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { formatCents } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Heartfelt campaigns',
  robots: { index: false, follow: false },
};

const CAMPAIGN_STATUSES = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export default async function AdminHeartfeltPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  await requirePermission('heartfelt.write');

  const [campaigns, editing] = await Promise.all([
    prisma.campaign.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { donations: true, updates: true } } },
    }),
    edit ? prisma.campaign.findUnique({ where: { id: edit } }) : Promise.resolve(null),
  ]);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Content"
        title="Heartfelt"
        description="Campaigns and their fundraising totals. Raised amounts are only ever moved by a confirmed payment, never edited by hand."
        action={
          edit ? (
            <ButtonLink href="/admin/heartfelt" variant="outline" size="sm">
              Cancel edit
            </ButtonLink>
          ) : undefined
        }
      />

      {!flags.stripeEnabled ? (
        <div className="mb-6">
          <Alert tone="warn">
            Payments are not configured, so donations cannot be collected even on campaigns that
            enable them.
          </Alert>
        </div>
      ) : null}

      <div className="mb-10">
        <EntityForm
          action={saveCampaignAction}
          title={editing ? `Edit ${editing.title}` : 'Create a campaign'}
          submitLabel={editing ? 'Save campaign' : 'Create campaign'}
          hidden={{ id: editing?.id }}
          fields={[
            { kind: 'text', name: 'title', label: 'Title', required: true, value: editing?.title },
            {
              kind: 'select',
              name: 'status',
              label: 'Status',
              required: true,
              value: editing?.status ?? 'DRAFT',
              options: CAMPAIGN_STATUSES,
            },
            {
              kind: 'textarea',
              name: 'summary',
              label: 'Summary',
              rows: 2,
              full: true,
              value: editing?.summary,
            },
            {
              kind: 'textarea',
              name: 'story',
              label: 'Story',
              hint: 'HTML allowed and sanitized on save.',
              rows: 12,
              mono: true,
              full: true,
              required: true,
              value: editing?.story,
            },
            {
              kind: 'url',
              name: 'heroImageUrl',
              label: 'Hero image URL',
              value: editing?.heroImageUrl,
            },
            {
              kind: 'url',
              name: 'thumbnailUrl',
              label: 'Thumbnail URL',
              value: editing?.thumbnailUrl,
            },
            { kind: 'text', name: 'category', label: 'Category', value: editing?.category },
            { kind: 'text', name: 'location', label: 'Location', value: editing?.location },
            {
              kind: 'number',
              name: 'goalCents',
              label: 'Goal (cents)',
              hint: '500000 = $5,000',
              min: 0,
              value: editing?.goalCents ?? 0,
            },
            {
              kind: 'date',
              name: 'endsAt',
              label: 'Ends',
              value: editing?.endsAt ? editing.endsAt.toISOString().slice(0, 10) : '',
            },
            {
              kind: 'checkbox',
              name: 'donationEnabled',
              label: 'Accept donations',
              value: editing?.donationEnabled,
            },
            { kind: 'checkbox', name: 'featured', label: 'Featured', value: editing?.featured },
          ]}
        />
      </div>

      {campaigns.length === 0 ? (
        <EmptyState title="No campaigns" description="Create the first campaign above." />
      ) : (
        <AdminTable head={['Campaign', 'Raised', 'Supporters', 'Status', '']}>
          {campaigns.map((campaign) => (
            <tr key={campaign.id}>
              <td className="px-4 py-3">
                <p className="text-bone">{campaign.title}</p>
                <p className="text-xs text-bone-dim">/{campaign.slug}</p>
                <div className="mt-1 flex gap-1">
                  {campaign.featured ? <Badge tone="gold">Featured</Badge> : null}
                  {campaign.donationEnabled ? <Badge>Donations on</Badge> : null}
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-bone-dim">
                {formatCents(campaign.raisedCents)}
                {campaign.goalCents > 0 ? ` of ${formatCents(campaign.goalCents)}` : ''}
              </td>
              <td className="px-4 py-3 text-xs text-bone-dim">{campaign._count.donations}</td>
              <td className="px-4 py-3">
                <Badge tone={campaign.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {campaign.status}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-3">
                  <Link
                    href={`/admin/heartfelt?edit=${campaign.id}`}
                    className="text-[11px] uppercase tracking-[0.14em] text-bone-dim hover:text-gold-300"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/heartfelt/${campaign.slug}`}
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
