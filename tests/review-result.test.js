import assert from "node:assert/strict";
import test from "node:test";
import { bindReviewResult, REVIEW_RESULT_SCHEMA, validateReviewResult } from "../src/review-result.js";
import { validateWorkItemRequest, WORK_ITEM_REQUEST_SCHEMA } from "../src/work-item.js";

function reviewRequest() {
  return validateWorkItemRequest({
    schema: WORK_ITEM_REQUEST_SCHEMA,
    intent: "review",
    source: { adapter: "github", host: "github.com", repository: "opaque-repo", change: "opaque-change", version: "abc123" },
    request: "Review this change",
    review: { focus: ["correctness"], guidance: "Prioritize regressions." },
  });
}

function reviewResult(overrides = {}) {
  return {
    schema: REVIEW_RESULT_SCHEMA,
    task_id: "review-task-1",
    adapter: "github",
    source: { adapter: "github", host: "github.com", repository: "opaque-repo", change: "opaque-change", version: "abc123" },
    status: "completed",
    report: "One actionable finding.",
    findings: [{ id: "finding-1", severity: "high", title: "Regression", body: "The new path skips validation.", location: { path: "src/example.js", line: 12, version: "abc123" } }],
    provider: { task_id: "provider-task", task_url: "https://example.invalid/task", review_id: "provider-review" },
    ...overrides,
  };
}

test("validates and freezes a terminal review result", () => {
  const result = validateReviewResult(reviewResult());
  assert.equal(result.source.version, "abc123");
  assert.equal(result.findings[0].severity, "high");
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.findings[0]));
});

test("completed review requires a report", () => {
  assert.throws(() => validateReviewResult(reviewResult({ report: null })), /requires report/);
});

test("failed review may omit report and findings", () => {
  const result = validateReviewResult(reviewResult({ status: "failed", report: null, findings: [] }));
  assert.equal(result.report, null);
});

test("rejects duplicate finding identifiers", () => {
  const finding = reviewResult().findings[0];
  assert.throws(() => validateReviewResult(reviewResult({ findings: [finding, finding] })), /duplicate finding id/);
});

test("rejects invalid finding locations", () => {
  const finding = { ...reviewResult().findings[0], location: { path: "src/example.js", line: 0 } };
  assert.throws(() => validateReviewResult(reviewResult({ findings: [finding] })), /positive integer/);
});

test("binds result to exact opaque source identity and pinned version", () => {
  const result = bindReviewResult({ request: reviewRequest(), result: reviewResult() });
  assert.equal(result.task_id, "review-task-1");

  assert.throws(() => bindReviewResult({
    request: reviewRequest(),
    result: reviewResult({ source: { ...reviewResult().source, version: "newer-head" } }),
  }), /source.version does not match request/);
});

test("binding rejects another adapter or non-review request", () => {
  assert.throws(() => bindReviewResult({ request: reviewRequest(), result: reviewResult({ adapter: "other" }) }), /adapter does not match request/);
  assert.throws(() => bindReviewResult({ request: { intent: "implement" }, result: reviewResult() }), /review request is required/);
});
