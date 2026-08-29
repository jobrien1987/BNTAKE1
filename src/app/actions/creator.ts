'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { assertUser } from '@/server/auth/guards';
import { clientIp } from '@/server/auth/session';
import { slugify } from '@/lib/slug';
import { isCreatorRole } from '@/lib/rbac';
import { recordAudit } from '@/server/audit';
import { notify } from '@/server/services/notifications';
import { actionError, fromZod, type ActionState } from '@/lib/action-state';

/**
 * Loads the signed-in user's creator profile, or throws. Every creator action
 * goes through this so ownership is proven server-side on each call rather
 * than trusted from a form field.
 */
async function requireCreatorProfile() {
  const user = await assertUser();

  const profile = await prisma.creatorProfile.findUnique({
    where: { userId: user.id },
    include: { artist: true },
  });

  if (!profile || profile.status !== 'APPROVED') {
    redirect('/creator/join');
  }

  return { user, profile };
}

/** Confirms an artist row belongs to the caller before it can be written to. */
async function assertOwnsArtist(artistId: string) {
  const { user, profile } = await requireCreatorProfile();
  if (!profile.artist || profile.artist.id !== artistId) {
    throw new Error('You do not have access to that artist.');
  }
  return { user, profile, artist: profile.artist };
}

const joinSchema = z.object({
  displayName: z.string().trim().min(2, 'Enter your artist or brand name.').max(80),
  contactEmail: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  tier: z.enum(['ARTIST', 'ARTIST_PRO']),
  agreementId: z.string().min(1, 'The creator agreement could not be loaded.'),
  accept: z.literal('on', {
    errorMap: () => ({ message: 'You must accept the creator agreement.' }),
  }),
});

export async function applyAsCreatorAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertUser();

  const parsed = joinSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Please check the highlighted fields.', fromZod(parsed.error.flatten()));
  }

  const agreement = await prisma.creatorAgreement.findUnique({
    where: { id: parsed.data.agreementId },
    select: { id: true, version: true, active: true },
  });
  if (!agreement || !agreement.active) {
    return actionError('The creator agreement has changed. Reload the page and try again.');
  }

  const existing = await prisma.creatorProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, status: true },
  });
  if (existing && existing.status !== 'REJECTED') {
    return actionError('You have already applied. We will be in touch about your application.');
  }

  const headerList = await headers();
  const ip = await clientIp();

  await prisma.$transaction(async (tx) => {
    const profile = existing
      ? await tx.creatorProfile.update({
          where: { id: existing.id },
          data: {
            displayName: parsed.data.displayName,
            contactEmail: parsed.data.contactEmail,
            tier: parsed.data.tier,
            status: 'PENDING',
          },
        })
      : await tx.creatorProfile.create({
          data: {
            userId: user.id,
            displayName: parsed.data.displayName,
            contactEmail: parsed.data.contactEmail,
            tier: parsed.data.tier,
            status: 'PENDING',
          },
        });

    // The exact agreement version is recorded at acceptance time, so a later
    // edit to the agreement never rewrites what someone actually agreed to.
    await tx.creatorAgreementAcceptance.upsert({
      where: { agreementId_userId: { agreementId: agreement.id, userId: user.id } },
      create: {
        agreementId: agreement.id,
        userId: user.id,
        version: agreement.version,
        ip,
        userAgent: headerList.get('user-agent')?.slice(0, 255) ?? null,
      },
      update: {},
    });

    return profile;
  });

  await recordAudit({
    actorId: user.id,
    action: 'creator.apply',
    entityType: 'CreatorProfile',
    entityId: user.id,
    metadata: { tier: parsed.data.tier, agreementVersion: agreement.version },
  });

  revalidatePath('/creator');
  revalidatePath('/creator/join');

  return {
    success:
      'Application received. We review creator applications by hand — you will hear from us soon.',
  };
}

const artistSchema = z.object({
  stageName: z.string().trim().min(2, 'Enter your artist name.').max(80),
  bio: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(80).optional(),
  profileImageUrl: z.string().url('Enter a valid image URL.').optional().or(z.literal('')),
  heroImageUrl: z.string().url('Enter a valid image URL.').optional().or(z.literal('')),
  websiteUrl: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
  instagramUrl: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
  twitterUrl: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
  youtubeUrl: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
  spotifyUrl: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
});

