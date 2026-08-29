'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { assertPermission } from '@/server/auth/guards';
import { slugify } from '@/lib/slug';
import { sanitizeRichText, estimateReadMinutes, toPlainText } from '@/server/services/sanitize';
import { recordAudit } from '@/server/audit';
import { actionError, fromZod, type ActionState } from '@/lib/action-state';

/** Ensures a slug is unique, suffixing on collision with anything but `selfId`. */
async function uniqueArticleSlug(base: string, selfId?: string) {
  const root = slugify(base) || 'story';
  const existing = await prisma.article.findUnique({
    where: { slug: root },
    select: { id: true },
  });
  if (!existing || existing.id === selfId) return root;
  return `${root}-${Math.random().toString(36).slice(2, 7)}`;
}

const articleSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3, 'Enter a headline.').max(200),
  slug: z.string().trim().max(200).optional(),
  dek: z.string().trim().max(300).optional(),
  excerpt: z.string().trim().max(400).optional(),
  body: z.string().min(1, 'Write the story.'),
  heroImageUrl: z.string().url('Enter a valid image URL.').optional().or(z.literal('')),
  thumbnailUrl: z.string().url('Enter a valid image URL.').optional().or(z.literal('')),
  seoTitle: z.string().trim().max(200).optional(),
  seoDescription: z.string().trim().max(300).optional(),
  categoryId: z.string().optional(),
  authorId: z.string().optional(),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']),
  publishedAt: z.string().optional(),
  featured: z.coerce.boolean().optional().default(false),
  breaking: z.coerce.boolean().optional().default(false),
});

export async function saveArticleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertPermission('culture.write');

  const parsed = articleSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Please check the highlighted fields.', fromZod(parsed.error.flatten()));
  }

  // Publishing is a separate permission from writing.
  if (parsed.data.status === 'PUBLISHED') {
    try {
      await assertPermission('culture.publish');
    } catch {
      return actionError('You do not have permission to publish articles.');
    }
  }

  // Author-supplied HTML is sanitized before it is ever stored, so a
  // compromised editor account cannot persist a script tag.
  const body = sanitizeRichText(parsed.data.body);

  const publishedAt =
    parsed.data.status === 'PUBLISHED'
      ? parsed.data.publishedAt
        ? new Date(parsed.data.publishedAt)
        : new Date()
      : parsed.data.publishedAt
        ? new Date(parsed.data.publishedAt)
        : null;

  if (publishedAt && Number.isNaN(publishedAt.getTime())) {
    return actionError('Enter a valid publish date.', { publishedAt: ['Invalid date.'] });
  }

  const data = {
    title: parsed.data.title,
    dek: parsed.data.dek || null,
    excerpt: parsed.data.excerpt || toPlainText(body, 240) || null,
    body,
    heroImageUrl: parsed.data.heroImageUrl || null,
    thumbnailUrl: parsed.data.thumbnailUrl || null,
    seoTitle: parsed.data.seoTitle || null,
    seoDescription: parsed.data.seoDescription || null,
    categoryId: parsed.data.categoryId || null,
    authorId: parsed.data.authorId || null,
    editorId: user.id,
    status: parsed.data.status,
    publishedAt,
    featured: parsed.data.featured,
    breaking: parsed.data.breaking,
    readMinutes: estimateReadMinutes(body),
  };

  const slug = await uniqueArticleSlug(parsed.data.slug || parsed.data.title, parsed.data.id);

  const article = parsed.data.id
    ? await prisma.article.update({ where: { id: parsed.data.id }, data: { ...data, slug } })
    : await prisma.article.create({ data: { ...data, slug } });

  await recordAudit({
    actorId: user.id,
    action: parsed.data.id ? 'article.update' : 'article.create',
    entityType: 'Article',
    entityId: article.id,
    metadata: { status: article.status, slug: article.slug },
  });

  revalidatePath('/culture');
  revalidatePath(`/culture/${article.slug}`);
  revalidatePath('/admin/culture');
  revalidatePath('/');

  return { success: `Saved “${article.title}”.` };
}

export async function deleteArticleAction(formData: FormData) {
  const user = await assertPermission('culture.delete');
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const article = await prisma.article.findUnique({
    where: { id },
    select: { slug: true, title: true },
  });
  if (!article) return;

  await prisma.article.delete({ where: { id } });

  await recordAudit({
    actorId: user.id,
    action: 'article.delete',
    entityType: 'Article',
    entityId: id,
    metadata: { title: article.title },
  });

  revalidatePath('/culture');
  revalidatePath('/admin/culture');
}

/** Flips the published state of any catalogue entity from a list view. */
const statusSchema = z.object({
  entity: z.enum(['song', 'album', 'artist', 'video', 'playlist']),
  id: z.string().min(1),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']),
});

export async function setContentStatusAction(formData: FormData) {
  const parsed = statusSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;

  const permission = parsed.data.entity === 'video' ? 'watch.write' : 'music.write';
  const user = await assertPermission(permission);

  const { entity, id, status } = parsed.data;

  switch (entity) {
    case 'song':
      await prisma.song.update({ where: { id }, data: { status } });
      break;
    case 'album':
      await prisma.album.update({ where: { id }, data: { status } });
      break;
    case 'artist':
      await prisma.artist.update({ where: { id }, data: { status } });
      break;
    case 'video':
      await prisma.video.update({ where: { id }, data: { status } });
      break;
    case 'playlist':
      await prisma.playlist.update({ where: { id }, data: { status } });
      break;
  }

  await recordAudit({
    actorId: user.id,
    action: `${entity}.status`,
    entityType: entity,
    entityId: id,
    metadata: { status },
  });

  revalidatePath(`/admin/${entity === 'video' ? 'watch' : 'music'}`);
  revalidatePath('/');
}

const toggleSchema = z.object({
  entity: z.enum(['song', 'album', 'artist', 'video', 'product', 'campaign']),
  id: z.string().min(1),
  field: z.enum(['featured', 'verified', 'active']),
  value: z.enum(['true', 'false']),
});

export async function toggleContentFlagAction(formData: FormData) {
  const parsed = toggleSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;

  const permissionByEntity = {
    song: 'music.write',
    album: 'music.write',
    artist: 'music.write',
    video: 'watch.write',
    product: 'shop.write',
    campaign: 'heartfelt.write',
  } as const;

  const user = await assertPermission(permissionByEntity[parsed.data.entity]);

  const value = parsed.data.value === 'true';
  const data = { [parsed.data.field]: value };
  const { entity, id } = parsed.data;

  switch (entity) {
    case 'song':
      await prisma.song.update({ where: { id }, data });
      break;
    case 'album':
      await prisma.album.update({ where: { id }, data });
      break;
    case 'artist':
      await prisma.artist.update({ where: { id }, data });
      break;
    case 'video':
      await prisma.video.update({ where: { id }, data });
      break;
    case 'product':
      await prisma.product.update({ where: { id }, data });
      break;
    case 'campaign':
      await prisma.campaign.update({ where: { id }, data });
      break;
  }

  await recordAudit({
    actorId: user.id,
    action: `${entity}.flag`,
    entityType: entity,
    entityId: id,
    metadata: { field: parsed.data.field, value },
  });

  revalidatePath('/admin');
  revalidatePath('/');
}
