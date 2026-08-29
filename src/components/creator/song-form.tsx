'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveSongAction, deleteSongAction } from '@/app/actions/creator';
import { Field, Input, Select, Checkbox, SubmitButton, FormMessage } from '@/components/ui/form';
import { initialActionState, fieldError } from '@/lib/action-state';
import { Badge } from '@/components/ui/primitives';

export interface SongFormValues {
  id?: string;
  title: string;
  albumId: string;
  trackNumber: string;
  durationSec: string;
  artworkUrl: string;
  audioUrl: string;
  previewUrl: string;
  explicit: boolean;
  accessType: 'FREE' | 'MEMBERSHIP' | 'PURCHASE';
  priceCents: string;
  purchasable: boolean;
  status?: string;
}

export function SongForm({
  values,
  albums,
  onDone,
}: {
  values: SongFormValues;
  albums: Array<{ id: string; title: string }>;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(saveSongAction, initialActionState);
  const [purchasable, setPurchasable] = useState(values.purchasable);
  const router = useRouter();

  const editable = !values.status || values.status === 'DRAFT' || values.status === 'IN_REVIEW';

  return (
    <form
      action={async (formData) => {
        await formAction(formData);
        router.refresh();
        onDone?.();
      }}
      className="space-y-5"
    >
      <FormMessage state={state} />

      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <Field label="Title" name="title" error={fieldError(state, 'title')} required>
        <Input id="title" name="title" defaultValue={values.title} required />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Album (optional)" name="albumId">
          <Select id="albumId" name="albumId" defaultValue={values.albumId}>
            <option value="">Standalone single</option>
            {albums.map((album) => (
              <option key={album.id} value={album.id}>
                {album.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Track number" name="trackNumber" error={fieldError(state, 'trackNumber')}>
          <Input
            id="trackNumber"
            name="trackNumber"
            type="number"
            min={0}
            defaultValue={values.trackNumber}
          />
        </Field>
      </div>

      <Field
        label="Duration (seconds)"
        name="durationSec"
        hint="Used for the tracklist and player."
        error={fieldError(state, 'durationSec')}
      >
        <Input
          id="durationSec"
          name="durationSec"
          type="number"
          min={0}
          defaultValue={values.durationSec}
        />
      </Field>

      <Field label="Artwork URL" name="artworkUrl" error={fieldError(state, 'artworkUrl')}>
        <Input id="artworkUrl" name="artworkUrl" type="url" defaultValue={values.artworkUrl} />
      </Field>

      <Field
        label="Audio file URL"
        name="audioUrl"
        hint="The full track. Never exposed directly to listeners — playback is served through an access-checked endpoint."
        error={fieldError(state, 'audioUrl')}
      >
        <Input id="audioUrl" name="audioUrl" type="url" defaultValue={values.audioUrl} />
      </Field>

      <Field
        label="Preview clip URL (optional)"
        name="previewUrl"
        hint="Played to listeners who don't have access yet."
        error={fieldError(state, 'previewUrl')}
      >
        <Input id="previewUrl" name="previewUrl" type="url" defaultValue={values.previewUrl} />
      </Field>

      <Field label="Access" name="accessType" required>
        <Select id="accessType" name="accessType" defaultValue={values.accessType} required>
          <option value="FREE">Free to everyone</option>
          <option value="MEMBERSHIP">Members only</option>
          <option value="PURCHASE">Purchase required</option>
        </Select>
      </Field>

      <Checkbox
        name="purchasable"
        value="true"
        defaultChecked={values.purchasable}
        onChange={(event) => setPurchasable(event.target.checked)}
        label="Sell this track individually"
      />

      {purchasable ? (
        <Field
          label="Price (in cents)"
          name="priceCents"
          hint="129 = $1.29. Stored as whole cents so nothing rounds badly."
          error={fieldError(state, 'priceCents')}
        >
          <Input
            id="priceCents"
            name="priceCents"
            type="number"
            min={0}
            defaultValue={values.priceCents}
          />
        </Field>
      ) : null}

      <Checkbox name="explicit" value="true" defaultChecked={values.explicit} label="Explicit" />

      <div className="flex flex-wrap items-center gap-3 border-t border-ink-700 pt-5">
        <SubmitButton variant="outline" pendingLabel="Saving…">
          Save draft
        </SubmitButton>

        <button
          type="submit"
          name="submitForReview"
          value="true"
          className="inline-flex h-11 items-center justify-center rounded-sm bg-gold-500 px-5 text-xs font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:bg-gold-400"
        >
          Submit for review
        </button>

        {values.status ? <Badge>{values.status}</Badge> : null}
      </div>

      {!editable ? (
        <p className="text-xs text-bone-dim">
          Published tracks are managed by network staff. Contact support to make changes.
        </p>
      ) : null}
    </form>
  );
}

export function DeleteSongButton({ id }: { id: string }) {
  const router = useRouter();

  return (
    <form
      action={async (formData: FormData) => {
        await deleteSongAction(formData);
        router.refresh();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="text-[11px] uppercase tracking-[0.16em] text-bone-dim transition-colors hover:text-[#ff8a92]"
      >
        Delete
      </button>
    </form>
  );
}
