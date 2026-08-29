import 'server-only';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

/**
 * First-party event foundation. Deliberately small: names, a loose entity
 * reference and non-sensitive metadata only. No IPs, no fingerprints.
 */

export const EVENT_NAMES = [
  'content_view',
  'article_view',
  'song_play',
  'album_view',
  'movie_view',
  'video_view',
  'artist_view',
  'product_view',
  'add_to_cart',
  'checkout_started',
  'purchase',
  'follow',
  'subscription_started',
  'search',
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

export interface TrackInput {
  name: EventName;
  userId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  path?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/** Analytics must never take down a page render. */
export async function track(input: TrackInput) {
  try {
    await prisma.analyticsEvent.create({
      data: {
        name: input.name,
        userId: input.userId ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        path: input.path ?? null,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    console.error('[analytics] failed to record event', error);
  }
}

export async function countEventsSince(name: EventName, since: Date) {
  return prisma.analyticsEvent.count({ where: { name, createdAt: { gte: since } } });
}

export async function topEntities(name: EventName, entityType: string, since: Date, take = 5) {
  const grouped = await prisma.analyticsEvent.groupBy({
    by: ['entityId'],
    where: { name, entityType, createdAt: { gte: since }, entityId: { not: null } },
    _count: { entityId: true },
    orderBy: { _count: { entityId: 'desc' } },
    take,
  });
  return grouped.map((row) => ({ entityId: row.entityId as string, count: row._count.entityId }));
}
