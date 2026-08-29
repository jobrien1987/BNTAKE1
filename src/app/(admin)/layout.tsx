import Link from 'next/link';
import { requireStaff } from '@/server/auth/guards';
import { can, type Permission } from '@/lib/rbac';
import { ADMIN_NAV } from '@/lib/nav';
import { AdminNav } from '@/components/admin/admin-nav';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff('/admin');

  // The nav is filtered by permission so a MODERATOR never sees links they
  // cannot use. Every page still re-checks its own permission on load.
  const groups = ADMIN_NAV.map((group) => ({
    label: group.label,
    items: group.items.filter((item) => can(user.role, item.permission as Permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      <div className="min-h-dvh">
        <header className="sticky top-0 z-40 border-b border-ink-700 bg-ink/95 backdrop-blur">
          <div className="flex h-[60px] items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="font-display text-base tracking-tight">
                BOOSIE <span className="gold-text">ADMIN</span>
              </Link>
            </div>

            <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.16em]">
              <span className="hidden text-bone-dim sm:inline">
                {user.name} · {user.role}
              </span>
              <Link href="/" className="text-bone-dim transition-colors hover:text-gold-300">
                View site
              </Link>
            </div>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row">
          <AdminNav groups={groups} />

          <main id="main" className="min-w-0 flex-1 px-4 py-8 sm:px-6 sm:py-10">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
