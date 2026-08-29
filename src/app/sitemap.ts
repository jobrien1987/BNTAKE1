import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { appUrl } from '@/lib/env';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    '',
    '/culture',
    '/watch',
    '/listen',
    '/radio',
    '/live',
    '/shop',
    '/community',
    '/heartfelt',
    '/membership',
    '/search',
    '/about',
    '/contact',
    '/legal/terms',
    '/legal/privacy',
  ].map((path) => ({
    url: `${appUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: path === '' ? 1 : 0.7,
  }));

  try {
    const [articles, artists, songs, albums, videos, products, campaigns] = await Promise.all([
      prisma.article.findMany({
        where: { status: 'PUBLISHED' },
        select: { slug: true, updatedAt: true },
        take: 2000,
      }),
      prisma.artist.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, updatedAt: true }, take: 2000 }),
      prisma.song.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, updatedAt: true }, take: 2000 }),
      prisma.album.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, updatedAt: true }, take: 2000 }),
      prisma.video.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, updatedAt: true }, take: 2000 }),
      prisma.product.findMany({ where: { active: true }, select: { slug: true, updatedAt: true }, take: 2000 }),
      prisma.campaign.findMany({
        where: { status: { in: ['ACTIVE', 'COMPLETED'] } },
        select: { slug: true, updatedAt: true },
        take: 500,
      }),
    ]);

    const dynamicRoutes = [
      ...articles.map((row) => ({ path: `/culture/${row.slug}`, updatedAt: row.updatedAt })),
      ...artists.map((row) => ({ path: `/artists/${row.slug}`, updatedAt: row.updatedAt })),
      ...songs.map((row) => ({ path: `/songs/${row.slug}`, updatedAt: row.updatedAt })),
      ...albums.map((row) => ({ path: `/albums/${row.slug}`, updatedAt: row.updatedAt })),
      ...videos.map((row) => ({ path: `/watch/${row.slug}`, updatedAt: row.updatedAt })),
      ...products.map((row) => ({ path: `/shop/${row.slug}`, updatedAt: row.updatedAt })),
      ...campaigns.map((row) => ({ path: `/heartfelt/${row.slug}`, updatedAt: row.updatedAt })),
    ];

    return [
      ...staticRoutes,
      ...dynamicRoutes.map((route) => ({
        url: `${appUrl}${route.path}`,
        lastModified: route.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
