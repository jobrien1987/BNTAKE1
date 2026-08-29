import 'server-only';
import { redirect } from 'next/navigation';
import { getCurrentUser, type SessionUser } from './session';
import { can, isStaff, type Permission } from '@/lib/rbac';

export class AuthorizationError extends Error {
  constructor(message = 'Not authorized') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/** For pages: redirect to login preserving the destination. */
export async function requireUser(returnTo = '/account'): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

export async function requirePermission(permission: Permission, returnTo = '/admin'): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (!can(user.role, permission)) redirect('/account?error=forbidden');
  return user;
}

export async function requireStaff(returnTo = '/admin'): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (!isStaff(user.role)) redirect('/account?error=forbidden');
  return user;
}

export async function requireCreator(returnTo = '/creator'): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (!user.isCreator && !isStaff(user.role)) redirect('/creator/join');
  return user;
}

/** For server actions and route handlers: throw instead of redirecting. */
export async function assertUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError('You must be signed in.');
  return user;
}

export async function assertPermission(permission: Permission): Promise<SessionUser> {
  const user = await assertUser();
  if (!can(user.role, permission)) throw new AuthorizationError('Insufficient permissions.');
  return user;
}
