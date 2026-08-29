import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/guards';
import {
  PasswordForm,
  PreferencesForm,
  SignOutEverywhereForm,
} from '@/components/account/settings-forms';
import { MediaFrame } from '@/components/ui/media-frame';
import { Divider, SectionHeader } from '@/components/ui/primitives';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const sessionUser = await requireUser('/account/settings');

  const [user, sessions, blocks] = await Promise.all([
    prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { email: true, marketingOptIn: true, createdAt: true },
    }),
    prisma.session.findMany({
      where: { userId: sessionUser.id, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
      take: 10,
      select: { id: true, userAgent: true, ip: true, lastSeenAt: true, createdAt: true },
    }),
    prisma.block.findMany({
      where: { blockerId: sessionUser.id },
      include: {
        blocked: { select: { id: true, name: true, username: true, avatarUrl: true } },
      },
    }),
  ]);

  if (!user) throw new Error('Account not found.');

  return (
    <div className="space-y-14">
      <section>
        <SectionHeader
          eyebrow="Account"
          title="Sign-in details"
          description="Your email is used for sign-in, receipts and account notices."
        />
        <dl className="max-w-md space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-bone-dim">Email</dt>
            <dd className="text-bone">{user.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-bone-dim">Member since</dt>
            <dd className="text-bone">{formatDateTime(user.createdAt)}</dd>
          </div>
        </dl>
      </section>

      <Divider />

      <section>
        <SectionHeader eyebrow="Security" title="Change your password" />
        <PasswordForm />
      </section>

      <Divider />

      <section>
        <SectionHeader
          eyebrow="Security"
          title="Active sessions"
          description="Devices currently signed in to your account."
        />
        <ul className="max-w-2xl divide-y divide-ink-700 border-y border-ink-700">
          {sessions.map((session) => (
            <li key={session.id} className="py-3 text-sm">
              <p className="line-clamp-1 text-bone">{session.userAgent ?? 'Unknown device'}</p>
              <p className="text-xs text-bone-dim">
                {session.ip ?? 'Unknown IP'} · last seen {formatDateTime(session.lastSeenAt)}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <SignOutEverywhereForm />
        </div>
      </section>

      <Divider />

      <section>
        <SectionHeader eyebrow="Email" title="Communication preferences" />
        <PreferencesForm marketingOptIn={user.marketingOptIn} />
      </section>

      <Divider />

      <section>
        <SectionHeader
          eyebrow="Community"
          title="Blocked members"
          description="You won't see their posts, and they won't see yours."
        />
        {blocks.length === 0 ? (
          <p className="text-sm text-bone-dim">You haven&rsquo;t blocked anyone.</p>
        ) : (
          <ul className="max-w-md divide-y divide-ink-700 border-y border-ink-700">
            {blocks.map((block) => (
              <li key={block.id} className="flex items-center gap-3 py-3">
                <MediaFrame
                  src={block.blocked.avatarUrl}
                  alt={block.blocked.name}
                  seed={block.blocked.name}
                  ratio="square"
                  className="h-9 w-9 shrink-0 rounded-full border border-ink-600"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-bone">{block.blocked.name}</p>
                  <p className="text-xs text-bone-dim">@{block.blocked.username}</p>
                </div>
                <Link
                  href={`/community/member/${block.blocked.username}`}
                  className="shrink-0 text-[11px] uppercase tracking-[0.16em] text-gold-400 hover:text-gold-300"
                >
                  Manage
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
