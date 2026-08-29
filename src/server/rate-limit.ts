import 'server-only';
import { prisma } from '@/lib/prisma';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Database-backed fixed-window rate limiter. Works across multiple instances
 * (unlike in-memory counters) without adding a Redis dependency for V1.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const since = new Date(Date.now() - windowSeconds * 1000);

  const count = await prisma.rateLimitHit.count({ where: { key, createdAt: { gte: since } } });

  if (count >= limit) {
    const oldest = await prisma.rateLimitHit.findFirst({
      where: { key, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    const resetAt = (oldest?.createdAt.getTime() ?? Date.now()) + windowSeconds * 1000;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
    };
  }

  await prisma.rateLimitHit.create({ data: { key } });

  // Opportunistic cleanup keeps the table small without a cron job.
  if (Math.random() < 0.02) {
    await prisma.rateLimitHit
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
      .catch(() => undefined);
  }

  return { allowed: true, remaining: limit - count - 1, retryAfterSeconds: 0 };
}

export const RATE_LIMITS = {
  login: { limit: 8, windowSeconds: 15 * 60 },
  register: { limit: 5, windowSeconds: 60 * 60 },
  passwordReset: { limit: 5, windowSeconds: 60 * 60 },
  checkout: { limit: 20, windowSeconds: 10 * 60 },
  post: { limit: 15, windowSeconds: 10 * 60 },
  comment: { limit: 40, windowSeconds: 10 * 60 },
  upload: { limit: 60, windowSeconds: 60 * 60 },
  search: { limit: 120, windowSeconds: 5 * 60 },
} as const;
