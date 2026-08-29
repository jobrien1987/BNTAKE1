'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { appUrl } from '@/lib/env';
import { slugify } from '@/lib/slug';
import { safeRedirectPath } from '@/lib/utils';
import { hashPassword, verifyPassword, checkPasswordStrength } from '@/server/auth/password';
import {
  createSession,
  destroyAllSessions,
  generateToken,
  hashResetToken,
  clientIp,
} from '@/server/auth/session';
import { rateLimit, RATE_LIMITS } from '@/server/rate-limit';
import { recordAudit } from '@/server/audit';
import { attachCartToUser } from '@/server/services/cart';
import { sendPasswordResetEmail, sendWelcomeEmail } from '@/server/services/email';
import { track } from '@/server/services/analytics';
import { actionError, fromZod, type ActionState } from '@/lib/action-state';

const MAX_FAILED_LOGINS = 8;
const LOCKOUT_MINUTES = 15;
const RESET_TTL_MINUTES = 60;

/** Generic on purpose — never reveals whether an address has an account. */
const BAD_CREDENTIALS = 'That email and password combination did not match.';

const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Tell us your name.').max(80),
    email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, 'Usernames are at least 3 characters.')
      .max(24, 'Usernames are at most 24 characters.')
      .regex(/^[a-z0-9_]+$/, 'Use letters, numbers and underscores only.'),
    password: z.string().min(10, 'Use at least 10 characters.').max(200),
    confirmPassword: z.string(),
    marketingOptIn: z.coerce.boolean().optional().default(false),
    terms: z.literal('on', { errorMap: () => ({ message: 'You must accept the terms.' }) }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ip = await clientIp();
  const limit = await rateLimit(
    `register:${ip ?? 'anon'}`,
    RATE_LIMITS.register.limit,
    RATE_LIMITS.register.windowSeconds,
  );
  if (!limit.allowed) {
    return actionError('Too many sign-up attempts. Please try again later.');
  }

  const parsed = registerSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Please check the highlighted fields.', fromZod(parsed.error.flatten()));
  }

  const { name, email, username, password, marketingOptIn } = parsed.data;

  const strength = checkPasswordStrength(password);
  if (!strength.ok) {
    return actionError('Choose a stronger password.', { password: strength.problems });
  }

  const [emailTaken, usernameTaken] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.user.findUnique({ where: { username }, select: { id: true } }),
  ]);

  if (emailTaken) {
    return actionError('That email is already registered.', {
      email: ['An account already exists for this address. Try signing in.'],
    });
  }
  if (usernameTaken) {
    return actionError('That username is taken.', { username: ['Pick another username.'] });
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      username: slugify(username).replace(/-/g, '_') || username,
      passwordHash: await hashPassword(password),
      marketingOptIn,
      role: 'USER',
    },
    select: { id: true, email: true, name: true },
  });

  await createSession(user.id);
  await attachCartToUser(user.id).catch(() => undefined);

  await Promise.all([
    recordAudit({ actorId: user.id, action: 'user.register', entityType: 'User', entityId: user.id }),
    track({ name: 'signup', userId: user.id, entityType: 'user', entityId: user.id }),
    sendWelcomeEmail(user.email, user.name).catch(() => undefined),
  ]);

  const returnTo = safeRedirectPath(formData.get('returnTo')?.toString() ?? null, '/account');
  redirect(returnTo);
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ip = await clientIp();
  const parsed = loginSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Please check the highlighted fields.', fromZod(parsed.error.flatten()));
  }

  const { email, password } = parsed.data;

  // Two limits: one per address, one per source IP. The first stops an
  // attacker grinding a single account, the second stops address spraying.
  const [byEmail, byIp] = await Promise.all([
    rateLimit(`login:email:${email}`, RATE_LIMITS.login.limit, RATE_LIMITS.login.windowSeconds),
    rateLimit(`login:ip:${ip ?? 'anon'}`, RATE_LIMITS.login.limit * 4, RATE_LIMITS.login.windowSeconds),
  ]);
  if (!byEmail.allowed || !byIp.allowed) {
    return actionError('Too many sign-in attempts. Please wait a few minutes and try again.');
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Still spend time hashing so a missing account is not detectably faster.
    await verifyPassword(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
    return actionError(BAD_CREDENTIALS);
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return actionError('This account is temporarily locked after too many failed attempts.');
  }

  if (user.status === 'BANNED' || user.status === 'SUSPENDED') {
    return actionError('This account is not available. Contact support if you think this is a mistake.');
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    const failedLogins = user.failedLogins + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins,
        lockedUntil:
          failedLogins >= MAX_FAILED_LOGINS
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : null,
      },
    });
    return actionError(BAD_CREDENTIALS);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  await createSession(user.id);
  await attachCartToUser(user.id).catch(() => undefined);
  await recordAudit({ actorId: user.id, action: 'user.login', entityType: 'User', entityId: user.id });

  const returnTo = safeRedirectPath(formData.get('returnTo')?.toString() ?? null, '/account');
  redirect(returnTo);
}

const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
});

/**
 * Always reports success. Confirming which addresses exist would turn this
 * form into an account-enumeration oracle.
 */
export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Enter a valid email address.', fromZod(parsed.error.flatten()));
  }

  const ip = await clientIp();
  const limit = await rateLimit(
    `reset:${ip ?? 'anon'}`,
    RATE_LIMITS.passwordReset.limit,
    RATE_LIMITS.passwordReset.windowSeconds,
  );

  const generic = {
    success: 'If an account exists for that address, a reset link is on its way.',
  } satisfies ActionState;

  if (!limit.allowed) return generic;

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, status: true },
  });

  if (!user || user.status === 'BANNED') return generic;

  const token = generateToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashResetToken(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000),
    },
  });

  const resetUrl = `${appUrl.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
  await sendPasswordResetEmail(user.email, resetUrl).catch((error) => {
    console.error('[auth] failed to send reset email', error);
  });

  return generic;
}

const resetSchema = z
  .object({
    token: z.string().min(10, 'This reset link is not valid.'),
    password: z.string().min(10, 'Use at least 10 characters.').max(200),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Please check the highlighted fields.', fromZod(parsed.error.flatten()));
  }

  const strength = checkPasswordStrength(parsed.data.password);
  if (!strength.ok) {
    return actionError('Choose a stronger password.', { password: strength.problems });
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(parsed.data.token) },
    include: { user: { select: { id: true, email: true } } },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return actionError('This reset link has expired. Request a new one.');
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await hashPassword(parsed.data.password),
        failedLogins: 0,
        lockedUntil: null,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  // A password change invalidates every existing session, including any an
  // attacker may already hold.
  await destroyAllSessions(record.userId);
  await recordAudit({
    actorId: record.userId,
    action: 'user.password_reset',
    entityType: 'User',
    entityId: record.userId,
  });

  redirect('/login?reset=1');
}
