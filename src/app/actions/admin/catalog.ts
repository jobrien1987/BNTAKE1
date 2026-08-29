'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { assertPermission } from '@/server/auth/guards';
import { slugify } from '@/lib/slug';
import { sanitizeRichText } from '@/server/services/sanitize';
import { recordAudit } from '@/server/audit';
import { actionError, fromZod, type ActionState } from '@/lib/action-state';

/** Reserves a unique slug for a model, suffixing on collision. */
async function uniqueSlugFor(
  model: 'artist' | 'video' | 'campaign' | 'liveStream' | 'radioStation',
  base: string,
  selfId?: string,
) {
  const root = slugify(base) || model;

  const finders = {
    artist: () => prisma.artist.findUnique({ where: { slug: root }, select: { id: true } }),
    video: () => prisma.video.findUnique({ where: { slug: root }, select: { id: true } }),
    campaign: () => prisma.campaign.findUnique({ where: { slug: root }, select: { id: true } }),
    liveStream: () => prisma.liveStream.findUnique({ where: { slug: root }, select: { id: true } }),
    radioStation: () =>
      prisma.radioStation.findUnique({ where: { slug: root }, select: { id: true } }),
  } as const;

  const existing = await finders[model]();
  if (!existing || existing.id === selfId) return root;
  return `${root}-${Math.random().toString(36).slice(2, 7)}`;
}

const optionalUrl = z.string().url('Enter a valid URL.').optional().or(z.literal(''));

/* ------------------------------------------------------------------ artists */

const artistSchema = z.object({
  id: z.string().optional(),
  stageName: z.string().trim().min(2, 'Enter an artist name.').max(80),
  bio: z.string().trim().max(4000).optional(),
  location: z.string().trim().max(80).optional(),
  profileImageUrl: optionalUrl,
  heroImageUrl: optionalUrl,
  websiteUrl: optionalUrl,
  instagramUrl: optionalUrl,
  twitterUrl: optionalUrl,
  youtubeUrl: optionalUrl,
  spotifyUrl: optionalUrl,
  status: z.enum(['DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']),
  featured: z.coerce.boolean().optional().default(false),
  verified: z.coerce.boolean().optional().default(false),
});

export async function saveArtistAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertPermission('music.write');

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
    status: parsed.data.status,
    featured: parsed.data.featured,
    verified: parsed.data.verified,
  };

  const artist = parsed.data.id
    ? await prisma.artist.update({ where: { id: parsed.data.id }, data })
    : await prisma.artist.create({
        data: { ...data, slug: await uniqueSlugFor('artist', parsed.data.stageName) },
      });

  await recordAudit({
    actorId: user.id,
    action: parsed.data.id ? 'artist.update' : 'artist.create',
    entityType: 'Artist',
    entityId: artist.id,
  });

  revalidatePath('/listen');
  revalidatePath(`/artists/${artist.slug}`);
  revalidatePath('/admin/artists');
  return { success: `Saved ${artist.stageName}.` };
}

/* ------------------------------------------------------------------- videos */

const videoSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2, 'Enter a title.').max(200),
  kind: z.enum(['MOVIE', 'DOCUMENTARY', 'SERIES', 'EPISODE', 'INTERVIEW', 'MUSIC_VIDEO', 'TRAILER']),
  synopsis: z.string().trim().max(4000).optional(),
  posterUrl: optionalUrl,
  backdropUrl: optionalUrl,
  trailerUrl: optionalUrl,
  mediaUrl: optionalUrl,
  durationSec: z.coerce.number().int().min(0).max(60 * 60 * 12).default(0),
  releaseDate: z.string().optional(),
  director: z.string().trim().max(120).optional(),
  contentRating: z.string().trim().max(16).optional(),
  accessType: z.enum(['FREE', 'MEMBERSHIP', 'PURCHASE']),
  priceCents: z.coerce.number().int().min(0).max(1_000_000).optional(),
  purchasable: z.coerce.boolean().optional().default(false),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']),
  featured: z.coerce.boolean().optional().default(false),
  seoDescription: z.string().trim().max(300).optional(),
});

