'use client';

import { useActionState } from 'react';
import { applyAsCreatorAction } from '@/app/actions/creator';
import { Field, Input, Select, Checkbox, SubmitButton, FormMessage } from '@/components/ui/form';
import { initialActionState, fieldError } from '@/lib/action-state';
import { formatCents } from '@/lib/money';

export interface CreatorTierOption {
  key: 'ARTIST' | 'ARTIST_PRO';
  name: string;
  priceCents: number;
  interval: string;
}

export function CreatorJoinForm({
  agreementId,
  agreementVersion,
  tiers,
  defaultName,
  defaultEmail,
}: {
  agreementId: string;
  agreementVersion: string;
  tiers: CreatorTierOption[];
  defaultName: string;
  defaultEmail: string;
}) {
  const [state, formAction] = useActionState(applyAsCreatorAction, initialActionState);

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />

      <input type="hidden" name="agreementId" value={agreementId} />

      <Field
        label="Artist or brand name"
        name="displayName"
        error={fieldError(state, 'displayName')}
        required
      >
        <Input id="displayName" name="displayName" defaultValue={defaultName} required />
      </Field>

      <Field
        label="Contact email"
        name="contactEmail"
        hint="Used for release and payout correspondence."
        error={fieldError(state, 'contactEmail')}
        required
      >
        <Input
          id="contactEmail"
          name="contactEmail"
          type="email"
          defaultValue={defaultEmail}
          required
        />
      </Field>

      <Field label="Plan" name="tier" error={fieldError(state, 'tier')} required>
        <Select id="tier" name="tier" defaultValue="ARTIST" required>
          {tiers.map((tier) => (
            <option key={tier.key} value={tier.key}>
              {tier.name} — {formatCents(tier.priceCents)}/{tier.interval}
            </option>
          ))}
        </Select>
      </Field>

      <div className="space-y-2">
        <Checkbox
          name="accept"
          required
          label={`I accept the creator agreement (version ${agreementVersion})`}
          description="Your acceptance is recorded against this exact version."
        />
        {fieldError(state, 'accept') ? (
          <p className="text-xs text-[#ffb3b8]">{fieldError(state, 'accept')}</p>
        ) : null}
      </div>

      <SubmitButton pendingLabel="Submitting…">Apply to become a creator</SubmitButton>

      <p className="text-xs text-bone-dim">
        Applications are reviewed by hand. Billing only starts once you are approved and choose to
        subscribe.
      </p>
    </form>
  );
}
