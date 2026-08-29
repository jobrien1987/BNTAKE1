'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Select, SubmitButton } from '@/components/ui/form';
import { initialActionState, type ActionState } from '@/lib/action-state';

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * A one-field select plus save button, used throughout the admin lists to
 * change a status or role without a full edit page.
 */
export function InlineSelectForm({
  action,
  name,
  value,
  options,
  hidden,
  label,
  saveLabel = 'Save',
  disabled,
}: {
  action: FormAction;
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  hidden: Record<string, string>;
  label: string;
  saveLabel?: string;
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  const router = useRouter();

  return (
    <form
      action={async (formData) => {
        await formAction(formData);
        router.refresh();
      }}
      className="flex items-center gap-2"
    >
      {Object.entries(hidden).map(([key, hiddenValue]) => (
        <input key={key} type="hidden" name={key} value={hiddenValue} />
      ))}

      <label className="sr-only" htmlFor={`${name}-${hidden.userId ?? hidden.profileId ?? value}`}>
        {label}
      </label>
      <Select
        id={`${name}-${hidden.userId ?? hidden.profileId ?? value}`}
        name={name}
        defaultValue={value}
        disabled={disabled}
        className="h-9 py-0 text-xs"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      <SubmitButton variant="outline" size="sm" pendingLabel="…" disabled={disabled}>
        {saveLabel}
      </SubmitButton>

      {state.error ? (
        <span className="text-[11px] text-[#ff9aa2]" role="status">
          {state.error}
        </span>
      ) : null}
      {state.success ? (
        <span className="text-[11px] text-[#8ff0c4]" role="status">
          Saved
        </span>
      ) : null}
    </form>
  );
}

/** A single button that posts a fixed payload to a void server action. */
export function InlineButtonForm({
  action,
  hidden,
  label,
  tone = 'quiet',
}: {
  action: (formData: FormData) => Promise<void>;
  hidden: Record<string, string>;
  label: string;
  tone?: 'quiet' | 'danger';
}) {
  const router = useRouter();

  return (
    <form
      action={async (formData: FormData) => {
        await action(formData);
        router.refresh();
      }}
    >
      {Object.entries(hidden).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <button
        type="submit"
        className={
          tone === 'danger'
            ? 'text-[11px] uppercase tracking-[0.14em] text-bone-dim transition-colors hover:text-[#ff8a92]'
            : 'text-[11px] uppercase tracking-[0.14em] text-bone-dim transition-colors hover:text-gold-300'
        }
      >
        {label}
      </button>
    </form>
  );
}
