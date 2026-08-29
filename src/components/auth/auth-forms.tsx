'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Field, Input, Checkbox, SubmitButton, FormMessage } from '@/components/ui/form';
import { initialActionState, fieldError } from '@/lib/action-state';
import {
  loginAction,
  registerAction,
  requestPasswordResetAction,
  resetPasswordAction,
} from '@/app/actions/auth';

export function LoginForm({ returnTo, notice }: { returnTo: string; notice?: string | null }) {
  const [state, formAction] = useActionState(loginAction, initialActionState);

  return (
    <form action={formAction} className="space-y-5">
      {notice ? (
        <div
          role="status"
          className="rounded-sm border border-jade/40 bg-jade/10 px-4 py-3 text-sm text-[#8ff0c4]"
        >
          {notice}
        </div>
      ) : null}

      <FormMessage state={state} />
      <input type="hidden" name="returnTo" value={returnTo} />

      <Field label="Email" name="email" error={fieldError(state, 'email')} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </Field>

      <Field label="Password" name="password" error={fieldError(state, 'password')} required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <SubmitButton className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>

      <div className="flex items-center justify-between text-xs text-bone-dim">
        <Link href="/forgot-password" className="hover:text-gold-300">
          Forgot password?
        </Link>
        <Link href="/register" className="hover:text-gold-300">
          Create an account
        </Link>
      </div>
    </form>
  );
}

export function RegisterForm({ returnTo }: { returnTo: string }) {
  const [state, formAction] = useActionState(registerAction, initialActionState);

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />
      <input type="hidden" name="returnTo" value={returnTo} />

      <Field label="Name" name="name" error={fieldError(state, 'name')} required>
        <Input id="name" name="name" autoComplete="name" required placeholder="Your name" />
      </Field>

      <Field
        label="Username"
        name="username"
        hint="Letters, numbers and underscores. This is how the community sees you."
        error={fieldError(state, 'username')}
        required
      >
        <Input id="username" name="username" autoComplete="username" required placeholder="yourname" />
      </Field>

      <Field label="Email" name="email" error={fieldError(state, 'email')} required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field
        label="Password"
        name="password"
        hint="At least 10 characters, with upper and lowercase letters and a number."
        error={fieldError(state, 'password')}
        required
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <Field
        label="Confirm password"
        name="confirmPassword"
        error={fieldError(state, 'confirmPassword')}
        required
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <div className="space-y-3">
        <Checkbox
          name="marketingOptIn"
          value="true"
          label="Email me network news"
          description="Drops, premieres and exclusives. Unsubscribe any time."
        />
        <Checkbox
          name="terms"
          required
          label="I accept the terms and privacy policy"
          description="Required to create an account."
        />
        {fieldError(state, 'terms') ? (
          <p className="text-xs text-[#ffb3b8]">{fieldError(state, 'terms')}</p>
        ) : null}
      </div>

      <SubmitButton className="w-full" pendingLabel="Creating account…">
        Create account
      </SubmitButton>

      <p className="text-center text-xs text-bone-dim">
        Already have an account?{' '}
        <Link href="/login" className="text-gold-400 hover:text-gold-300">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, initialActionState);

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />

      <Field label="Email" name="email" error={fieldError(state, 'email')} required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <SubmitButton className="w-full" pendingLabel="Sending…">
        Send reset link
      </SubmitButton>

      <p className="text-center text-xs text-bone-dim">
        <Link href="/login" className="hover:text-gold-300">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, initialActionState);

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />

      <Field
        label="New password"
        name="password"
        hint="At least 10 characters, with upper and lowercase letters and a number."
        error={fieldError(state, 'password')}
        required
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>

      <Field
        label="Confirm new password"
        name="confirmPassword"
        error={fieldError(state, 'confirmPassword')}
        required
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <SubmitButton className="w-full" pendingLabel="Updating…">
        Update password
      </SubmitButton>
    </form>
  );
}
