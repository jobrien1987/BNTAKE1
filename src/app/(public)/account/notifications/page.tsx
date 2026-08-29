import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/server/auth/guards';
import { listNotifications } from '@/server/services/notifications';
import { markAllNotificationsReadAction } from '@/app/actions/account';
import { Badge, EmptyState, SectionHeader } from '@/components/ui/primitives';
import { SubmitButton } from '@/components/ui/form';
import { relativeTime, cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Notifications',
  robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
  const user = await requireUser('/account/notifications');
  const notifications = await listNotifications(user.id, 50);
  const unread = notifications.filter((entry) => !entry.readAt).length;

  if (notifications.length === 0) {
    return (
      <EmptyState
        title="Nothing here yet"
        description="Order updates, replies, follows and network announcements land here."
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <SectionHeader
          eyebrow={unread > 0 ? `${unread} unread` : 'All caught up'}
          title="Notifications"
          className="mb-0"
        />
        {unread > 0 ? (
          <form action={markAllNotificationsReadAction}>
            <SubmitButton variant="outline" size="sm" pendingLabel="Marking…">
              Mark all read
            </SubmitButton>
          </form>
        ) : null}
      </div>

      <ul className="divide-y divide-ink-700 border-y border-ink-700">
        {notifications.map((notification) => {
          const content = (
            <div
              className={cn(
                'flex items-start gap-4 py-4',
                !notification.readAt && 'border-l-2 border-gold-500 pl-4',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{notification.type}</Badge>
                  <time
                    dateTime={notification.createdAt.toISOString()}
                    className="text-xs text-bone-dim"
                  >
                    {relativeTime(notification.createdAt)}
                  </time>
                </div>
                <p className="mt-2 text-sm text-bone">{notification.title}</p>
                {notification.body ? (
                  <p className="mt-1 text-sm text-bone-dim">{notification.body}</p>
                ) : null}
              </div>
            </div>
          );

          return (
            <li key={notification.id}>
              {notification.href ? (
                <Link href={notification.href} className="block transition-colors hover:bg-ink-800/60">
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
