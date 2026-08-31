import test from "node:test";
import assert from "node:assert/strict";
import { canonicalizeText, renderTaskLog, sha256, taskLogPath } from "../src/task-log.js";

function baseRecord(overrides = {}) {
  return {
    task_id: "task-001", task_type: "initial", created_at: "2026-08-31T20:00:00Z", completed_at: "2026-08-31T20:05:00Z",
    target_repository: "example/project", base_branch: "main", working_branch: "crossdock/task-001", pull_request: 42, issue: 123,
    agent_task_url: "https://example.invalid/tasks/task-001", result_commit: "0123456789abcdef0123456789abcdef01234567", parent_task_id: null,
    prompt: "Do the thing.\r\nPreserve invariants.\r\n", report: "## Summary\r\n\r\nDone.\r\n", ...overrides,
  };
}

test("canonicalizeText normalizes CRLF and CR to LF", () => assert.equal(canonicalizeText("a\r\nb\rc\n"), "a\nb\nc\n"));

test("renderTaskLog preserves canonical prompt and report with digests", () => {
  const record = baseRecord(); const rendered = renderTaskLog(record);
  assert.match(rendered, /schema: "crossdock\.task-record\/v1"/);
  assert.match(rendered, new RegExp(`prompt_sha256: "${sha256(record.prompt)}"`));
  assert.match(rendered, new RegExp(`report_sha256: "${sha256(record.report)}"`));
  assert.match(rendered, /## Prompt\n\nDo the thing\.\nPreserve invariants\.\n/);
  assert.match(rendered, /## Report\n\n## Summary\n\nDone\.\n/);
  assert.ok(!rendered.includes("\r"));
});

test("taskLogPath is deterministic", () => assert.equal(taskLogPath(baseRecord()), "crossdock/tasks/example/project/2026/08/task-001.md"));

test("update tasks require a pull request", () => assert.throws(() => renderTaskLog(baseRecord({ task_type: "update", pull_request: null, parent_task_id: "task-001" })), /update task requires pull_request/));

test("known secret-like material fails closed", () => assert.throws(() => renderTaskLog(baseRecord({ prompt: "access_token=ghp_abcdefghijklmnopqrstuvwxyz123456" })), /Forbidden-from-GitHub/));
