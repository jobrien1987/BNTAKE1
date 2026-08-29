'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { subscribeToNewsletter } from '@/app/actions/newsletter';
import { initialActionState } from '@/lib/action-state';
import { SubmitButton } from '@/components/ui/form';

export function NewsletterForm() {
  const [state, formAction] = useActionState(subscribeToNewsletter, initialActionState);

  return (
    <form action={formAction} className="mt-8 max-w-sm">
      <label
        htmlFor="newsletter-email"
        className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-bone-muted"
      >
        Get network drops first
      </label>
      <div className="mt-3 flex">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@email.com"
          className="h-11 flex-1 border border-ink-500 border-r-0 bg-ink-800 px-3 text-sm text-bone placeholder:text-bone-dim/70 focus:border-gold-600 focus:outline-none"
        />
        <SubmitButton pendingLabel="…" className="rounded-none">
          Join
        </SubmitButton>
      </div>
      {state.error ? <p className="mt-2 text-xs text-[#ff9aa2]">{state.error}</p> : null}
      {state.success ? <p className="mt-2 text-xs text-[#8ff0c4]">{state.success}</p> : null}
    </form>
  );
}
