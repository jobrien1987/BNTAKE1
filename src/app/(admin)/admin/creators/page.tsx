import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/server/auth/guards';
import { setCreatorStatusAction } from '@/app/actions/admin/people';
import { AdminPageHeader, AdminTable, AdminTabs } from '@/components/admin/admin-shell';
import { InlineSelectForm } from '@/components/admin/inline-forms';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Creators',
  robots: { index: false, follow: false },
};

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;

export default async function AdminCreatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  await requirePermission('creators.manage');

  const status = STATUSES.includes(params.status as (typeof STATUSES)[number])
    ? (params.status as (typeof STATUSES)[number])
    : undefined;

  const profiles = await prisma.creatorProfile.findMany({
    where: status ? { status } : {},
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      user: { select: { id: true, name: true, email: true, username: true, role: true } },
      artist: { select: { slug: true, stageName: true, status: true } },
    },
  });

  const acceptances = await prisma.creatorAgreementAcceptance.findMany({
    where: { userId: { in: profiles.map((profile) => profile.userId) } },
    orderBy: { acceptedAt: 'desc' },
    select: { userId: true, version: true, acceptedAt: true },
  });

  const acceptanceByUser = new Map(
    acceptances.map((entry) => [entry.userId, entry] as const),
  );

  return (
    <div>
      <AdminPageHeader
        eyebrow="People"
        title="Creators"
        description="Approve applications and manage creator standing. The agreement version each creator accepted is recorded permanently."
      />

      <AdminTabs
        active={status ? `/admin/creators?status=${status}` : '/admin/creators'}
        items={[
          { label: 'All', href: '/admin/creators' },
          ...STATUSES.map((entry) => ({
            label: entry,
            href: `/admin/creators?status=${entry}`,
          })),
        ]}
      />

      {profiles.length === 0 ? (
        <EmptyState
          title="No creator applications"
          description="Applications appear here as soon as someone applies."
        />
      ) : (
        <AdminTable head={['Creator', 'Tier', 'Artist page', 'Agreement', 'Status']}>
          {profiles.map((profile) => {
            const acceptance = acceptanceByUser.get(profile.userId);

            return (
              <tr key={profile.id}>
                <td className="px-4 py-3">
                  <p className="text-bone">{profile.displayName}</p>
                  <p className="text-xs text-bone-dim">
                    {profile.user.email}
                    {profile.contactEmail && profile.contactEmail !== profile.user.email
                      ? ` · contact: ${profile.contactEmail}`
                      : ''}
                  </p>
                  <p className="text-xs text-bone-dim">Applied {formatDate(profile.createdAt)}</p>
                </td>

                <td className="px-4 py-3">
                  <Badge>{profile.tier}</Badge>
                  <p className="mt-1 text-xs text-bone-dim">Account role: {profile.user.role}</p>
                </td>

                <td className="px-4 py-3 text-xs">
                  {profile.artist ? (
                    <>
                      <Link
                        href={`/artists/${profile.artist.slug}`}
                        className="text-bone transition-colors hover:text-gold-300"
                      >
                        {profile.artist.stageName}
                      </Link>
                      <p className="mt-1 text-bone-dim">{profile.artist.status}</p>
                    </>
                  ) : (
                    <span className="text-bone-dim">Not created yet</span>
                  )}
                </td>

                <td className="px-4 py-3 text-xs">
                  {acceptance ? (
                    <>
                      <p className="text-bone">v{acceptance.version}</p>
                      <p className="text-bone-dim">{formatDate(acceptance.acceptedAt)}</p>
                    </>
                  ) : (
                    <span className="text-[#ff9aa2]">No acceptance on record</span>
                  )}
                </td>

                <td className="px-4 py-3">
                  <InlineSelectForm
                    action={setCreatorStatusAction}
                    name="status"
                    value={profile.status}
                    label={`Status for ${profile.displayName}`}
                    hidden={{ profileId: profile.id }}
                    options={STATUSES.map((entry) => ({ value: entry, label: entry }))}
                  />
                </td>
              </tr>
            );
          })}
        </AdminTable>
      )}
    </div>
  );
}
