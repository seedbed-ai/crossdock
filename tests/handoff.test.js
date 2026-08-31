import test from "node:test";
import assert from "node:assert/strict";
import { publishInitialHandoff, publishUpdateHandoff } from "../src/handoff.js";

const storage = { repository: "example/private-task-records", branch: "main" };
function task(overrides = {}) { return { task_id: "task-001", created_at: "2026-08-31T20:00:00Z", completed_at: "2026-08-31T20:05:00Z", target_repository: "example/project", base_branch: "main", working_branch: "crossdock/task-001", issue: 123, agent_task_url: "https://example.invalid/tasks/task-001", result_commit: "0123456789abcdef0123456789abcdef01234567", prompt: "Implement the bounded task.", report: "## Summary\n\nImplemented and validated.", ...overrides }; }
function mockGithub() {
  const calls = []; let prBody = null; let storedContent = null; let storedComment = null;
  return { calls,
    async createPullRequest(repository, payload) { calls.push(["createPullRequest", repository, payload]); prBody = payload.body; return { number: 77, body: prBody }; },
    async createFile(repository, path, content, message, branch) { calls.push(["createFile", repository, path, content, message, branch]); storedContent = content; return { commit: { sha: "abc123" }, content: { sha: "blob123" } }; },
    async updatePullRequest(repository, number, payload) { calls.push(["updatePullRequest", repository, number, payload]); prBody = payload.body; return { number, body: prBody }; },
    async getPullRequest(repository, number) { calls.push(["getPullRequest", repository, number]); return { number, body: prBody }; },
    async getFile(repository, path, ref) { calls.push(["getFile", repository, path, ref]); return { sha: "blob123", content: Buffer.from(storedContent, "utf8").toString("base64") }; },
    async addIssueComment(repository, number, body) { calls.push(["addIssueComment", repository, number, body]); storedComment = { id: 9, body }; return storedComment; },
    async getIssueComments(repository, number) { calls.push(["getIssueComments", repository, number]); return storedComment ? [storedComment] : []; },
  };
}

test("storage must be explicit before mutation", async () => { const github = mockGithub(); await assert.rejects(publishInitialHandoff({ github, task: task(), pr: { title: "change", summary: "summary" } }), /storage must be configured explicitly/); assert.deepEqual(github.calls, []); });

test("initial handoff persists configured record and verifies", async () => { const github = mockGithub(); const result = await publishInitialHandoff({ github, storage, task: task(), pr: { title: "test: bounded change", summary: "Implements the bounded change.", validation: ["tests passed"] } }); assert.equal(result.pullRequest.number, 77); assert.equal(result.taskLog.url, "https://github.com/example/private-task-records/blob/abc123/crossdock/tasks/example/project/2026/08/task-001.md"); assert.match(result.pullRequest.body, /Task record:/); assert.deepEqual(github.calls.map(([name]) => name), ["createPullRequest", "createFile", "updatePullRequest", "getPullRequest", "getFile"]); });

test("forbidden content fails before PR creation", async () => { const github = mockGithub(); await assert.rejects(publishInitialHandoff({ github, storage, task: task({ prompt: "access_token=ghp_abcdefghijklmnopqrstuvwxyz123456" }), pr: { title: "change", summary: "summary" } }), /Forbidden-from-GitHub/); assert.deepEqual(github.calls, []); });

test("update handoff adds a new top-level comment without editing PR", async () => { const github = mockGithub(); const result = await publishUpdateHandoff({ github, storage, task: task({ task_id: "task-002", pull_request: 77, parent_task_id: "task-001" }), update: { summary: "Addressed review findings.", validation: ["tests passed"] } }); assert.match(result.comment.body, /Crossdock branch update/); assert.ok(!github.calls.some(([name]) => name === "updatePullRequest")); });
