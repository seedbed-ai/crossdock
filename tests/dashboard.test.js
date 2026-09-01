import test from "node:test";
import assert from "node:assert/strict";
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
  ]) {
    assert.throws(() => normalizeServiceUrl(value));
  }
});

test("legacy active task migration freezes the historical endpoint", () => {
  const original = { task_id: "legacy-task", phase: "ready" };
  const migrated = migrateActiveTaskServiceUrl(original);
  assert.equal(migrated.changed, true);
  assert.equal(migrated.taskState.service_url, DEFAULT_SERVICE_URL);
  assert.equal(original.service_url, undefined);
});

test("existing active task endpoint is normalized without reading a new preference", () => {
  const migrated = migrateActiveTaskServiceUrl({ task_id: "task-1", service_url: "http://127.0.0.1:8787/" });
  assert.equal(migrated.changed, false);
  assert.equal(migrated.taskState.service_url, "http://127.0.0.1:8787");
  assert.equal(resolveServiceUrl({ taskState: migrated.taskState, preference: "http://127.0.0.1:9999" }), "http://127.0.0.1:8787");
});

test("recovered service request uses frozen task endpoint after preference changes", async () => {
  const calls = [];
  const taskState = { task_id: "task-1", service_url: "http://127.0.0.1:8787" };
  const result = await postServiceJson({
    path: "/pr/snapshot",
    body: { target_repository: "example/repo", pull_request: 1 },
    taskState,
    preference: "http://127.0.0.1:9999",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return okResponse({ head_sha: "abc" });
    },
  });
  assert.deepEqual(result, { head_sha: "abc" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://127.0.0.1:8787/pr/snapshot");
  assert.equal(JSON.parse(calls[0].init.body).pull_request, 1);
});

test("pre-task service request uses the current validated preference", async () => {
  const calls = [];
  await postServiceJson({
    path: "/pr/snapshot",
    body: {},
    taskState: null,
    preference: "http://127.0.0.1:4321",
    fetchImpl: async (url) => {
      calls.push(url);
      return okResponse();
    },
  });
  assert.deepEqual(calls, ["http://127.0.0.1:4321/pr/snapshot"]);
});
