import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import { listNotifications, unreadCount } from '@/server/services/notifications';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ unread: 0, notifications: [] }, { status: 401 });

  const [unread, notifications] = await Promise.all([
    unreadCount(user.id),
    listNotifications(user.id, 15),
  ]);

  return NextResponse.json(
    { unread, notifications },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
