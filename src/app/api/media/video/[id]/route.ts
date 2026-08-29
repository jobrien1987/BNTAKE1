import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/server/auth/session';
import { evaluateAccess } from '@/server/services/entitlements';
import { resolvePlaybackUrl } from '@/server/services/secure-media';

export const dynamic = 'force-dynamic';

/**
 * Returns a short-lived playback descriptor for a video. The player fetches
 * this rather than embedding the source in the page, so the entitlement check
 * happens per playback rather than per render.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const video = await prisma.video.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      mediaUrl: true,
      trailerUrl: true,
      mediaProvider: true,
      accessType: true,
      status: true,
    },
  });

  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const user = await getCurrentUser();
  const decision = await evaluateAccess({
    accessType: video.accessType,
    kind: 'VIDEO',
    refId: video.id,
    userId: user?.id ?? null,
    role: user?.role ?? null,
    published: video.status === 'PUBLISHED',
  });

  if (!decision.allowed) {
    return NextResponse.json(
      { allowed: false, reason: decision.reason, trailerUrl: video.trailerUrl ?? null },
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  if (!video.mediaUrl) {
    return NextResponse.json(
      { allowed: true, reason: decision.reason, playbackUrl: null, error: 'No video file has been attached yet.' },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const playbackUrl = await resolvePlaybackUrl(video.mediaUrl);

  await prisma.video
    .update({ where: { id: video.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);

  return NextResponse.json(
    { allowed: true, reason: decision.reason, provider: video.mediaProvider ?? 'file', playbackUrl },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
