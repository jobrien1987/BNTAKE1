import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

/**
 * Site settings live in the database so the owner can change business
 * configuration without a deploy.
 */

export interface SiteSettings {
  siteName: string;
  tagline: string;
  supportEmail: string;
  instagramUrl: string;
  twitterUrl: string;
  youtubeUrl: string;
  tiktokUrl: string;
  announcementText: string;
  announcementHref: string;
  announcementEnabled: boolean;
  liveEnabled: boolean;
  communityEnabled: boolean;
  donationsEnabled: boolean;
  radioStationSlug: string;
  eventsIntegrationUrl: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: 'Boosie Network',
  tagline: 'Culture. Music. Movies. Ownership.',
  supportEmail: 'support@boosienetwork.com',
  instagramUrl: '',
  twitterUrl: '',
  youtubeUrl: '',
  tiktokUrl: '',
  announcementText: '',
  announcementHref: '',
  announcementEnabled: false,
  liveEnabled: true,
  communityEnabled: true,
  donationsEnabled: false,
  radioStationSlug: 'badazz-radio',
  eventsIntegrationUrl: '',
};

export const getSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const rows = await prisma.siteSetting.findMany();
    const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      if (row.key in DEFAULT_SETTINGS) merged[row.key] = row.value;
    }
    return merged as unknown as SiteSettings;
  } catch {
    // Database unavailable (e.g. during a build without DATABASE_URL).
    return DEFAULT_SETTINGS;
  }
});

export async function updateSettings(patch: Partial<SiteSettings>, group = 'general') {
  const entries = Object.entries(patch).filter(([key]) => key in DEFAULT_SETTINGS);
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.siteSetting.upsert({
        where: { key },
        create: { key, value: value as Prisma.InputJsonValue, group },
        update: { value: value as Prisma.InputJsonValue, group },
      }),
    ),
  );
}
