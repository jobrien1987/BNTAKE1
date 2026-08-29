import { NextResponse } from 'next/server';
import { globalSearch } from '@/server/services/search';
import { rateLimit, RATE_LIMITS } from '@/server/rate-limit';
import { clientIpFrom } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ip = clientIpFrom(request.headers);
  const limit = await rateLimit(
    `search:${ip ?? 'anon'}`,
    RATE_LIMITS.search.limit,
    RATE_LIMITS.search.windowSeconds,
  );

  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many searches. Slow down for a moment.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const query = new URL(request.url).searchParams.get('q') ?? '';
  const results = await globalSearch(query, 5);

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