export async function saveVideoAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertPermission('watch.write');

  const parsed = videoSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Please check the highlighted fields.', fromZod(parsed.error.flatten()));
  }

  if (parsed.data.purchasable && !parsed.data.priceCents) {
    return actionError('Set a price before making a title purchasable.', {
      priceCents: ['Enter a price in cents.'],
    });
  }

  const releaseDate = parsed.data.releaseDate ? new Date(parsed.data.releaseDate) : null;
  if (releaseDate && Number.isNaN(releaseDate.getTime())) {
    return actionError('Enter a valid release date.', { releaseDate: ['Invalid date.'] });
  }

  const data = {
    title: parsed.data.title,
    kind: parsed.data.kind,
    synopsis: parsed.data.synopsis || null,
    posterUrl: parsed.data.posterUrl || null,
    backdropUrl: parsed.data.backdropUrl || null,
    trailerUrl: parsed.data.trailerUrl || null,
    mediaUrl: parsed.data.mediaUrl || null,
    durationSec: parsed.data.durationSec,
    releaseDate,
    director: parsed.data.director || null,
    contentRating: parsed.data.contentRating || null,
    accessType: parsed.data.accessType,
    priceCents: parsed.data.priceCents || null,
    purchasable: parsed.data.purchasable,
    status: parsed.data.status,
    featured: parsed.data.featured,
    seoDescription: parsed.data.seoDescription || null,
  };

  const video = parsed.data.id
    ? await prisma.video.update({ where: { id: parsed.data.id }, data })
    : await prisma.video.create({
        data: { ...data, slug: await uniqueSlugFor('video', parsed.data.title) },
      });

  await recordAudit({
    actorId: user.id,
    action: parsed.data.id ? 'video.update' : 'video.create',
    entityType: 'Video',
    entityId: video.id,
  });

  revalidatePath('/watch');
  revalidatePath(`/watch/${video.slug}`);
  revalidatePath('/admin/watch');
  return { success: `Saved “${video.title}”.` };
}

/* ---------------------------------------------------------------- campaigns */

const campaignSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2, 'Enter a title.').max(200),
  summary: z.string().trim().max(400).optional(),
  story: z.string().min(1, 'Write the campaign story.'),
  heroImageUrl: optionalUrl,
  thumbnailUrl: optionalUrl,
  category: z.string().trim().max(60).optional(),
  location: z.string().trim().max(80).optional(),
  goalCents: z.coerce.number().int().min(0).max(100_000_000).default(0),
  donationEnabled: z.coerce.boolean().optional().default(false),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED']),
  featured: z.coerce.boolean().optional().default(false),
  endsAt: z.string().optional(),
});

export async function saveCampaignAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertPermission('heartfelt.write');

  const parsed = campaignSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Please check the highlighted fields.', fromZod(parsed.error.flatten()));
  }

  if (parsed.data.donationEnabled && parsed.data.goalCents <= 0) {
    return actionError('Set a fundraising goal before enabling donations.', {
      goalCents: ['Enter a goal in cents.'],
    });
  }

  const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;
  if (endsAt && Number.isNaN(endsAt.getTime())) {
    return actionError('Enter a valid end date.', { endsAt: ['Invalid date.'] });
  }

  const data = {
    title: parsed.data.title,
    summary: parsed.data.summary || null,
    // Campaign stories are rich text, so they are sanitized before storage.
    story: sanitizeRichText(parsed.data.story),
    heroImageUrl: parsed.data.heroImageUrl || null,
    thumbnailUrl: parsed.data.thumbnailUrl || null,
    category: parsed.data.category || null,
    location: parsed.data.location || null,
    goalCents: parsed.data.goalCents,
    donationEnabled: parsed.data.donationEnabled,
    status: parsed.data.status,
    featured: parsed.data.featured,
    endsAt,
  };

  const campaign = parsed.data.id
    ? await prisma.campaign.update({ where: { id: parsed.data.id }, data })
    : await prisma.campaign.create({
        data: { ...data, slug: await uniqueSlugFor('campaign', parsed.data.title) },
      });

  await recordAudit({
    actorId: user.id,
    action: parsed.data.id ? 'campaign.update' : 'campaign.create',
    entityType: 'Campaign',
    entityId: campaign.id,
  });

  revalidatePath('/heartfelt');
  revalidatePath(`/heartfelt/${campaign.slug}`);
  revalidatePath('/admin/heartfelt');
  return { success: `Saved “${campaign.title}”.` };
}

/* -------------------------------------------------------------- live + radio */

const liveSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2, 'Enter a title.').max(200),
  description: z.string().trim().max(2000).optional(),
  posterUrl: optionalUrl,
  playbackUrl: optionalUrl,
  provider: z.string().trim().max(60).optional(),
  status: z.enum(['SCHEDULED', 'LIVE', 'ENDED', 'CANCELED']),
  scheduledFor: z.string().optional(),
  accessType: z.enum(['FREE', 'MEMBERSHIP', 'PURCHASE']),
  priceCents: z.coerce.number().int().min(0).max(1_000_000).optional(),
  artistId: z.string().optional(),
});

