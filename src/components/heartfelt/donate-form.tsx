'use client';

import { useActionState, useState } from 'react';
import { donateAction } from '@/app/actions/heartfelt';
import { Field, Input, Checkbox, SubmitButton, FormMessage } from '@/components/ui/form';
import { initialActionState, fieldError } from '@/lib/action-state';
import { cn } from '@/lib/utils';

const PRESETS = [10, 25, 50, 100];

export function DonateForm({
  campaignId,
  campaignTitle,
}: {
  campaignId: string;
  campaignTitle: string;
}) {
  const [state, formAction] = useActionState(donateAction, initialActionState);
  const [amount, setAmount] = useState('25');

  return (
    <form action={formAction} className="panel space-y-5 p-6">
      <h2 className="eyebrow">Support this campaign</h2>
      <input type="hidden" name="campaignId" value={campaignId} />

      <FormMessage state={state} />

      <div>
        <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-bone-dim">
          Choose an amount
        </span>
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(String(preset))}
              aria-pressed={amount === String(preset)}
              className={cn(
                'border py-2.5 text-sm font-semibold transition-colors',
                amount === String(preset)
                  ? 'border-gold-500 bg-gold-500 text-ink'
                  : 'border-ink-600 text-bone-muted hover:border-gold-700 hover:text-bone',
              )}
            >
              ${preset}
            </button>
          ))}
        </div>
      </div>

      <Field label="Amount (USD)" name="amount" error={fieldError(state, 'amount')} required>
        <Input
          id="amount"
          name="amount"
          type="number"
          min={1}
          max={10000}
          step="1"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </Field>

      <Field label="Email" name="email" error={fieldError(state, 'email')} required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field label="Message (optional)" name="message" error={fieldError(state, 'message')}>
        <Input id="message" name="message" maxLength={200} placeholder="Words of support" />
      </Field>

      <Checkbox name="anonymous" value="true" label="Donate anonymously" />

      <SubmitButton className="w-full" pendingLabel="Redirecting…">
        Donate
      </SubmitButton>

      <p className="text-xs text-bone-dim">
        Your donation goes to {campaignTitle}. Payment is handled on a secure page hosted by our
        payment processor.
      </p>
    </form>
  );
}
