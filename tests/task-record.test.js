import test from "node:test";
import assert from "node:assert/strict";
import { canonicalizeText, evidencePolicy, renderTaskRecord, sha256, taskRecordPath } from "../src/task-record.js";

function baseRecord(overrides = {}) {
  return {
    task_id: "task-001",
    task_type: "initial",
    created_at: "2026-08-31T20:00:00Z",
    completed_at: "2026-08-31T20:05:00Z",
    target_repository: "example/project",
    base_branch: "main",
    working_branch: "crossdock/task-001",
    pull_request: 42,
    issue: 123,
    agent_task_url: "https://example.invalid/tasks/task-001",
    result_commit: "0123456789abcdef0123456789abcdef01234567",
    parent_task_id: null,
    prompt: "Do the thing.\r\nPreserve invariants.\r\n",
    report: "## Summary\r\n\r\nDone.\r\n",
    ...overrides,
  };
}

test("canonicalizeText normalizes CRLF and CR to LF", () => {
  assert.equal(canonicalizeText("a\r\nb\rc\n"), "a\nb\nc\n");
});

test("default evidence policy retains full prompt and report", () => {
  const record = baseRecord();
  assert.deepEqual(evidencePolicy(record), { prompt: "full", report: "full" });
  const rendered = renderTaskRecord(record);
  assert.match(rendered, /schema: "crossdock\.task-record\/v2"/);
  assert.match(rendered, /prompt_evidence: "full"/);
  assert.match(rendered, /report_evidence: "full"/);
  assert.match(rendered, new RegExp(`prompt_sha256: "${sha256(record.prompt)}"`));
  assert.match(rendered, new RegExp(`report_sha256: "${sha256(record.report)}"`));
  assert.match(rendered, /## Prompt\n\nDo the thing\.\nPreserve invariants\.\n/);
  assert.match(rendered, /## Report\n\n## Summary\n\nDone\.\n/);
  assert.ok(!rendered.includes("\r"));
});

test("prompt-only retention omits report content and digest", () => {
  const rendered = renderTaskRecord(baseRecord({ evidence_policy: { prompt: "full", report: "omit" } }));
  assert.match(rendered, /prompt_evidence: "full"/);
  assert.match(rendered, /report_evidence: "omit"/);
  assert.match(rendered, /report_sha256: null/);
  assert.match(rendered, /## Prompt/);
  assert.ok(!rendered.includes("## Report"));
  assert.ok(!rendered.includes("Done."));
});

test("report-only retention omits prompt content and digest", () => {
  const rendered = renderTaskRecord(baseRecord({ evidence_policy: { prompt: "omit", report: "full" } }));
  assert.match(rendered, /prompt_evidence: "omit"/);
  assert.match(rendered, /prompt_sha256: null/);
  assert.ok(!rendered.includes("## Prompt"));
  assert.ok(!rendered.includes("Do the thing."));
  assert.match(rendered, /## Report/);
});

test("metadata-only retention permits absent prompt and report", () => {
  const record = baseRecord({ evidence_policy: { prompt: "omit", report: "omit" } });
  delete record.prompt;
  delete record.report;
  const rendered = renderTaskRecord(record);
  assert.match(rendered, /prompt_evidence: "omit"/);
  assert.match(rendered, /report_evidence: "omit"/);
  assert.match(rendered, /prompt_sha256: null/);
  assert.match(rendered, /report_sha256: null/);
  assert.ok(!rendered.includes("## Prompt"));
  assert.ok(!rendered.includes("## Report"));
});

test("hash-only evidence stores digests without plaintext", () => {
  const record = baseRecord({ evidence_policy: { prompt: "hash", report: "hash" } });
  const rendered = renderTaskRecord(record);
  assert.match(rendered, /prompt_evidence: "hash"/);
  assert.match(rendered, /report_evidence: "hash"/);
  assert.match(rendered, new RegExp(`prompt_sha256: "${sha256(record.prompt)}"`));
  assert.match(rendered, new RegExp(`report_sha256: "${sha256(record.report)}"`));
  assert.ok(!rendered.includes("Do the thing."));
  assert.ok(!rendered.includes("Done."));
});

test("task-record rendering is provider-neutral about secret-like plaintext", () => {
  const secret = "access_token=ghp_abcdefghijklmnopqrstuvwxyz123456";
  const rendered = renderTaskRecord(baseRecord({ prompt: secret }));
  assert.ok(rendered.includes(secret));
});

test("unsupported evidence modes fail clearly", () => {
  assert.throws(() => renderTaskRecord(baseRecord({ evidence_policy: { prompt: "sometimes", report: "full" } })), /prompt evidence mode/);
});

test("taskRecordPath is deterministic", () => {
  assert.equal(taskRecordPath(baseRecord()), "crossdock/tasks/example/project/2026/08/task-001.md");
});

test("update tasks require a pull request", () => {
  assert.throws(() => renderTaskRecord(baseRecord({ task_type: "update", pull_request: null, parent_task_id: "task-001" })), /update task requires pull_request/);
});