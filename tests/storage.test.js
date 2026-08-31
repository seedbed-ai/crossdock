import test from "node:test";
import assert from "node:assert/strict";
import { TASK_RECORD_STORAGE_ADAPTER, createGitHubTaskRecordStorage, isTaskRecordStorageAdapter, resolveTaskRecordStorage } from "../src/storage.js";

function conflict(status = 422) { const error = new Error("exists"); error.status = status; return error; }

function githubMock() {
  let content = null;
  let created = false;
  const calls = [];
  return {
    calls,
    setContent(value) { content = value; created = true; },
    async createFile(repository, path, value, message, branch) {
      calls.push(["createFile", repository, path, value, message, branch]);
      if (created) throw conflict();
      created = true;
      content = value;
      return { commit: { sha: "commit-1" } };
    },
    async getFile(repository, path, ref) {
      calls.push(["getFile", repository, path, ref]);
      return { sha: "blob-1", content: Buffer.from(content ?? "", "utf8").toString("base64") };
    },
    async getLatestCommitForPath(repository, path, ref) {
      calls.push(["getLatestCommitForPath", repository, path, ref]);
      return { sha: "commit-1" };
    },
  };
}

test("GitHub storage persists an immutable record and returns stable adapter metadata", async () => {
  const github = githubMock();
  const storage = createGitHubTaskRecordStorage({ github, repository: "example/private-records", branch: "main" });
  assert.ok(isTaskRecordStorageAdapter(storage));
  const result = await storage.persistImmutable({ path: "crossdock/tasks/task.md", content: "record\n", message: "record task" });
  assert.deepEqual(result, {
    path: "crossdock/tasks/task.md",
    content: "record\n",
    version: "commit-1",
    commitSha: "commit-1",
    url: "https://github.com/example/private-records/blob/commit-1/crossdock/tasks/task.md",
  });
  await assert.doesNotReject(storage.verifyImmutable({ path: result.path, version: result.version, expectedContent: result.content }));
});

test("GitHub storage retry recovers only exact existing content", async () => {
  const github = githubMock();
  const storage = createGitHubTaskRecordStorage({ github, repository: "example/private-records", branch: "main" });
  const first = await storage.persistImmutable({ path: "task.md", content: "same\n", message: "record task" });
  const second = await storage.persistImmutable({ path: "task.md", content: "same\n", message: "record task" });
  assert.deepEqual(second, first);
  assert.equal(github.calls.filter(([name]) => name === "getLatestCommitForPath").length, 1);
});

test("GitHub storage retry fails closed on conflicting immutable content", async () => {
  const github = githubMock();
  const storage = createGitHubTaskRecordStorage({ github, repository: "example/private-records", branch: "main" });
  await storage.persistImmutable({ path: "task.md", content: "expected\n", message: "record task" });
  github.setContent("different\n");
  await assert.rejects(storage.persistImmutable({ path: "task.md", content: "expected\n", message: "record task" }), /different content/);
});

test("GitHub storage verification fails closed on remote mismatch", async () => {
  const github = githubMock();
  const storage = createGitHubTaskRecordStorage({ github, repository: "example/private-records", branch: "main" });
  const result = await storage.persistImmutable({ path: "task.md", content: "expected\n", message: "record task" });
  github.setContent("different\n");
  await assert.rejects(storage.verifyImmutable({ path: result.path, version: result.version, expectedContent: result.content }), /remote content mismatch/);
});

test("plain GitHub storage configuration resolves to the first adapter", () => {
  const github = githubMock();
  const storage = resolveTaskRecordStorage({ github, storage: { repository: "example/private-records", branch: "main" } });
  assert.equal(storage.type, "github");
  assert.equal(storage.repository, "example/private-records");
});

test("an already-instantiated conforming adapter is reused", () => {
  const adapter = {
    adapter: TASK_RECORD_STORAGE_ADAPTER,
    type: "test",
    async persistImmutable() {},
    async verifyImmutable() {},
  };
  assert.ok(isTaskRecordStorageAdapter(adapter));
  assert.equal(resolveTaskRecordStorage({ github: null, storage: adapter }), adapter);
});

test("unsupported serialized storage types fail rather than falling back", () => {
  assert.throws(
    () => resolveTaskRecordStorage({ github: githubMock(), storage: { type: "filesystem", repository: "example/records", branch: "main" } }),
    /unsupported task-record storage type/,
  );
});

test("unknown storage fields fail instead of being ignored", () => {
  assert.throws(
    () => resolveTaskRecordStorage({ github: githubMock(), storage: { repository: "example/records", branch: "main", accidental: true } }),
    /unknown field: accidental/,
  );
});
