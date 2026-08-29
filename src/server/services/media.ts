import 'server-only';
import { prisma } from '@/lib/prisma';
import { uploadObject, validateUpload, type UploadCategory } from './storage';
import type { MediaKind } from '@prisma/client';

const KIND_BY_CATEGORY: Record<UploadCategory, MediaKind> = {
  IMAGE: 'IMAGE',
  AUDIO: 'AUDIO',
  VIDEO: 'VIDEO',
  DOCUMENT: 'DOCUMENT',
};

export interface StoreMediaInput {
  file: File;
  category: UploadCategory;
  uploadedById: string;
  prefix?: string;
  altText?: string;
}

export class MediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaError';
  }
}

/** Validates, uploads and records a media asset in one place. */
export async function storeMedia(input: StoreMediaInput) {
  const problem = validateUpload(input.category, {
    name: input.file.name,
    type: input.file.type,
    size: input.file.size,
  });
  if (problem) throw new MediaError(problem);

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const stored = await uploadObject({
    buffer,
    fileName: input.file.name,
    contentType: input.file.type,
    prefix: input.prefix ?? input.category.toLowerCase(),
  });

  return prisma.mediaAsset.create({
    data: {
      kind: KIND_BY_CATEGORY[input.category],
      storageKey: stored.key,
      url: stored.url,
      fileName: input.file.name,
      mimeType: input.file.type,
      sizeBytes: input.file.size,
      altText: input.altText ?? null,
      uploadedById: input.uploadedById,
    },
  });
}

export async function listMedia(kind?: MediaKind, take = 60) {
  return prisma.mediaAsset.findMany({
    where: kind ? { kind } : undefined,
    orderBy: { createdAt: 'desc' },
    take,
  });
}
