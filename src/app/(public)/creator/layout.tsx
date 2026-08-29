import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/guards';
import { CREATOR_NAV } from '@/lib/nav';
import { AccountNav } from '@/components/account/account-nav';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser('/creator');

  const profile = await prisma.creatorProfile.findUnique({
    where: { userId: user.id },
    select: { status: true, displayName: true },
  });

  // Anyone without an approved profile is routed to the application flow —
  // except while they are already on it.
  const pathname = (await headers()).get('x-pathname') ?? '';
  const onJoinPage = pathname.startsWith('/creator/join');

  if ((!profile || profile.status !== 'APPROVED') && !onJoinPage) {
    redirect('/creator/join');
  }

  return (
    <div className="container-page py-10 sm:py-14">
      <header className="mb-8 border-b border-ink-700 pb-6">
        <p className="eyebrow">Creator</p>
        <h1 className="mt-2 text-4xl leading-none sm:text-5xl">
          {profile?.displayName ?? user.name}
        </h1>
        <p className="mt-2 text-sm text-bone-dim">
          Manage your catalogue, releases and merch requests.
        </p>
      </header>

      {profile?.status === 'APPROVED' ? (
        <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <AccountNav items={CREATOR_NAV} unread={0} />
          <div className="min-w-0">{children}</div>
        </div>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}
