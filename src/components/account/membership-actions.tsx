'use client';

import { useActionState } from 'react';
import { startMembershipCheckoutAction, openBillingPortalAction } from '@/app/actions/account';
import { SubmitButton, FormMessage } from '@/components/ui/form';
import { initialActionState } from '@/lib/action-state';

export function SubscribeButton({
  planId,
  label,
  variant = 'gold',
}: {
  planId: string;
  label: string;
  variant?: 'gold' | 'outline';
}) {
  const [state, formAction] = useActionState(startMembershipCheckoutAction, initialActionState);

  return (
    <form action={formAction} className="w-full">
      <input type="hidden" name="planId" value={planId} />
      <SubmitButton variant={variant} className="w-full" pendingLabel="Redirecting…">
        {label}
      </SubmitButton>
      {state.error ? <p className="mt-2 text-xs text-[#ff9aa2]">{state.error}</p> : null}
    </form>
  );
}

export function ManageBillingButton() {
  const [state, formAction] = useActionState(openBillingPortalAction, initialActionState);

  return (
    <form action={formAction}>
      <SubmitButton variant="outline" pendingLabel="Opening…">
        Manage billing
      </SubmitButton>
      <div className="mt-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
