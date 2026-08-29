import 'server-only';
import { prisma } from '@/lib/prisma';
import type { HomepageSectionType } from '@prisma/client';

/**
 * The homepage is entirely database-driven: Admin controls which sections show,
 * their order, and what is featured in each. When a section has no curated
 * items we fall back to the newest published content so the page never looks
 * broken or empty.
 */

export const HERO_SELECT = {
  id: true,
  kind: true,
  position: true,
  headline: true,
  subheadline: true,
  eyebrow: true,
  imageUrl: true,
  videoUrl: true,
  ctaLabel: true,
  ctaHref: true,
  secondaryCtaLabel: true,
  secondaryCtaHref: true,
  article: { select: { slug: true, title: true, dek: true, heroImageUrl: true } },
  video: { select: { slug: true, title: true, synopsis: true, backdropUrl: true, posterUrl: true } },
  album: {
    select: { slug: true, title: true, artworkUrl: true, artist: { select: { stageName: true } } },
  },
  song: {
    select: { slug: true, title: true, artworkUrl: true, artist: { select: { stageName: true } } },
  },
  artist: { select: { slug: true, stageName: true, heroImageUrl: true, bio: true } },
  product: {
    select: { slug: true, title: true, description: true, images: { take: 1, orderBy: { position: 'asc' as const } } },
  },
  campaign: { select: { slug: true, title: true, summary: true, heroImageUrl: true } },
  liveStream: { select: { slug: true, title: true, description: true, posterUrl: true, status: true } },
} as const;

export interface HeroContent {
  eyebrow: string;
  headline: string;
  subheadline: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  ctaLabel: string;
  ctaHref: string;
  secondaryCtaLabel: string | null;
  secondaryCtaHref: string | null;
}

type HeroItem = Awaited<ReturnType<typeof loadSections>>[number]['items'][number];

function heroFromItem(item: HeroItem): HeroContent | null {
  const base = {
    eyebrow: item.eyebrow ?? 'Featured',
    subheadline: item.subheadline ?? null,
    videoUrl: item.videoUrl ?? null,
    secondaryCtaLabel: item.secondaryCtaLabel ?? null,
    secondaryCtaHref: item.secondaryCtaHref ?? null,
  };

  switch (item.kind) {
    case 'ARTICLE':
      if (!item.article) return null;
      return {
        ...base,
        headline: item.headline ?? item.article.title,
        subheadline: item.subheadline ?? item.article.dek,
        imageUrl: item.imageUrl ?? item.article.heroImageUrl,
        ctaLabel: item.ctaLabel ?? 'Read the story',
        ctaHref: item.ctaHref ?? `/culture/${item.article.slug}`,
      };
    case 'VIDEO':
      if (!item.video) return null;
      return {
        ...base,
        headline: item.headline ?? item.video.title,
        subheadline: item.subheadline ?? item.video.synopsis,
        imageUrl: item.imageUrl ?? item.video.backdropUrl ?? item.video.posterUrl,
        ctaLabel: item.ctaLabel ?? 'Watch now',
        ctaHref: item.ctaHref ?? `/watch/${item.video.slug}`,
      };
    case 'ALBUM':
      if (!item.album) return null;
      return {
        ...base,
        headline: item.headline ?? item.album.title,
        subheadline: item.subheadline ?? item.album.artist.stageName,
        imageUrl: item.imageUrl ?? item.album.artworkUrl,
        ctaLabel: item.ctaLabel ?? 'Hear the album',
        ctaHref: item.ctaHref ?? `/albums/${item.album.slug}`,
      };
    case 'SONG':
      if (!item.song) return null;
      return {
        ...base,
        headline: item.headline ?? item.song.title,
        subheadline: item.subheadline ?? item.song.artist.stageName,
        imageUrl: item.imageUrl ?? item.song.artworkUrl,
        ctaLabel: item.ctaLabel ?? 'Play the record',
        ctaHref: item.ctaHref ?? `/songs/${item.song.slug}`,
      };
    case 'ARTIST':
      if (!item.artist) return null;
      return {
        ...base,
        headline: item.headline ?? item.artist.stageName,
        subheadline: item.subheadline ?? item.artist.bio,
        imageUrl: item.imageUrl ?? item.artist.heroImageUrl,
        ctaLabel: item.ctaLabel ?? 'View artist',
        ctaHref: item.ctaHref ?? `/artists/${item.artist.slug}`,
      };
    case 'PRODUCT':
      if (!item.product) return null;
      return {
        ...base,
        headline: item.headline ?? item.product.title,
        subheadline: item.subheadline ?? item.product.description,
        imageUrl: item.imageUrl ?? item.product.images[0]?.url ?? null,
        ctaLabel: item.ctaLabel ?? 'Shop the drop',
        ctaHref: item.ctaHref ?? `/shop/${item.product.slug}`,
      };
    case 'CAMPAIGN':
      if (!item.campaign) return null;
      return {
        ...base,
        headline: item.headline ?? item.campaign.title,
        subheadline: item.subheadline ?? item.campaign.summary,
        imageUrl: item.imageUrl ?? item.campaign.heroImageUrl,
        ctaLabel: item.ctaLabel ?? 'Support the cause',
        ctaHref: item.ctaHref ?? `/heartfelt/${item.campaign.slug}`,
      };
    case 'LIVE_STREAM':
      if (!item.liveStream) return null;
      return {
        ...base,
        headline: item.headline ?? item.liveStream.title,
        subheadline: item.subheadline ?? item.liveStream.description,
        imageUrl: item.imageUrl ?? item.liveStream.posterUrl,
        ctaLabel: item.ctaLabel ?? 'Go to the stream',
        ctaHref: item.ctaHref ?? `/live/${item.liveStream.slug}`,
      };
    case 'CUSTOM':
    default:
      if (!item.headline) return null;
      return {
        ...base,
        headline: item.headline,
        imageUrl: item.imageUrl,
        ctaLabel: item.ctaLabel ?? 'Explore',
        ctaHref: item.ctaHref ?? '/culture',
      };
  }
}

