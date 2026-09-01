import test from "node:test";
import assert from "node:assert/strict";
import { persistTaskRecord, publishInitialHandoff, publishUpdateHandoff } from "../src/handoff.js";
import { TASK_RECORD_STORAGE_ADAPTER } from "../src/storage.js";

const storage = { repository: "example/private-task-records", branch: "main" };

function task(overrides = {}) {
  return {
    task_id: "task-001",
    created_at: "2026-08-31T20:00:00Z",
    completed_at: "2026-08-31T20:05:00Z",
    target_repository: "example/project",
    base_branch: "main",
    working_branch: "crossdock/task-001",
    issue: 123,
    agent_task_url: "https://example.invalid/tasks/task-001",
    result_commit: "0123456789abcdef0123456789abcdef01234567",
    prompt: "Implement the bounded task.",
    report: "## Summary\n\nImplemented and validated.",
    ...overrides,
  };
}

function conflictError(status = 422) {
  const error = new Error("already exists");
  error.status = status;
  return error;
}

function mockGithub() {
  const calls = [];
  let prBody = null;
  let storedContent = null;
  let fileCreated = false;
  let storedComment = null;

  return {
    calls,
    setStoredContent(value) { storedContent = value; fileCreated = true; },
    setStoredCommentBody(value) {
      if (!storedComment) throw new Error("no comment to mutate");
      storedComment = { ...storedComment, body: value };
    },
    async createPullRequest(repository, payload) {
      calls.push(["createPullRequest", repository, payload]);
      prBody = payload.body;
      return { number: 77, body: prBody };
    },
    async createFile(repository, path, content, message, branch) {
      calls.push(["createFile", repository, path, content, message, branch]);
      if (fileCreated) throw conflictError();
      fileCreated = true;
      storedContent = content;
      return { commit: { sha: "abc123" }, content: { sha: "blob123" } };
    },
    async getLatestCommitForPath(repository, path, ref) {
      calls.push(["getLatestCommitForPath", repository, path, ref]);
      return { sha: "abc123" };
    },
    async updatePullRequest(repository, number, payload) {
      calls.push(["updatePullRequest", repository, number, payload]);
      prBody = payload.body;
      return { number, body: prBody };
    },
    async getPullRequest(repository, number) {
      calls.push(["getPullRequest", repository, number]);
      return { number, body: prBody };
    },
    async getFile(repository, path, ref) {
      calls.push(["getFile", repository, path, ref]);
      return { sha: "blob123", content: Buffer.from(storedContent ?? "", "utf8").toString("base64") };
    },
    async addIssueComment(repository, number, body) {
      calls.push(["addIssueComment", repository, number, body]);
      storedComment = { id: 9, body };
      return storedComment;
    },
    async getIssueComments(repository, number) {
      calls.push(["getIssueComments", repository, number]);
      return storedComment ? [storedComment] : [];
    },
  };
}

