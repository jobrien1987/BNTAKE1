'use client';

import { useActionState } from 'react';
import { saveArtistProfileAction } from '@/app/actions/creator';
import { Field, Input, Textarea, SubmitButton, FormMessage } from '@/components/ui/form';
import { initialActionState, fieldError } from '@/lib/action-state';

export interface ArtistDefaults {
  stageName: string;
  bio: string;
  location: string;
  profileImageUrl: string;
  heroImageUrl: string;
  websiteUrl: string;
  instagramUrl: string;
  twitterUrl: string;
  youtubeUrl: string;
  spotifyUrl: string;
}

export function ArtistProfileForm({ defaults }: { defaults: ArtistDefaults }) {
  const [state, formAction] = useActionState(saveArtistProfileAction, initialActionState);

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <FormMessage state={state} />

      <Field label="Artist name" name="stageName" error={fieldError(state, 'stageName')} required>
        <Input id="stageName" name="stageName" defaultValue={defaults.stageName} required />
      </Field>

      <Field label="Bio" name="bio" hint="Up to 2000 characters." error={fieldError(state, 'bio')}>
        <Textarea id="bio" name="bio" rows={6} maxLength={2000} defaultValue={defaults.bio} />
      </Field>

      <Field label="Location" name="location" error={fieldError(state, 'location')}>
        <Input id="location" name="location" defaultValue={defaults.location} />
      </Field>

      <Field
        label="Profile image URL"
        name="profileImageUrl"
        hint="Square image works best."
        error={fieldError(state, 'profileImageUrl')}
      >
        <Input
          id="profileImageUrl"
          name="profileImageUrl"
          type="url"
          defaultValue={defaults.profileImageUrl}
        />
      </Field>

      <Field
        label="Hero image URL"
        name="heroImageUrl"
        hint="Wide banner for the top of your page."
        error={fieldError(state, 'heroImageUrl')}
      >
        <Input
          id="heroImageUrl"
          name="heroImageUrl"
          type="url"
          defaultValue={defaults.heroImageUrl}
        />
      </Field>

      <fieldset className="space-y-5 border-t border-ink-700 pt-6">
        <legend className="eyebrow">Links</legend>

        <Field label="Website" name="websiteUrl" error={fieldError(state, 'websiteUrl')}>
          <Input id="websiteUrl" name="websiteUrl" type="url" defaultValue={defaults.websiteUrl} />
        </Field>

        <Field label="Instagram" name="instagramUrl" error={fieldError(state, 'instagramUrl')}>
          <Input
            id="instagramUrl"
            name="instagramUrl"
            type="url"
            defaultValue={defaults.instagramUrl}
          />
        </Field>

        <Field label="X" name="twitterUrl" error={fieldError(state, 'twitterUrl')}>
          <Input id="twitterUrl" name="twitterUrl" type="url" defaultValue={defaults.twitterUrl} />
        </Field>

        <Field label="YouTube" name="youtubeUrl" error={fieldError(state, 'youtubeUrl')}>
          <Input id="youtubeUrl" name="youtubeUrl" type="url" defaultValue={defaults.youtubeUrl} />
        </Field>

        <Field label="Spotify" name="spotifyUrl" error={fieldError(state, 'spotifyUrl')}>
          <Input id="spotifyUrl" name="spotifyUrl" type="url" defaultValue={defaults.spotifyUrl} />
        </Field>
      </fieldset>

      <SubmitButton pendingLabel="Saving…">Save artist profile</SubmitButton>
    </form>
  );
}
