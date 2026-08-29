'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { assertPermission } from '@/server/auth/guards';
import { slugify } from '@/lib/slug';
import { recordAudit } from '@/server/audit';
import { updateSettings } from '@/server/services/settings';
import { actionError, fromZod, type ActionState } from '@/lib/action-state';

const productSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2, 'Enter a title.').max(160),
  description: z.string().trim().max(4000).optional(),
  sku: z.string().trim().max(64).optional(),
  categoryId: z.string().optional(),
  priceCents: z.coerce.number().int().min(0, 'Price cannot be negative.').max(1_000_000),
  salePriceCents: z.coerce.number().int().min(0).max(1_000_000).optional(),
  inventory: z.coerce.number().int().min(0).max(1_000_000).default(0),
  trackInventory: z.coerce.boolean().optional().default(true),
  requiresShipping: z.coerce.boolean().optional().default(true),
  isDigital: z.coerce.boolean().optional().default(false),
  digitalAssetUrl: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
  active: z.coerce.boolean().optional().default(true),
  featured: z.coerce.boolean().optional().default(false),
  imageUrl: z.string().url('Enter a valid image URL.').optional().or(z.literal('')),
});

export async function saveProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertPermission('shop.write');

  const parsed = productSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Please check the highlighted fields.', fromZod(parsed.error.flatten()));
  }

  if (
    parsed.data.salePriceCents &&
    parsed.data.salePriceCents >= parsed.data.priceCents
  ) {
    return actionError('The sale price must be lower than the regular price.', {
      salePriceCents: ['Must be below the regular price.'],
    });
  }

  if (parsed.data.isDigital && !parsed.data.digitalAssetUrl) {
    return actionError('Digital products need a download URL.', {
      digitalAssetUrl: ['Required for digital products.'],
    });
  }

  const data = {
    title: parsed.data.title,
    description: parsed.data.description || null,
    sku: parsed.data.sku || null,
    categoryId: parsed.data.categoryId || null,
    priceCents: parsed.data.priceCents,
    salePriceCents: parsed.data.salePriceCents || null,
    inventory: parsed.data.inventory,
    trackInventory: parsed.data.trackInventory,
    // Digital goods never ship, whatever the form said.
    requiresShipping: parsed.data.isDigital ? false : parsed.data.requiresShipping,
    isDigital: parsed.data.isDigital,
    digitalAssetUrl: parsed.data.digitalAssetUrl || null,
    active: parsed.data.active,
    featured: parsed.data.featured,
  };

  let productId = parsed.data.id ?? null;

  if (productId) {
    await prisma.product.update({ where: { id: productId }, data });
  } else {
    const base = slugify(parsed.data.title) || 'product';
    const taken = await prisma.product.findUnique({ where: { slug: base }, select: { id: true } });
    const slug = taken ? `${base}-${Math.random().toString(36).slice(2, 7)}` : base;

    const created = await prisma.product.create({
      data: { ...data, slug, createdById: user.id },
    });
    productId = created.id;
  }

  if (parsed.data.imageUrl && productId) {
    const existingImage = await prisma.productImage.findFirst({
      where: { productId },
      orderBy: { position: 'asc' },
    });

    if (existingImage) {
      await prisma.productImage.update({
        where: { id: existingImage.id },
        data: { url: parsed.data.imageUrl, altText: parsed.data.title },
      });
    } else {
      await prisma.productImage.create({
        data: { productId, url: parsed.data.imageUrl, altText: parsed.data.title, position: 0 },
      });
    }
  }

  await recordAudit({
    actorId: user.id,
    action: parsed.data.id ? 'product.update' : 'product.create',
    entityType: 'Product',
    entityId: productId,
  });

  revalidatePath('/shop');
  revalidatePath('/admin/products');
  return { success: `Saved “${parsed.data.title}”.` };
}

const orderStatusSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(['PENDING', 'PAID', 'FULFILLED', 'CANCELED']),
  notes: z.string().trim().max(500).optional(),
});

