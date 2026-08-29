import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/server/auth/guards';
import { AdminPageHeader, AdminTable } from '@/components/admin/admin-shell';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/primitives';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Audit log',
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string }>;
}) {
  const params = await searchParams;
  await requirePermission('audit.read');

  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const where = params.action ? { action: { contains: params.action } } : {};

  const [total, entries] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { name: true, username: true } } },
    }),
  ]);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Operations"
        title="Audit log"
        description="An append-only record of privileged actions. Entries are never edited or deleted from the application."
      />

      <form method="get" className="mb-6 flex flex-wrap gap-3">
        <label className="sr-only" htmlFor="action">
          Filter by action
        </label>
        <input
          id="action"
          name="action"
          defaultValue={params.action}
          placeholder="Filter by action, e.g. order.paid"
          className="h-10 w-full max-w-sm rounded-sm border border-ink-600 bg-ink-800 px-3 text-sm text-bone placeholder:text-bone-dim focus:border-gold-700 focus:outline-none"
        />
        <button
          type="submit"
          className="h-10 rounded-sm border border-ink-600 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-bone-muted transition-colors hover:border-gold-700 hover:text-bone"
        >
          Filter
        </button>
      </form>

      {entries.length === 0 ? (
        <EmptyState
          title="Nothing logged yet"
          description="Privileged actions are recorded here as they happen."
        />
      ) : (
        <AdminTable head={['When', 'Actor', 'Action', 'Entity', 'Details']}>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="px-4 py-3 text-xs text-bone-dim">
                {formatDateTime(entry.createdAt)}
              </td>
              <td className="px-4 py-3 text-xs text-bone">
                {entry.actor?.name ?? 'System'}
                {entry.ip ? <p className="text-bone-dim">{entry.ip}</p> : null}
              </td>
              <td className="px-4 py-3 text-xs text-gold-300">{entry.action}</td>
              <td className="px-4 py-3 text-xs text-bone-dim">
                {entry.entityType}
                {entry.entityId ? (
                  <p className="truncate" title={entry.entityId}>
                    {entry.entityId.slice(0, 12)}…
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-3 text-xs text-bone-dim">
                {entry.metadata ? (
                  <code className="block max-w-xs truncate">{JSON.stringify(entry.metadata)}</code>
                ) : (
                  '—'
                )}
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
          if (params.action) search.set('action', params.action);
          if (nextPage > 1) search.set('page', String(nextPage));
          const qs = search.toString();
          return `/admin/audit${qs ? `?${qs}` : ''}`;
        }}
      />
    </div>
  );
}
