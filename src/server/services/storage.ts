import 'server-only';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand, S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env, flags, appUrl } from '@/lib/env';

/**
 * S3-compatible storage abstraction (Amazon S3, Cloudflare R2, Backblaze B2,
 * MinIO ...). If no bucket credentials are configured we fall back to writing
 * into ./public/uploads so local development is genuinely functional rather
 * than a dead upload button.
 */

export interface StoredObject {
  key: string;
  url: string;
}

export interface UploadInput {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  prefix?: string;
}

export type StorageDriver = 's3' | 'local';

export const storageDriver: StorageDriver = flags.storageRemote ? 's3' : 'local';

let cachedClient: S3Client | null = null;

function s3Client(): S3Client {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    region: env.S3_REGION || 'auto',
    endpoint: env.S3_ENDPOINT || undefined,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID as string,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
    },
  });
  return cachedClient;
}

export function buildObjectKey(fileName: string, prefix = 'uploads') {
  const ext = path.extname(fileName).toLowerCase().slice(0, 10);
  const base = path
    .basename(fileName, path.extname(fileName))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const stamp = new Date().toISOString().slice(0, 10);
  const random = crypto.randomBytes(6).toString('hex');
  return `${prefix}/${stamp}/${base || 'file'}-${random}${ext}`;
}

export function publicUrlFor(key: string) {
  if (storageDriver === 'local') return `/${key.replace(/^\/+/, '')}`;
  const base = env.S3_PUBLIC_BASE_URL?.replace(/\/+$/, '');
  if (base) return `${base}/${key}`;
  if (env.S3_ENDPOINT && env.S3_BUCKET) {
    return `${env.S3_ENDPOINT.replace(/\/+$/, '')}/${env.S3_BUCKET}/${key}`;
  }
  return `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`;
}

export async function uploadObject({ buffer, fileName, contentType, prefix }: UploadInput): Promise<StoredObject> {
  if (storageDriver === 'local') {
    const key = buildObjectKey(fileName, `uploads/${prefix ?? 'media'}`);
    const target = path.join(process.cwd(), 'public', key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
    return { key, url: `/${key}` };
  }

  const key = buildObjectKey(fileName, prefix ?? 'media');
  await s3Client().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  return { key, url: publicUrlFor(key) };
}

export async function deleteObject(key: string) {
  if (storageDriver === 'local') {
    const target = path.join(process.cwd(), 'public', key.replace(/^\/+/, ''));
    await fs.rm(target, { force: true });
    return;
  }
  await s3Client().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

/**
 * Time-limited URL for premium media. Local development returns the plain
 * path because there is nothing to sign — production always signs.
 */
export async function signedReadUrl(key: string, expiresInSeconds = 60 * 60) {
  if (storageDriver === 'local') return `/${key.replace(/^\/+/, '')}`;
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  return getSignedUrl(
    s3Client(),
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

export function absoluteMediaUrl(url: string) {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${appUrl.replace(/\/+$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
}

export const UPLOAD_RULES = {
  IMAGE: {
    maxBytes: 8 * 1024 * 1024,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'],
    extensions: ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'],
  },
  AUDIO: {
    maxBytes: 60 * 1024 * 1024,
    mimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/aac', 'audio/mp4', 'audio/ogg'],
    extensions: ['.mp3', '.wav', '.aac', '.m4a', '.ogg'],
  },
  VIDEO: {
    maxBytes: 512 * 1024 * 1024,
    mimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
    extensions: ['.mp4', '.mov', '.webm'],
  },
  DOCUMENT: {
    maxBytes: 25 * 1024 * 1024,
    mimeTypes: ['application/pdf', 'application/zip'],
    extensions: ['.pdf', '.zip'],
  },
} as const;

export type UploadCategory = keyof typeof UPLOAD_RULES;

export function validateUpload(category: UploadCategory, file: { name: string; type: string; size: number }) {
  const rules = UPLOAD_RULES[category];
  const ext = path.extname(file.name).toLowerCase();
  if (file.size <= 0) return 'File is empty.';
  if (file.size > rules.maxBytes) {
    return `File is larger than ${Math.round(rules.maxBytes / (1024 * 1024))}MB.`;
  }
  if (!(rules.mimeTypes as readonly string[]).includes(file.type)) {
    return `Unsupported file type: ${file.type || 'unknown'}.`;
  }
  if (!(rules.extensions as readonly string[]).includes(ext)) {
    return `Unsupported file extension: ${ext || 'none'}.`;
  }
  return null;
}
