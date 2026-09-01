import test from "node:test";
import assert from "node:assert/strict";
import {
  TASK_RECORD_V3_SCHEMA,
  parseTaskRecordV3,
  renderTaskRecordV3,
  validateTaskRecordV3Input,
} from "../src/task-record-v3.js";

function reviewRecord(overrides = {}) {
  return {
    task_id: "review-001",
    intent: "review",
    created_at: "2026-09-01T01:00:00Z",
    completed_at: "2026-09-01T01:05:00Z",
    handoff_phase: "review-publication",
    parent_task_id: "implement-001",
    causal_artifact: null,
    family_id: null,
    schedule_id: null,
    schedule_occurrence: null,
    source: {
      adapter: "github",
      host: "github.com",
      repository: "example/project",
      pull_request: 42,
      base_ref: "main",
      working_ref: "feature/example",
      target_commit: "abc123",
      result_commit: null,
    },
    agent: {
      adapter: "test-review-adapter",
      provider: "test-provider",
      surface: "test-surface",
      task_url: "https://agent.example/tasks/1",
    },
    evidence_policy: { request: "full", result: "full" },
    request: "Review for correctness.\r\nInclude edge cases.",
    result: "## Artifact 1\n\nThis heading is evidence, not metadata.\nUnicode: café 🚢",
    publications: [{
      publication_id: "pub-result",
      destination_adapter: "github",
      destination_host: "github.com",
      target: "example/project#42",
      payload_class: "result",
      representation: "full",
      visibility: "public",
      authority: "explicit-user",
      requested: "authorized",
      outcome: "published",
      artifact_id: "review-artifact",
    }],
    artifacts: [{
      artifact_id: "review-artifact",
      type: "source-control.review",
      adapter: "github",
      host: "github.com",
      remote_id: "12345",
      url: "https://github.com/example/project/pull/42#pullrequestreview-12345",
      target: "example/project#42",
      version: "abc123",
      verification: "verified",
    }],
    recovery_state: "clear",
    ...overrides,
  };
}

test("v3 render/parse round trip preserves arbitrary canonical full evidence", () => {
  const rendered = renderTaskRecordV3(reviewRecord());
  const parsed = parseTaskRecordV3(rendered);

  assert.equal(parsed.metadata.schema, TASK_RECORD_V3_SCHEMA);
  assert.equal(parsed.metadata.intent, "review");
  assert.equal(parsed.metadata.source.adapter, "github");
  assert.equal(parsed.metadata.source.host, "github.com");
  assert.equal(parsed.metadata.source.base_ref, "main");
  assert.equal(parsed.metadata.source.working_ref, "feature/example");
  assert.equal(parsed.evidence.request, "Review for correctness.\nInclude edge cases.");
  assert.equal(parsed.evidence.result, "## Artifact 1\n\nThis heading is evidence, not metadata.\nUnicode: café 🚢");
  assert.equal(parsed.metadata.evidence.result.bytes, Buffer.byteLength(parsed.evidence.result, "utf8"));
});

test("v3 rendering is deterministic regardless of caller object key order", () => {
  const first = reviewRecord();
  const second = reviewRecord({
    source: {
      result_commit: null,
      target_commit: "abc123",
      working_ref: "feature/example",
      base_ref: "main",
      pull_request: 42,
      repository: "example/project",
      host: "github.com",
      adapter: "github",
    },
  });
  assert.equal(renderTaskRecordV3(first), renderTaskRecordV3(second));
});

test("hash and omit evidence retain no plaintext payload", () => {
  const rendered = renderTaskRecordV3(reviewRecord({
    evidence_policy: { request: "hash", result: "omit" },
    result: undefined,
  }));
  const parsed = parseTaskRecordV3(rendered);

  assert.equal(parsed.metadata.evidence.request.mode, "hash");
  assert.match(parsed.metadata.evidence.request.sha256, /^[0-9a-f]{64}$/);
  assert.equal(parsed.metadata.evidence.request.bytes, null);
  assert.deepEqual(parsed.metadata.evidence.result, { bytes: null, mode: "omit", sha256: null });
  assert.deepEqual(parsed.evidence, {});
  assert.ok(!rendered.includes("Review for correctness."));
});

test("parser rejects payload tampering and undeclared trailing bytes", () => {
  const rendered = renderTaskRecordV3(reviewRecord());
  const tampered = rendered.replace("This heading is evidence", "This heading is tampered");
  assert.throws(() => parseTaskRecordV3(tampered), /(digest does not match|evidence is not followed|unexpected bytes)/);
  assert.throws(() => parseTaskRecordV3(`${rendered}extra`), /unexpected bytes/);
});

test("review requires a globally qualified source target and PR identity", () => {
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({ source: { ...reviewRecord().source, host: "https://github.com" } })), /host name without scheme/);
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({ source: { ...reviewRecord().source, repository: "project" } })), /owner\/repo/);
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({ source: { ...reviewRecord().source, pull_request: null } })), /review requires source.pull_request/);
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({ source: { ...reviewRecord().source, target_commit: "" } })), /source.target_commit is required/);
});

test("initial and update phases preserve distinct base/working/result provenance", () => {
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({
    intent: "implement",
    handoff_phase: "initial-pr",
    source: { ...reviewRecord().source, pull_request: null, base_ref: null },
  })), /initial-pr requires source.base_ref and source.working_ref/);

  assert.throws(() => validateTaskRecordV3Input(reviewRecord({
    intent: "remediate",
    handoff_phase: "branch-update",
    source: { ...reviewRecord().source, result_commit: null },
  })), /branch-update requires/);
});

test("publication authority is independent of retention and artifact existence", () => {
  const privateReview = reviewRecord({
    publications: [{
      publication_id: "pub-result",
      destination_adapter: "github",
      destination_host: "github.com",
      target: "example/project#42",
      payload_class: "result",
      representation: "omit",
      visibility: "public",
      authority: "user-policy",
      requested: "forbidden",
      outcome: "not-attempted",
      artifact_id: null,
    }],
    artifacts: [],
  });
  assert.doesNotThrow(() => validateTaskRecordV3Input(privateReview));

  assert.throws(() => validateTaskRecordV3Input(reviewRecord({
    publications: [{ ...reviewRecord().publications[0], requested: "forbidden" }],
  })), /cannot be attempted without authorization/);
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({
    publications: [{ ...reviewRecord().publications[0], payload_class: "request", artifact_id: "missing" }],
  })), /unknown artifact_id/);
});

test("task records cannot contain their own final storage artifact", () => {
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({
    publications: [],
    artifacts: [{
      artifact_id: "self",
      type: "crossdock.task-record",
      adapter: "github-task-record-storage",
      host: "github.com",
      remote_id: "future-commit",
      url: "https://example.invalid/future",
      target: "record",
      version: null,
      verification: "verified",
    }],
  })), /must not contain a self-referential task-record artifact/);
});

test("specific causal finding lineage requires a parent task namespace", () => {
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({ parent_task_id: null, causal_artifact: "finding-thread-2" })), /causal_artifact requires parent_task_id/);
  assert.doesNotThrow(() => validateTaskRecordV3Input(reviewRecord({ parent_task_id: "review-parent", causal_artifact: "finding-thread-2" })));
});

test("unknown fields and unresolved publication artifacts fail closed", () => {
  assert.throws(() => validateTaskRecordV3Input({ ...reviewRecord(), surprise: true }), /unknown field: surprise/);
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({
    publications: [{ ...reviewRecord().publications[0], artifact_id: "unknown" }],
  })), /unknown artifact_id/);
});