export async function updateOrderStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertPermission('orders.write');

  const parsed = orderStatusSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return actionError('Invalid order update.');

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    select: { id: true, status: true, orderNumber: true },
  });
  if (!order) return actionError('That order no longer exists.');

  // Payment state is owned by the webhook. Staff can only move an order
  // forward through fulfilment or cancel it — never mark it paid by hand.
  if (parsed.data.status === 'PAID' && order.status !== 'PAID') {
    return actionError(
      'Orders are marked paid by the payment processor, not by hand. Check the webhook log if a payment is missing.',
    );
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: parsed.data.status,
      notes: parsed.data.notes || undefined,
      fulfilledAt: parsed.data.status === 'FULFILLED' ? new Date() : undefined,
      canceledAt: parsed.data.status === 'CANCELED' ? new Date() : undefined,
    },
  });

  await recordAudit({
    actorId: user.id,
    action: 'order.status_change',
    entityType: 'Order',
    entityId: order.id,
    metadata: { from: order.status, to: parsed.data.status },
  });

  revalidatePath('/admin/orders');
  return { success: `Order ${order.orderNumber} is now ${parsed.data.status}.` };
}

const planSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(160).optional(),
  priceCents: z.coerce.number().int().min(0).max(1_000_000),
  stripePriceId: z.string().trim().max(120).optional(),
  active: z.coerce.boolean().optional().default(true),
  visible: z.coerce.boolean().optional().default(true),
  memberContentAccess: z.coerce.boolean().optional().default(false),
  earlyAccess: z.coerce.boolean().optional().default(false),
  adFree: z.coerce.boolean().optional().default(false),
  shopDiscountPercent: z.coerce.number().int().min(0).max(100).default(0),
  canUploadMusic: z.coerce.boolean().optional().default(false),
  canSellMerch: z.coerce.boolean().optional().default(false),
  canGoLive: z.coerce.boolean().optional().default(false),
  advancedAnalytics: z.coerce.boolean().optional().default(false),
  perks: z.string().optional(),
});

/**
 * Plan pricing and capabilities are configuration, never constants in code.
 * Everything a plan unlocks is stored on the row and read at request time.
 */
export async function savePlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertPermission('memberships.manage');

  const parsed = planSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Please check the highlighted fields.', fromZod(parsed.error.flatten()));
  }

  if (parsed.data.priceCents > 0 && !parsed.data.stripePriceId) {
    return actionError('A paid plan needs a Stripe price ID before it can be sold.', {
      stripePriceId: ['Required for paid plans.'],
    });
  }

  const perks = (parsed.data.perks ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

  await prisma.plan.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      tagline: parsed.data.tagline || null,
      priceCents: parsed.data.priceCents,
      stripePriceId: parsed.data.stripePriceId || null,
      active: parsed.data.active,
      visible: parsed.data.visible,
      memberContentAccess: parsed.data.memberContentAccess,
      earlyAccess: parsed.data.earlyAccess,
      adFree: parsed.data.adFree,
      shopDiscountPercent: parsed.data.shopDiscountPercent,
      canUploadMusic: parsed.data.canUploadMusic,
      canSellMerch: parsed.data.canSellMerch,
      canGoLive: parsed.data.canGoLive,
      advancedAnalytics: parsed.data.advancedAnalytics,
      perks,
    },
  });

  await recordAudit({
    actorId: user.id,
    action: 'plan.update',
    entityType: 'Plan',
    entityId: parsed.data.id,
    metadata: { priceCents: parsed.data.priceCents },
  });

  revalidatePath('/membership');
  revalidatePath('/admin/memberships');
  return { success: `Saved ${parsed.data.name}.` };
}

const settingsSchema = z.object({
  siteName: z.string().trim().min(1).max(80),
  tagline: z.string().trim().max(200),
  supportEmail: z.string().trim().email('Enter a valid email address.').or(z.literal('')),
  instagramUrl: z.string().trim().max(300),
  twitterUrl: z.string().trim().max(300),
  youtubeUrl: z.string().trim().max(300),
  tiktokUrl: z.string().trim().max(300),
  announcementText: z.string().trim().max(300),
  announcementHref: z.string().trim().max(300),
  announcementEnabled: z.coerce.boolean().optional().default(false),
  communityEnabled: z.coerce.boolean().optional().default(true),
  donationsEnabled: z.coerce.boolean().optional().default(false),
  radioStationSlug: z.string().trim().max(120),
});

export async function saveSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertPermission('settings.write');

  const parsed = settingsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Please check the highlighted fields.', fromZod(parsed.error.flatten()));
  }

  await updateSettings(parsed.data);

  await recordAudit({
    actorId: user.id,
    action: 'settings.update',
    entityType: 'SiteSetting',
    entityId: null,
  });

  revalidatePath('/', 'layout');
  revalidatePath('/admin/settings');
  return { success: 'Settings saved.' };
}
