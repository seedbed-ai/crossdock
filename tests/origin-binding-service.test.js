import test from "node:test";
import assert from "node:assert/strict";
import { dispatchHandoff } from "../src/service.js";
import { renderOriginBinding } from "../src/origin-binding.js";

const storage = { repository: "owner/private-records", branch: "main" };
const binding = {
  target_repository: "owner/repo",
  pull_request: 9,
  originating_task_id: "crossdock-origin",
  provider: "codex",
  agent_task_url: "https://chatgpt.com/codex/cloud/tasks/task_origin",
  created_at: "2026-09-05T17:00:00Z",
  initial_working_branch: "codex/example",
};

function githubWithBinding(value = binding) {
  const content = renderOriginBinding(value);
  return {
    async createFile() { throw new Error("not expected"); },
    async getFile(repository, path, ref) {
      assert.equal(repository, "owner/private-records");
      assert.equal(path, "crossdock/origins/owner/repo/pull/9.json");
      assert.equal(ref, "main");
      return { sha: "blob", content: Buffer.from(content, "utf8").toString("base64") };
    },
  };
}

test("origin binding resolution endpoint returns provider task identity", async () => {
  const result = await dispatchHandoff({
    method: "POST",
    path: "/origin-binding/resolve",
    github: githubWithBinding(),
    body: { target_repository: " owner/repo ", pull_request: 9, storage },
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    repository: "owner/repo",
    pull_request: 9,
    originating_task_id: "crossdock-origin",
    provider: "codex",
    agent_task_url: "https://chatgpt.com/codex/cloud/tasks/task_origin",
    created_at: "2026-09-05T17:00:00.000Z",
    initial_working_branch: "codex/example",
  });
});

test("origin binding resolution endpoint requires explicit storage and positive PR", async () => {
  await assert.rejects(
    dispatchHandoff({
      method: "POST",
      path: "/origin-binding/resolve",
      github: githubWithBinding(),
      body: { target_repository: "owner/repo", pull_request: 9 },
    }),
    /storage must be an object/,
  );

  await assert.rejects(
    dispatchHandoff({
      method: "POST",
      path: "/origin-binding/resolve",
      github: githubWithBinding(),
      body: { target_repository: "owner/repo", pull_request: 0, storage },
    }),
    /pull_request is required/,
  );
});

test("origin binding resolution fails closed when remote identity conflicts", async () => {
  const conflicting = { ...binding, target_repository: "owner/other" };
  const content = renderOriginBinding(conflicting);
  const github = {
    async createFile() { throw new Error("not expected"); },
    async getFile() {
      return { sha: "blob", content: Buffer.from(content, "utf8").toString("base64") };
    },
  };

  await assert.rejects(
    dispatchHandoff({
      method: "POST",
      path: "/origin-binding/resolve",
      github,
      body: { target_repository: "owner/repo", pull_request: 9, storage },
    }),
    /identity does not match requested PR/,
  );
});
