import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PUBLICATION_POLICY,
  migrateActiveTaskPublication,
  normalizeBrowserPublicationPolicy,
} from "../extension/publication-client.js";
import {
  DEFAULT_SERVICE_URL,
  migrateActiveTaskServiceUrl,
  normalizeServiceUrl,
  postServiceJson,
  resolveServiceUrl,
} from "../extension/service-client.js";

function okResponse(body = { ok: true }) {
  return {
    ok: true,
    status: 200,
    async json() { return body; },
  };
}

test("browser service URL accepts explicit port 80 consistently", () => {
  assert.equal(normalizeServiceUrl("http://127.0.0.1:80"), "http://127.0.0.1:80");
  assert.equal(normalizeServiceUrl("http://127.0.0.1:8787/"), "http://127.0.0.1:8787");
});

test("browser service URL rejects non-loopback and decorated destinations", () => {
  for (const value of [
    "https://127.0.0.1:3210",
    "http://localhost:3210",
    "http://127.0.0.1",
    "http://127.0.0.1:3210/path",
    "http://127.0.0.1:3210/?query=1",
    "http://user:pass@127.0.0.1:3210",
  ]) assert.throws(() => normalizeServiceUrl(value));
});

test("legacy active task migration freezes the historical endpoint", () => {
  const original = { task_id: "legacy-task", phase: "ready" };
  const migrated = migrateActiveTaskServiceUrl(original);
  assert.equal(migrated.changed, true);
  assert.equal(migrated.taskState.service_url, DEFAULT_SERVICE_URL);
  assert.equal(original.service_url, undefined);
});

test("explicit invalid active endpoint fails instead of being migrated", () => {
  for (const service_url of [null, "", "http://localhost:3210"]) {
    assert.throws(() => migrateActiveTaskServiceUrl({ task_id: "task-1", service_url }));
    assert.throws(() => resolveServiceUrl({ taskState: { task_id: "task-1", service_url }, preference: DEFAULT_SERVICE_URL }));
  }
});

test("existing active task endpoint is normalized without reading a new preference", () => {
  const migrated = migrateActiveTaskServiceUrl({ task_id: "task-1", service_url: "http://127.0.0.1:8787/" });
  assert.equal(migrated.changed, false);
  assert.equal(migrated.taskState.service_url, "http://127.0.0.1:8787");
  assert.equal(resolveServiceUrl({ taskState: migrated.taskState, preference: "http://127.0.0.1:9999" }), "http://127.0.0.1:8787");
});

test("browser publication policy supports only currently executable link and none modes", () => {
  assert.deepEqual(normalizeBrowserPublicationPolicy({
    change_description: "none",
    change_comment: "link",
    committed_file: null,
  }), {
    change_description: "none",
    change_comment: "link",
    committed_file: null,
  });
  assert.throws(() => normalizeBrowserPublicationPolicy({ change_description: "summary", change_comment: "link", committed_file: null }), /link or none/);
  assert.throws(() => normalizeBrowserPublicationPolicy({ change_description: "link", change_comment: "link", committed_file: { presentation: "reference" } }), /committed-file/);
});

test("legacy active tasks migrate to historical link publication behavior", () => {
  const original = { task_id: "legacy-task", phase: "ready" };
  const migrated = migrateActiveTaskPublication(original);
  assert.equal(migrated.changed, true);
  assert.deepEqual(migrated.taskState.publication, DEFAULT_PUBLICATION_POLICY);
  assert.equal(original.publication, undefined);
});

test("existing active task publication is frozen and validated", () => {
  const publication = { change_description: "none", change_comment: "none", committed_file: null };
  const migrated = migrateActiveTaskPublication({ task_id: "task-1", publication });
  assert.equal(migrated.changed, false);
  assert.deepEqual(migrated.taskState.publication, publication);
  assert.throws(() => migrateActiveTaskPublication({ task_id: "task-1", publication: { ...publication, change_comment: "summary" } }), /link or none/);
});

