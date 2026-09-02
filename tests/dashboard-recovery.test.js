import test from "node:test";
import assert from "node:assert/strict";

test("memory-only prompt recovery persists neither dashboard nor active-task prompt", async () => {
  const previous = { document: globalThis.document, chrome: globalThis.chrome, fetch: globalThis.fetch };
  const elements = makeDashboardElements();
  const storage = {};

  Object.assign(elements.get("repository"), { value: "example/repo" });
  Object.assign(elements.get("handoff-mode"), { value: "review" });
  Object.assign(elements.get("service-url"), { value: "http://127.0.0.1:3210" });
  Object.assign(elements.get("storage-repository"), { value: "example/private-records" });
  Object.assign(elements.get("storage-branch"), { value: "main" });
  Object.assign(elements.get("prompt-evidence"), { value: "omit" });
  Object.assign(elements.get("report-evidence"), { value: "omit" });
  Object.assign(elements.get("prompt-recovery"), { value: "memory" });
  Object.assign(elements.get("change-description-publication"), { value: "none" });
  Object.assign(elements.get("change-comment-publication"), { value: "none" });

  globalThis.document = {
    getElementById(id) { return elements.get(id) ?? null; },
    querySelectorAll() { return []; },
  };
  globalThis.chrome = {
    runtime: {
      async sendMessage(message) {
        if (message.type === "crossdock.capturePrompt") return { ok: true, result: { prompt: "private prompt bytes" } };
        if (message.type === "crossdock.submitCodex") return { ok: true, result: { taskUrl: "https://agent.example/tasks/1" } };
        if (message.type === "crossdock.inspectCodex") return { ok: true, result: { createPrAvailable: true, updateBranchAvailable: false } };
        return { ok: true, result: {} };
      },
    },
    storage: {
      local: {
        async get(keys) {
          const list = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(list.filter((key) => Object.hasOwn(storage, key)).map((key) => [key, structuredClone(storage[key])]));
        },
        async set(values) { Object.assign(storage, structuredClone(values)); },
        async remove(key) { delete storage[key]; },
      },
    },
  };
  globalThis.fetch = async () => { throw new Error("unexpected fetch"); };

  try {
    await import(`${new URL("../extension/dashboard.js", import.meta.url).href}?memory-prompt-test=${Date.now()}`);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const capture = elements.get("capture").listeners.get("click");
    await capture();
    assert.equal(elements.get("prompt").value, "private prompt bytes");
    assert.equal(storage.dashboard.prompt, undefined);
    assert.equal(storage.dashboard["prompt-recovery"], "memory");

    const submit = elements.get("submit").listeners.get("click");
    await submit();
    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.equal(storage.dashboard.prompt, undefined);
    assert.equal(storage.taskState.prompt, undefined);
    assert.deepEqual(storage.taskState.recovery, { prompt: "memory" });
    assert.equal(storage.taskState.evidence_policy.prompt, "omit");
    assert.equal(storage.taskState.phase, "ready");
  } finally {
    globalThis.document = previous.document;
    globalThis.chrome = previous.chrome;
    globalThis.fetch = previous.fetch;
  }
});

function makeDashboardElements() {
  const ids = [
    "open-chatgpt", "open-codex", "open-github", "capture", "submit", "finalize-initial", "finalize-update",
    "repository", "issue", "pull-request", "handoff-mode", "service-url", "storage-repository", "storage-branch",
    "prompt-evidence", "report-evidence", "prompt-recovery", "change-description-publication", "change-comment-publication",
    "summary", "validation", "prompt", "status",
  ];
  return new Map(ids.map((id) => [id, {
    value: "",
    textContent: "",
    dataset: {},
    disabled: false,
    listeners: new Map(),
    addEventListener(type, listener) { this.listeners.set(type, listener); },
  }]));
}
