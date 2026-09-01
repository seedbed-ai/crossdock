import test from "node:test";
import assert from "node:assert/strict";
import {
  TASK_RECORD_V3_SCHEMA,
  parseTaskRecordV3,
  renderTaskRecordV3,
  validateTaskRecordV3Input,
} from "../src/task-record-v3.js";

const PARENT_DIGEST = "a".repeat(64);

function reviewRecord(overrides = {}) {
  return {
    task_id: "review-001",
    intent: "review",
    created_at: "2026-09-01T01:00:00Z",
    completed_at: "2026-09-01T01:05:00Z",
    handoff_phase: "review-publication",
    parent_task_id: "implement-001",
    parent_record: {
      storage_adapter: "test-storage",
      locator: "records/implement-001",
      version: "version-1",
      sha256: PARENT_DIGEST,
    },
    causal_artifact: null,
    family_id: null,
    schedule_id: null,
    schedule_occurrence: null,
    source: {
      adapter: "github",
      host: "github.com",
      repository_id: "example/project",
      change_id: "42",
      base_ref: "main",
      working_ref: "feature/example",
      target_version: "abc123",
      result_version: null,
    },
    origin: {
      adapter: "github",
      host: "github.com",
      type: "issue",
      id: "17",
      url: "https://github.com/example/project/issues/17",
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
  const parsed = parseTaskRecordV3(renderTaskRecordV3(reviewRecord()));
  assert.equal(parsed.metadata.schema, TASK_RECORD_V3_SCHEMA);
  assert.equal(parsed.metadata.intent, "review");
  assert.equal(parsed.metadata.source.repository_id, "example/project");
  assert.equal(parsed.metadata.source.change_id, "42");
  assert.equal(parsed.metadata.origin.id, "17");
  assert.equal(parsed.metadata.parent_record.sha256, PARENT_DIGEST);
  assert.equal(parsed.evidence.request, "Review for correctness.\nInclude edge cases.");
  assert.equal(parsed.evidence.result, "## Artifact 1\n\nThis heading is evidence, not metadata.\nUnicode: café 🚢");
  assert.equal(parsed.metadata.evidence.result.bytes, Buffer.byteLength(parsed.evidence.result, "utf8"));
});

test("v3 rendering is deterministic across object and collection ordering", () => {
  const first = reviewRecord({
    publications: [
      reviewRecord().publications[0],
      {
        publication_id: "pub-request",
        destination_adapter: "github",
        destination_host: "github.com",
        target: "example/project#42",
        payload_class: "request",
        representation: "omit",
        visibility: "public",
        authority: "user-policy",
        requested: "forbidden",
        outcome: "not-attempted",
        artifact_id: null,
      },
    ],
  });
  const second = reviewRecord({
    source: {
      result_version: null,
      target_version: "abc123",
      working_ref: "feature/example",
      base_ref: "main",
      change_id: "42",
      repository_id: "example/project",
      host: "github.com",
      adapter: "github",
    },
    publications: [...first.publications].reverse(),
  });
  assert.equal(renderTaskRecordV3(first), renderTaskRecordV3(second));
});

test("parser rejects noncanonical metadata, duplicate-key collapse, tampering, and trailing bytes", () => {
  const rendered = renderTaskRecordV3(reviewRecord());
  assert.throws(() => parseTaskRecordV3(rendered.replace('"task_id": "review-001"', '"task_id":"review-001"')), /front matter is not canonical/);
  assert.throws(() => parseTaskRecordV3(rendered.replace('"task_id": "review-001",', '"task_id": "other",\n  "task_id": "review-001",')), /front matter is not canonical/);
  const tampered = rendered.replace("This heading is evidence", "This heading is tampered");
  assert.throws(() => parseTaskRecordV3(tampered), /(digest does not match|evidence is not followed|unexpected bytes)/);
  assert.throws(() => parseTaskRecordV3(`${rendered}extra`), /unexpected bytes/);
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

test("source and origin identities are adapter-qualified but opaque to the core", () => {
  assert.doesNotThrow(() => validateTaskRecordV3Input(reviewRecord({
    source: { ...reviewRecord().source, repository_id: "hierarchy/team/project::uuid", change_id: "change/ABC-7" },
    origin: { ...reviewRecord().origin, id: "ticket/OPS-99" },
  })));
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({ source: { ...reviewRecord().source, host: "https://github.com" } })), /host name without scheme/);
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({ source: { ...reviewRecord().source, change_id: null } })), /review requires source.change_id/);
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({ source: { ...reviewRecord().source, target_version: "" } })), /source.target_version is required/);
});

test("initial and update phases preserve distinct base, working, target, and result provenance", () => {
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({
    intent: "implement",
    handoff_phase: "initial-change",
    source: { ...reviewRecord().source, change_id: null, base_ref: null },
  })), /initial-change requires source.base_ref and source.working_ref/);

  assert.throws(() => validateTaskRecordV3Input(reviewRecord({
    intent: "remediate",
    handoff_phase: "branch-update",
    source: { ...reviewRecord().source, result_version: null },
  })), /branch-update requires/);
});

test("lineage requires an immutable parent record locator and digest", () => {
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({ parent_record: null })), /parent_task_id requires parent_record/);
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({ parent_record: { ...reviewRecord().parent_record, sha256: "bad" } })), /lowercase SHA-256/);
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({ parent_task_id: null, parent_record: null, causal_artifact: "finding-thread-2" })), /causal_artifact requires parent_record/);
  assert.doesNotThrow(() => validateTaskRecordV3Input(reviewRecord({ causal_artifact: "finding-thread-2" })));
});

test("publication authority is independent of retention and artifact existence", () => {
  assert.doesNotThrow(() => validateTaskRecordV3Input(reviewRecord({
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
  })));

  assert.throws(() => validateTaskRecordV3Input(reviewRecord({
    publications: [{ ...reviewRecord().publications[0], requested: "forbidden" }],
  })), /cannot be attempted without authorization/);
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({
    publications: [{ ...reviewRecord().publications[0], representation: "omit" }],
  })), /cannot publish an omitted payload/);
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({
    publications: [{ ...reviewRecord().publications[0], artifact_id: "missing" }],
  })), /unknown artifact_id/);
});

test("completed records reject ambiguous recovery and self-referential storage artifacts", () => {
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({ recovery_state: "ambiguous" })), /recovery_state must be one of: clear/);
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

test("unknown fields and unexpected evidence metadata fail closed", () => {
  assert.throws(() => validateTaskRecordV3Input({ ...reviewRecord(), surprise: true }), /unknown field: surprise/);
  const rendered = renderTaskRecordV3(reviewRecord());
  const withUnknownEvidenceMetadata = rendered.replace('"mode": "full",', '"made_up": true,\n      "mode": "full",');
  assert.throws(() => parseTaskRecordV3(withUnknownEvidenceMetadata), /(front matter is not canonical|unknown field: made_up)/);
});
