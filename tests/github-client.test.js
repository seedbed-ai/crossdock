import test from "node:test";
import assert from "node:assert/strict";
import { GitHubClient } from "../src/github-client.js";
function response(status, payload) { return { ok: status >= 200 && status < 300, status, async text() { return payload == null ? "" : JSON.stringify(payload); } }; }

test("GitHubClient creates UTF-8 files with base64 content", async () => {
  const calls = []; const client = new GitHubClient({ token: "test-token", fetchImpl: async (url, options) => { calls.push([url, options]); return response(201, { commit: { sha: "abc123" } }); } });
  await client.createFile("example/private-task-records", "crossdock/tasks/a b.md", "hello", "record task", "main");
  const [url, options] = calls[0]; assert.equal(url, "https://api.github.com/repos/example/private-task-records/contents/crossdock/tasks/a%20b.md"); assert.equal(options.method, "PUT"); assert.equal(options.headers.Authorization, "Bearer test-token");
});

test("GitHubClient exposes GitHub error status and payload", async () => {
  const client = new GitHubClient({ token: "test-token", fetchImpl: async () => response(422, { message: "Validation Failed" }) });
  await assert.rejects(client.getPullRequest("example/project", 1), (error) => error.status === 422 && error.payload.message === "Validation Failed");
});
