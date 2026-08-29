'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveAlbumAction, deleteAlbumAction } from '@/app/actions/creator';
import { Field, Input, Textarea, Select, Checkbox, SubmitButton, FormMessage } from '@/components/ui/form';
import { initialActionState, fieldError } from '@/lib/action-state';
import { Badge } from '@/components/ui/primitives';

export interface AlbumFormValues {
  id?: string;
  title: string;
  description: string;
  artworkUrl: string;
  releaseDate: string;
  accessType: 'FREE' | 'MEMBERSHIP' | 'PURCHASE';
  priceCents: string;
  purchasable: boolean;
  status?: string;
}

export function AlbumForm({ values, onDone }: { values: AlbumFormValues; onDone?: () => void }) {
  const [state, formAction] = useActionState(saveAlbumAction, initialActionState);
  const [purchasable, setPurchasable] = useState(values.purchasable);
  const router = useRouter();

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
        <Input id="album-title" name="title" defaultValue={values.title} required />
      </Field>

      <Field label="Description" name="description" error={fieldError(state, 'description')}>
        <Textarea
          id="album-description"
          name="description"
          rows={4}
          maxLength={2000}
          defaultValue={values.description}
        />
      </Field>

      <Field label="Artwork URL" name="artworkUrl" error={fieldError(state, 'artworkUrl')}>
        <Input
          id="album-artworkUrl"
          name="artworkUrl"
          type="url"
          defaultValue={values.artworkUrl}
        />
      </Field>

      <Field label="Release date" name="releaseDate" error={fieldError(state, 'releaseDate')}>
        <Input
          id="album-releaseDate"
          name="releaseDate"
          type="date"
          defaultValue={values.releaseDate}
        />
      </Field>

      <Field label="Access" name="accessType" required>
        <Select
          id="album-accessType"
          name="accessType"
          defaultValue={values.accessType}
          required
        >
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
        label="Sell this album"
        description="Buying an album grants every track on it."
      />

      {purchasable ? (
        <Field
          label="Price (in cents)"
          name="priceCents"
          hint="999 = $9.99."
          error={fieldError(state, 'priceCents')}
        >
          <Input
            id="album-priceCents"
            name="priceCents"
            type="number"
            min={0}
            defaultValue={values.priceCents}
          />
        </Field>
      ) : null}

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
    </form>
  );
}

export function DeleteAlbumButton({ id }: { id: string }) {
  const router = useRouter();

  return (
    <form
      action={async (formData: FormData) => {
        await deleteAlbumAction(formData);
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
