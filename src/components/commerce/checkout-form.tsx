'use client';

import { useActionState } from 'react';
import { startCheckoutAction } from '@/app/actions/cart';
import { Field, Input, SubmitButton, FormMessage } from '@/components/ui/form';
import { initialActionState, fieldError } from '@/lib/action-state';

export function CheckoutForm({
  requiresShipping,
  defaultEmail,
  defaultName,
  blocked,
}: {
  requiresShipping: boolean;
  defaultEmail: string;
  defaultName: string;
  blocked: boolean;
}) {
  const [state, formAction] = useActionState(startCheckoutAction, initialActionState);

  return (
    <form action={formAction} className="panel space-y-5 p-6">
      <h2 className="eyebrow">Checkout</h2>

      <FormMessage state={state} />

      <Field label="Email" name="email" error={fieldError(state, 'email')} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={defaultEmail}
          placeholder="you@example.com"
        />
      </Field>

      {requiresShipping ? (
        <>
          <Field label="Full name" name="name" error={fieldError(state, 'name')} required>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              required
              defaultValue={defaultName}
            />
          </Field>

          <Field label="Address" name="line1" error={fieldError(state, 'line1')} required>
            <Input id="line1" name="line1" autoComplete="address-line1" required />
          </Field>

          <Field label="Apartment, suite (optional)" name="line2">
            <Input id="line2" name="line2" autoComplete="address-line2" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="City" name="city" error={fieldError(state, 'city')} required>
              <Input id="city" name="city" autoComplete="address-level2" required />
            </Field>
            <Field label="State" name="state" error={fieldError(state, 'state')} required>
              <Input id="state" name="state" autoComplete="address-level1" required />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Postal code"
              name="postalCode"
              error={fieldError(state, 'postalCode')}
              required
            >
              <Input id="postalCode" name="postalCode" autoComplete="postal-code" required />
            </Field>
            <Field label="Country" name="country" hint="Two-letter code">
              <Input
                id="country"
                name="country"
                autoComplete="country"
                maxLength={2}
                defaultValue="US"
              />
            </Field>
          </div>
        </>
      ) : null}

      <SubmitButton className="w-full" pendingLabel="Redirecting…" disabled={blocked}>
        {blocked ? 'Resolve cart issues first' : 'Continue to payment'}
      </SubmitButton>

      <p className="text-center text-xs text-bone-dim">
        Payment is completed on a secure page hosted by our payment processor. Card details never
        touch this site.
      </p>
    </form>
  );
}
