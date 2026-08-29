import { describe, it, expect } from 'vitest';
import {
  can,
  canAny,
  isAtLeast,
  isStaff,
  isCreatorRole,
  assignableRoles,
  ROLE_PERMISSIONS,
  PERMISSIONS,
} from '@/lib/rbac';

describe('permission checks', () => {
  it('grants OWNER every permission', () => {
    for (const permission of PERMISSIONS) {
      expect(can('OWNER', permission)).toBe(true);
    }
  });

  it('gives a plain USER no admin permissions', () => {
    expect(ROLE_PERMISSIONS.USER).toHaveLength(0);
    expect(can('USER', 'admin.access')).toBe(false);
    expect(can('USER', 'users.write')).toBe(false);
  });

  it('treats a missing role as unauthorized rather than defaulting open', () => {
    expect(can(null, 'admin.access')).toBe(false);
    expect(can(undefined, 'culture.read')).toBe(false);
    expect(isStaff(null)).toBe(false);
  });

  it('does not let a MODERATOR touch commerce or roles', () => {
    expect(can('MODERATOR', 'community.moderate')).toBe(true);
    expect(can('MODERATOR', 'shop.write')).toBe(false);
    expect(can('MODERATOR', 'roles.write')).toBe(false);
    expect(can('MODERATOR', 'settings.write')).toBe(false);
  });

  it('does not let an EDITOR change roles or settings', () => {
    expect(can('EDITOR', 'culture.write')).toBe(true);
    expect(can('EDITOR', 'roles.write')).toBe(false);
    expect(can('EDITOR', 'settings.write')).toBe(false);
  });

  it('canAny requires only one matching permission', () => {
    expect(canAny('EDITOR', ['roles.write', 'culture.write'])).toBe(true);
    expect(canAny('USER', ['roles.write', 'culture.write'])).toBe(false);
  });
});

describe('role ranking', () => {
  it('orders staff above members', () => {
    expect(isAtLeast('ADMIN', 'EDITOR')).toBe(true);
    expect(isAtLeast('EDITOR', 'ADMIN')).toBe(false);
    expect(isAtLeast('OWNER', 'OWNER')).toBe(true);
  });

  it('identifies creator roles', () => {
    expect(isCreatorRole('ARTIST')).toBe(true);
    expect(isCreatorRole('ARTIST_PRO')).toBe(true);
    expect(isCreatorRole('USER')).toBe(false);
  });
});

describe('assignableRoles', () => {
  it('lets OWNER assign anything including OWNER', () => {
    expect(assignableRoles('OWNER')).toContain('OWNER');
    expect(assignableRoles('OWNER')).toContain('ADMIN');
  });

  // This is the privilege-escalation guard: an ADMIN must never be able to
  // mint another ADMIN or an OWNER.
  it('prevents ADMIN from assigning ADMIN or OWNER', () => {
    const allowed = assignableRoles('ADMIN');
    expect(allowed).not.toContain('OWNER');
    expect(allowed).not.toContain('ADMIN');
    expect(allowed).toContain('EDITOR');
  });

  it('gives non-staff roles nothing to assign', () => {
    expect(assignableRoles('EDITOR')).toHaveLength(0);
    expect(assignableRoles('MODERATOR')).toHaveLength(0);
    expect(assignableRoles('USER')).toHaveLength(0);
  });
});
