export function canonicalCodexTaskUrl(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Codex task URL is required");
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Codex task URL must be absolute");
  }
  if (url.origin !== "https://chatgpt.com") throw new Error("Codex task URL must use https://chatgpt.com");
  if (!/^\/codex\/cloud\/tasks\/[^/?#]+$/.test(url.pathname)) throw new Error("Codex task URL must identify one concrete cloud task");
  return `${url.origin}${url.pathname}`;
}

export function normalizeCodexOriginBinding(binding) {
  if (!binding || typeof binding !== "object") throw new Error("origin binding is required");
  if (binding.provider !== "codex") throw new Error(`origin binding provider is not supported by Codex adapter: ${binding.provider ?? "none"}`);
  if (typeof binding.originating_task_id !== "string" || !binding.originating_task_id.trim()) throw new Error("originating task id is required");
  return Object.freeze({
    originating_task_id: binding.originating_task_id.trim(),
    task_url: canonicalCodexTaskUrl(binding.agent_task_url),
  });
}

export function assertCodexContinuationTaskIdentity({ expectedTaskUrl, currentTaskUrl }) {
  const expected = canonicalCodexTaskUrl(expectedTaskUrl);
  const current = canonicalCodexTaskUrl(currentTaskUrl);
  if (current !== expected) throw new Error(`Codex continuation task identity mismatch: expected ${expected}, got ${current}`);
  return expected;
}

export function classifyCodexUpdateReadiness({ updateBranchAvailable, createPrAvailable }) {
  const update = Boolean(updateBranchAvailable);
  const create = Boolean(createPrAvailable);
  if (update && create) throw new Error("Codex update readiness is ambiguous: both Update branch and Create PR are available");
  if (create) throw new Error("Codex normal existing-PR update exposed Create PR instead of Update branch");
  return Object.freeze({ ready: update, publication_action: update ? "update_branch" : null });
}
