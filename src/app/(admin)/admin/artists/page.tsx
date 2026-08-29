import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/server/auth/guards';
import { saveArtistAction } from '@/app/actions/admin/catalog';
import { EntityForm, STATUS_OPTIONS } from '@/components/admin/entity-form';
import { AdminPageHeader, AdminTable } from '@/components/admin/admin-shell';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Artists',
  robots: { index: false, follow: false },
};

export default async function AdminArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  await requirePermission('music.write');

  const [artists, editing] = await Promise.all([
    prisma.artist.findMany({
      orderBy: [{ featured: 'desc' }, { stageName: 'asc' }],
      include: { _count: { select: { songs: true, albums: true, follows: true } } },
    }),
    edit ? prisma.artist.findUnique({ where: { id: edit } }) : Promise.resolve(null),
  ]);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Content"
        title="Artists"
        description="The roster. Creator-owned pages appear here too and can be published from this screen."
        action={
          edit ? (
            <ButtonLink href="/admin/artists" variant="outline" size="sm">
              Cancel edit
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="mb-10">
        <EntityForm
          action={saveArtistAction}
          title={editing ? `Edit ${editing.stageName}` : 'Add an artist'}
          submitLabel={editing ? 'Save artist' : 'Create artist'}
          hidden={{ id: editing?.id }}
          fields={[
            {
              kind: 'text',
              name: 'stageName',
              label: 'Artist name',
              required: true,
              value: editing?.stageName,
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
              name: 'bio',
              label: 'Bio',
              rows: 5,
              full: true,
              value: editing?.bio,
            },
            { kind: 'text', name: 'location', label: 'Location', value: editing?.location },
            {
              kind: 'url',
              name: 'profileImageUrl',
              label: 'Profile image URL',
              value: editing?.profileImageUrl,
            },
            {
              kind: 'url',
              name: 'heroImageUrl',
              label: 'Hero image URL',
              value: editing?.heroImageUrl,
            },
            { kind: 'url', name: 'websiteUrl', label: 'Website', value: editing?.websiteUrl },
            {
              kind: 'url',
              name: 'instagramUrl',
              label: 'Instagram',
              value: editing?.instagramUrl,
            },
            { kind: 'url', name: 'twitterUrl', label: 'X', value: editing?.twitterUrl },
            { kind: 'url', name: 'youtubeUrl', label: 'YouTube', value: editing?.youtubeUrl },
            { kind: 'url', name: 'spotifyUrl', label: 'Spotify', value: editing?.spotifyUrl },
            {
              kind: 'checkbox',
              name: 'featured',
              label: 'Featured on Listen',
              value: editing?.featured,
            },
            {
              kind: 'checkbox',
              name: 'verified',
              label: 'Verified',
              value: editing?.verified,
            },
          ]}
        />
      </div>

      {artists.length === 0 ? (
        <EmptyState title="No artists yet" description="Add the first artist above." />
      ) : (
        <AdminTable head={['Artist', 'Catalogue', 'Followers', 'Status', '']}>
          {artists.map((artist) => (
            <tr key={artist.id}>
              <td className="px-4 py-3">
                <p className="text-bone">{artist.stageName}</p>
                <p className="text-xs text-bone-dim">/{artist.slug}</p>
                <div className="mt-1 flex gap-1">
                  {artist.featured ? <Badge tone="gold">Featured</Badge> : null}
                  {artist.verified ? <Badge>Verified</Badge> : null}
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-bone-dim">
                {artist._count.songs} songs · {artist._count.albums} albums
              </td>
              <td className="px-4 py-3 text-xs text-bone-dim">
                {artist._count.follows.toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <Badge tone={artist.status === 'PUBLISHED' ? 'success' : 'neutral'}>
                  {artist.status}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-3">
                  <Link
                    href={`/admin/artists?edit=${artist.id}`}
                    className="text-[11px] uppercase tracking-[0.14em] text-bone-dim hover:text-gold-300"
                  >
                    Edit
                  </Link>
                  {artist.status === 'PUBLISHED' ? (
                    <Link
                      href={`/artists/${artist.slug}`}
                      className="text-[11px] uppercase tracking-[0.14em] text-bone-dim hover:text-gold-300"
                    >
                      View
                    </Link>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
