import 'server-only';
import { prisma } from '@/lib/prisma';
import type { AccessType, EntitlementKind, Prisma } from '@prisma/client';

/**
 * Digital entitlements. Every premium media endpoint asks this service —
 * hiding a play button is not access control.
 */

export interface AccessDecision {
  allowed: boolean;
  reason: 'FREE' | 'OWNED' | 'MEMBERSHIP' | 'STAFF' | 'PURCHASE_REQUIRED' | 'MEMBERSHIP_REQUIRED' | 'UNAVAILABLE';
}

export async function hasEntitlement(userId: string, kind: EntitlementKind, refId: string) {
  const record = await prisma.entitlement.findUnique({
    where: { userId_kind_refId: { userId, kind, refId } },
    select: { revokedAt: true, expiresAt: true },
  });
  if (!record) return false;
  if (record.revokedAt) return false;
  if (record.expiresAt && record.expiresAt.getTime() < Date.now()) return false;
  return true;
}

export async function grantEntitlement(params: {
  userId: string;
  kind: EntitlementKind;
  refId: string;
  orderId?: string | null;
  source?: 'PURCHASE' | 'SUBSCRIPTION' | 'GRANT';
  expiresAt?: Date | null;
  tx?: Prisma.TransactionClient;
}) {
  const client = params.tx ?? prisma;
  return client.entitlement.upsert({
    where: { userId_kind_refId: { userId: params.userId, kind: params.kind, refId: params.refId } },
    create: {
      userId: params.userId,
      kind: params.kind,
      refId: params.refId,
      orderId: params.orderId ?? null,
      source: params.source ?? 'PURCHASE',
      expiresAt: params.expiresAt ?? null,
    },
    update: {
      revokedAt: null,
      expiresAt: params.expiresAt ?? null,
      orderId: params.orderId ?? undefined,
    },
  });
}

/**
 * Buying an album grants the album plus every track on it, so the customer's
 * library and the audio player both work without special-casing.
 */
export async function grantEntitlementsForOrderItems(
  userId: string,
  orderId: string,
  items: Array<{ kind: string; refId: string | null }>,
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma;

  for (const item of items) {
    if (!item.refId) continue;
    switch (item.kind) {
      case 'SONG':
        await grantEntitlement({ userId, kind: 'SONG', refId: item.refId, orderId, tx: client });
        break;
      case 'ALBUM': {
        await grantEntitlement({ userId, kind: 'ALBUM', refId: item.refId, orderId, tx: client });
        const tracks = await client.song.findMany({
          where: { albumId: item.refId },
          select: { id: true },
        });
        for (const track of tracks) {
          await grantEntitlement({ userId, kind: 'SONG', refId: track.id, orderId, tx: client });
        }
        break;
      }
      case 'VIDEO':
        await grantEntitlement({ userId, kind: 'VIDEO', refId: item.refId, orderId, tx: client });
        break;
      case 'DIGITAL_PRODUCT':
        await grantEntitlement({
          userId,
          kind: 'DIGITAL_PRODUCT',
          refId: item.refId,
          orderId,
          tx: client,
        });
        break;
      default:
        break;
    }
  }
}

export async function hasActiveMembership(userId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['ACTIVE', 'TRIALING'] },
      plan: { kind: 'FAN' },
    },
    include: { plan: true },
  });
  if (!subscription) return null;
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd.getTime() < Date.now()) {
    return null;
  }
  return subscription;
}

export interface AccessInput {
  accessType: AccessType;
  kind: EntitlementKind;
  refId: string;
  userId?: string | null;
  role?: string | null;
  published: boolean;
}

/** Single decision point used by pages *and* by the media streaming route. */
export async function evaluateAccess(input: AccessInput): Promise<AccessDecision> {
  const staff = input.role === 'ADMIN' || input.role === 'OWNER' || input.role === 'EDITOR';

  if (!input.published && !staff) return { allowed: false, reason: 'UNAVAILABLE' };
  if (input.accessType === 'FREE') return { allowed: true, reason: 'FREE' };
  if (staff) return { allowed: true, reason: 'STAFF' };
  if (!input.userId) {
    return {
      allowed: false,
      reason: input.accessType === 'MEMBERSHIP' ? 'MEMBERSHIP_REQUIRED' : 'PURCHASE_REQUIRED',
    };
  }

  if (await hasEntitlement(input.userId, input.kind, input.refId)) {
    return { allowed: true, reason: 'OWNED' };
  }

  if (input.accessType === 'MEMBERSHIP') {
    const membership = await hasActiveMembership(input.userId);
    if (membership?.plan.memberContentAccess) return { allowed: true, reason: 'MEMBERSHIP' };
    return { allowed: false, reason: 'MEMBERSHIP_REQUIRED' };
  }

  // PURCHASE content is also unlocked for members whose plan includes the
  // member library, when an admin has configured it that way.
  const membership = await hasActiveMembership(input.userId);
  if (membership?.plan.memberContentAccess && membership.plan.key === 'INSIDER') {
    return { allowed: true, reason: 'MEMBERSHIP' };
  }

  return { allowed: false, reason: 'PURCHASE_REQUIRED' };
}

export async function getLibrary(userId: string) {
  const entitlements = await prisma.entitlement.findMany({
    where: { userId, revokedAt: null },
    orderBy: { grantedAt: 'desc' },
  });

  const idsFor = (kind: EntitlementKind) =>
    entitlements.filter((e) => e.kind === kind).map((e) => e.refId);

  const [songs, albums, videos] = await Promise.all([
    prisma.song.findMany({
      where: { id: { in: idsFor('SONG') } },
      include: { artist: { select: { stageName: true, slug: true } }, album: { select: { title: true, slug: true } } },
    }),
    prisma.album.findMany({
      where: { id: { in: idsFor('ALBUM') } },
      include: { artist: { select: { stageName: true, slug: true } }, _count: { select: { songs: true } } },
    }),
    prisma.video.findMany({ where: { id: { in: idsFor('VIDEO') } } }),
  ]);

  const digitalIds = idsFor('DIGITAL_PRODUCT');
  const digitalProducts = digitalIds.length
    ? await prisma.product.findMany({
        where: { id: { in: digitalIds } },
        include: { images: { take: 1, orderBy: { position: 'asc' } } },
      })
    : [];

  return {
    songs,
    albums,
    videos: videos.filter((v) => v.kind === 'MOVIE' || v.kind === 'DOCUMENTARY'),
    otherVideos: videos.filter((v) => v.kind !== 'MOVIE' && v.kind !== 'DOCUMENTARY'),
    digitalProducts,
    total: entitlements.length,
  };
}
