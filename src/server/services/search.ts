import 'server-only';
import { prisma } from '@/lib/prisma';

/**
 * Global search runs entirely in Postgres. Results are grouped by domain and
 * hard-limited — the client never receives the catalogue.
 */

export type SearchGroupKey =
  | 'articles'
  | 'artists'
  | 'songs'
  | 'albums'
  | 'videos'
  | 'products'
  | 'campaigns';

export interface SearchResult {
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  imageUrl: string | null;
  group: SearchGroupKey;
  meta: string | null;
}

export interface SearchResponse {
  query: string;
  total: number;
  groups: Record<SearchGroupKey, SearchResult[]>;
}

const EMPTY_GROUPS = (): Record<SearchGroupKey, SearchResult[]> => ({
  articles: [],
  artists: [],
  songs: [],
  albums: [],
  videos: [],
  products: [],
  campaigns: [],
});

export async function globalSearch(rawQuery: string, limitPerGroup = 6): Promise<SearchResponse> {
  const query = rawQuery.trim().slice(0, 120);
  if (query.length < 2) return { query, total: 0, groups: EMPTY_GROUPS() };

  const contains = { contains: query, mode: 'insensitive' as const };
  const take = Math.min(Math.max(limitPerGroup, 1), 20);

  const [articles, artists, songs, albums, videos, products, campaigns] = await Promise.all([
    prisma.article.findMany({
      where: {
        status: 'PUBLISHED',
        OR: [{ title: contains }, { dek: contains }, { excerpt: contains }],
      },
      select: { id: true, title: true, slug: true, dek: true, thumbnailUrl: true, publishedAt: true },
      orderBy: { publishedAt: 'desc' },
      take,
    }),
    prisma.artist.findMany({
      where: { status: 'PUBLISHED', OR: [{ stageName: contains }, { bio: contains }] },
      select: { id: true, stageName: true, slug: true, location: true, profileImageUrl: true },
      take,
    }),
    prisma.song.findMany({
      where: { status: 'PUBLISHED', title: contains },
      select: {
        id: true,
        title: true,
        slug: true,
        artworkUrl: true,
        artist: { select: { stageName: true } },
      },
      take,
    }),
    prisma.album.findMany({
      where: { status: 'PUBLISHED', title: contains },
      select: {
        id: true,
        title: true,
        slug: true,
        artworkUrl: true,
        artist: { select: { stageName: true } },
      },
      take,
    }),
    prisma.video.findMany({
      where: { status: 'PUBLISHED', OR: [{ title: contains }, { synopsis: contains }] },
      select: { id: true, title: true, slug: true, posterUrl: true, kind: true, releaseDate: true },
      take,
    }),
    prisma.product.findMany({
      where: { active: true, OR: [{ title: contains }, { description: contains }] },
      select: {
        id: true,
        title: true,
        slug: true,
        priceCents: true,
        salePriceCents: true,
        images: { take: 1, orderBy: { position: 'asc' } },
      },
      take,
    }),
    prisma.campaign.findMany({
      where: { status: { in: ['ACTIVE', 'COMPLETED'] }, OR: [{ title: contains }, { summary: contains }] },
      select: { id: true, title: true, slug: true, summary: true, thumbnailUrl: true },
      take,
    }),
  ]);

  const groups = EMPTY_GROUPS();

  groups.articles = articles.map((a) => ({
    id: a.id,
    title: a.title,
    subtitle: a.dek,
    href: `/culture/${a.slug}`,
    imageUrl: a.thumbnailUrl,
    group: 'articles',
    meta: 'Culture',
  }));
  groups.artists = artists.map((a) => ({
    id: a.id,
    title: a.stageName,
    subtitle: a.location,
    href: `/artists/${a.slug}`,
    imageUrl: a.profileImageUrl,
    group: 'artists',
    meta: 'Artist',
  }));
  groups.songs = songs.map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: s.artist.stageName,
    href: `/songs/${s.slug}`,
    imageUrl: s.artworkUrl,
    group: 'songs',
    meta: 'Song',
  }));
  groups.albums = albums.map((a) => ({
    id: a.id,
    title: a.title,
    subtitle: a.artist.stageName,
    href: `/albums/${a.slug}`,
    imageUrl: a.artworkUrl,
    group: 'albums',
    meta: 'Album',
  }));
  groups.videos = videos.map((v) => ({
    id: v.id,
    title: v.title,
    subtitle: v.kind.replace(/_/g, ' ').toLowerCase(),
    href: `/watch/${v.slug}`,
    imageUrl: v.posterUrl,
    group: 'videos',
    meta: 'Watch',
  }));
  groups.products = products.map((p) => ({
    id: p.id,
    title: p.title,
    subtitle: null,
    href: `/shop/${p.slug}`,
    imageUrl: p.images[0]?.url ?? null,
    group: 'products',
    meta: 'Shop',
  }));
  groups.campaigns = campaigns.map((c) => ({
    id: c.id,
    title: c.title,
    subtitle: c.summary,
    href: `/heartfelt/${c.slug}`,
    imageUrl: c.thumbnailUrl,
    group: 'campaigns',
    meta: 'Heartfelt',
  }));

  const total = Object.values(groups).reduce((sum, list) => sum + list.length, 0);
  return { query, total, groups };
}

export const SEARCH_GROUP_LABELS: Record<SearchGroupKey, string> = {
  articles: 'Culture',
  artists: 'Artists',
  songs: 'Songs',
  albums: 'Albums',
  videos: 'Watch',
  products: 'Shop',
  campaigns: 'Heartfelt',
};
