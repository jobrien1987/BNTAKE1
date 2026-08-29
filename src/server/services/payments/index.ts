import 'server-only';
import { stripeProvider } from './stripe';
import type { PaymentProvider } from './types';

/** Swap this factory to change processors. Nothing else needs to change. */
export function paymentProvider(): PaymentProvider {
  return stripeProvider;
}

export function paymentsEnabled() {
  return paymentProvider().isConfigured();
}

export * from './types';
