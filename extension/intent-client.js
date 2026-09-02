export const DEFAULT_BROWSER_INTENT = "implement";

/** Validate the only intent currently executable by the Codex browser adapter. */
export function normalizeBrowserIntent(value) {
  if (value !== DEFAULT_BROWSER_INTENT) {
    const displayed = typeof value === "string" && value ? value : "empty";
    throw new Error(`Codex browser work intent is unsupported: ${displayed}; only implement is currently available`);
  }
  return DEFAULT_BROWSER_INTENT;
}

/** Migrate only historical tasks with no intent; explicit values are validated. */
export function migrateActiveTaskIntent(taskState) {
  if (taskState == null) return { taskState: null, changed: false };
  if (!taskState || typeof taskState !== "object" || Array.isArray(taskState)) throw new TypeError("active task state must be an object");
  if (!Object.hasOwn(taskState, "intent")) {
    return { taskState: { ...taskState, intent: DEFAULT_BROWSER_INTENT }, changed: true };
  }
  normalizeBrowserIntent(taskState.intent);
  return { taskState, changed: false };
}
