export const DEFAULT_PROMPT_RECOVERY_MODE = "persist";
export const DEFAULT_REPORT_RECOVERY_MODE = "persist";
export const RECOVERY_CONTENT_MODES = Object.freeze(["persist", "memory"]);
export const PROMPT_RECOVERY_MODES = RECOVERY_CONTENT_MODES;
export const REPORT_RECOVERY_MODES = RECOVERY_CONTENT_MODES;

export function normalizePromptRecoveryMode(value) { return normalizeRecoveryMode(value, "prompt"); }
export function normalizeReportRecoveryMode(value) { return normalizeRecoveryMode(value, "report"); }

/** Return the active-task representation safe to persist locally. */
export function taskStateForLocalPersistence(taskState) {
  if (taskState == null) return null;
  if (!taskState || typeof taskState !== "object" || Array.isArray(taskState)) throw new TypeError("active task state must be an object");
  const prompt = normalizePromptRecoveryMode(taskState.recovery?.prompt ?? DEFAULT_PROMPT_RECOVERY_MODE);
  const hasReportPolicy = Object.hasOwn(taskState.recovery ?? {}, "report");
  const report = normalizeReportRecoveryMode(taskState.recovery?.report ?? DEFAULT_REPORT_RECOVERY_MODE);
  const persisted = structuredClone(taskState);
  persisted.recovery = { ...(persisted.recovery ?? {}), prompt };
  if (hasReportPolicy) persisted.recovery.report = report;
  if (prompt === "memory") delete persisted.prompt;
  if (report === "memory") delete persisted.final_report;
  return persisted;
}

export function migrateActiveTaskRecovery(taskState) {
  if (taskState == null) return { taskState: null, changed: false };
  if (!taskState || typeof taskState !== "object" || Array.isArray(taskState)) throw new TypeError("active task state must be an object");
  if (!Object.hasOwn(taskState, "recovery")) return { taskState: { ...taskState, recovery: { prompt: DEFAULT_PROMPT_RECOVERY_MODE } }, changed: true };
  const prompt = normalizePromptRecoveryMode(taskState.recovery?.prompt);
  if (Object.hasOwn(taskState.recovery, "report")) normalizeReportRecoveryMode(taskState.recovery.report);
  return { taskState: { ...taskState, recovery: { ...taskState.recovery, prompt } }, changed: false };
}

export function assertPromptAvailableForRecovery(taskState) {
  if (!taskState) return true;
  const mode = normalizePromptRecoveryMode(taskState.recovery?.prompt ?? DEFAULT_PROMPT_RECOVERY_MODE);
  if (mode !== "memory" || typeof taskState.prompt === "string" || taskState.evidence_policy?.prompt === "omit") return true;
  throw new Error("active task used memory-only prompt recovery; the prompt is unavailable after restart, so full/hash prompt evidence cannot be completed");
}

/** Report bytes become recovery-critical only after the provider result has been captured. */
export function assertReportAvailableForRecovery(taskState) {
  if (!taskState) return true;
  const mode = normalizeReportRecoveryMode(taskState.recovery?.report ?? DEFAULT_REPORT_RECOVERY_MODE);
  if (mode !== "memory" || taskState.evidence_policy?.report === "omit" || typeof taskState.final_report === "string") return true;
  const captured = Boolean(taskState.final_task_url) && ["pr-create-uncertain", "pr-created", "branch-update-clicked"].includes(taskState.phase);
  if (!captured) return true;
  throw new Error("active task used memory-only report recovery; the captured report is unavailable after restart, so full/hash report evidence cannot be completed");
}

function normalizeRecoveryMode(value, label) {
  if (!RECOVERY_CONTENT_MODES.includes(value)) throw new Error(`${label} recovery mode must be one of: ${RECOVERY_CONTENT_MODES.join(", ")}`);
  return value;
}
