import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("dashboard exposes report recovery with historical persist default", async () => {
  const html = await readFile(new URL("../extension/dashboard.html", import.meta.url), "utf8");
  assert.match(html, /<select id="report-recovery">\s*<option value="persist">/);
});

test("submission freezes independent memory-only prompt and report recovery", async () => {
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
  Object.assign(elements.get("report-recovery"), { value: "memory" });
  Object.assign(elements.get("change-description-publication"), { value: "none" });
  Object.assign(elements.get("change-comment-publication"), { value: "none" });
  Object.assign(elements.get("committed-file-publication"), { value: "reference" });
  Object.assign(elements.get("committed-file-repository"), { value: "example/provenance" });
  Object.assign(elements.get("committed-file-branch"), { value: "records" });
  Object.assign(elements.get("committed-file-path-template"), { value: "crossdock/{task_id}.md" });

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
    assert.deepEqual(storage.taskState.recovery, { prompt: "memory", report: "memory" });
    assert.equal(storage.taskState.evidence_policy.prompt, "omit");
    assert.deepEqual(storage.taskState.publication.committed_file, {
      presentation: "reference", adapter: "github", repository: "example/provenance", branch: "records", path_template: "crossdock/{task_id}.md",
    });
    elements.get("committed-file-publication").value = "link";
    elements.get("committed-file-repository").value = "changed/destination";
    elements.get("committed-file-branch").value = "changed";
    elements.get("committed-file-path-template").value = "changed/{task_id}.md";
    assert.deepEqual(storage.taskState.publication.committed_file, {
      presentation: "reference", adapter: "github", repository: "example/provenance", branch: "records", path_template: "crossdock/{task_id}.md",
    });
    assert.equal(storage.taskState.phase, "ready");
  } finally {
    globalThis.document = previous.document;
    globalThis.chrome = previous.chrome;
    globalThis.fetch = previous.fetch;
  }
});

test("captured memory-only report stays live for handoff but never enters persisted task state", async () => {
  const previous = { document: globalThis.document, chrome: globalThis.chrome, fetch: globalThis.fetch };
  const elements = makeDashboardElements();
  const storage = {};
  const persistedTasks = [];
  const requests = [];
  for (const [id, value] of Object.entries({
    repository: "example/repo", "pull-request": "7", "handoff-mode": "review",
    "service-url": "http://127.0.0.1:3210", "storage-repository": "example/records", "storage-branch": "main",
    "prompt-evidence": "omit", "report-evidence": "full", "prompt-recovery": "persist", "report-recovery": "memory",
    "change-description-publication": "none", "change-comment-publication": "none", prompt: "safe test prompt",
  })) elements.get(id).value = value;

  globalThis.document = { getElementById: (id) => elements.get(id) ?? null, querySelectorAll: () => [] };
  globalThis.chrome = {
    runtime: { async sendMessage(message) {
      if (message.type === "crossdock.submitCodex") return { ok: true, result: { taskUrl: "https://agent.example/tasks/2" } };
      if (message.type === "crossdock.inspectCodex") return { ok: true, result: { updateBranchAvailable: true } };
      if (message.type === "crossdock.applyBranchUpdate") return { ok: true, result: { taskUrl: "https://agent.example/tasks/2", report: "private report bytes" } };
      return { ok: true, result: {} };
    } },
    storage: { local: {
      async get(keys) { const list = Array.isArray(keys) ? keys : [keys]; return Object.fromEntries(list.filter((key) => Object.hasOwn(storage, key)).map((key) => [key, structuredClone(storage[key])])); },
      async set(values) { Object.assign(storage, structuredClone(values)); if (values.taskState) persistedTasks.push(structuredClone(values.taskState)); },
      async remove(key) { delete storage[key]; },
    } },
  };
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    if (url.endsWith("/pr/snapshot")) return okResponse({ head_sha: requests.filter((call) => call.url.endsWith("/pr/snapshot")).length === 1 ? "old" : "new" });
    if (url.endsWith("/handoff/update")) return okResponse({ task_record_url: "https://records.example/task" });
    throw new Error(`unexpected fetch: ${url}`);
  };

  try {
    await import(`${new URL("../extension/dashboard.js", import.meta.url).href}?memory-report-live=${Date.now()}`);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await elements.get("submit").listeners.get("click")();
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.deepEqual(storage.taskState.recovery, { prompt: "persist", report: "memory" });

    elements.get("report-recovery").value = "persist";
    await elements.get("report-recovery").listeners.get("change")();
    await elements.get("finalize-update").listeners.get("click")();

    assert.ok(persistedTasks.every((state) => state.final_report === undefined));
    assert.ok(persistedTasks.every((state) => state.recovery.report === "memory"));
    const handoff = requests.find(({ url }) => url.endsWith("/handoff/update"));
    assert.equal(JSON.parse(handoff.init.body).task.report, "private report bytes");
    assert.equal(storage.taskState, undefined);
  } finally {
    Object.assign(globalThis, previous);
  }
});

function okResponse(body) {
  return { ok: true, status: 200, async json() { return body; } };
}

function makeDashboardElements() {
  const ids = [
    "open-chatgpt", "open-codex", "open-github", "capture", "submit", "finalize-initial", "finalize-update",
    "repository", "issue", "pull-request", "handoff-mode", "service-url", "storage-repository", "storage-branch",
    "prompt-evidence", "report-evidence", "prompt-recovery", "report-recovery", "change-description-publication", "change-comment-publication", "committed-file-publication", "committed-file-repository", "committed-file-branch", "committed-file-path-template",
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
