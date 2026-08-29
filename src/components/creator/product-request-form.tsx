'use client';

import { useActionState } from 'react';
import { requestProductAction } from '@/app/actions/creator';
import { Field, Input, Textarea, SubmitButton, FormMessage } from '@/components/ui/form';
import { initialActionState, fieldError } from '@/lib/action-state';

export function ProductRequestForm() {
  const [state, formAction] = useActionState(requestProductAction, initialActionState);

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <FormMessage state={state} />

      <Field label="Product title" name="title" error={fieldError(state, 'title')} required>
        <Input id="product-title" name="title" required placeholder="Tour tee, vinyl, hoodie…" />
      </Field>

      <Field
        label="Description"
        name="description"
        hint="Materials, sizes, artwork, quantities — anything the merch team needs."
        error={fieldError(state, 'description')}
        required
      >
        <Textarea id="product-description" name="description" rows={6} maxLength={2000} required />
      </Field>

      <Field
        label="Suggested price (in cents)"
        name="priceCents"
        hint="3500 = $35.00. The merch team confirms final pricing."
        error={fieldError(state, 'priceCents')}
        required
      >
        <Input id="product-priceCents" name="priceCents" type="number" min={100} required />
      </Field>

      <SubmitButton pendingLabel="Sending…">Send merch request</SubmitButton>
    </form>
  );
}
