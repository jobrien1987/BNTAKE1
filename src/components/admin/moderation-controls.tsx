'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { moderateAction } from '@/app/actions/admin/people';
import { initialActionState } from '@/lib/action-state';

/**
 * Both buttons submit the same form and carry the action in their own value,
 * so there is exactly one `action` field in the payload whichever is pressed.
 */
export function ModerationControls({
  reportId,
  targetType,
  targetId,
  hidden,
}: {
  reportId: string;
  targetType: string;
  targetId: string;
  hidden: boolean;
}) {
  const [state, formAction] = useActionState(moderateAction, initialActionState);
  const router = useRouter();

  return (
    <form
      action={async (formData) => {
        await formAction(formData);
        router.refresh();
      }}
      className="flex flex-wrap items-center gap-3"
    >
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />

      <ModerationButton value={hidden ? 'RESTORE' : 'HIDE'} variant="outline">
        {hidden ? 'Restore' : 'Hide'}
      </ModerationButton>

      <ModerationButton value="DELETE" variant="danger">
        Delete permanently
      </ModerationButton>

      {state.error ? <span className="text-[11px] text-[#ff9aa2]">{state.error}</span> : null}
      {state.success ? <span className="text-[11px] text-[#8ff0c4]">Done</span> : null}
    </form>
  );
}

function ModerationButton({
  value,
  variant,
  children,
}: {
  value: string;
  variant: 'outline' | 'danger';
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name="action"
      value={value}
      disabled={pending}
      className={
        variant === 'outline'
          ? 'inline-flex h-9 items-center rounded-sm border border-ink-600 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-bone-muted transition-colors hover:border-gold-700 hover:text-bone disabled:opacity-50'
          : 'text-[11px] uppercase tracking-[0.14em] text-bone-dim transition-colors hover:text-[#ff8a92] disabled:opacity-50'
      }
    >
      {pending ? '…' : children}
    </button>
  );
}
