'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { assertUser } from '@/server/auth/guards';
import { destroyAllSessions, destroySession } from '@/server/auth/session';
import { hashPassword, verifyPassword, checkPasswordStrength } from '@/server/auth/password';
import { markAllRead, markRead } from '@/server/services/notifications';
import { getActiveSubscription, openBillingPortal, startSubscriptionCheckout } from '@/server/services/subscriptions';
import { PaymentsNotConfiguredError } from '@/server/services/payments';
import { recordAudit } from '@/server/audit';
import { actionError, fromZod, type ActionState } from '@/lib/action-state';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Tell us your name.').max(80),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Usernames are at least 3 characters.')
    .max(24)
    .regex(/^[a-z0-9_]+$/, 'Use letters, numbers and underscores only.'),
  bio: z.string().trim().max(500, 'Keep your bio under 500 characters.').optional(),
  location: z.string().trim().max(80).optional(),
  avatarUrl: z.string().url('Enter a valid image URL.').optional().or(z.literal('')),
  bannerUrl: z.string().url('Enter a valid image URL.').optional().or(z.literal('')),
});

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertUser();

  const parsed = profileSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Please check the highlighted fields.', fromZod(parsed.error.flatten()));
  }

  if (parsed.data.username !== user.username) {
    const taken = await prisma.user.findUnique({
      where: { username: parsed.data.username },
      select: { id: true },
    });
    if (taken) return actionError('That username is taken.', { username: ['Pick another one.'] });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name,
      username: parsed.data.username,
      bio: parsed.data.bio || null,
      location: parsed.data.location || null,
      avatarUrl: parsed.data.avatarUrl || null,
      bannerUrl: parsed.data.bannerUrl || null,
    },
  });

  revalidatePath('/account/profile');
  revalidatePath('/', 'layout');
  return { success: 'Profile updated.' };
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    password: z.string().min(10, 'Use at least 10 characters.').max(200),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessionUser = await assertUser();

  const parsed = passwordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Please check the highlighted fields.', fromZod(parsed.error.flatten()));
  }

  const record = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { passwordHash: true },
  });
  if (!record) return actionError('Something went wrong.');

  const valid = await verifyPassword(parsed.data.currentPassword, record.passwordHash);
  if (!valid) {
    return actionError('That password is not correct.', {
      currentPassword: ['Incorrect password.'],
    });
  }

  const strength = checkPasswordStrength(parsed.data.password);
  if (!strength.ok) return actionError('Choose a stronger password.', { password: strength.problems });

  await prisma.user.update({
    where: { id: sessionUser.id },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });

  await recordAudit({
    actorId: sessionUser.id,
    action: 'user.password_change',
    entityType: 'User',
    entityId: sessionUser.id,
  });

  // Every other device is signed out; this one gets a fresh session below.
  await destroyAllSessions(sessionUser.id);

  redirect('/login?reset=1');
}

const preferencesSchema = z.object({
  marketingOptIn: z.coerce.boolean().optional().default(false),
});

export async function updatePreferencesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertUser();
  const parsed = preferencesSchema.safeParse({
    marketingOptIn: formData.get('marketingOptIn') ?? false,
  });
  if (!parsed.success) return actionError('Could not save your preferences.');

  await prisma.user.update({
    where: { id: user.id },
    data: { marketingOptIn: parsed.data.marketingOptIn },
  });

  revalidatePath('/account/settings');
  return { success: 'Preferences saved.' };
}

export async function signOutEverywhereAction() {
  const user = await assertUser();
  await destroyAllSessions(user.id);
  await destroySession();
  redirect('/login');
}

export async function markNotificationReadAction(formData: FormData) {
  const user = await assertUser();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await markRead(user.id, id);
  revalidatePath('/account/notifications');
}

export async function markAllNotificationsReadAction() {
  const user = await assertUser();
  await markAllRead(user.id);
  revalidatePath('/account/notifications');
}

export async function startMembershipCheckoutAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertUser();
  const planId = String(formData.get('planId') ?? '');
  if (!planId) return actionError('Choose a plan first.');

  let redirectUrl: string;
  try {
    redirectUrl = await startSubscriptionCheckout(user, planId);
  } catch (error) {
    if (error instanceof PaymentsNotConfiguredError) {
      return actionError('Memberships are unavailable — payments have not been configured.');
    }
    console.error('[membership] checkout failed', error);
    return actionError(
      error instanceof Error ? error.message : 'Membership checkout could not be started.',
    );
  }

  redirect(redirectUrl);
}

export async function openBillingPortalAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const user = await assertUser();

  const subscription = await getActiveSubscription(user.id);
  if (!subscription) return actionError('You do not have an active membership to manage.');

  let url: string;
  try {
    url = await openBillingPortal(user.id, '/account/membership');
  } catch (error) {
    if (error instanceof PaymentsNotConfiguredError) {
      return actionError('Billing management is unavailable — payments are not configured.');
    }
    console.error('[membership] portal failed', error);
    return actionError('The billing portal could not be opened.');
  }

  redirect(url);
}
