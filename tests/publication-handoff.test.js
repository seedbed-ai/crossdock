import test from "node:test";
import assert from "node:assert/strict";
import { publishExistingInitialHandoff, publishInitialHandoff, publishUpdateHandoff } from "../src/handoff.js";
import { TASK_RECORD_STORAGE_ADAPTER } from "../src/storage.js";

function task(overrides = {}) {
  return {
    task_id: "task-publication",
    created_at: "2026-09-01T20:00:00Z",
    completed_at: "2026-09-01T20:05:00Z",
    target_repository: "example/project",
    base_branch: "main",
    working_branch: "crossdock/task-publication",
    pull_request: 42,
    issue: null,
    agent_task_url: "https://example.invalid/tasks/task-publication",
    result_commit: "0123456789abcdef0123456789abcdef01234567",
    evidence_policy: { prompt: "omit", report: "omit" },
    ...overrides,
  };
}

function memoryStorage() {
  const calls = [];
  let stored = null;
  return {
    adapter: TASK_RECORD_STORAGE_ADAPTER,
    type: "memory-test",
    calls,
    async persistImmutable({ path, content }) {
      calls.push(["persistImmutable", path]);
      stored = { path, content, version: "v1", url: `memory://records/${encodeURIComponent(path)}` };
      return stored;
    },
    async verifyImmutable({ path, version, expectedContent }) {
      calls.push(["verifyImmutable", path, version]);
      assert.equal(path, stored.path);
      assert.equal(version, stored.version);
      assert.equal(expectedContent, stored.content);
      return true;
    },
  };
}

function github() {
  const calls = [];
  const files = new Map();
  return {
    calls,
    async createPullRequest(repository, payload) {
      calls.push(["createPullRequest", repository, payload]);
      return { number: 42, body: payload.body };
    },
    async getPullRequest(repository, number) {
      calls.push(["getPullRequest", repository, number]);
      return { number, body: "Existing provider-created body", html_url: `https://github.com/${repository}/pull/${number}` };
    },
    async updatePullRequest(repository, number, payload) {
      calls.push(["updatePullRequest", repository, number, payload]);
      return { number, body: payload.body };
    },
    async getIssueComments(repository, number) {
      calls.push(["getIssueComments", repository, number]);
      return [];
    },
    async addIssueComment(repository, number, body) {
      calls.push(["addIssueComment", repository, number, body]);
      return { id: 9, body };
    },
    async getFile(repository, path, branch) {
      calls.push(["getFile", repository, path, branch]);
      if (!files.has(`${repository}:${branch}:${path}`)) throw Object.assign(new Error("not found"), { status: 404 });
      return { encoding: "base64", content: Buffer.from(files.get(`${repository}:${branch}:${path}`), "utf8").toString("base64") };
    },
    async createFile(repository, path, content, message, branch) {
      calls.push(["createFile", repository, path, branch]);
      files.set(`${repository}:${branch}:${path}`, content);
      return { commit: { sha: "publication" } };
    },
  };
}

const nonePolicy = {
  change_description: "none",
  change_comment: "none",
  committed_file: null,
};

test("initial none presentation persists and verifies without rewriting the PR body", async () => {
  const remote = github();
  const storage = memoryStorage();
  const result = await publishExistingInitialHandoff({
    github: remote,
    storage,
    task: task(),
    pr: { summary: "password=not-published", validation: ["api_key=not-published"] },
    publication: nonePolicy,
  });

  assert.equal(result.pullRequest.number, 42);
  assert.deepEqual(result.publication, { change_description: "none" });
  assert.ok(!remote.calls.some(([name]) => name === "updatePullRequest"));
  assert.deepEqual(storage.calls.map(([name]) => name), ["persistImmutable", "verifyImmutable"]);
});

test("update none presentation persists and verifies without reading or writing PR comments", async () => {
  const remote = github();
  const storage = memoryStorage();
  const result = await publishUpdateHandoff({
    github: remote,
    storage,
    task: task({ task_id: "task-update", parent_task_id: "task-parent" }),
    update: { summary: "secret=not-published", validation: ["token=not-published"] },
    publication: nonePolicy,
  });

  assert.equal(result.comment, null);
  assert.deepEqual(result.publication, { change_comment: "none" });
  assert.ok(!remote.calls.some(([name]) => name === "getIssueComments" || name === "addIssueComment"));
  assert.deepEqual(storage.calls.map(([name]) => name), ["persistImmutable", "verifyImmutable"]);
});

test("unsupported summary presentation fails before durable or GitHub mutation", async () => {
  for (const [kind, invoke] of [
    ["initial", ({ remote, storage }) => publishExistingInitialHandoff({
      github: remote,
      storage,
      task: task(),
      pr: { summary: "safe" },
      publication: { ...nonePolicy, change_description: "summary" },
    })],
    ["update", ({ remote, storage }) => publishUpdateHandoff({
      github: remote,
      storage,
      task: task({ task_id: "task-update", parent_task_id: "task-parent" }),
      update: { summary: "safe" },
      publication: { ...nonePolicy, change_comment: "summary" },
    })],
  ]) {
    const remote = github();
    const storage = memoryStorage();
    await assert.rejects(invoke({ remote, storage }), new RegExp(`${kind === "initial" ? "change_description" : "change_comment"} summary provenance publication`));
    assert.deepEqual(remote.calls, []);
    assert.deepEqual(storage.calls, []);
  }
});

test("configured committed-file publication executes independently for update handoff", async () => {
  const remote = github();
  const storage = memoryStorage();
  const result = await publishUpdateHandoff({
      github: remote,
      storage,
      task: task({ task_id: "task-update", parent_task_id: "task-parent" }),
      update: { summary: "safe" },
      publication: {
        change_description: "none",
        change_comment: "none",
        committed_file: {
          presentation: "reference",
          adapter: "github",
          repository: "example/provenance",
          branch: "main",
          path_template: "crossdock/{task_id}.md",
        },
      },
    });
  assert.deepEqual(result.publication.committed_file, {
    presentation: "reference", repository: "example/provenance", branch: "main",
    path: "crossdock/task-update.md", verification: "verified", result: "created",
  });
  assert.deepEqual(storage.calls.map(([name]) => name), ["persistImmutable", "verifyImmutable"]);
  assert.ok(remote.calls.some(([name, repository]) => name === "createFile" && repository === "example/provenance"));
});

test("invalid resolved committed-file path fails before initial PR creation", async () => {
  const remote = github();
  const storage = memoryStorage();
  await assert.rejects(publishInitialHandoff({
    github: remote,
    storage,
    task: task({ pull_request: null }),
    pr: { title: "Safe", summary: "Safe" },
    publication: {
      change_description: "none",
      change_comment: "none",
      committed_file: { presentation: "link", adapter: "github", repository: "example/provenance", branch: "main", path_template: "safe/{task_id}/{leftover}.md" },
    },
  }), /repository-relative path/);
  assert.deepEqual(remote.calls, []);
  assert.deepEqual(storage.calls, []);
});
