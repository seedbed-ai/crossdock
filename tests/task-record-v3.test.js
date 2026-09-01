import test from "node:test";
import assert from "node:assert/strict";
import {
  TASK_RECORD_V3_SCHEMA,
  parseTaskRecordV3,
  renderTaskRecordV3,
  validateTaskRecordV3Input,
} from "../src/task-record-v3.js";

const PARENT_DIGEST = "a".repeat(64);
const wire = (record) => Buffer.from(renderTaskRecordV3(record), "utf8");

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
  const parsed = parseTaskRecordV3(wire(reviewRecord()));
  assert.equal(parsed.metadata.schema, TASK_RECORD_V3_SCHEMA);
  assert.equal(parsed.metadata.intent, "review");
  assert.equal(parsed.metadata.source.repository_id, "example/project");
  assert.equal(parsed.metadata.source.change_id, "42");
  assert.equal(parsed.metadata.origin.id, "17");
  assert.equal(parsed.metadata.parent_record.sha256, PARENT_DIGEST);
  assert.equal(parsed.metadata.created_at, "2026-09-01T01:00:00.000Z");
  assert.equal(parsed.evidence.request, "Review for correctness.\nInclude edge cases.");
  assert.equal(parsed.evidence.result, "## Artifact 1\n\nThis heading is evidence, not metadata.\nUnicode: café 🚢");
  assert.equal(parsed.metadata.evidence.result.bytes, Buffer.byteLength(parsed.evidence.result, "utf8"));
});

test("parser requires original bytes and rejects malformed UTF-8", () => {
  const rendered = renderTaskRecordV3(reviewRecord());
  assert.throws(() => parseTaskRecordV3(rendered), /Uint8Array or Buffer/);
  const bytes = Buffer.from(rendered, "utf8");
  const marker = Buffer.from("This heading is evidence");
  const at = bytes.indexOf(marker);
  bytes[at] = 0xff;
  assert.throws(() => parseTaskRecordV3(bytes), /not valid UTF-8/);
});

test("v3 rendering is deterministic across object, host, timestamp, and collection ordering", () => {
  const first = reviewRecord({
    source: { ...reviewRecord().source, host: "GitHub.COM" },
    publications: [
      reviewRecord().publications[0],
      {
        publication_id: "pub-request",
        destination_adapter: "github",
        destination_host: "GITHUB.COM",
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
  const second = reviewRecord({ publications: [...first.publications].reverse() });
  assert.equal(renderTaskRecordV3(first), renderTaskRecordV3(second));
});

test("parser rejects noncanonical or incomplete metadata, tampering, and trailing bytes", () => {
  const rendered = renderTaskRecordV3(reviewRecord());
  const parseText = (text) => parseTaskRecordV3(Buffer.from(text, "utf8"));
  assert.throws(() => parseText(rendered.replace('"task_id": "review-001"', '"task_id":"review-001"')), /front matter is not canonical/);
  assert.throws(() => parseText(rendered.replace('  "task_id": "review-001"\n}', '  "task_id": "other",\n  "task_id": "review-001"\n}')), /front matter is not canonical/);
  const missingStatus = rendered.replace('  "status": "completed",\n', "");
  assert.throws(() => parseText(missingStatus), /(missing required field: status|front matter is not canonical)/);
  const noncanonicalHost = rendered.replace('"host": "github.com"', '"host": "GitHub.COM"');
  assert.throws(() => parseText(noncanonicalHost), /(noncanonical or implicit values|front matter is not canonical)/);
  const tampered = rendered.replace("This heading is evidence", "This heading is tampered");
  assert.throws(() => parseText(tampered), /(digest does not match|evidence is not followed|unexpected bytes)/);
  assert.throws(() => parseText(`${rendered}extra`), /unexpected bytes/);
});

test("hash and omit evidence retain no plaintext payload", () => {
  const rendered = renderTaskRecordV3(reviewRecord({ evidence_policy: { request: "hash", result: "omit" }, result: undefined }));
  const parsed = parseTaskRecordV3(Buffer.from(rendered, "utf8"));
  assert.equal(parsed.metadata.evidence.request.mode, "hash");
  assert.match(parsed.metadata.evidence.request.sha256, /^[0-9a-f]{64}$/);
  assert.equal(parsed.metadata.evidence.request.bytes, null);
  assert.deepEqual(parsed.metadata.evidence.result, { bytes: null, mode: "omit", sha256: null });
  assert.deepEqual(parsed.evidence, {});
  assert.ok(!rendered.includes("Review for correctness."));
});

test("evidence rejects unpaired UTF-16 surrogates instead of silently replacing them", () => {
  assert.throws(() => renderTaskRecordV3(reviewRecord({ result: "bad \ud800 evidence" })), /unpaired UTF-16 surrogate/);
  assert.doesNotThrow(() => renderTaskRecordV3(reviewRecord({ result: "valid pair 🚢" })));
});

test("source and origin identities are adapter-qualified, opaque, and host-canonical", () => {
  const normalized = validateTaskRecordV3Input(reviewRecord({
    source: { ...reviewRecord().source, host: "GitHub.COM", repository_id: "hierarchy/team/project::uuid", change_id: "change/ABC-7" },
    origin: { ...reviewRecord().origin, host: "GitHub.COM", id: "ticket/OPS-99" },
  }));
  assert.equal(normalized.source.host, "github.com");
  assert.equal(normalized.origin.host, "github.com");
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({ source: { ...reviewRecord().source, host: " github.com " } })), /surrounding whitespace/);
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({ source: { ...reviewRecord().source, host: "https://github.com" } })), /host name without scheme/);
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({ source: { ...reviewRecord().source, change_id: null } })), /review requires source.change_id/);
});