export async function saveArtistProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, profile } = await requireCreatorProfile();

  const parsed = artistSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Please check the highlighted fields.', fromZod(parsed.error.flatten()));
  }

  const data = {
    stageName: parsed.data.stageName,
    bio: parsed.data.bio || null,
    location: parsed.data.location || null,
    profileImageUrl: parsed.data.profileImageUrl || null,
    heroImageUrl: parsed.data.heroImageUrl || null,
    websiteUrl: parsed.data.websiteUrl || null,
    instagramUrl: parsed.data.instagramUrl || null,
    twitterUrl: parsed.data.twitterUrl || null,
    youtubeUrl: parsed.data.youtubeUrl || null,
    spotifyUrl: parsed.data.spotifyUrl || null,
  };

  if (profile.artist) {
    await prisma.artist.update({ where: { id: profile.artist.id }, data });
  } else {
    // Slugs must be unique across the whole roster, so collisions get suffixed.
    const base = slugify(parsed.data.stageName) || 'artist';
    const taken = await prisma.artist.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    const slug = taken.some((entry) => entry.slug === base)
      ? `${base}-${Math.random().toString(36).slice(2, 7)}`
      : base;

    await prisma.artist.create({
      data: {
        ...data,
        slug,
        // New artist pages start unpublished; staff review before they go live.
        status: 'DRAFT',
        ownerId: profile.id,
      },
    });
  }

  await recordAudit({
    actorId: user.id,
    action: 'creator.artist_save',
    entityType: 'Artist',
    entityId: profile.artist?.id ?? null,
  });

  revalidatePath('/creator/profile');
  return { success: 'Artist profile saved.' };
}

const songSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, 'Enter a title.').max(160),
  albumId: z.string().optional(),
  trackNumber: z.coerce.number().int().min(0).max(999).optional(),
  durationSec: z.coerce.number().int().min(0).max(60 * 60 * 5).default(0),
  artworkUrl: z.string().url('Enter a valid image URL.').optional().or(z.literal('')),
  audioUrl: z.string().url('Enter a valid audio URL.').optional().or(z.literal('')),
  previewUrl: z.string().url('Enter a valid audio URL.').optional().or(z.literal('')),
  explicit: z.coerce.boolean().optional().default(false),
  accessType: z.enum(['FREE', 'MEMBERSHIP', 'PURCHASE']),
  priceCents: z.coerce.number().int().min(0).max(100_000).optional(),
  purchasable: z.coerce.boolean().optional().default(false),
  submitForReview: z.coerce.boolean().optional().default(false),
});

export async function saveSongAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, profile } = await requireCreatorProfile();

  if (!profile.artist) {
    return actionError('Set up your artist profile before uploading music.');
  }

  const parsed = songSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Please check the highlighted fields.', fromZod(parsed.error.flatten()));
  }

  if (parsed.data.purchasable && !parsed.data.priceCents) {
    return actionError('Set a price before making a track purchasable.', {
      priceCents: ['Enter a price in cents.'],
    });
  }

  // An album can only be attached if the same creator owns it.
  if (parsed.data.albumId) {
    const album = await prisma.album.findFirst({
      where: { id: parsed.data.albumId, artistId: profile.artist.id },
      select: { id: true },
    });
    if (!album) return actionError('That album does not belong to you.');
  }

  const data = {
    title: parsed.data.title,
    artistId: profile.artist.id,
    albumId: parsed.data.albumId || null,
    trackNumber: parsed.data.trackNumber ?? null,
    durationSec: parsed.data.durationSec,
    artworkUrl: parsed.data.artworkUrl || null,
    audioUrl: parsed.data.audioUrl || null,
    previewUrl: parsed.data.previewUrl || null,
    explicit: parsed.data.explicit,
    accessType: parsed.data.accessType,
    priceCents: parsed.data.priceCents || null,
    purchasable: parsed.data.purchasable,
  };

  if (parsed.data.id) {
    const existing = await prisma.song.findFirst({
      where: { id: parsed.data.id, artistId: profile.artist.id },
      select: { id: true },
    });
    if (!existing) return actionError('That track does not belong to you.');

    await prisma.song.update({
      where: { id: existing.id },
      data: {
        ...data,
        // Creators can submit for review but cannot publish themselves.
        ...(parsed.data.submitForReview ? { status: 'IN_REVIEW' as const } : {}),
      },
    });
  } else {
    const base = slugify(parsed.data.title) || 'track';
    const taken = await prisma.song.findFirst({ where: { slug: base }, select: { id: true } });
    const slug = taken ? `${base}-${Math.random().toString(36).slice(2, 7)}` : base;

    await prisma.song.create({
      data: {
        ...data,
        slug,
        status: parsed.data.submitForReview ? 'IN_REVIEW' : 'DRAFT',
      },
    });
  }

  await recordAudit({
    actorId: user.id,
    action: parsed.data.id ? 'creator.song_update' : 'creator.song_create',
    entityType: 'Song',
    entityId: parsed.data.id ?? null,
  });

  revalidatePath('/creator/music');
  return { success: parsed.data.submitForReview ? 'Track submitted for review.' : 'Track saved.' };
}

export async function deleteSongAction(formData: FormData) {
  const { profile } = await requireCreatorProfile();
  const id = String(formData.get('id') ?? '');
  if (!id || !profile.artist) return;

  // Only unpublished tracks can be removed by the creator; published catalogue
  // is taken down by staff so purchase history stays coherent.
  await prisma.song.deleteMany({
    where: { id, artistId: profile.artist.id, status: { in: ['DRAFT', 'IN_REVIEW'] } },
  });

  revalidatePath('/creator/music');
}

const albumSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, 'Enter a title.').max(160),
  description: z.string().trim().max(2000).optional(),
  artworkUrl: z.string().url('Enter a valid image URL.').optional().or(z.literal('')),
  releaseDate: z.string().optional(),
  accessType: z.enum(['FREE', 'MEMBERSHIP', 'PURCHASE']),
  priceCents: z.coerce.number().int().min(0).max(500_000).optional(),
  purchasable: z.coerce.boolean().optional().default(false),
  submitForReview: z.coerce.boolean().optional().default(false),
});

export async function saveAlbumAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, profile } = await requireCreatorProfile();

  if (!profile.artist) {
    return actionError('Set up your artist profile before creating albums.');
  }

  const parsed = albumSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Please check the highlighted fields.', fromZod(parsed.error.flatten()));
  }

  if (parsed.data.purchasable && !parsed.data.priceCents) {
    return actionError('Set a price before making an album purchasable.', {
      priceCents: ['Enter a price in cents.'],
    });
  }

  const releaseDate = parsed.data.releaseDate ? new Date(parsed.data.releaseDate) : null;
  if (releaseDate && Number.isNaN(releaseDate.getTime())) {
    return actionError('Enter a valid release date.', { releaseDate: ['Invalid date.'] });
  }

  const data = {
    title: parsed.data.title,
    artistId: profile.artist.id,
    description: parsed.data.description || null,
    artworkUrl: parsed.data.artworkUrl || null,
    releaseDate,
    accessType: parsed.data.accessType,
    priceCents: parsed.data.priceCents || null,
    purchasable: parsed.data.purchasable,
  };

  if (parsed.data.id) {
    const existing = await prisma.album.findFirst({
      where: { id: parsed.data.id, artistId: profile.artist.id },
      select: { id: true },
    });
    if (!existing) return actionError('That album does not belong to you.');

    await prisma.album.update({
      where: { id: existing.id },
      data: {
        ...data,
        ...(parsed.data.submitForReview ? { status: 'IN_REVIEW' as const } : {}),
      },
    });
  } else {
    const base = slugify(parsed.data.title) || 'album';
    const taken = await prisma.album.findFirst({ where: { slug: base }, select: { id: true } });
    const slug = taken ? `${base}-${Math.random().toString(36).slice(2, 7)}` : base;

    await prisma.album.create({
      data: { ...data, slug, status: parsed.data.submitForReview ? 'IN_REVIEW' : 'DRAFT' },
    });
  }

  await recordAudit({
    actorId: user.id,
    action: parsed.data.id ? 'creator.album_update' : 'creator.album_create',
    entityType: 'Album',
    entityId: parsed.data.id ?? null,
  });

  revalidatePath('/creator/albums');
  return { success: parsed.data.submitForReview ? 'Album submitted for review.' : 'Album saved.' };
}

export async function deleteAlbumAction(formData: FormData) {
  const { profile } = await requireCreatorProfile();
  const id = String(formData.get('id') ?? '');
  if (!id || !profile.artist) return;

  await prisma.album.deleteMany({
    where: { id, artistId: profile.artist.id, status: { in: ['DRAFT', 'IN_REVIEW'] } },
  });

  revalidatePath('/creator/albums');
}

const productRequestSchema = z.object({
  title: z.string().trim().min(2, 'Enter a product title.').max(160),
  description: z.string().trim().min(10, 'Describe the product.').max(2000),
  priceCents: z.coerce.number().int().min(100, 'Minimum price is $1.').max(500_000),
});

/**
 * Creators propose merch; staff create the sellable product. This keeps
 * fulfilment, inventory and payouts under network control.
 */
export async function requestProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, profile } = await requireCreatorProfile();

  if (!isCreatorRole(user.role) && user.role === 'USER') {
    return actionError('An active creator subscription is required to sell merch.');
  }

  const parsed = productRequestSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Please check the highlighted fields.', fromZod(parsed.error.flatten()));
  }

  const staff = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'OWNER'] } },
    select: { id: true },
  });

  for (const member of staff) {
    await notify({
      userId: member.id,
      type: 'SYSTEM',
      title: `Merch request from ${profile.displayName}`,
      body: `${parsed.data.title} — proposed at ${(parsed.data.priceCents / 100).toFixed(2)}`,
      href: '/admin/products',
    });
  }

  await recordAudit({
    actorId: user.id,
    action: 'creator.product_request',
    entityType: 'CreatorProfile',
    entityId: profile.id,
    metadata: {
      title: parsed.data.title,
      priceCents: parsed.data.priceCents,
      description: parsed.data.description,
    },
  });

  return { success: 'Request sent. The merch team will follow up with you.' };
}

export { assertOwnsArtist };
