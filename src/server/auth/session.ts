import 'server-only';
import { cookies, headers } from 'next/headers';
import crypto from 'node:crypto';
import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import type { Role, User, UserStatus } from '@prisma/client';

export const SESSION_COOKIE = 'bn_session';
export const CART_COOKIE = 'bn_cart';
const SESSION_TTL_DAYS = 30;

export type SessionUser = Pick<
  User,
  'id' | 'email' | 'name' | 'username' | 'role' | 'status' | 'avatarUrl' | 'isCreator'
>;

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export async function createSession(userId: string) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const headerList = await headers();

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: headerList.get('user-agent')?.slice(0, 255) ?? null,
      ip: clientIpFrom(headerList),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });

  return { token, expiresAt };
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function destroyAllSessions(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
}

/**
 * Resolve the signed-in user for the current request. Cached per request so
 * multiple server components don't re-query.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          role: true,
          status: true,
          avatarUrl: true,
          isCreator: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (session.user.status !== ('ACTIVE' satisfies UserStatus)) return null;

  return session.user;
});

export const getCurrentRole = cache(async (): Promise<Role | null> => {
  const user = await getCurrentUser();
  return user?.role ?? null;
});

export function clientIpFrom(headerList: Headers) {
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null;
  return headerList.get('x-real-ip');
}

export async function clientIp() {
  return clientIpFrom(await headers());
}

/** Password reset tokens: raw token to the user, hash in the database. */
export function hashResetToken(token: string) {
  return hashToken(token);
}
