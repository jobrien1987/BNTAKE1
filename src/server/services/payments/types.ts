/**
 * Payment provider abstraction. Stripe is the V1 implementation; everything in
 * the application talks to this interface so another processor can be added
 * without touching commerce logic.
 */

export interface CheckoutLineItem {
  name: string;
  description?: string;
  imageUrl?: string;
  unitAmountCents: number;
  quantity: number;
}

export interface CreateCheckoutInput {
  mode: 'payment' | 'subscription';
  referenceId: string;
  customerEmail?: string;
  customerId?: string | null;
  lineItems?: CheckoutLineItem[];
  priceId?: string;
  successUrl: string;
  cancelUrl: string;
  currency: string;
  metadata: Record<string, string>;
  collectShipping?: boolean;
  idempotencyKey?: string;
}

export interface CheckoutSession {
  id: string;
  url: string;
}

export type ProviderEventType =
  | 'checkout.completed'
  | 'subscription.updated'
  | 'subscription.deleted'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'charge.refunded'
  | 'unhandled';

export interface ProviderEvent {
  id: string;
  type: ProviderEventType;
  rawType: string;
  data: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly id: string;
  isConfigured(): boolean;
  createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession>;
  createBillingPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }>;
  ensureCustomer(params: { email: string; name?: string; userId: string; existingId?: string | null }): Promise<string>;
  parseWebhook(payload: string, signature: string | null): Promise<ProviderEvent>;
}

export class PaymentsNotConfiguredError extends Error {
  constructor() {
    super('Payments are not configured. Set STRIPE_SECRET_KEY to enable checkout.');
    this.name = 'PaymentsNotConfiguredError';
  }
}
