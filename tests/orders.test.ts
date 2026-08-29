import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  order: { create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
};

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/server/services/analytics', () => ({ track: vi.fn() }));
vi.mock('@/server/services/notifications', () => ({ notify: vi.fn() }));
vi.mock('@/server/services/email', () => ({ sendOrderReceiptEmail: vi.fn() }));
vi.mock('@/server/audit', () => ({ recordAudit: vi.fn() }));
vi.mock('@/server/services/entitlements', () => ({ grantEntitlementsForOrderItems: vi.fn() }));

const { generateOrderNumber, createPendingOrder, markOrderRefunded } = await import(
  '@/server/services/orders'
);

function line(overrides: Record<string, unknown> = {}) {
  return {
    itemId: 'item_1',
    kind: 'PRODUCT',
    refId: 'product_1',
    productId: 'product_1',
    variantId: null,
    title: 'Tour Tee',
    variantLabel: 'Large',
    imageUrl: 'https://example.com/tee.jpg',
    sku: 'tee-l',
    unitPriceCents: 3500,
    quantity: 2,
    lineTotalCents: 7000,
    requiresShipping: true,
    availableInventory: 10,
    stockWarning: null,
    href: '/shop/tour-tee',
    ...overrides,
  };
}

function cart(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cart_1',
    lines: [line()],
    totals: {
      subtotalCents: 7000,
      shippingCents: 795,
      taxCents: 0,
      discountCents: 0,
      totalCents: 7795,
    },
    itemCount: 2,
    requiresShipping: true,
    hasIssues: false,
    issues: [],
    ...overrides,
  };
}

beforeEach(() => {
  prismaMock.order.create.mockReset().mockImplementation(({ data }) => ({ id: 'order_1', ...data }));
  prismaMock.order.findFirst.mockReset().mockResolvedValue(null);
  prismaMock.order.update.mockReset().mockImplementation(({ data }) => ({ id: 'order_1', ...data }));
});

describe('generateOrderNumber', () => {
  it('uses the documented BN-YYYYMMDD-XXXXXX shape', () => {
    expect(generateOrderNumber()).toMatch(/^BN-\d{8}-[A-Z0-9]{6}$/);
  });

  it('does not collide across many calls', () => {
    const numbers = new Set(Array.from({ length: 500 }, () => generateOrderNumber()));
    expect(numbers.size).toBe(500);
  });
});

describe('createPendingOrder', () => {
  it('refuses to create an order from an empty cart', async () => {
    await expect(
      createPendingOrder({ cart: cart({ lines: [] }) as never, userId: null, email: 'a@b.com' }),
    ).rejects.toThrow();
  });

  it('starts every order as PENDING so payment decides the rest', async () => {
    await createPendingOrder({ cart: cart() as never, userId: 'user_1', email: 'A@B.com' });
    const data = prismaMock.order.create.mock.calls[0][0].data;
    expect(data.status).toBe('PENDING');
  });

  it('normalises the email to lowercase', async () => {
    await createPendingOrder({ cart: cart() as never, userId: null, email: 'Mixed@Case.COM' });
    const data = prismaMock.order.create.mock.calls[0][0].data;
    expect(data.email).toBe('mixed@case.com');
  });

  // Item snapshots are what stop a later price or title edit from rewriting
  // somebody's receipt.
  it('snapshots title, price and image onto each item', async () => {
    await createPendingOrder({ cart: cart() as never, userId: 'user_1', email: 'a@b.com' });
    const item = prismaMock.order.create.mock.calls[0][0].data.items.create[0];

    expect(item.titleSnapshot).toBe('Tour Tee');
    expect(item.variantSnapshot).toBe('Large');
    expect(item.imageSnapshot).toBe('https://example.com/tee.jpg');
    expect(item.unitPriceCents).toBe(3500);
    expect(item.quantity).toBe(2);
    expect(item.totalCents).toBe(7000);
  });

  it('recomputes totals server-side rather than trusting the cart object', async () => {
    // The cart claims a nonsense total; the order must ignore it.
    const lying = cart({
      totals: {
        subtotalCents: 1,
        shippingCents: 0,
        taxCents: 0,
        discountCents: 0,
        totalCents: 1,
      },
    });

    await createPendingOrder({ cart: lying as never, userId: null, email: 'a@b.com' });
    const data = prismaMock.order.create.mock.calls[0][0].data;

    expect(data.subtotalCents).toBe(7000);
    expect(data.totalCents).toBe(7000 + 795);
  });

  it('charges no shipping for a digital-only cart', async () => {
    const digital = cart({
      lines: [line({ requiresShipping: false, lineTotalCents: 999, unitPriceCents: 999, quantity: 1 })],
      requiresShipping: false,
    });

    await createPendingOrder({ cart: digital as never, userId: null, email: 'a@b.com' });
    const data = prismaMock.order.create.mock.calls[0][0].data;

    expect(data.shippingCents).toBe(0);
    expect(data.totalCents).toBe(999);
  });
});

describe('markOrderRefunded', () => {
  it('marks a full refund as REFUNDED', async () => {
    prismaMock.order.findFirst.mockResolvedValue({ id: 'order_1', totalCents: 5000 });
    await markOrderRefunded('pi_1', 5000);
    expect(prismaMock.order.update.mock.calls[0][0].data.status).toBe('REFUNDED');
  });

  it('marks a partial refund as PARTIALLY_REFUNDED', async () => {
    prismaMock.order.findFirst.mockResolvedValue({ id: 'order_1', totalCents: 5000 });
    await markOrderRefunded('pi_1', 1000);
    expect(prismaMock.order.update.mock.calls[0][0].data.status).toBe('PARTIALLY_REFUNDED');
  });

  it('does nothing for an unknown payment reference', async () => {
    prismaMock.order.findFirst.mockResolvedValue(null);
    await expect(markOrderRefunded('pi_missing', 100)).resolves.toBeNull();
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });
});
