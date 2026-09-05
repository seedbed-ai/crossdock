import test from "node:test";
import assert from "node:assert/strict";
import { dispatchHandoff } from "../src/service.js";

const storage = { repository: "owner/private-records", branch: "main" };

function githubMock() {
  let stored = null;
  return {
    async createFile(repository, path, content, message, branch) {
      assert.equal(repository, "owner/private-records");
      assert.equal(path, "crossdock/origins/owner/repo/pull/9.json");
      assert.match(message, /bind PR #9/);
      assert.equal(branch, "main");
      stored = content;
      return { commit: { sha: "commit-origin" } };
    },
    async getFile(repository, path) {
      assert.equal(repository, "owner/private-records");
      assert.equal(path, "crossdock/origins/owner/repo/pull/9.json");
      return { sha: "blob", content: Buffer.from(stored ?? "", "utf8").toString("base64") };
    },
    async getLatestCommitForPath() {
      return { sha: "commit-origin" };
    },
  };
}

test("origin binding persistence endpoint stores immutable routing identity", async () => {
  const result = await dispatchHandoff({
    method: "POST",
    path: "/origin-binding/persist",
    github: githubMock(),
    body: {
      storage,
      target_repository: " owner/repo ",
      pull_request: 9,
      originating_task_id: "crossdock-origin",
      provider: "codex",
      agent_task_url: "https://chatgpt.com/codex/cloud/tasks/task_origin",
      created_at: "2026-09-05T17:00:00Z",
      initial_working_branch: "codex/example",
    },
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    repository: "owner/repo",
    pull_request: 9,
    originating_task_id: "crossdock-origin",
    provider: "codex",
    agent_task_url: "https://chatgpt.com/codex/cloud/tasks/task_origin",
    origin_binding_url: "https://github.com/owner/private-records/blob/commit-origin/crossdock/origins/owner/repo/pull/9.json",
    origin_binding_version: "commit-origin",
  });
});

test("origin binding persistence endpoint validates provider routing fields", async () => {
  const base = {
    storage,
    target_repository: "owner/repo",
    pull_request: 9,
    originating_task_id: "crossdock-origin",
    provider: "codex",
    agent_task_url: "https://chatgpt.com/codex/cloud/tasks/task_origin",
    created_at: "2026-09-05T17:00:00Z",
  };

  for (const [field, value] of [["originating_task_id", ""], ["provider", ""], ["agent_task_url", "relative"], ["created_at", "bad"]]) {
    await assert.rejects(
      dispatchHandoff({ method: "POST", path: "/origin-binding/persist", github: githubMock(), body: { ...base, [field]: value } }),
    );
  }
});
