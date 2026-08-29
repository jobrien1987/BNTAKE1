import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/server/auth/guards';
import { can } from '@/lib/rbac';
import { deleteArticleAction } from '@/app/actions/admin/content';
import { AdminPageHeader, AdminTable, AdminTabs } from '@/components/admin/admin-shell';
import { InlineButtonForm } from '@/components/admin/inline-forms';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Culture',
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 25;
const STATUSES = ['DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const;

export default async function AdminCulturePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const actor = await requirePermission('culture.read');

  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const status = STATUSES.includes(params.status as (typeof STATUSES)[number])
    ? (params.status as (typeof STATUSES)[number])
    : undefined;

  const where = status ? { status } : {};

  const [total, articles] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        category: { select: { name: true } },
        author: { select: { name: true } },
      },
    }),
  ]);

  const canDelete = can(actor.role, 'culture.delete');
  const canWrite = can(actor.role, 'culture.write');

  return (
    <div>
      <AdminPageHeader
        eyebrow="Content"
        title="Culture"
        description="The newsroom. Article bodies are sanitized on save."
        action={
          canWrite ? <ButtonLink href="/admin/culture/new">New story</ButtonLink> : undefined
        }
      />

      <AdminTabs
        active={status ? `/admin/culture?status=${status}` : '/admin/culture'}
        items={[
          { label: 'All', href: '/admin/culture' },
          ...STATUSES.map((entry) => ({ label: entry, href: `/admin/culture?status=${entry}` })),
        ]}
      />

      {articles.length === 0 ? (
        <EmptyState
          title="No stories"
          description="Write the first one."
          action={canWrite ? <ButtonLink href="/admin/culture/new">New story</ButtonLink> : undefined}
        />
      ) : (
        <AdminTable head={['Headline', 'Category', 'Status', 'Updated', '']}>
          {articles.map((article) => (
            <tr key={article.id}>
              <td className="px-4 py-3">
                <Link
                  href={`/admin/culture/${article.id}`}
                  className="text-bone transition-colors hover:text-gold-300"
                >
                  {article.title}
                </Link>
                <p className="text-xs text-bone-dim">
                  /{article.slug}
                  {article.author ? ` · ${article.author.name}` : ''}
                </p>
                <div className="mt-1 flex gap-1">
                  {article.breaking ? <Badge tone="danger">Breaking</Badge> : null}
                  {article.featured ? <Badge tone="gold">Featured</Badge> : null}
                </div>
              </td>

              <td className="px-4 py-3 text-xs text-bone-dim">
                {article.category?.name ?? '—'}
              </td>

              <td className="px-4 py-3">
                <Badge tone={article.status === 'PUBLISHED' ? 'success' : 'neutral'}>
                  {article.status}
                </Badge>
              </td>

              <td className="px-4 py-3 text-xs text-bone-dim">{formatDate(article.updatedAt)}</td>

              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {article.status === 'PUBLISHED' ? (
                    <Link
                      href={`/culture/${article.slug}`}
                      className="text-[11px] uppercase tracking-[0.14em] text-bone-dim hover:text-gold-300"
                    >
                      View
                    </Link>
                  ) : null}
                  {canDelete ? (
                    <InlineButtonForm
                      action={deleteArticleAction}
                      hidden={{ id: article.id }}
                      label="Delete"
                      tone="danger"
                    />
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        buildHref={(nextPage) => {
          const search = new URLSearchParams();
          if (status) search.set('status', status);
          if (nextPage > 1) search.set('page', String(nextPage));
          const qs = search.toString();
          return `/admin/culture${qs ? `?${qs}` : ''}`;
        }}
      />
    </div>
  );
}
