export const DEFAULT_PROMPT_RECOVERY_MODE = "persist";
export const PROMPT_RECOVERY_MODES = Object.freeze(["persist", "memory"]);

export function normalizePromptRecoveryMode(value) {
  if (!PROMPT_RECOVERY_MODES.includes(value)) throw new Error(`prompt recovery mode must be one of: ${PROMPT_RECOVERY_MODES.join(", ")}`);
  return value;
}

/** Return the active-task representation safe to persist locally. */
export function taskStateForLocalPersistence(taskState) {
  if (taskState == null) return null;
  if (!taskState || typeof taskState !== "object" || Array.isArray(taskState)) throw new TypeError("active task state must be an object");
  const mode = normalizePromptRecoveryMode(taskState.recovery?.prompt ?? DEFAULT_PROMPT_RECOVERY_MODE);
  const persisted = structuredClone(taskState);
  persisted.recovery = { ...(persisted.recovery ?? {}), prompt: mode };
  if (mode === "memory") delete persisted.prompt;
  return persisted;
}

export function migrateActiveTaskRecovery(taskState) {
  if (taskState == null) return { taskState: null, changed: false };
  if (!taskState || typeof taskState !== "object" || Array.isArray(taskState)) throw new TypeError("active task state must be an object");
  if (!Object.hasOwn(taskState, "recovery")) {
    return { taskState: { ...taskState, recovery: { prompt: DEFAULT_PROMPT_RECOVERY_MODE } }, changed: true };
  }
  const mode = normalizePromptRecoveryMode(taskState.recovery?.prompt);
  return { taskState: { ...taskState, recovery: { ...taskState.recovery, prompt: mode } }, changed: false };
}

/**
 * A memory-only prompt is intentionally unrecoverable after reload when the
 * durable record still requires prompt bytes for full/hash evidence.
 */
export function assertPromptAvailableForRecovery(taskState) {
  if (!taskState) return true;
  const mode = normalizePromptRecoveryMode(taskState.recovery?.prompt ?? DEFAULT_PROMPT_RECOVERY_MODE);
  if (mode !== "memory" || typeof taskState.prompt === "string") return true;
  if (taskState.evidence_policy?.prompt === "omit") return true;
  throw new Error("active task used memory-only prompt recovery; the prompt is unavailable after restart, so full/hash prompt evidence cannot be completed");
}
