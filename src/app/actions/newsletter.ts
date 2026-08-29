'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/server/rate-limit';
import { clientIp } from '@/server/auth/session';
import { track } from '@/server/services/analytics';
import type { ActionState } from '@/lib/action-state';

const schema = z.object({ email: z.string().email('Enter a valid email address.') });

/**
 * Marketing opt-in. Stored on the user record when the address already has an
 * account, and recorded as an analytics event either way, so no list data is
 * silently dropped on the floor.
 */
export async function subscribeToNewsletter(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = schema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { error: 'Enter a valid email address.' };

  const ip = await clientIp();
  const limit = await rateLimit(`newsletter:${ip ?? 'anon'}`, 10, 60 * 60);
  if (!limit.allowed) return { error: 'Too many attempts. Try again later.' };

  const email = parsed.data.email.toLowerCase();

  await prisma.user
    .updateMany({ where: { email }, data: { marketingOptIn: true } })
    .catch(() => undefined);

  await track({ name: 'follow', entityType: 'newsletter', entityId: email });

  return { success: 'You’re on the list.' };
}
