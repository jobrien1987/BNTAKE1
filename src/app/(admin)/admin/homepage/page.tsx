import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/server/auth/guards';
import { saveHomepageSectionAction } from '@/app/actions/admin/catalog';
import { EntityForm } from '@/components/admin/entity-form';
import { AdminPageHeader } from '@/components/admin/admin-shell';
import { Alert, Badge, EmptyState } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Homepage',
  robots: { index: false, follow: false },
};

export default async function AdminHomepagePage() {
  await requirePermission('homepage.write');

  const sections = await prisma.homepageSection.findMany({
    orderBy: { position: 'asc' },
    include: { _count: { select: { items: true } } },
  });

  return (
    <div>
      <AdminPageHeader
        eyebrow="Content"
        title="Homepage"
        description="Section order, copy and visibility. A section with no pinned items falls back to the newest published content of its type, so the homepage never renders empty."
      />

      <div className="mb-8">
        <Alert tone="info">
          Disabling a section hides it entirely. Reordering uses the position field — lower numbers
          appear first.
        </Alert>
      </div>

      {sections.length === 0 ? (
        <EmptyState
          title="No sections configured"
          description="Run the seed script to create the default homepage layout."
        />
      ) : (
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.id}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone={section.enabled ? 'success' : 'neutral'}>
                  {section.enabled ? 'Enabled' : 'Hidden'}
                </Badge>
                <Badge>{section.type}</Badge>
                <span className="text-xs text-bone-dim">
                  key: {section.key} · {section._count.items} pinned item
                  {section._count.items === 1 ? '' : 's'}
                </span>
              </div>

              <EntityForm
                action={saveHomepageSectionAction}
                submitLabel="Save section"
                hidden={{ id: section.id }}
                fields={[
                  {
                    kind: 'text',
                    name: 'title',
                    label: 'Title',
                    required: true,
                    value: section.title,
                  },
                  {
                    kind: 'number',
                    name: 'position',
                    label: 'Position',
                    required: true,
                    min: 0,
                    value: section.position,
                  },
                  {
                    kind: 'text',
                    name: 'subtitle',
                    label: 'Subtitle',
                    full: true,
                    value: section.subtitle,
                  },
                  {
                    kind: 'text',
                    name: 'ctaLabel',
                    label: 'Link label',
                    value: section.ctaLabel,
                  },
                  {
                    kind: 'text',
                    name: 'ctaHref',
                    label: 'Link URL',
                    placeholder: '/listen',
                    value: section.ctaHref,
                  },
                  {
                    kind: 'checkbox',
                    name: 'enabled',
                    label: 'Show this section',
                    value: section.enabled,
                  },
                ]}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
