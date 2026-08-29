/** Shared shape for every server action used with useActionState. */
export interface ActionState {
  error?: string | null;
  success?: string | null;
  fieldErrors?: Record<string, string[]>;
  redirectTo?: string | null;
}

export const initialActionState: ActionState = {};

export function fieldError(state: ActionState, field: string) {
  return state.fieldErrors?.[field];
}

/** Converts a Zod flatten() result into ActionState field errors. */
export function fromZod(flattened: { fieldErrors: Record<string, string[] | undefined> }): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(flattened.fieldErrors)) {
    if (value && value.length) result[key] = value;
  }
  return result;
}

export function actionError(message: string, fieldErrors?: Record<string, string[]>): ActionState {
  return { error: message, fieldErrors };
}

export function actionSuccess(message?: string): ActionState {
  return { success: message ?? 'Saved.' };
}
