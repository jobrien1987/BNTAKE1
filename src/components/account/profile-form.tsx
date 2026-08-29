'use client';

import { useActionState } from 'react';
import { updateProfileAction } from '@/app/actions/account';
import { Field, Input, Textarea, SubmitButton, FormMessage } from '@/components/ui/form';
import { initialActionState, fieldError } from '@/lib/action-state';

export function ProfileForm({
  defaults,
}: {
  defaults: {
    name: string;
    username: string;
    bio: string;
    location: string;
    avatarUrl: string;
    bannerUrl: string;
  };
}) {
  const [state, formAction] = useActionState(updateProfileAction, initialActionState);

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />

      <Field label="Name" name="name" error={fieldError(state, 'name')} required>
        <Input id="name" name="name" defaultValue={defaults.name} required />
      </Field>

      <Field
        label="Username"
        name="username"
        hint="Your handle in the community. Letters, numbers and underscores."
        error={fieldError(state, 'username')}
        required
      >
        <Input id="username" name="username" defaultValue={defaults.username} required />
      </Field>

      <Field label="Bio" name="bio" hint="Up to 500 characters." error={fieldError(state, 'bio')}>
        <Textarea id="bio" name="bio" rows={4} maxLength={500} defaultValue={defaults.bio} />
      </Field>

      <Field label="Location" name="location" error={fieldError(state, 'location')}>
        <Input id="location" name="location" defaultValue={defaults.location} />
      </Field>

      <Field
        label="Avatar image URL"
        name="avatarUrl"
        hint="Paste a link to a square image."
        error={fieldError(state, 'avatarUrl')}
      >
        <Input id="avatarUrl" name="avatarUrl" type="url" defaultValue={defaults.avatarUrl} />
      </Field>

      <Field
        label="Banner image URL"
        name="bannerUrl"
        hint="A wide image for the top of your profile."
        error={fieldError(state, 'bannerUrl')}
      >
        <Input id="bannerUrl" name="bannerUrl" type="url" defaultValue={defaults.bannerUrl} />
      </Field>

      <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
    </form>
  );
}
