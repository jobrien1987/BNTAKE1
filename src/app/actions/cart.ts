'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  addToCart,
  getCartView,
  removeCartItem,
  updateCartItemQuantity,
} from '@/server/services/cart';
import { CatalogError } from '@/server/services/catalog';
import { startCheckout } from '@/server/services/checkout';
import { PaymentsNotConfiguredError } from '@/server/services/payments';
import { getCurrentUser, clientIp } from '@/server/auth/session';
import { rateLimit, RATE_LIMITS } from '@/server/rate-limit';
import { track } from '@/server/services/analytics';
import type { ActionState } from '@/lib/action-state';

const addSchema = z.object({
  kind: z.enum(['PRODUCT', 'DIGITAL_PRODUCT', 'SONG', 'ALBUM', 'VIDEO']),
  productId: z.string().optional().nullable(),
  variantId: z.string().optional().nullable(),
  refId: z.string().optional().nullable(),
  quantity: z.coerce.number().int().min(1).max(25).default(1),
});

export async function addToCartAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = addSchema.safeParse({
    kind: formData.get('kind'),
    productId: formData.get('productId') || null,
    variantId: formData.get('variantId') || null,
    refId: formData.get('refId') || null,
    quantity: formData.get('quantity') ?? 1,
  });

  if (!parsed.success) return { error: 'That item could not be added.' };

  try {
    const resolved = await addToCart(parsed.data);
    const user = await getCurrentUser();
    await track({
      name: 'add_to_cart',
      userId: user?.id ?? null,
      entityType: parsed.data.kind.toLowerCase(),
      entityId: resolved.refId,
      metadata: { unitPriceCents: resolved.unitPriceCents, quantity: parsed.data.quantity },
    });
    revalidatePath('/cart');
    revalidatePath('/', 'layout');
    return { success: 'Added to cart.' };
  } catch (error) {
    if (error instanceof CatalogError) return { error: error.message };
    console.error('[cart] add failed', error);
    return { error: 'We couldn’t add that item. Please try again.' };
  }
}

export async function updateCartItemAction(formData: FormData) {
  const itemId = String(formData.get('itemId') ?? '');
  const quantity = Number(formData.get('quantity') ?? 1);
  if (!itemId) return;
  try {
    await updateCartItemQuantity(itemId, quantity);
  } catch (error) {
    console.error('[cart] update failed', error);
  }
  revalidatePath('/cart');
  revalidatePath('/', 'layout');
}

export async function removeCartItemAction(formData: FormData) {
  const itemId = String(formData.get('itemId') ?? '');
  if (!itemId) return;
  await removeCartItem(itemId);
  revalidatePath('/cart');
  revalidatePath('/', 'layout');
}

const checkoutSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  name: z.string().max(120).optional(),
  line1: z.string().max(160).optional(),
  line2: z.string().max(160).optional(),
  city: z.string().max(80).optional(),
  state: z.string().max(80).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(2).optional(),
});

export async function startCheckoutAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  const ip = await clientIp();
  const limit = await rateLimit(
    `checkout:${user?.id ?? ip ?? 'anon'}`,
    RATE_LIMITS.checkout.limit,
    RATE_LIMITS.checkout.windowSeconds,
  );
  if (!limit.allowed) {
    return { error: `Too many checkout attempts. Try again in ${limit.retryAfterSeconds}s.` };
  }

  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      error: 'Please check the highlighted fields.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const cart = await getCartView();
  if (cart.lines.length === 0) return { error: 'Your cart is empty.' };

  let redirectUrl: string;
  try {
    const result = await startCheckout({
      user,
      email: parsed.data.email,
      shipping: cart.requiresShipping
        ? {
            name: parsed.data.name,
            line1: parsed.data.line1,
            line2: parsed.data.line2,
            city: parsed.data.city,
            state: parsed.data.state,
            postalCode: parsed.data.postalCode,
            country: parsed.data.country || 'US',
          }
        : null,
    });
    redirectUrl = result.redirectUrl;
  } catch (error) {
    if (error instanceof PaymentsNotConfiguredError) {
      return { error: 'Checkout is not available yet — payments have not been configured.' };
    }
    console.error('[checkout] failed to start', error);
    return { error: error instanceof Error ? error.message : 'Checkout could not be started.' };
  }

  redirect(redirectUrl);
}
