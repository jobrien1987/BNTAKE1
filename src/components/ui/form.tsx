'use client';

import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { cn } from '@/lib/utils';
import { buttonClasses } from './button';

export interface FieldProps {
  label: string;
  name: string;
  hint?: string;
  error?: string[] | string | null;
  required?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function Field({ label, name, hint, error, required, children, className }: FieldProps) {
  const messages = Array.isArray(error) ? error : error ? [error] : [];
  return (
    <div className={cn('space-y-2', className)}>
      <label
        htmlFor={name}
        className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-bone-muted"
      >
        {label}
        {required ? <span className="ml-1 text-gold-500">*</span> : null}
      </label>
      {children}
      {hint && messages.length === 0 ? <p className="text-xs text-bone-dim">{hint}</p> : null}
      {messages.map((message) => (
        <p key={message} className="text-xs text-[#ff9aa2]" role="alert">
          {message}
        </p>
      ))}
    </div>
  );
}

const controlBase =
  'w-full rounded-sm border border-ink-500 bg-ink-800 px-3 py-2.5 text-sm text-bone placeholder:text-bone-dim/70 transition-colors focus:border-gold-600 focus:outline-none focus:ring-1 focus:ring-gold-600/60 disabled:opacity-50';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controlBase, className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(controlBase, 'min-h-[120px] resize-y', className)} {...props} />;
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(controlBase, 'appearance-none pr-8', className)} {...props}>
      {children}
    </select>
  );
});

export function Checkbox({
  label,
  description,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', className)}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border-ink-400 bg-ink-800 text-gold-500 accent-[#d4af37]"
        {...props}
      />
      <span>
        <span className="block text-sm text-bone">{label}</span>
        {description ? <span className="block text-xs text-bone-dim">{description}</span> : null}
      </span>
    </label>
  );
}

export function SubmitButton({
  children,
  pendingLabel = 'Working…',
  variant = 'gold',
  size = 'md',
  className,
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: Parameters<typeof buttonClasses>[0];
  size?: Parameters<typeof buttonClasses>[1];
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={buttonClasses(variant, size, className)}
      aria-busy={pending}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormMessage({ state }: { state: { error?: string | null; success?: string | null } }) {
  if (!state.error && !state.success) return null;
  return (
    <div
      role="status"
      className={cn(
        'rounded-sm border px-4 py-3 text-sm',
        state.error
          ? 'border-blood/50 bg-blood/10 text-[#ffb3b8]'
          : 'border-jade/40 bg-jade/10 text-[#8ff0c4]',
      )}
    >
      {state.error ?? state.success}
    </div>
  );
}
