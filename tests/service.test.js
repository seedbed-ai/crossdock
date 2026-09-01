import test from "node:test";
import assert from "node:assert/strict";
import { dispatchHandoff, hydrateTaskFromPullRequest } from "../src/service.js";

function githubMock() {
  let body = "provisional";
  let storedContent = "";
  return {
    calls: [],
    async getPullRequest(repository, number) {
      this.calls.push(["getPullRequest", repository, number]);
      return { number, body, html_url: `https://github.com/${repository}/pull/${number}`, base: { ref: "main" }, head: { ref: "crossdock/task", sha: "0123456789abcdef0123456789abcdef01234567" } };
    },
    async createFile(repository, path, content) {
      this.calls.push(["createFile", repository, path]); storedContent = content; return { commit: { sha: "abc123" } };
    },
    async updatePullRequest(repository, number, payload) {
      this.calls.push(["updatePullRequest", repository, number]); body = payload.body; return { number, body };
    },
    async getFile(repository, path, ref) {
      this.calls.push(["getFile", repository, path, ref]); return { sha: "blob", content: Buffer.from(storedContent).toString("base64") };
    },
    async addIssueComment() { throw new Error("not expected"); },
    async getIssueComments() { this.calls.push(["getIssueComments"]); return []; },
  };
}

const task = {
  task_id: "task-001",
  created_at: "2026-08-31T20:00:00Z",
  completed_at: "2026-08-31T20:05:00Z",
  target_repository: "example/project",
  pull_request: 9,
  prompt: "Do the task.",
  report: "Done.",
  agent_task_url: "https://example.invalid/task/1",
};

const storage = { repository: "example/private-records", branch: "main" };
const nonePublication = { change_description: "none", change_comment: "none", committed_file: null };

test("hydrateTaskFromPullRequest trusts remote PR refs and head SHA", async () => {
  const github = githubMock();
  const hydrated = await hydrateTaskFromPullRequest(github, task);
  assert.equal(hydrated.base_branch, "main");
  assert.equal(hydrated.working_branch, "crossdock/task");
  assert.equal(hydrated.result_commit, "0123456789abcdef0123456789abcdef01234567");
});

test("initial service enriches existing PR instead of creating another", async () => {
  const github = githubMock();
  const result = await dispatchHandoff({
    method: "POST",
    path: "/handoff/initial",
    github,
    body: { task, storage, pr: { summary: "Implemented.", validation: ["tests passed"] } },
  });
  assert.equal(result.status, 200);
  assert.ok(github.calls.some(([name]) => name === "updatePullRequest"));
  assert.ok(!github.calls.some(([name]) => name === "createPullRequest"));
  assert.match(result.body.task_record_url, /example\/private-records/);
  assert.deepEqual(result.body.publication, { change_description: "link" });
});

test("service passes none publication through and returns no update-comment identity", async () => {
  const github = githubMock();
  const result = await dispatchHandoff({
    method: "POST",
    path: "/handoff/update",
    github,
    body: {
      task: { ...task, task_id: "task-002", parent_task_id: "task-001" },
      storage,
      update: { summary: "Recorded without a PR comment." },
      publication: nonePublication,
    },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.comment_id, null);
  assert.equal(result.body.comment_url, null);
  assert.deepEqual(result.body.publication, { change_comment: "none" });
  assert.ok(!github.calls.some(([name]) => name === "getIssueComments"));
});

test("handoff endpoints require explicit storage", async () => {
  const github = githubMock();
  await assert.rejects(
    dispatchHandoff({ method: "POST", path: "/handoff/initial", github, body: { task, pr: { summary: "Implemented." } } }),
    /storage must be an object/,
  );
});
