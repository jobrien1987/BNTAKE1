import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Pricing must always come from the database. These tests exist to prove the
 * browser cannot influence what something costs.
 */

const prismaMock = {
  product: { findUnique: vi.fn() },
  productVariant: { findUnique: vi.fn() },
  song: { findUnique: vi.fn() },
  album: { findUnique: vi.fn() },
  video: { findUnique: vi.fn() },
};

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const { resolvePurchasable, CatalogError } = await import('@/server/services/catalog');

beforeEach(() => {
  for (const model of Object.values(prismaMock)) {
    for (const method of Object.values(model)) {
      (method as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue(null);
    }
  }
});

describe('resolvePurchasable — products', () => {
  it('prices from the database, not the request', async () => {
    prismaMock.product.findUnique.mockResolvedValue({
      id: 'product_1',
      slug: 'tour-tee',
      title: 'Tour Tee',
      priceCents: 3500,
      salePriceCents: null,
      currency: 'usd',
      inventory: 10,
      trackInventory: true,
      requiresShipping: true,
      isDigital: false,
      active: true,
      sku: 'tee-1',
      images: [{ url: 'https://example.com/tee.jpg' }],
      variants: [],
    });

    const line = await resolvePurchasable({ kind: 'PRODUCT', productId: 'product_1' });

    expect(line.unitPriceCents).toBe(3500);
    expect(line.title).toBe('Tour Tee');
    expect(line.requiresShipping).toBe(true);
  });

  it('prefers a sale price when one is set', async () => {
    prismaMock.product.findUnique.mockResolvedValue({
      id: 'product_1',
      slug: 'vinyl',
      title: 'Vinyl',
      priceCents: 4200,
      salePriceCents: 3600,
      currency: 'usd',
      inventory: 5,
      trackInventory: true,
      requiresShipping: true,
      isDigital: false,
      active: true,
      sku: null,
      images: [],
      variants: [],
    });

    const line = await resolvePurchasable({ kind: 'PRODUCT', productId: 'product_1' });
    expect(line.unitPriceCents).toBe(3600);
  });

  it('refuses an inactive product', async () => {
    prismaMock.product.findUnique.mockResolvedValue({
      id: 'product_1',
      slug: 'gone',
      title: 'Gone',
      priceCents: 1000,
      salePriceCents: null,
      currency: 'usd',
      inventory: 5,
      trackInventory: true,
      requiresShipping: true,
      isDigital: false,
      active: false,
      sku: null,
      images: [],
      variants: [],
    });

    await expect(resolvePurchasable({ kind: 'PRODUCT', productId: 'product_1' })).rejects.toThrow(
      CatalogError,
    );
  });

  it('refuses a product that does not exist', async () => {
    await expect(resolvePurchasable({ kind: 'PRODUCT', productId: 'nope' })).rejects.toThrow(
      CatalogError,
    );
  });
});

describe('resolvePurchasable — songs and albums', () => {
  it('refuses a track that is not for sale', async () => {
    prismaMock.song.findUnique.mockResolvedValue({
      id: 'song_1',
      slug: 'track',
      title: 'Track',
      priceCents: 129,
      purchasable: false,
      status: 'PUBLISHED',
      artworkUrl: null,
      artist: { stageName: 'Vega Rain', slug: 'vega-rain' },
    });

    await expect(resolvePurchasable({ kind: 'SONG', refId: 'song_1' })).rejects.toThrow(
      CatalogError,
    );
  });

  it('refuses an unpublished album even when marked purchasable', async () => {
    prismaMock.album.findUnique.mockResolvedValue({
      id: 'album_1',
      slug: 'album',
      title: 'Album',
      priceCents: 999,
      purchasable: true,
      status: 'DRAFT',
      artworkUrl: null,
      artist: { stageName: 'Vega Rain', slug: 'vega-rain' },
    });

    await expect(resolvePurchasable({ kind: 'ALBUM', refId: 'album_1' })).rejects.toThrow(
      CatalogError,
    );
  });

  it('treats digital goods as not requiring shipping', async () => {
    prismaMock.album.findUnique.mockResolvedValue({
      id: 'album_1',
      slug: 'lowlight-hours',
      title: 'Lowlight Hours',
      priceCents: 999,
      purchasable: true,
      status: 'PUBLISHED',
      artworkUrl: null,
      artist: { stageName: 'Vega Rain', slug: 'vega-rain' },
    });

    const line = await resolvePurchasable({ kind: 'ALBUM', refId: 'album_1' });
    expect(line.requiresShipping).toBe(false);
    expect(line.unitPriceCents).toBe(999);
  });
});
