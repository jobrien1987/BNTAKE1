'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getCurrentUser, clientIp } from '@/server/auth/session';
import { rateLimit } from '@/server/rate-limit';
import {
  startDonationCheckout,
  DonationError,
  DONATION_MIN_CENTS,
  DONATION_MAX_CENTS,
} from '@/server/services/donations';
import { PaymentsNotConfiguredError } from '@/server/services/payments';
import { actionError, fromZod, type ActionState } from '@/lib/action-state';

const schema = z.object({
  campaignId: z.string().min(1),
  amount: z.coerce
    .number()
    .min(DONATION_MIN_CENTS / 100, 'Minimum donation is $1.')
    .max(DONATION_MAX_CENTS / 100, 'Maximum donation is $10,000.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  anonymous: z.coerce.boolean().optional().default(false),
  message: z.string().trim().max(200).optional(),
});

export async function donateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const ip = await clientIp();

  const limit = await rateLimit(`donate:${user?.id ?? ip ?? 'anon'}`, 10, 10 * 60);
  if (!limit.allowed) {
    return actionError('Too many attempts. Please wait a moment and try again.');
  }

  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Please check the highlighted fields.', fromZod(parsed.error.flatten()));
  }

  let redirectUrl: string;
  try {
    const result = await startDonationCheckout({
      campaignId: parsed.data.campaignId,
      // Converted to integer cents here so no float ever reaches the processor.
      amountCents: Math.round(parsed.data.amount * 100),
      email: parsed.data.email,
      user,
      anonymous: parsed.data.anonymous,
      message: parsed.data.message ?? null,
    });
    redirectUrl = result.redirectUrl;
  } catch (error) {
    if (error instanceof PaymentsNotConfiguredError) {
      return actionError('Donations are unavailable — payments have not been configured.');
    }
    if (error instanceof DonationError) return actionError(error.message);
    console.error('[heartfelt] donation checkout failed', error);
    return actionError('Your donation could not be started. Please try again.');
  }

  redirect(redirectUrl);
}
