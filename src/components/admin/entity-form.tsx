'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Input, Textarea, Select, Checkbox, SubmitButton, FormMessage } from '@/components/ui/form';
import { initialActionState, fieldError, type ActionState } from '@/lib/action-state';

export type FieldSpec =
  | {
      kind: 'text' | 'url' | 'number' | 'date' | 'datetime';
      name: string;
      label: string;
      hint?: string;
      required?: boolean;
      placeholder?: string;
      value?: string | number | null;
      min?: number;
      max?: number;
      full?: boolean;
    }
  | {
      kind: 'textarea';
      name: string;
      label: string;
      hint?: string;
      required?: boolean;
      rows?: number;
      value?: string | null;
      mono?: boolean;
      full?: boolean;
    }
  | {
      kind: 'select';
      name: string;
      label: string;
      hint?: string;
      required?: boolean;
      value?: string | null;
      options: Array<{ value: string; label: string }>;
      full?: boolean;
    }
  | {
      kind: 'checkbox';
      name: string;
      label: string;
      hint?: string;
      value?: boolean;
      full?: boolean;
    };

const INPUT_TYPES: Record<string, string> = {
  text: 'text',
  url: 'url',
  number: 'number',
  date: 'date',
  datetime: 'datetime-local',
};

/**
 * Renders a declarative admin form. Every admin editor shares this so field
 * naming, error display and pending states behave identically everywhere.
 */
export function EntityForm({
  action,
  fields,
  hidden,
  submitLabel = 'Save',
  title,
  onSaved,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  fields: FieldSpec[];
  hidden?: Record<string, string | undefined>;
  submitLabel?: string;
  title?: string;
  onSaved?: () => void;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  const router = useRouter();

  return (
    <form
      action={async (formData) => {
        await formAction(formData);
        router.refresh();
        onSaved?.();
      }}
      className="panel space-y-5 p-6"
    >
      {title ? (
        <h2 className="border-b border-ink-700 pb-4 font-display text-lg uppercase tracking-tight text-bone">
          {title}
        </h2>
      ) : null}

      {Object.entries(hidden ?? {}).map(([key, value]) =>
        value ? <input key={key} type="hidden" name={key} value={value} /> : null,
      )}

      <FormMessage state={state} />

      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((field) => {
          const error = fieldError(state, field.name);
          const span = field.full ? 'sm:col-span-2' : '';

          if (field.kind === 'checkbox') {
            return (
              <div key={field.name} className={span}>
                <Checkbox
                  name={field.name}
                  value="true"
                  defaultChecked={field.value ?? false}
                  label={field.label}
                  description={field.hint}
                />
              </div>
            );
          }

          if (field.kind === 'select') {
            return (
              <div key={field.name} className={span}>
                <Field
                  label={field.label}
                  name={field.name}
                  hint={field.hint}
                  error={error}
                  required={field.required}
                >
                  <Select
                    id={field.name}
                    name={field.name}
                    defaultValue={field.value ?? ''}
                    required={field.required}
                  >
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            );
          }

          if (field.kind === 'textarea') {
            return (
              <div key={field.name} className={span}>
                <Field
                  label={field.label}
                  name={field.name}
                  hint={field.hint}
                  error={error}
                  required={field.required}
                >
                  <Textarea
                    id={field.name}
                    name={field.name}
                    rows={field.rows ?? 4}
                    defaultValue={field.value ?? ''}
                    required={field.required}
                    className={field.mono ? 'font-mono text-xs leading-relaxed' : undefined}
                  />
                </Field>
              </div>
            );
          }

          return (
            <div key={field.name} className={span}>
              <Field
                label={field.label}
                name={field.name}
                hint={field.hint}
                error={error}
                required={field.required}
              >
                <Input
                  id={field.name}
                  name={field.name}
                  type={INPUT_TYPES[field.kind]}
                  defaultValue={field.value ?? ''}
                  required={field.required}
                  placeholder={field.placeholder}
                  min={field.min}
                  max={field.max}
                />
              </Field>
            </div>
          );
        })}
      </div>

      <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
    </form>
  );
}

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'IN_REVIEW', label: 'In review' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const ACCESS_OPTIONS = [
  { value: 'FREE', label: 'Free to everyone' },
  { value: 'MEMBERSHIP', label: 'Members only' },
  { value: 'PURCHASE', label: 'Purchase required' },
];

export { STATUS_OPTIONS, ACCESS_OPTIONS };
