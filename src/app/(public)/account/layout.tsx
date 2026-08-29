import Link from 'next/link';
import { requireUser } from '@/server/auth/guards';
import { ACCOUNT_NAV } from '@/lib/nav';
import { AccountNav } from '@/components/account/account-nav';
import { unreadCount } from '@/server/services/notifications';

export const dynamic = 'force-dynamic';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser('/account');
  const unread = await unreadCount(user.id);

  return (
    <div className="container-page py-10 sm:py-14">
      <header className="mb-8 border-b border-ink-700 pb-6">
        <p className="eyebrow">Your account</p>
        <h1 className="mt-2 text-4xl leading-none sm:text-5xl">{user.name}</h1>
        <p className="mt-2 text-sm text-bone-dim">
          @{user.username}
          {user.isCreator ? (
            <>
              {' · '}
              <Link href="/creator" className="text-gold-400 hover:text-gold-300">
                Creator dashboard
              </Link>
            </>
          ) : null}
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <AccountNav items={ACCOUNT_NAV} unread={unread} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
