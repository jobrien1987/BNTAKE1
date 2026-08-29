import { NextResponse } from 'next/server';
import { assertPermission, AuthorizationError } from '@/server/auth/guards';
import { clientIpFrom } from '@/server/auth/session';
import { rateLimit, RATE_LIMITS } from '@/server/rate-limit';
import { storeMedia, MediaError } from '@/server/services/media';
import type { UploadCategory } from '@/server/services/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CATEGORIES: UploadCategory[] = ['IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT'];

export async function POST(request: Request) {
  let user;
  try {
    user = await assertPermission('media.upload');
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const ip = clientIpFrom(request.headers);
  const limit = await rateLimit(
    `upload:${user.id}:${ip ?? 'anon'}`,
    RATE_LIMITS.upload.limit,
    RATE_LIMITS.upload.windowSeconds,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Upload limit reached. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const rawCategory = String(form?.get('category') ?? 'IMAGE').toUpperCase();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file was uploaded.' }, { status: 400 });
  }
  if (!CATEGORIES.includes(rawCategory as UploadCategory)) {
    return NextResponse.json({ error: 'Unsupported upload category.' }, { status: 400 });
  }

  try {
    const asset = await storeMedia({
      category: rawCategory as UploadCategory,
      file,
      uploadedById: user.id,
      altText: form?.get('altText')?.toString() ?? undefined,
    });

    return NextResponse.json({
      id: asset.id,
      url: asset.url,
      kind: asset.kind,
      fileName: asset.fileName,
      sizeBytes: asset.sizeBytes,
    });
  } catch (error) {
    if (error instanceof MediaError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[upload] failed', error);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
