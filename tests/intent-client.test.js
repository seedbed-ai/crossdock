import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BROWSER_INTENT, migrateActiveTaskIntent, normalizeBrowserIntent } from "../extension/intent-client.js";

test("browser intent validation permits only implementation", () => {
  assert.equal(normalizeBrowserIntent("implement"), DEFAULT_BROWSER_INTENT);
  for (const value of ["review", "investigate", "triage", "remediate", "verify", "", "made-up-intent", null]) {
    assert.throws(() => normalizeBrowserIntent(value), /unsupported.*only implement/);
  }
});

test("active task intent migration is deterministic and fail closed", () => {
  const legacy = { task_id: "legacy", mode: "update", pull_request: 9, phase: "ready", prompt: "do not inspect" };
  const migrated = migrateActiveTaskIntent(legacy);
  assert.equal(migrated.changed, true);
  assert.equal(migrated.taskState.intent, "implement");
  assert.equal(legacy.intent, undefined);
  const current = { ...legacy, intent: "implement" };
  assert.deepEqual(migrateActiveTaskIntent(current), { taskState: current, changed: false });
  for (const intent of ["review", "made-up-intent", ""]) assert.throws(() => migrateActiveTaskIntent({ ...legacy, intent }), /unsupported/);
});

test("dashboard freezes intent and rejects tampering before remote activity", async () => {
  const previous = { document: globalThis.document, chrome: globalThis.chrome, fetch: globalThis.fetch };
  const elements = makeElements();
  const storage = {}, messages = [], requests = [];
  globalThis.document = { getElementById: (id) => elements.get(id) ?? null, querySelectorAll: () => [] };
  globalThis.chrome = {
    runtime: { async sendMessage(message) {
      messages.push(message);
      if (message.type === "crossdock.submitCodex") return { ok: true, result: { taskUrl: "https://agent.example/tasks/1" } };
      if (message.type === "crossdock.inspectCodex") return { ok: true, result: { createPrAvailable: true, updateBranchAvailable: true } };
      return { ok: true, result: {} };
    } },
    storage: { local: {
      async get(keys) { const list = Array.isArray(keys) ? keys : [keys]; return Object.fromEntries(list.filter((key) => Object.hasOwn(storage, key)).map((key) => [key, structuredClone(storage[key])])); },
      async set(values) { Object.assign(storage, structuredClone(values)); },
      async remove(key) { delete storage[key]; },
    } },
  };
  globalThis.fetch = async (...args) => { requests.push(args); throw new Error("unexpected remote request"); };
  try {
    await import(`${new URL("../extension/dashboard.js", import.meta.url).href}?intent-test=${Date.now()}`);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const submit = elements.get("submit").listeners.get("click");
    for (const intent of ["review", "investigate", "made-up-intent", ""]) {
      elements.get("work-intent").value = intent;
      elements.get("pull-request").value = "7";
      await submit();
      assert.match(elements.get("status").textContent, /work intent is unsupported/);
      assert.equal(messages.length, 0);
      assert.equal(requests.length, 0);
    }
    elements.get("pull-request").value = "";
    elements.get("work-intent").value = "implement";
    await submit();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(messages.filter(({ type }) => type === "crossdock.submitCodex").length, 1);
    assert.equal(storage.taskState.intent, "implement");
    assert.equal(storage.dashboard["work-intent"], "implement");
    elements.get("work-intent").value = "review";
    await elements.get("work-intent").listeners.get("change")();
    assert.equal(storage.taskState.intent, "implement");
    assert.equal(storage.dashboard["work-intent"], "review");
  } finally { Object.assign(globalThis, previous); }
});

function makeElements() {
  const ids = ["open-chatgpt", "open-codex", "open-github", "capture", "submit", "finalize-initial", "finalize-update", "repository", "issue", "pull-request", "handoff-mode", "work-intent", "service-url", "storage-repository", "storage-branch", "prompt-evidence", "report-evidence", "prompt-recovery", "report-recovery", "change-description-publication", "change-comment-publication", "committed-file-publication", "committed-file-repository", "committed-file-branch", "committed-file-path-template", "summary", "validation", "prompt", "status"];
  const elements = new Map(ids.map((id) => [id, { value: "", textContent: "", dataset: {}, disabled: false, listeners: new Map(), addEventListener(type, listener) { this.listeners.set(type, listener); } }]));
  for (const [id, value] of Object.entries({ repository: "example/repo", "handoff-mode": "review", "work-intent": "implement", "service-url": "http://127.0.0.1:3210", "storage-repository": "example/records", "storage-branch": "main", "prompt-evidence": "omit", "report-evidence": "omit", "prompt-recovery": "persist", "report-recovery": "persist", "change-description-publication": "none", "change-comment-publication": "none", "committed-file-publication": "none", prompt: "safe prompt" })) elements.get(id).value = value;
  return elements;
}
