import test from "node:test";
import assert from "node:assert/strict";
import { GitHubClient, decodeGitHubFileContent } from "../src/github-client.js";
function response(status, payload) { return { ok: status >= 200 && status < 300, status, async text() { return payload == null ? "" : JSON.stringify(payload); } }; }

test("GitHubClient reads repository metadata", async () => {
  const calls = [];
  const client = new GitHubClient({ token: "test-token", fetchImpl: async (url, options) => { calls.push([url, options]); return response(200, { default_branch: "main" }); } });
  const repository = await client.getRepository("example/project");
  assert.equal(repository.default_branch, "main");
  assert.equal(calls[0][0], "https://api.github.com/repos/example/project");
  assert.equal(calls[0][1].method, "GET");
});

test("GitHubClient creates UTF-8 files with base64 content", async () => {
  const calls = []; const client = new GitHubClient({ token: "test-token", fetchImpl: async (url, options) => { calls.push([url, options]); return response(201, { commit: { sha: "abc123" } }); } });
  await client.createFile("example/private-task-records", "crossdock/tasks/a b.md", "hello", "record task", "main");
  const [url, options] = calls[0]; assert.equal(url, "https://api.github.com/repos/example/private-task-records/contents/crossdock/tasks/a%20b.md"); assert.equal(options.method, "PUT"); assert.equal(options.headers.Authorization, "Bearer test-token");
});

test("GitHubClient resolves latest commit for an immutable task-record path", async () => {
  const calls = [];
  const client = new GitHubClient({ token: "test-token", fetchImpl: async (url, options) => { calls.push([url, options]); return response(200, [{ sha: "record-commit" }]); } });
  const commit = await client.getLatestCommitForPath("example/private-task-records", "crossdock/tasks/example/project/task 1.md", "records/main");
  assert.equal(commit.sha, "record-commit");
  const [url, options] = calls[0];
  assert.equal(options.method, "GET");
  const parsed = new URL(url);
  assert.equal(parsed.pathname, "/repos/example/private-task-records/commits");
  assert.equal(parsed.searchParams.get("path"), "crossdock/tasks/example/project/task 1.md");
  assert.equal(parsed.searchParams.get("sha"), "records/main");
  assert.equal(parsed.searchParams.get("per_page"), "1");
});

test("GitHubClient rejects missing commit lookup results", async () => {
  const client = new GitHubClient({ token: "test-token", fetchImpl: async () => response(200, []) });
  await assert.rejects(client.getLatestCommitForPath("example/private-task-records", "task.md", "main"), /did not return a commit/);
});

test("GitHubClient exposes GitHub error status and payload", async () => {
  const client = new GitHubClient({ token: "test-token", fetchImpl: async () => response(422, { message: "Validation Failed" }) });
  await assert.rejects(client.getPullRequest("example/project", 1), (error) => error.status === 422 && error.payload.message === "Validation Failed");
});

test("GitHub file content decoding handles wrapped base64 and rejects malformed payloads", () => {
  assert.equal(decodeGitHubFileContent({ encoding: "base64", content: "aGVs\nbG8=" }).toString("utf8"), "hello");
  assert.throws(() => decodeGitHubFileContent({ encoding: "utf-8", content: "hello" }), /base64 content/);
  assert.throws(() => decodeGitHubFileContent({ encoding: "base64", content: "%%%=" }), /malformed base64/);
});
