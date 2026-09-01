import test from "node:test";
import assert from "node:assert/strict";
import { AGENT_CAPABILITIES_SCHEMA } from "../src/agent-capabilities.js";
import { WORK_ITEM_REQUEST_SCHEMA, preflightWorkItemRequest, validateWorkItemRequest } from "../src/work-item.js";

function request(overrides = {}) {
  return {
    schema: WORK_ITEM_REQUEST_SCHEMA,
    intent: "review",
    source: {
      adapter: "github",
      host: "github.com",
      repository: "example/project",
      change: "42",
      version: "0123456789abcdef0123456789abcdef01234567",
    },
    request: "Review the pull request without changing it.",
    review: { focus: ["correctness", "tests"], guidance: "Pay special attention to retry safety." },
    ...overrides,
  };
}

function capabilities({ review = true, guidance = true, status = "verified" } = {}) {
  return {
    schema: AGENT_CAPABILITIES_SCHEMA,
    adapter: "test-review-adapter",
    provider: "test-provider",
    surface: "test-surface",
    intents: review ? {
      review: { status, features: guidance ? ["review-guidance", "result-report"] : ["result-report"] },
    } : {},
  };
}

test("review requests normalize exact source identity and guidance", () => {
  const normalized = validateWorkItemRequest(request({
    source: { adapter: " github ", host: " github.com ", repository: " example/project ", change: " 42 ", version: " abc123 " },
    request: "  Review this exact head.  ",
    review: { focus: [" correctness ", "correctness", " tests "], guidance: "  Check retries.  " },
  }));

  assert.deepEqual(normalized.source, {
    adapter: "github",
    host: "github.com",
    repository: "example/project",
    change: "42",
    version: "abc123",
  });
  assert.equal(normalized.request, "Review this exact head.");
  assert.deepEqual(normalized.review, { focus: ["correctness", "tests"], guidance: "Check retries." });
  assert.ok(Object.isFrozen(normalized));
  assert.ok(Object.isFrozen(normalized.source));
  assert.ok(Object.isFrozen(normalized.review.focus));
});

test("review requires a change identity and exact source version", () => {
  assert.throws(() => validateWorkItemRequest(request({ source: { adapter: "github", host: "github.com", repository: "example/project", version: "abc" } })), /review source.change is required/);
  assert.throws(() => validateWorkItemRequest(request({ source: { adapter: "github", host: "github.com", repository: "example/project", change: "42" } })), /review source.version is required/);
});

test("non-review work cannot smuggle review-only options", () => {
  assert.throws(() => validateWorkItemRequest(request({ intent: "implement" })), /review options are only valid/);
  const normalized = validateWorkItemRequest(request({ intent: "investigate", review: undefined }));
  assert.equal(normalized.review, null);
});

test("unknown request, source, and review fields fail closed", () => {
  assert.throws(() => validateWorkItemRequest({ ...request(), accidental: true }), /unknown field: accidental/);
  assert.throws(() => validateWorkItemRequest(request({ source: { ...request().source, url: "https:\/\/github.com\/example\/project\/pull\/42" } })), /source contains unknown field: url/);
  assert.throws(() => validateWorkItemRequest(request({ review: { focus: [], autoApprove: true } })), /review contains unknown field: autoApprove/);
});

test("preflight refuses unsupported review intent before delegation", () => {
  assert.throws(() => preflightWorkItemRequest({ request: request(), capabilities: capabilities({ review: false }) }), /does not support work-item intent: review/);
});

test("preflight refuses review guidance when adapter would drop it", () => {
  assert.throws(() => preflightWorkItemRequest({ request: request(), capabilities: capabilities({ guidance: false }) }), /does not support review guidance/);

  const plain = request({ review: { focus: [], guidance: null } });
  assert.doesNotThrow(() => preflightWorkItemRequest({ request: plain, capabilities: capabilities({ guidance: false }) }));
});

test("experimental review support requires explicit opt-in", () => {
  const experimental = capabilities({ status: "experimental" });
  assert.throws(() => preflightWorkItemRequest({ request: request(), capabilities: experimental }), /only experimentally/);
  assert.doesNotThrow(() => preflightWorkItemRequest({ request: request(), capabilities: experimental, allowExperimental: true }));
});

test("preflight returns the normalized request and validated adapter capability", () => {
  const result = preflightWorkItemRequest({ request: request(), capabilities: capabilities() });
  assert.equal(result.request.intent, "review");
  assert.equal(result.request.source.version, request().source.version);
  assert.equal(result.capabilities.adapter, "test-review-adapter");
  assert.ok(Object.isFrozen(result));
});
