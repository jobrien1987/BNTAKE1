'use client';

import { useActionState } from 'react';
import {
  changePasswordAction,
  updatePreferencesAction,
  signOutEverywhereAction,
} from '@/app/actions/account';
import { Field, Input, Checkbox, SubmitButton, FormMessage } from '@/components/ui/form';
import { initialActionState, fieldError } from '@/lib/action-state';

export function PasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, initialActionState);

  return (
    <form action={formAction} className="max-w-md space-y-5">
      <FormMessage state={state} />

      <Field
        label="Current password"
        name="currentPassword"
        error={fieldError(state, 'currentPassword')}
        required
      >
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

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

      <p className="text-xs text-bone-dim">
        Changing your password signs you out on every device, including this one.
      </p>

      <SubmitButton pendingLabel="Updating…">Change password</SubmitButton>
    </form>
  );
}

export function PreferencesForm({ marketingOptIn }: { marketingOptIn: boolean }) {
  const [state, formAction] = useActionState(updatePreferencesAction, initialActionState);

  return (
    <form action={formAction} className="max-w-md space-y-5">
      <FormMessage state={state} />

      <Checkbox
        name="marketingOptIn"
        value="true"
        defaultChecked={marketingOptIn}
        label="Email me network news"
        description="Drops, premieres and exclusives. Account and order emails are always sent."
      />

      <SubmitButton pendingLabel="Saving…">Save preferences</SubmitButton>
    </form>
  );
}

export function SignOutEverywhereForm() {
  return (
    <form action={signOutEverywhereAction}>
      <SubmitButton variant="outline" pendingLabel="Signing out…">
        Sign out on all devices
      </SubmitButton>
    </form>
  );
}
