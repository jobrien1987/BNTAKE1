import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/server/auth/session';
import { evaluateAccess } from '@/server/services/entitlements';
import { resolvePlaybackUrl } from '@/server/services/secure-media';
import { absoluteMediaUrl } from '@/server/services/storage';
import { track } from '@/server/services/analytics';

export const dynamic = 'force-dynamic';

/**
 * The only way audio reaches a listener. The player never receives a raw
 * gated file URL — it points at this endpoint, access is decided here on the
 * server, and only then is a short-lived URL issued.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const song = await prisma.song.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      audioUrl: true,
      previewUrl: true,
      accessType: true,
      status: true,
    },
  });

  if (!song) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const user = await getCurrentUser();
  const decision = await evaluateAccess({
    accessType: song.accessType,
    kind: 'SONG',
    refId: song.id,
    userId: user?.id ?? null,
    role: user?.role ?? null,
    published: song.status === 'PUBLISHED',
  });

  // Gated tracks may still offer a preview clip when one has been uploaded.
  const source = decision.allowed ? (song.audioUrl ?? song.previewUrl) : song.previewUrl;

  if (!decision.allowed && !source) {
    return NextResponse.json({ error: decision.reason }, { status: 403 });
  }

  if (!source) {
    return NextResponse.json({ error: 'No audio has been uploaded for this track.' }, { status: 404 });
  }

  if (decision.allowed) {
    await Promise.all([
      prisma.song.update({ where: { id: song.id }, data: { playCount: { increment: 1 } } }),
      track({ name: 'song_play', userId: user?.id ?? null, entityType: 'song', entityId: song.id }),
    ]).catch(() => undefined);
  }

  const playbackUrl = await resolvePlaybackUrl(source);
  if (!playbackUrl) {
    return NextResponse.json({ error: 'Audio unavailable.' }, { status: 404 });
  }

  return NextResponse.redirect(absoluteMediaUrl(playbackUrl), {
    status: 302,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
