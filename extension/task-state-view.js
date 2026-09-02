export function taskStateViewModel(taskState) {
  if (!taskState) return null;
  if (typeof taskState !== "object" || Array.isArray(taskState)) throw new TypeError("active task state must be an object");
  return Object.freeze({
    intent: taskState.intent === "implement" ? "Implementation" : "Unsupported",
    mode: taskState.mode ?? "unknown",
    phase: taskState.phase ?? "unknown",
    repository: taskState.repository ?? "unknown",
    pull_request: taskState.pull_request == null ? "New PR" : `#${taskState.pull_request}`,
    handoff_mode: taskState.handoff_mode ?? "unknown",
  });
}

export function renderTaskState(taskState, documentRef = document) {
  const empty = documentRef.getElementById("active-task-empty");
  const details = documentRef.getElementById("active-task-details");
  const model = taskStateViewModel(taskState);

  if (!model) {
    empty.hidden = false;
    details.hidden = true;
    return;
  }

  empty.hidden = true;
  details.hidden = false;
  for (const [field, value] of Object.entries(model)) {
    documentRef.getElementById(`active-task-${field.replace("_", "-")}`).textContent = value;
  }
}

export async function bindTaskStateView({ documentRef = document, chromeRef = chrome } = {}) {
  const stored = await chromeRef.storage.local.get("taskState");
  renderTaskState(stored.taskState ?? null, documentRef);
  chromeRef.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !Object.hasOwn(changes, "taskState")) return;
    renderTaskState(changes.taskState.newValue ?? null, documentRef);
  });
}

if (typeof document !== "undefined" && globalThis.chrome?.storage?.local && globalThis.chrome?.storage?.onChanged) {
  void bindTaskStateView();
}
