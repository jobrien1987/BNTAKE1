import 'server-only';
import { prisma } from '@/lib/prisma';
import { signedReadUrl, storageDriver } from '@/server/services/storage';

/**
 * Turns a stored media URL into something safe to hand a browser for a single
 * playback. When the asset was uploaded through our own storage service we
 * re-sign it with a short TTL, so a gated URL that leaks out of the network
 * tab stops working quickly. External URLs (a label's CDN, for example) are
 * returned untouched because we have nothing to sign them with.
 */
export async function resolvePlaybackUrl(url: string, expiresInSeconds = 60 * 15) {
  if (!url) return null;

  const asset = await prisma.mediaAsset.findFirst({
    where: { url },
    select: { storageKey: true },
  });

  if (!asset) return url;
  if (storageDriver === 'local') return url;

  try {
    return await signedReadUrl(asset.storageKey, expiresInSeconds);
  } catch (error) {
    console.error('[media] failed to sign playback url', error);
    return url;
  }
}
