import test from "node:test";
import assert from "node:assert/strict";
import { persistOriginBinding, resolveOriginBinding } from "../extension/origin-binding-client.js";

const storage = { repository: "owner/private-records", branch: "main" };
const serviceUrl = "http://127.0.0.1:3210";

function response(body, ok = true, status = 200) {
  return { ok, status, async json() { return body; } };
}

test("browser client persists exact origin identity through loopback service", async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return response({
      repository: "owner/repo",
      pull_request: 9,
      originating_task_id: "crossdock-origin",
      provider: "codex",
      agent_task_url: "https://chatgpt.com/codex/cloud/tasks/task_origin",
      origin_binding_url: "https://github.com/owner/private-records/blob/abc/crossdock/origins/owner/repo/pull/9.json",
      origin_binding_version: "abc",
    });
  };

  const result = await persistOriginBinding({
    storage,
    repository: "owner/repo",
    pullRequest: 9,
    originatingTaskId: "crossdock-origin",
    provider: "codex",
    agentTaskUrl: "https://chatgpt.com/codex/cloud/tasks/task_origin",
    createdAt: "2026-09-05T17:00:00Z",
    initialWorkingBranch: "codex/example",
    serviceUrl,
    fetchImpl,
  });

  assert.equal(request.url, "http://127.0.0.1:3210/origin-binding/persist");
  assert.equal(request.options.method, "POST");
  assert.deepEqual(request.body, {
    storage,
    target_repository: "owner/repo",
    pull_request: 9,
    originating_task_id: "crossdock-origin",
    provider: "codex",
    agent_task_url: "https://chatgpt.com/codex/cloud/tasks/task_origin",
    created_at: "2026-09-05T17:00:00Z",
    initial_working_branch: "codex/example",
  });
  assert.equal(result.origin_binding_version, "abc");
  assert.ok(Object.isFrozen(result));
});

test("browser client resolves exact originating task identity", async () => {
  const fetchImpl = async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), {
      storage,
      target_repository: "owner/repo",
      pull_request: 9,
    });
    return response({
      repository: "owner/repo",
      pull_request: 9,
      originating_task_id: "crossdock-origin",
      provider: "codex",
      agent_task_url: "https://chatgpt.com/codex/cloud/tasks/task_origin",
      created_at: "2026-09-05T17:00:00.000Z",
      initial_working_branch: "codex/example",
    });
  };

  const result = await resolveOriginBinding({
    storage,
    repository: "owner/repo",
    pullRequest: 9,
    serviceUrl,
    fetchImpl,
  });

  assert.equal(result.agent_task_url, "https://chatgpt.com/codex/cloud/tasks/task_origin");
  assert.equal(result.originating_task_id, "crossdock-origin");
  assert.ok(Object.isFrozen(result));
});

test("browser client rejects service identity mismatches", async () => {
  const fetchImpl = async () => response({
    repository: "owner/other",
    pull_request: 9,
    originating_task_id: "crossdock-origin",
    provider: "codex",
    agent_task_url: "https://chatgpt.com/codex/cloud/tasks/task_origin",
    created_at: "2026-09-05T17:00:00.000Z",
    initial_working_branch: null,
  });

  await assert.rejects(
    resolveOriginBinding({ storage, repository: "owner/repo", pullRequest: 9, serviceUrl, fetchImpl }),
    /different repository or PR identity/,
  );
});

test("browser client fails before network mutation on malformed routing input", async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return response({}); };

  await assert.rejects(
    persistOriginBinding({
      storage,
      repository: "repo",
      pullRequest: 9,
      originatingTaskId: "task",
      provider: "codex",
      agentTaskUrl: "https://chatgpt.com/codex/cloud/tasks/task_origin",
      createdAt: "2026-09-05T17:00:00Z",
      serviceUrl,
      fetchImpl,
    }),
    /repository must be owner\/repo/,
  );
  assert.equal(called, false);
});