export async function saveLiveStreamAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertPermission('watch.write');

  const parsed = liveSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Please check the highlighted fields.', fromZod(parsed.error.flatten()));
  }

  const scheduledFor = parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : null;
  if (scheduledFor && Number.isNaN(scheduledFor.getTime())) {
    return actionError('Enter a valid date and time.', { scheduledFor: ['Invalid date.'] });
  }

  const data = {
    title: parsed.data.title,
    description: parsed.data.description || null,
    posterUrl: parsed.data.posterUrl || null,
    playbackUrl: parsed.data.playbackUrl || null,
    provider: parsed.data.provider || null,
    status: parsed.data.status,
    scheduledFor,
    accessType: parsed.data.accessType,
    priceCents: parsed.data.priceCents || null,
    artistId: parsed.data.artistId || null,
    // Timestamps follow the status so the public page can describe the stream
    // accurately without a separate scheduler.
    startedAt: parsed.data.status === 'LIVE' ? new Date() : undefined,
    endedAt: parsed.data.status === 'ENDED' ? new Date() : undefined,
  };

  const stream = parsed.data.id
    ? await prisma.liveStream.update({ where: { id: parsed.data.id }, data })
    : await prisma.liveStream.create({
        data: { ...data, slug: await uniqueSlugFor('liveStream', parsed.data.title) },
      });

  await recordAudit({
    actorId: user.id,
    action: parsed.data.id ? 'live.update' : 'live.create',
    entityType: 'LiveStream',
    entityId: stream.id,
  });

  revalidatePath('/live');
  revalidatePath(`/live/${stream.slug}`);
  revalidatePath('/admin/live');
  return { success: `Saved “${stream.title}”.` };
}

const stationSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, 'Enter a station name.').max(80),
  tagline: z.string().trim().max(160).optional(),
  description: z.string().trim().max(2000).optional(),
  logoUrl: optionalUrl,
  heroImageUrl: optionalUrl,
  streamUrl: optionalUrl,
  isLive: z.coerce.boolean().optional().default(false),
  active: z.coerce.boolean().optional().default(true),
});

export async function saveRadioStationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertPermission('music.write');

  const parsed = stationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Please check the highlighted fields.', fromZod(parsed.error.flatten()));
  }

  const data = {
    name: parsed.data.name,
    tagline: parsed.data.tagline || null,
    description: parsed.data.description || null,
    logoUrl: parsed.data.logoUrl || null,
    heroImageUrl: parsed.data.heroImageUrl || null,
    streamUrl: parsed.data.streamUrl || null,
    isLive: parsed.data.isLive,
    active: parsed.data.active,
  };

  const station = parsed.data.id
    ? await prisma.radioStation.update({ where: { id: parsed.data.id }, data })
    : await prisma.radioStation.create({
        data: { ...data, slug: await uniqueSlugFor('radioStation', parsed.data.name) },
      });

  await recordAudit({
    actorId: user.id,
    action: parsed.data.id ? 'radio.update' : 'radio.create',
    entityType: 'RadioStation',
    entityId: station.id,
  });

  revalidatePath('/radio');
  revalidatePath('/admin/radio');
  return { success: `Saved ${station.name}.` };
}

/* ---------------------------------------------------------------- homepage */

const sectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().max(200).optional(),
  ctaLabel: z.string().trim().max(60).optional(),
  ctaHref: z.string().trim().max(200).optional(),
  position: z.coerce.number().int().min(0).max(100),
  enabled: z.coerce.boolean().optional().default(true),
});

export async function saveHomepageSectionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertPermission('homepage.write');

  const parsed = sectionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Please check the highlighted fields.', fromZod(parsed.error.flatten()));
  }

  await prisma.homepageSection.update({
    where: { id: parsed.data.id },
    data: {
      title: parsed.data.title,
      subtitle: parsed.data.subtitle || null,
      ctaLabel: parsed.data.ctaLabel || null,
      ctaHref: parsed.data.ctaHref || null,
      position: parsed.data.position,
      enabled: parsed.data.enabled,
    },
  });

  await recordAudit({
    actorId: user.id,
    action: 'homepage.section_update',
    entityType: 'HomepageSection',
    entityId: parsed.data.id,
  });

  revalidatePath('/');
  revalidatePath('/admin/homepage');
  return { success: 'Section saved.' };
}
