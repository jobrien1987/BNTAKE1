import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/server/auth/guards';
import { assignableRoles, can } from '@/lib/rbac';
import { setUserRoleAction, setUserStatusAction } from '@/app/actions/admin/people';
import { AdminPageHeader, AdminTable } from '@/components/admin/admin-shell';
import { InlineSelectForm } from '@/components/admin/inline-forms';
import { Badge } from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Users',
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 25;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; page?: string }>;
}) {
  const params = await searchParams;
  const actor = await requirePermission('users.read');

  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const query = params.q?.trim();

  const where = {
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' as const } },
            { email: { contains: query, mode: 'insensitive' as const } },
            { username: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(params.role ? { role: params.role as never } : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        status: true,
        isCreator: true,
        createdAt: true,
      },
    }),
  ]);

  const canWriteRoles = can(actor.role, 'roles.write');
  const canWriteUsers = can(actor.role, 'users.write');
  const allowedRoles = assignableRoles(actor.role);

  return (
    <div>
      <AdminPageHeader
        eyebrow="People"
        title="Users"
        description="Roles decide what someone can do. You can only assign roles at or below your own level."
      />

      <form method="get" className="mb-6 flex flex-wrap gap-3">
        <label className="sr-only" htmlFor="q">
          Search users
        </label>
        <input
          id="q"
          name="q"
          defaultValue={query}
          placeholder="Search name, email or username"
          className="h-10 w-full max-w-sm rounded-sm border border-ink-600 bg-ink-800 px-3 text-sm text-bone placeholder:text-bone-dim focus:border-gold-700 focus:outline-none"
        />
        <button
          type="submit"
          className="h-10 rounded-sm border border-ink-600 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-bone-muted transition-colors hover:border-gold-700 hover:text-bone"
        >
          Search
        </button>
        {query ? (
          <Link
            href="/admin/users"
            className="flex h-10 items-center text-xs uppercase tracking-[0.14em] text-bone-dim hover:text-bone"
          >
            Clear
          </Link>
        ) : null}
      </form>

      <AdminTable head={['Member', 'Role', 'Status', 'Joined']}>
        {users.map((entry) => {
          const outranksMe = !allowedRoles.includes(entry.role);
          const isSelf = entry.id === actor.id;

          return (
            <tr key={entry.id} className="align-middle">
              <td className="px-4 py-3">
                <Link
                  href={`/community/member/${entry.username}`}
                  className="text-bone transition-colors hover:text-gold-300"
                >
                  {entry.name}
                </Link>
                <p className="text-xs text-bone-dim">{entry.email}</p>
                {entry.isCreator ? (
                  <span className="mt-1 inline-block">
                    <Badge tone="gold">Creator</Badge>
                  </span>
                ) : null}
              </td>

              <td className="px-4 py-3">
                {canWriteRoles && !isSelf && !outranksMe ? (
                  <InlineSelectForm
                    action={setUserRoleAction}
                    name="role"
                    value={entry.role}
                    label={`Role for ${entry.name}`}
                    hidden={{ userId: entry.id }}
                    options={allowedRoles.map((role) => ({ value: role, label: role }))}
                  />
                ) : (
                  <Badge>{entry.role}</Badge>
                )}
              </td>

              <td className="px-4 py-3">
                {canWriteUsers && !isSelf && !outranksMe ? (
                  <InlineSelectForm
                    action={setUserStatusAction}
                    name="status"
                    value={entry.status}
                    label={`Status for ${entry.name}`}
                    hidden={{ userId: entry.id }}
                    options={[
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'SUSPENDED', label: 'Suspended' },
                      { value: 'BANNED', label: 'Banned' },
                    ]}
                  />
                ) : (
                  <Badge tone={entry.status === 'ACTIVE' ? 'success' : 'danger'}>
                    {entry.status}
                  </Badge>
                )}
              </td>

              <td className="px-4 py-3 text-xs text-bone-dim">{formatDate(entry.createdAt)}</td>
            </tr>
          );
        })}
      </AdminTable>

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        buildHref={(nextPage) => {
          const search = new URLSearchParams();
          if (query) search.set('q', query);
          if (params.role) search.set('role', params.role);
          if (nextPage > 1) search.set('page', String(nextPage));
          const qs = search.toString();
          return `/admin/users${qs ? `?${qs}` : ''}`;
        }}
      />
    </div>
  );
}
