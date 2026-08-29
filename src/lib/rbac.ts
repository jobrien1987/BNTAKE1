import type { Role } from '@prisma/client';

/**
 * Real role-based access control. Authorization is enforced in server actions,
 * route handlers and page loaders — never by hiding a button.
 */

export const ROLE_RANK: Record<Role, number> = {
  USER: 10,
  ARTIST: 20,
  ARTIST_PRO: 25,
  EDITOR: 40,
  MODERATOR: 45,
  ADMIN: 80,
  OWNER: 100,
};

export const PERMISSIONS = [
  'admin.access',
  'culture.read',
  'culture.write',
  'culture.publish',
  'culture.delete',
  'music.write',
  'watch.write',
  'shop.write',
  'orders.read',
  'orders.write',
  'users.read',
  'users.write',
  'roles.write',
  'community.moderate',
  'heartfelt.write',
  'homepage.write',
  'creators.manage',
  'memberships.manage',
  'settings.write',
  'audit.read',
  'media.upload',
  'creator.dashboard',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const EDITOR_PERMISSIONS: Permission[] = [
  'admin.access',
  'culture.read',
  'culture.write',
  'culture.publish',
  'media.upload',
  'homepage.write',
];

const MODERATOR_PERMISSIONS: Permission[] = [
  'admin.access',
  'culture.read',
  'community.moderate',
  'users.read',
  'media.upload',
];

const ADMIN_PERMISSIONS: Permission[] = [
  'admin.access',
  'culture.read',
  'culture.write',
  'culture.publish',
  'culture.delete',
  'music.write',
  'watch.write',
  'shop.write',
  'orders.read',
  'orders.write',
  'users.read',
  'users.write',
  'community.moderate',
  'heartfelt.write',
  'homepage.write',
  'creators.manage',
  'audit.read',
  'media.upload',
];

const CREATOR_PERMISSIONS: Permission[] = ['creator.dashboard', 'media.upload'];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  USER: [],
  ARTIST: CREATOR_PERMISSIONS,
  ARTIST_PRO: CREATOR_PERMISSIONS,
  EDITOR: EDITOR_PERMISSIONS,
  MODERATOR: MODERATOR_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
  // OWNER holds every permission, including financial/business configuration.
  OWNER: [...PERMISSIONS],
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canAny(role: Role | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

export function isAtLeast(role: Role | null | undefined, minimum: Role) {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function isStaff(role: Role | null | undefined) {
  return can(role, 'admin.access');
}

export function isCreatorRole(role: Role | null | undefined) {
  return role === 'ARTIST' || role === 'ARTIST_PRO';
}

/** Roles an actor is allowed to assign. Only OWNER may mint ADMIN/OWNER. */
export function assignableRoles(actorRole: Role): Role[] {
  if (actorRole === 'OWNER') {
    return ['USER', 'ARTIST', 'ARTIST_PRO', 'EDITOR', 'MODERATOR', 'ADMIN', 'OWNER'];
  }
  if (actorRole === 'ADMIN') {
    return ['USER', 'ARTIST', 'ARTIST_PRO', 'EDITOR', 'MODERATOR'];
  }
  return [];
}
