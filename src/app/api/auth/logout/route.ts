import { NextResponse } from 'next/server';
import { destroySession } from '@/server/auth/session';
import { appUrl } from '@/lib/env';
import { safeRedirectPath } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Sign out. POST-only so a prefetch or an <img> tag can never end a session.
 */
export async function POST(request: Request) {
  await destroySession();

  const form = await request.formData().catch(() => null);
  const target = safeRedirectPath(form?.get('returnTo')?.toString() ?? null, '/');

  return NextResponse.redirect(new URL(target, appUrl), { status: 303 });
}
