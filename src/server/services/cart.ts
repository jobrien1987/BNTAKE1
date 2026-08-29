import 'server-only';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { calculateTotals, type Totals } from '@/lib/money';
import { CART_COOKIE, generateToken } from '@/server/auth/session';
import { getCurrentUser } from '@/server/auth/session';
import { CatalogError, resolvePurchasable, type ResolvedLine } from './catalog';
import type { PurchasableKind } from '@prisma/client';

const CART_TTL_DAYS = 60;

export interface CartLine extends ResolvedLine {
  itemId: string;
  quantity: number;
  lineTotalCents: number;
  /** Set when the requested quantity exceeds live stock. */
  stockWarning: string | null;
}

export interface CartView {
  id: string | null;
  lines: CartLine[];
  totals: Totals;
  itemCount: number;
  requiresShipping: boolean;
  hasIssues: boolean;
  issues: string[];
}

export const EMPTY_CART: CartView = {
  id: null,
  lines: [],
  totals: { subtotalCents: 0, shippingCents: 0, taxCents: 0, discountCents: 0, totalCents: 0 },
  itemCount: 0,
  requiresShipping: false,
  hasIssues: false,
  issues: [],
};

async function readCartToken() {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

/** Read-only cart lookup, safe from server components. */
export async function findCart() {
  const user = await getCurrentUser();
  const token = await readCartToken();

  if (user) {
    const owned = await prisma.cart.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    });
    if (owned) return owned;
  }
  if (!token) return null;
  return prisma.cart.findUnique({ where: { token } });
}

/** Creates the cart and cookie when needed. Only call from actions/handlers. */
export async function ensureCart() {
  const existing = await findCart();
  const user = await getCurrentUser();
  const store = await cookies();

  if (existing) {
    if (user && !existing.userId) {
      await prisma.cart.update({ where: { id: existing.id }, data: { userId: user.id } });
    }
    if (store.get(CART_COOKIE)?.value !== existing.token) {
      store.set(CART_COOKIE, existing.token, cartCookieOptions());
    }
    return existing;
  }

  const token = generateToken();
  const cart = await prisma.cart.create({ data: { token, userId: user?.id ?? null } });
  store.set(CART_COOKIE, token, cartCookieOptions());
  return cart;
}

function cartCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(Date.now() + CART_TTL_DAYS * 24 * 60 * 60 * 1000),
  };
}

/**
 * Builds the cart view by re-pricing every line from the database. Prices are
 * never read from the client or cached in the cart row.
 */
export async function getCartView(): Promise<CartView> {
  const cart = await findCart();
  if (!cart) return EMPTY_CART;

  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    orderBy: { createdAt: 'asc' },
  });

  const lines: CartLine[] = [];
  const issues: string[] = [];

  for (const item of items) {
    try {
      const resolved = await resolvePurchasable({
        kind: item.kind,
        productId: item.productId,
        variantId: item.variantId,
        refId: item.refId,
      });
      // Digital goods are single-quantity by nature.
      const quantity = resolved.requiresShipping ? Math.max(1, item.quantity) : 1;
      const stockWarning =
        resolved.availableInventory != null && quantity > resolved.availableInventory
          ? resolved.availableInventory <= 0
            ? 'Out of stock'
            : `Only ${resolved.availableInventory} left`
          : null;
      if (stockWarning) issues.push(`${resolved.title}: ${stockWarning.toLowerCase()}.`);
      lines.push({
        ...resolved,
        itemId: item.id,
        quantity,
        lineTotalCents: resolved.unitPriceCents * quantity,
        stockWarning,
      });
    } catch (error) {
      const message = error instanceof CatalogError ? error.message : 'An item is unavailable.';
      issues.push(message);
      await prisma.cartItem.delete({ where: { id: item.id } }).catch(() => undefined);
    }
  }

  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const requiresShipping = lines.some((line) => line.requiresShipping);

  return {
    id: cart.id,
    lines,
    totals: calculateTotals({ subtotalCents, requiresShipping }),
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    requiresShipping,
    hasIssues: issues.length > 0,
    issues,
  };
}

export async function getCartCount(): Promise<number> {
  const cart = await findCart();
  if (!cart) return 0;
  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    select: { quantity: true },
  });
  return items.reduce((sum, item) => sum + Math.max(1, item.quantity), 0);
}

export interface AddToCartInput {
  kind: PurchasableKind;
  productId?: string | null;
  variantId?: string | null;
  refId?: string | null;
  quantity?: number;
}

export async function addToCart(input: AddToCartInput) {
  // Validate + price the item before it is ever persisted.
  const resolved = await resolvePurchasable(input);
  const cart = await ensureCart();
  const quantity = resolved.requiresShipping ? Math.max(1, Math.min(input.quantity ?? 1, 25)) : 1;

  if (resolved.availableInventory != null && resolved.availableInventory <= 0) {
    throw new CatalogError('That item is out of stock.');
  }

  const existing = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      kind: resolved.kind,
      productId: resolved.productId,
      variantId: resolved.variantId,
      refId: resolved.refId,
    },
  });

  if (existing) {
    if (!resolved.requiresShipping) return resolved;
    const nextQuantity = Math.min(existing.quantity + quantity, resolved.availableInventory ?? 25);
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: nextQuantity } });
    return resolved;
  }

  await prisma.cartItem.create({
    data: {
      cartId: cart.id,
      kind: resolved.kind,
      productId: resolved.productId,
      variantId: resolved.variantId,
      refId: resolved.refId,
      quantity,
    },
  });

  return resolved;
}

export async function updateCartItemQuantity(itemId: string, quantity: number) {
  const cart = await findCart();
  if (!cart) throw new CatalogError('Your cart is empty.');
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
  if (!item) throw new CatalogError('That item is no longer in your cart.');

  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    return;
  }

  const resolved = await resolvePurchasable({
    kind: item.kind,
    productId: item.productId,
    variantId: item.variantId,
    refId: item.refId,
  });
  const max = resolved.availableInventory ?? 25;
  await prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity: Math.max(1, Math.min(quantity, max)) },
  });
}

export async function removeCartItem(itemId: string) {
  const cart = await findCart();
  if (!cart) return;
  await prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
}

export async function clearCart(cartId: string) {
  await prisma.cartItem.deleteMany({ where: { cartId } });
}

/** Called after login/registration so a guest cart follows the user in. */
export async function attachCartToUser(userId: string) {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token) return;
  const guestCart = await prisma.cart.findUnique({
    where: { token },
    include: { items: true },
  });
  if (!guestCart || guestCart.userId === userId) return;

  const userCart = await prisma.cart.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: { items: true },
  });

  if (!userCart) {
    await prisma.cart.update({ where: { id: guestCart.id }, data: { userId } });
    return;
  }

  for (const item of guestCart.items) {
    const duplicate = userCart.items.find(
      (existing) =>
        existing.kind === item.kind &&
        existing.productId === item.productId &&
        existing.variantId === item.variantId &&
        existing.refId === item.refId,
    );
    if (duplicate) {
      await prisma.cartItem.update({
        where: { id: duplicate.id },
        data: { quantity: Math.min(duplicate.quantity + item.quantity, 25) },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: userCart.id,
          kind: item.kind,
          productId: item.productId,
          variantId: item.variantId,
          refId: item.refId,
          quantity: item.quantity,
        },
      });
    }
  }

  await prisma.cart.delete({ where: { id: guestCart.id } });
  (await cookies()).set(CART_COOKIE, userCart.token, cartCookieOptions());
}
