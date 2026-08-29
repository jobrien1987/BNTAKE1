import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The access decision is the security boundary for all premium media, so it is
 * tested directly against a stubbed database rather than through the UI.
 */

const prismaMock = {
  entitlement: { findUnique: vi.fn() },
  subscription: { findFirst: vi.fn() },
};

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const { evaluateAccess, hasEntitlement } = await import('@/server/services/entitlements');

function membership(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_1',
    userId: 'user_1',
    status: 'ACTIVE',
    currentPeriodEnd: new Date(Date.now() + 86_400_000),
    plan: { key: 'FAMILY', memberContentAccess: true },
    ...overrides,
  };
}

beforeEach(() => {
  prismaMock.entitlement.findUnique.mockReset().mockResolvedValue(null);
  prismaMock.subscription.findFirst.mockReset().mockResolvedValue(null);
});

describe('hasEntitlement', () => {
  it('is false when no record exists', async () => {
    expect(await hasEntitlement('user_1', 'SONG', 'song_1')).toBe(false);
  });

  it('is true for a live entitlement', async () => {
    prismaMock.entitlement.findUnique.mockResolvedValue({ revokedAt: null, expiresAt: null });
    expect(await hasEntitlement('user_1', 'SONG', 'song_1')).toBe(true);
  });

  it('is false once revoked', async () => {
    prismaMock.entitlement.findUnique.mockResolvedValue({
      revokedAt: new Date(),
      expiresAt: null,
    });
    expect(await hasEntitlement('user_1', 'SONG', 'song_1')).toBe(false);
  });

  it('is false once expired', async () => {
    prismaMock.entitlement.findUnique.mockResolvedValue({
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await hasEntitlement('user_1', 'SONG', 'song_1')).toBe(false);
  });
});

describe('evaluateAccess — unpublished content', () => {
  it('hides unpublished content from ordinary users', async () => {
    const decision = await evaluateAccess({
      accessType: 'FREE',
      kind: 'SONG',
      refId: 'song_1',
      userId: 'user_1',
      role: 'USER',
      published: false,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('UNAVAILABLE');
  });

  it('lets staff preview unpublished content', async () => {
    const decision = await evaluateAccess({
      accessType: 'MEMBERSHIP',
      kind: 'SONG',
      refId: 'song_1',
      userId: 'admin_1',
      role: 'ADMIN',
      published: false,
    });
    expect(decision.allowed).toBe(true);
  });
});

describe('evaluateAccess — free content', () => {
  it('is open to anonymous visitors', async () => {
    const decision = await evaluateAccess({
      accessType: 'FREE',
      kind: 'SONG',
      refId: 'song_1',
      userId: null,
      role: null,
      published: true,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('FREE');
  });
});

describe('evaluateAccess — membership content', () => {
  it('refuses anonymous visitors', async () => {
    const decision = await evaluateAccess({
      accessType: 'MEMBERSHIP',
      kind: 'VIDEO',
      refId: 'video_1',
      userId: null,
      role: null,
      published: true,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('MEMBERSHIP_REQUIRED');
  });

  it('refuses a signed-in user with no membership', async () => {
    const decision = await evaluateAccess({
      accessType: 'MEMBERSHIP',
      kind: 'VIDEO',
      refId: 'video_1',
      userId: 'user_1',
      role: 'USER',
      published: true,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('MEMBERSHIP_REQUIRED');
  });

  it('allows a member whose plan includes the library', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(membership());
    const decision = await evaluateAccess({
      accessType: 'MEMBERSHIP',
      kind: 'VIDEO',
      refId: 'video_1',
      userId: 'user_1',
      role: 'USER',
      published: true,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('MEMBERSHIP');
  });

  it('refuses a member whose plan does not include the library', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(
      membership({ plan: { key: 'FREE', memberContentAccess: false } }),
    );
    const decision = await evaluateAccess({
      accessType: 'MEMBERSHIP',
      kind: 'VIDEO',
      refId: 'video_1',
      userId: 'user_1',
      role: 'USER',
      published: true,
    });
    expect(decision.allowed).toBe(false);
  });

  it('refuses a membership whose period has already ended', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(
      membership({ currentPeriodEnd: new Date(Date.now() - 86_400_000) }),
    );
    const decision = await evaluateAccess({
      accessType: 'MEMBERSHIP',
      kind: 'VIDEO',
      refId: 'video_1',
      userId: 'user_1',
      role: 'USER',
      published: true,
    });
    expect(decision.allowed).toBe(false);
  });
});

describe('evaluateAccess — purchased content', () => {
  it('refuses a user who has not bought it', async () => {
    const decision = await evaluateAccess({
      accessType: 'PURCHASE',
      kind: 'ALBUM',
      refId: 'album_1',
      userId: 'user_1',
      role: 'USER',
      published: true,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('PURCHASE_REQUIRED');
  });

  it('allows a user who owns it', async () => {
    prismaMock.entitlement.findUnique.mockResolvedValue({ revokedAt: null, expiresAt: null });
    const decision = await evaluateAccess({
      accessType: 'PURCHASE',
      kind: 'ALBUM',
      refId: 'album_1',
      userId: 'user_1',
      role: 'USER',
      published: true,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('OWNED');
  });

  // Ownership must not depend on a subscription staying active.
  it('keeps access to owned content when the membership has lapsed', async () => {
    prismaMock.entitlement.findUnique.mockResolvedValue({ revokedAt: null, expiresAt: null });
    prismaMock.subscription.findFirst.mockResolvedValue(null);
    const decision = await evaluateAccess({
      accessType: 'PURCHASE',
      kind: 'ALBUM',
      refId: 'album_1',
      userId: 'user_1',
      role: 'USER',
      published: true,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe('OWNED');
  });

  it('lets the top tier reach purchase-gated content when configured to', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(
      membership({ plan: { key: 'INSIDER', memberContentAccess: true } }),
    );
    const decision = await evaluateAccess({
      accessType: 'PURCHASE',
      kind: 'VIDEO',
      refId: 'video_1',
      userId: 'user_1',
      role: 'USER',
      published: true,
    });
    expect(decision.allowed).toBe(true);
  });

  it('does not extend that to a mid tier', async () => {
    prismaMock.subscription.findFirst.mockResolvedValue(
      membership({ plan: { key: 'FAMILY', memberContentAccess: true } }),
    );
    const decision = await evaluateAccess({
      accessType: 'PURCHASE',
      kind: 'VIDEO',
      refId: 'video_1',
      userId: 'user_1',
      role: 'USER',
      published: true,
    });
    expect(decision.allowed).toBe(false);
  });
});
