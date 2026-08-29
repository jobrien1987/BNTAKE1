import 'server-only';
import { prisma } from '@/lib/prisma';
import type { PurchasableKind } from '@prisma/client';

/**
 * Authoritative server-side pricing. The browser may only say *what* it wants
 * to buy — never how much it costs.
 */

export interface ResolvedLine {
  kind: PurchasableKind;
  refId: string | null;
  productId: string | null;
  variantId: string | null;
  title: string;
  variantLabel: string | null;
  imageUrl: string | null;
  sku: string | null;
  unitPriceCents: number;
  requiresShipping: boolean;
  /** null means "not inventory tracked" (digital goods). */
  availableInventory: number | null;
  href: string;
}

export interface ResolveRequest {
  kind: PurchasableKind;
  productId?: string | null;
  variantId?: string | null;
  refId?: string | null;
}

export class CatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogError';
  }
}

export async function resolvePurchasable(request: ResolveRequest): Promise<ResolvedLine> {
  switch (request.kind) {
    case 'PRODUCT':
    case 'DIGITAL_PRODUCT':
      return resolveProduct(request);
    case 'SONG':
      return resolveSong(request.refId);
    case 'ALBUM':
      return resolveAlbum(request.refId);
    case 'VIDEO':
      return resolveVideo(request.refId);
    default:
      throw new CatalogError(`Unsupported purchasable kind: ${request.kind}`);
  }
}

async function resolveProduct(request: ResolveRequest): Promise<ResolvedLine> {
  const productId = request.productId ?? request.refId;
  if (!productId) throw new CatalogError('Missing product.');

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      images: { orderBy: { position: 'asc' }, take: 1 },
      variants: true,
    },
  });

  if (!product || !product.active) throw new CatalogError('This product is no longer available.');

  const variant = request.variantId
    ? product.variants.find((v) => v.id === request.variantId && v.active)
    : null;

  if (request.variantId && !variant) throw new CatalogError('That option is no longer available.');
  if (!variant && product.variants.some((v) => v.active)) {
    throw new CatalogError('Please choose an option before adding to cart.');
  }

  const basePrice = product.salePriceCents ?? product.priceCents;
  const unitPriceCents = variant?.priceCents ?? basePrice;

  return {
    kind: product.isDigital ? 'DIGITAL_PRODUCT' : 'PRODUCT',
    refId: product.id,
    productId: product.id,
    variantId: variant?.id ?? null,
    title: product.title,
    variantLabel: variant?.name ?? null,
    imageUrl: product.images[0]?.url ?? null,
    sku: variant?.sku ?? product.sku ?? null,
    unitPriceCents,
    requiresShipping: product.requiresShipping && !product.isDigital,
    availableInventory: product.trackInventory
      ? (variant ? variant.inventory : product.inventory)
      : null,
    href: `/shop/${product.slug}`,
  };
}

async function resolveSong(refId: string | null | undefined): Promise<ResolvedLine> {
  if (!refId) throw new CatalogError('Missing song.');
  const song = await prisma.song.findUnique({
    where: { id: refId },
    include: { artist: { select: { stageName: true } } },
  });
  if (!song || song.status !== 'PUBLISHED' || !song.purchasable || song.priceCents == null) {
    throw new CatalogError('This song is not available for purchase.');
  }
  return {
    kind: 'SONG',
    refId: song.id,
    productId: null,
    variantId: null,
    title: `${song.title} — ${song.artist.stageName}`,
    variantLabel: 'Digital single',
    imageUrl: song.artworkUrl,
    sku: null,
    unitPriceCents: song.priceCents,
    requiresShipping: false,
    availableInventory: null,
    href: `/songs/${song.slug}`,
  };
}

async function resolveAlbum(refId: string | null | undefined): Promise<ResolvedLine> {
  if (!refId) throw new CatalogError('Missing album.');
  const album = await prisma.album.findUnique({
    where: { id: refId },
    include: { artist: { select: { stageName: true } } },
  });
  if (!album || album.status !== 'PUBLISHED' || !album.purchasable || album.priceCents == null) {
    throw new CatalogError('This album is not available for purchase.');
  }
  return {
    kind: 'ALBUM',
    refId: album.id,
    productId: null,
    variantId: null,
    title: `${album.title} — ${album.artist.stageName}`,
    variantLabel: 'Digital album',
    imageUrl: album.artworkUrl,
    sku: null,
    unitPriceCents: album.priceCents,
    requiresShipping: false,
    availableInventory: null,
    href: `/albums/${album.slug}`,
  };
}

async function resolveVideo(refId: string | null | undefined): Promise<ResolvedLine> {
  if (!refId) throw new CatalogError('Missing title.');
  const video = await prisma.video.findUnique({ where: { id: refId } });
  if (!video || video.status !== 'PUBLISHED' || !video.purchasable || video.priceCents == null) {
    throw new CatalogError('This title is not available for purchase.');
  }
  return {
    kind: 'VIDEO',
    refId: video.id,
    productId: null,
    variantId: null,
    title: video.title,
    variantLabel: 'Digital film',
    imageUrl: video.posterUrl,
    sku: null,
    unitPriceCents: video.priceCents,
    requiresShipping: false,
    availableInventory: null,
    href: `/watch/${video.slug}`,
  };
}