async function loadSections() {
  return prisma.homepageSection.findMany({
    where: { enabled: true },
    orderBy: { position: 'asc' },
    include: {
      items: { orderBy: { position: 'asc' }, select: HERO_SELECT },
    },
  });
}

const DEFAULT_HERO: HeroContent = {
  eyebrow: 'Boosie Network',
  headline: 'CULTURE. MUSIC. MOVIES. OWNERSHIP.',
  subheadline:
    'The owned home for Boosie Badazz — breaking culture, original films, independent music, live moments, merch and community.',
  imageUrl: null,
  videoUrl: null,
  ctaLabel: 'Enter the network',
  ctaHref: '/culture',
  secondaryCtaLabel: 'Become a member',
  secondaryCtaHref: '/membership',
};

export async function getHomepage() {
  const [
    sections,
    breakingArticles,
    latestArticles,
    featuredVideos,
    featuredAlbums,
    featuredSongs,
    featuredArtists,
    featuredProducts,
    featuredCampaign,
    radioStation,
    communityPosts,
    membershipPlans,
    liveStreams,
  ] = await Promise.all([
    loadSections(),
    prisma.article.findMany({
      where: { status: 'PUBLISHED', breaking: true },
      orderBy: { publishedAt: 'desc' },
      take: 4,
      include: { category: { select: { name: true } }, author: { select: { name: true } } },
    }),
    prisma.article.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      take: 9,
      include: { category: { select: { name: true } }, author: { select: { name: true } } },
    }),
    prisma.video.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ featured: 'desc' }, { releaseDate: 'desc' }],
      take: 12,
    }),
    prisma.album.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ featured: 'desc' }, { releaseDate: 'desc' }],
      take: 10,
      include: { artist: { select: { stageName: true, slug: true } } },
    }),
    prisma.song.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ featured: 'desc' }, { releaseDate: 'desc' }],
      take: 8,
      include: { artist: { select: { stageName: true, slug: true } } },
    }),
    prisma.artist.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ featured: 'desc' }, { followerCount: 'desc' }],
      take: 10,
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
      take: 10,
      include: { images: { take: 1, orderBy: { position: 'asc' } }, category: { select: { name: true } } },
    }),
    prisma.campaign.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.radioStation.findFirst({
      where: { active: true },
      include: { plays: { orderBy: { playedAt: 'desc' }, take: 5 } },
    }),
    prisma.post.findMany({
      where: { hidden: false },
      orderBy: { createdAt: 'desc' },
      take: 4,
      include: {
        author: { select: { name: true, username: true, avatarUrl: true } },
      },
    }),
    prisma.plan.findMany({
      where: { kind: 'FAN', visible: true, active: true },
      orderBy: { position: 'asc' },
    }),
    prisma.liveStream.findMany({
      where: { status: { in: ['LIVE', 'SCHEDULED'] } },
      orderBy: [{ status: 'asc' }, { scheduledFor: 'asc' }],
      take: 3,
    }),
  ]);

  const heroSection = sections.find((section) => section.type === 'HERO');
  const heroItems = (heroSection?.items ?? [])
    .map(heroFromItem)
    .filter((hero): hero is HeroContent => hero !== null);

  const fallbackHeroSource = latestArticles[0] ?? null;
  const hero: HeroContent =
    heroItems[0] ??
    (fallbackHeroSource
      ? {
          eyebrow: 'Featured story',
          headline: fallbackHeroSource.title,
          subheadline: fallbackHeroSource.dek ?? fallbackHeroSource.excerpt,
          imageUrl: fallbackHeroSource.heroImageUrl,
          videoUrl: null,
          ctaLabel: 'Read the story',
          ctaHref: `/culture/${fallbackHeroSource.slug}`,
          secondaryCtaLabel: 'Become a member',
          secondaryCtaHref: '/membership',
        }
      : DEFAULT_HERO);

  const sectionByType = (type: HomepageSectionType) => sections.find((section) => section.type === type);

  const curatedIds = (type: HomepageSectionType, key: keyof HeroItem) =>
    (sectionByType(type)?.items ?? [])
      .map((item) => item[key])
      .filter(Boolean) as unknown[];

  // Curated selections take priority; the newest content backfills the rail.
  const curatedVideoSlugs = new Set(
    (sectionByType('WATCH_RAIL')?.items ?? []).map((item) => item.video?.slug).filter(Boolean),
  );
  const orderedVideos = [
    ...featuredVideos.filter((video) => curatedVideoSlugs.has(video.slug)),
    ...featuredVideos.filter((video) => !curatedVideoSlugs.has(video.slug)),
  ];

  return {
    sections,
    hero,
    heroItems,
    breakingArticles,
    latestArticles,
    videos: orderedVideos,
    albums: featuredAlbums,
    songs: featuredSongs,
    artists: featuredArtists,
    products: featuredProducts,
    campaign: featuredCampaign,
    radioStation,
    communityPosts,
    membershipPlans,
    liveStreams,
    curatedCount: curatedIds('WATCH_RAIL', 'video').length,
    sectionConfig: (type: HomepageSectionType) => sectionByType(type),
  };
}

export type HomepageData = Awaited<ReturnType<typeof getHomepage>>;