test("timestamps require RFC 3339 and normalize to one UTC representation", () => {
  const normalized = validateTaskRecordV3Input(reviewRecord({ created_at: "2026-08-31T21:00:00-04:00" }));
  assert.equal(normalized.created_at, "2026-09-01T01:00:00.000Z");
  for (const created_at of ["2026-09-01", "2026-09-01T01:00:00", "09/01/2026 01:00:00"]) {
    assert.throws(() => validateTaskRecordV3Input(reviewRecord({ created_at })), /RFC 3339/);
  }
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

test("lineage requires immutable parent identity and a durable causal-artifact locator", () => {
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({ parent_record: null })), /parent_task_id requires parent_record/);
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({ parent_record: { ...reviewRecord().parent_record, sha256: "bad" } })), /lowercase SHA-256/);
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({ causal_artifact: "finding-thread-2" })), /durable artifact locator object/);
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({
    parent_task_id: null,
    parent_record: null,
    causal_artifact: { artifact_id: "finding-2", type: "crossdock.finding", adapter: "github", host: "github.com", remote_id: "2", target: "example/project#42", version: "abc" },
  })), /requires parent_record/);
  assert.doesNotThrow(() => validateTaskRecordV3Input(reviewRecord({
    causal_artifact: { artifact_id: "finding-2", type: "crossdock.finding", adapter: "github", host: "github.com", remote_id: "2", target: "example/project#42", version: "abc" },
  })));
});

test("publication authority and artifacts are independently validated and destination-bound", () => {
  assert.doesNotThrow(() => validateTaskRecordV3Input(reviewRecord({
    publications: [{ ...reviewRecord().publications[0], representation: "omit", requested: "forbidden", outcome: "not-attempted", artifact_id: null }],
    artifacts: [],
  })));
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({ publications: [{ ...reviewRecord().publications[0], requested: "forbidden" }] })), /cannot be attempted without authorization/);
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({ publications: [{ ...reviewRecord().publications[0], representation: "omit" }] })), /cannot publish an omitted payload/);
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({ publications: [{ ...reviewRecord().publications[0], artifact_id: "missing" }] })), /unknown artifact_id/);
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({
    artifacts: [{ ...reviewRecord().artifacts[0], target: "other/project#99" }],
  })), /artifact does not match publication destination/);
});

test("artifact types use a closed provider-neutral vocabulary and exclude task-record self-reference", () => {
  for (const type of ["crossdock.task-record", "crossdock.task-record/v3", "github-task-record-storage"]) {
    assert.throws(() => validateTaskRecordV3Input(reviewRecord({
      publications: [],
      artifacts: [{ ...reviewRecord().artifacts[0], type }],
    })), /type must be one of/);
  }
});

test("completed records reject ambiguous recovery and unknown fields", () => {
  assert.throws(() => validateTaskRecordV3Input(reviewRecord({ recovery_state: "ambiguous" })), /recovery_state must be one of: clear/);
  assert.throws(() => validateTaskRecordV3Input({ ...reviewRecord(), surprise: true }), /unknown field: surprise/);
});