test("service client uses frozen task endpoint after preference changes", async () => {
  const calls = [];
  await postServiceJson({
    path: "/pr/snapshot",
    body: { target_repository: "example/repo", pull_request: 1 },
    taskState: { task_id: "task-1", service_url: "http://127.0.0.1:8787" },
    preference: "http://127.0.0.1:9999",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return okResponse({ head_sha: "abc" });
    },
  });
  assert.equal(calls[0].url, "http://127.0.0.1:8787/pr/snapshot");
});

test("dashboard restoration keeps recovered update requests on frozen endpoint and publication policy", async () => {
  const previous = { document: globalThis.document, chrome: globalThis.chrome, fetch: globalThis.fetch };
  const elements = makeDashboardElements();
  const storage = {
    dashboard: {
      repository: "example/repo",
      issue: "",
      "pull-request": "7",
      "handoff-mode": "review",
      "service-url": "http://127.0.0.1:8787",
      "storage-repository": "example/records",
      "storage-branch": "main",
      "prompt-evidence": "full",
      "report-evidence": "full",
      "prompt-recovery": "persist",
      "change-description-publication": "none",
      "change-comment-publication": "none",
      summary: "Update summary",
      validation: "tests passed",
      prompt: "Update the branch",
    },
    taskState: {
      task_id: "task-update-1",
      created_at: "2026-09-01T00:00:00Z",
      prompt: "Update the branch",
      mode: "update",
      handoff_mode: "review",
      evidence_policy: { prompt: "full", report: "full" },
      recovery: { prompt: "persist" },
      publication: { change_description: "link", change_comment: "link", committed_file: null },
      repository: "example/repo",
      service_url: "http://127.0.0.1:8787",
      storage: { repository: "example/records", branch: "main" },
      pull_request: 7,
      initial_head_sha: "old-head",
      task_url: "https://agent.example/tasks/1",
      phase: "ready",
    },
    parentTaskId: "parent-task",
  };
  const fetchCalls = [];

  globalThis.document = {
    getElementById(id) { return elements.get(id) ?? null; },
    querySelectorAll() { return []; },
  };
  globalThis.chrome = {
    runtime: {
      async sendMessage(message) {
        if (message.type === "crossdock.applyBranchUpdate") {
          return { ok: true, result: { taskUrl: "https://agent.example/tasks/1", report: "Done" } };
        }
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
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    if (url.endsWith("/pr/snapshot")) return okResponse({ head_sha: "new-head" });
    if (url.endsWith("/handoff/update")) return okResponse({ task_record_url: "https://records.example/task" });
    throw new Error(`unexpected fetch: ${url}`);
  };

  try {
    await import(`${new URL("../extension/dashboard.js", import.meta.url).href}?recovery-test=${Date.now()}`);
    await new Promise((resolve) => setTimeout(resolve, 0));

    elements.get("service-url").value = "http://127.0.0.1:9999";
    elements.get("change-comment-publication").value = "none";
    const finalize = elements.get("finalize-update").listeners.get("click");
    assert.equal(typeof finalize, "function");
    await finalize();

    assert.ok(fetchCalls.length >= 2);
    assert.ok(fetchCalls.every(({ url }) => url.startsWith("http://127.0.0.1:8787/")));
    assert.ok(fetchCalls.some(({ url }) => url.endsWith("/pr/snapshot")));
    const handoff = fetchCalls.find(({ url }) => url.endsWith("/handoff/update"));
    assert.ok(handoff);
    assert.deepEqual(JSON.parse(handoff.init.body).publication, {
      change_description: "link",
      change_comment: "link",
      committed_file: null,
    });
    assert.equal(storage.taskState, undefined);
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
    "prompt-evidence", "report-evidence", "prompt-recovery", "change-description-publication", "change-comment-publication", "summary", "validation", "prompt", "status",
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
