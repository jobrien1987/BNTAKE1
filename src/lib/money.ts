/**
 * All prices in the system are integer cents. Never store or compute money
 * with floating point.
 */

export function formatCents(cents: number | null | undefined, currency = 'usd') {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCentsExact(cents: number | null | undefined, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format((cents ?? 0) / 100);
}

export function applyPercentDiscount(cents: number, percent: number) {
  if (percent <= 0) return cents;
  const bounded = Math.min(Math.max(percent, 0), 100);
  return Math.max(0, Math.round(cents - (cents * bounded) / 100));
}

export function sumCents(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * Flat-rate shipping calculation for V1. Physical orders only.
 * Free shipping threshold and rates live here so a single change updates
 * checkout, cart and order creation consistently.
 */
export const SHIPPING = {
  flatRateCents: 795,
  freeThresholdCents: 10000,
};

export function calculateShippingCents(subtotalCents: number, requiresShipping: boolean) {
  if (!requiresShipping) return 0;
  if (subtotalCents >= SHIPPING.freeThresholdCents) return 0;
  return SHIPPING.flatRateCents;
}

/** V1 does not do automated tax. Stripe Tax can be enabled later. */
export function calculateTaxCents(): number {
  return 0;
}

export interface TotalsInput {
  subtotalCents: number;
  requiresShipping: boolean;
  discountCents?: number;
}

export interface Totals {
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
}

export function calculateTotals({ subtotalCents, requiresShipping, discountCents = 0 }: TotalsInput): Totals {
  const safeSubtotal = Math.max(0, Math.round(subtotalCents));
  const safeDiscount = Math.min(Math.max(0, Math.round(discountCents)), safeSubtotal);
  const discounted = safeSubtotal - safeDiscount;
  const shippingCents = calculateShippingCents(discounted, requiresShipping);
  const taxCents = calculateTaxCents();
  return {
    subtotalCents: safeSubtotal,
    shippingCents,
    taxCents,
    discountCents: safeDiscount,
    totalCents: discounted + shippingCents + taxCents,
  };
}
