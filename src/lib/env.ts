/**
 * Centralised, validated environment access.
 * Server secrets are only read from server code — nothing here is exported
 * through a NEXT_PUBLIC_ variable unless it is genuinely public.
 */
import { z } from 'zod';

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(16).optional(),
  APP_URL: z.string().url().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_CURRENCY: z.string().default('usd'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),
  EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
  EMAIL_FROM: z.string().default('Boosie Network <no-reply@boosienetwork.com>'),
  RESEND_API_KEY: z.string().optional(),
  LIVE_PROVIDER: z.enum(['none', 'external']).default('none'),
  FEATURE_LIVE_ENABLED: z.string().optional(),
  RADIO_DEFAULT_STREAM_URL: z.string().optional(),
});

const parsed = serverSchema.safeParse(process.env);

const raw = parsed.success ? parsed.data : ({} as z.infer<typeof serverSchema>);

const bool = (v: string | undefined, fallback = false) =>
  v === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());

export const env = {
  ...raw,
  STRIPE_CURRENCY: raw.STRIPE_CURRENCY ?? 'usd',
  S3_REGION: raw.S3_REGION ?? 'auto',
  EMAIL_PROVIDER: raw.EMAIL_PROVIDER ?? 'console',
  EMAIL_FROM: raw.EMAIL_FROM ?? 'Boosie Network <no-reply@boosienetwork.com>',
  LIVE_PROVIDER: raw.LIVE_PROVIDER ?? 'none',
  S3_FORCE_PATH_STYLE: bool(raw.S3_FORCE_PATH_STYLE, true),
  FEATURE_LIVE_ENABLED: bool(raw.FEATURE_LIVE_ENABLED, true),
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',
};

/** Public site origin, safe on client and server. */
export const appUrl =
  process.env.NEXT_PUBLIC_APP_URL || raw.APP_URL || 'http://localhost:3000';

export const flags = {
  stripeEnabled: Boolean(raw.STRIPE_SECRET_KEY),
  stripeWebhookConfigured: Boolean(raw.STRIPE_WEBHOOK_SECRET),
  storageRemote: Boolean(raw.S3_BUCKET && raw.S3_ACCESS_KEY_ID && raw.S3_SECRET_ACCESS_KEY),
  emailConfigured: raw.EMAIL_PROVIDER === 'resend' ? Boolean(raw.RESEND_API_KEY) : false,
  liveEnabled: bool(raw.FEATURE_LIVE_ENABLED, true),
  liveProviderConfigured: (raw.LIVE_PROVIDER ?? 'none') !== 'none',
};

export function requireEnv(name: keyof typeof raw): string {
  const value = raw[name];
  if (!value || typeof value !== 'string') {
    throw new Error(`Missing required environment variable: ${String(name)}`);
  }
  return value;
}
