'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { savePlanAction } from '@/app/actions/admin/commerce';
import { Field, Input, Textarea, Checkbox, SubmitButton, FormMessage } from '@/components/ui/form';
import { initialActionState, fieldError } from '@/lib/action-state';

export interface PlanFormValues {
  id: string;
  kind: string;
  key: string;
  name: string;
  tagline: string;
  priceCents: number;
  interval: string;
  stripePriceId: string;
  active: boolean;
  visible: boolean;
  memberContentAccess: boolean;
  earlyAccess: boolean;
  adFree: boolean;
  shopDiscountPercent: number;
  canUploadMusic: boolean;
  canSellMerch: boolean;
  canGoLive: boolean;
  advancedAnalytics: boolean;
  perks: string[];
}

export function PlanForm({ plan }: { plan: PlanFormValues }) {
  const [state, formAction] = useActionState(savePlanAction, initialActionState);
  const router = useRouter();

  return (
    <form
      action={async (formData) => {
        await formAction(formData);
        router.refresh();
      }}
      className="panel space-y-5 p-6"
    >
      <input type="hidden" name="id" value={plan.id} />

      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700 pb-4">
        <div>
          <h2 className="font-display text-xl uppercase tracking-tight text-bone">{plan.name}</h2>
          <p className="text-xs text-bone-dim">
            {plan.kind} · {plan.key} · billed {plan.interval}ly
          </p>
        </div>
      </header>

      <FormMessage state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Display name" name="name" error={fieldError(state, 'name')} required>
          <Input id={`name-${plan.id}`} name="name" defaultValue={plan.name} required />
        </Field>

        <Field
          label="Price (in cents)"
          name="priceCents"
          hint="1999 = $19.99. Zero makes the plan free."
          error={fieldError(state, 'priceCents')}
          required
        >
          <Input
            id={`priceCents-${plan.id}`}
            name="priceCents"
            type="number"
            min={0}
            defaultValue={plan.priceCents}
            required
          />
        </Field>
      </div>

      <Field label="Tagline" name="tagline" error={fieldError(state, 'tagline')}>
        <Input id={`tagline-${plan.id}`} name="tagline" defaultValue={plan.tagline} />
      </Field>

      <Field
        label="Stripe price ID"
        name="stripePriceId"
        hint="Required before a paid plan can be sold. Create the price in Stripe first."
        error={fieldError(state, 'stripePriceId')}
      >
        <Input
          id={`stripePriceId-${plan.id}`}
          name="stripePriceId"
          defaultValue={plan.stripePriceId}
          placeholder="price_..."
        />
      </Field>

      <Field
        label="Perks"
        name="perks"
        hint="One per line. Shown on the membership page."
        error={fieldError(state, 'perks')}
      >
        <Textarea
          id={`perks-${plan.id}`}
          name="perks"
          rows={5}
          defaultValue={plan.perks.join('\n')}
        />
      </Field>

      <fieldset className="space-y-3 border-t border-ink-700 pt-5">
        <legend className="eyebrow mb-2">What this plan unlocks</legend>

        <div className="grid gap-3 sm:grid-cols-2">
          <Checkbox
            name="memberContentAccess"
            value="true"
            defaultChecked={plan.memberContentAccess}
            label="Member library access"
            description="Unlocks content marked members-only."
          />
          <Checkbox
            name="earlyAccess"
            value="true"
            defaultChecked={plan.earlyAccess}
            label="Early access"
          />
          <Checkbox name="adFree" value="true" defaultChecked={plan.adFree} label="Ad-free" />
          <Checkbox
            name="canUploadMusic"
            value="true"
            defaultChecked={plan.canUploadMusic}
            label="Can upload music"
          />
          <Checkbox
            name="canSellMerch"
            value="true"
            defaultChecked={plan.canSellMerch}
            label="Can sell merch"
          />
          <Checkbox
            name="canGoLive"
            value="true"
            defaultChecked={plan.canGoLive}
            label="Can go live"
          />
          <Checkbox
            name="advancedAnalytics"
            value="true"
            defaultChecked={plan.advancedAnalytics}
            label="Advanced analytics"
          />
        </div>

        <Field
          label="Shop discount (%)"
          name="shopDiscountPercent"
          error={fieldError(state, 'shopDiscountPercent')}
        >
          <Input
            id={`shopDiscountPercent-${plan.id}`}
            name="shopDiscountPercent"
            type="number"
            min={0}
            max={100}
            defaultValue={plan.shopDiscountPercent}
          />
        </Field>
      </fieldset>

      <fieldset className="flex flex-wrap gap-6 border-t border-ink-700 pt-5">
        <Checkbox name="active" value="true" defaultChecked={plan.active} label="Active" />
        <Checkbox
          name="visible"
          value="true"
          defaultChecked={plan.visible}
          label="Visible on the membership page"
        />
      </fieldset>

      <SubmitButton pendingLabel="Saving…">Save plan</SubmitButton>
    </form>
  );
}
