import { describe, it, expect } from 'vitest';
import {
  formatCents,
  applyPercentDiscount,
  sumCents,
  calculateShippingCents,
  calculateTotals,
  SHIPPING,
} from '@/lib/money';

describe('formatCents', () => {
  it('formats whole and partial dollars', () => {
    expect(formatCents(0)).toContain('0');
    expect(formatCents(1299)).toContain('12.99');
  });

  it('handles null and undefined without throwing', () => {
    expect(() => formatCents(null)).not.toThrow();
    expect(() => formatCents(undefined)).not.toThrow();
  });
});

describe('applyPercentDiscount', () => {
  it('applies a percentage and returns whole cents', () => {
    const result = applyPercentDiscount(1000, 15);
    expect(result).toBe(850);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('never returns a fractional cent', () => {
    // 999 * 0.85 = 849.15 — must not leak a float into a money field.
    const result = applyPercentDiscount(999, 15);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('ignores a zero discount', () => {
    expect(applyPercentDiscount(2500, 0)).toBe(2500);
  });
});

describe('sumCents', () => {
  it('sums to an integer', () => {
    expect(sumCents([100, 250, 399])).toBe(749);
    expect(sumCents([])).toBe(0);
  });
});

describe('shipping', () => {
  it('charges the flat rate below the free threshold', () => {
    expect(calculateShippingCents(5000, true)).toBe(SHIPPING.flatRateCents);
  });

  it('is free at and above the threshold', () => {
    expect(calculateShippingCents(SHIPPING.freeThresholdCents, true)).toBe(0);
    expect(calculateShippingCents(SHIPPING.freeThresholdCents + 1, true)).toBe(0);
  });

  it('charges nothing for a digital-only cart', () => {
    expect(calculateShippingCents(5000, false)).toBe(0);
  });
});

describe('calculateTotals', () => {
  it('adds shipping to a physical order below the threshold', () => {
    const totals = calculateTotals({ subtotalCents: 3500, requiresShipping: true });
    expect(totals.subtotalCents).toBe(3500);
    expect(totals.shippingCents).toBe(SHIPPING.flatRateCents);
    expect(totals.totalCents).toBe(3500 + SHIPPING.flatRateCents);
  });

  it('never lets a discount push the total below zero', () => {
    const totals = calculateTotals({
      subtotalCents: 1000,
      requiresShipping: false,
      discountCents: 99999,
    });
    expect(totals.discountCents).toBe(1000);
    expect(totals.totalCents).toBe(0);
    expect(totals.totalCents).toBeGreaterThanOrEqual(0);
  });

  it('ignores a negative subtotal rather than producing negative money', () => {
    const totals = calculateTotals({ subtotalCents: -500, requiresShipping: false });
    expect(totals.subtotalCents).toBe(0);
    expect(totals.totalCents).toBe(0);
  });

  it('applies the discount before deciding on free shipping', () => {
    // Subtotal clears the threshold, but not after a discount is applied, so
    // shipping must be charged.
    const totals = calculateTotals({
      subtotalCents: SHIPPING.freeThresholdCents + 500,
      requiresShipping: true,
      discountCents: 1000,
    });
    expect(totals.shippingCents).toBe(SHIPPING.flatRateCents);
  });

  it('returns only integer cents', () => {
    const totals = calculateTotals({
      subtotalCents: 1234.6,
      requiresShipping: true,
      discountCents: 11.4,
    });
    for (const value of Object.values(totals)) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});