function memoryStorage() {
  let stored = null;
  const calls = [];
  return {
    adapter: TASK_RECORD_STORAGE_ADAPTER,
    type: "memory-test",
    calls,
    async persistImmutable({ path, content, message }) {
      calls.push(["persistImmutable", path, message]);
      stored = { path, content, version: "memory-v1", url: `memory://records/${encodeURIComponent(path)}` };
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

test("storage must be explicit before mutation", async () => {
  const github = mockGithub();
  await assert.rejects(
    publishInitialHandoff({ github, task: task(), pr: { title: "change", summary: "summary" } }),
    /storage must be configured explicitly/,
  );
  assert.deepEqual(github.calls, []);
});

test("initial handoff persists configured record and verifies", async () => {
  const github = mockGithub();
  const result = await publishInitialHandoff({
    github,
    storage,
    task: task(),
    pr: { title: "test: bounded change", summary: "Implements the bounded change.", validation: ["tests passed"] },
  });
  assert.equal(result.pullRequest.number, 77);
  assert.equal(result.taskRecord.url, "https://github.com/example/private-task-records/blob/abc123/crossdock/tasks/example/project/2026/08/task-001.md");
  assert.match(result.pullRequest.body, /Task record:/);
  assert.deepEqual(github.calls.map(([name]) => name), ["createPullRequest", "createFile", "updatePullRequest", "getPullRequest", "getFile"]);
});

test("GitHub-backed full evidence is preflighted before PR creation", async () => {
  const github = mockGithub();
  await assert.rejects(
    publishInitialHandoff({
      github,
      storage,
      task: task({ prompt: "access_token=ghp_abcdefghijklmnopqrstuvwxyz123456" }),
      pr: { title: "change", summary: "summary" },
    }),
    /Forbidden-from-GitHub/,
  );
  assert.deepEqual(github.calls, []);
});

test("hash-only GitHub evidence may hash secret-like source without persisting plaintext", async () => {
  const github = mockGithub();
  const result = await publishInitialHandoff({
    github,
    storage,
    task: task({
      prompt: "access_token=ghp_abcdefghijklmnopqrstuvwxyz123456",
      evidence_policy: { prompt: "hash", report: "omit" },
    }),
    pr: { title: "change", summary: "summary" },
  });
  assert.ok(!result.taskRecord.content.includes("ghp_abcdefghijklmnopqrstuvwxyz123456"));
});

test("secret-like PR summary fails before any GitHub mutation", async () => {
  const github = mockGithub();
  await assert.rejects(
    publishInitialHandoff({
      github,
      storage,
      task: task({ evidence_policy: { prompt: "omit", report: "omit" } }),
      pr: { title: "change", summary: "access_token=ghp_abcdefghijklmnopqrstuvwxyz123456" },
    }),
    /Forbidden-from-GitHub/,
  );
  assert.deepEqual(github.calls, []);
});

test("task-record retry reuses an exact immutable record", async () => {
  const github = mockGithub();
  const record = { ...task(), task_type: "initial", parent_task_id: null };
  const first = await persistTaskRecord({ github, storage, record });
  const second = await persistTaskRecord({ github, storage, record });
  assert.deepEqual(second, first);
  assert.equal(github.calls.filter(([name]) => name === "createFile").length, 2);
  assert.equal(github.calls.filter(([name]) => name === "getLatestCommitForPath").length, 1);
});

test("task-record retry fails closed when existing content differs", async () => {
  const github = mockGithub();
  const record = { ...task(), task_type: "initial", parent_task_id: null };
  await persistTaskRecord({ github, storage, record });
  github.setStoredContent("conflicting immutable content\n");
  await assert.rejects(persistTaskRecord({ github, storage, record }), /existing immutable record has different content/);
});

test("update handoff adds a new top-level comment without editing PR", async () => {
  const github = mockGithub();
  const result = await publishUpdateHandoff({
    github,
    storage,
    task: task({ task_id: "task-002", pull_request: 77, parent_task_id: "task-001" }),
    update: { summary: "Addressed review findings.", validation: ["tests passed"] },
  });
  assert.match(result.comment.body, /Crossdock branch update/);
  assert.ok(!github.calls.some(([name]) => name === "updatePullRequest"));
});

test("secret-like update summary fails before comment creation", async () => {
  const github = mockGithub();
  await assert.rejects(
    publishUpdateHandoff({
      github,
      storage,
      task: task({ task_id: "task-002", pull_request: 77, parent_task_id: "task-001", evidence_policy: { prompt: "omit", report: "omit" } }),
      update: { summary: "password=not-for-github", validation: [] },
    }),
    /Forbidden-from-GitHub/,
  );
  assert.equal(github.calls.filter(([name]) => name === "addIssueComment").length, 0);
});

test("update retry reuses the exact existing task-record comment", async () => {
  const github = mockGithub();
  const updateTask = task({ task_id: "task-002", pull_request: 77, parent_task_id: "task-001" });
  const update = { summary: "Addressed review findings.", validation: ["tests passed"] };
  const first = await publishUpdateHandoff({ github, storage, task: updateTask, update });
  const second = await publishUpdateHandoff({ github, storage, task: updateTask, update });
  assert.equal(second.comment.id, first.comment.id);
  assert.equal(github.calls.filter(([name]) => name === "addIssueComment").length, 1);
});

test("update retry fails closed on conflicting comment for the same task record", async () => {
  const github = mockGithub();
  const updateTask = task({ task_id: "task-002", pull_request: 77, parent_task_id: "task-001" });
  const update = { summary: "Addressed review findings.", validation: ["tests passed"] };
  const first = await publishUpdateHandoff({ github, storage, task: updateTask, update });
  github.setStoredCommentBody(`${first.comment.body}\nconflicting edit\n`);
  await assert.rejects(
    publishUpdateHandoff({ github, storage, task: updateTask, update }),
    /existing task-record comment has different content/,
  );
  assert.equal(github.calls.filter(([name]) => name === "addIssueComment").length, 1);
});

test("handoff accepts a conforming non-GitHub task-record storage adapter", async () => {
  const github = mockGithub();
  const adapter = memoryStorage();
  const secret = "access_token=ghp_abcdefghijklmnopqrstuvwxyz123456";
  const result = await publishUpdateHandoff({
    github,
    storage: adapter,
    task: task({ task_id: "task-memory", pull_request: 77, parent_task_id: "task-001", prompt: secret }),
    update: { summary: "Stored outside GitHub.", validation: [] },
  });
  assert.match(result.taskRecord.url, /^memory:\/\/records\//);
  assert.ok(result.taskRecord.content.includes(secret));
  assert.deepEqual(adapter.calls.map(([name]) => name), ["persistImmutable", "verifyImmutable"]);
  assert.ok(!github.calls.some(([name]) => name === "createFile" || name === "getFile"));
});