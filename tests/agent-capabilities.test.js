import test from "node:test";
import assert from "node:assert/strict";
import {
  AGENT_CAPABILITIES_SCHEMA,
  AGENT_FEATURES,
  CAPABILITY_STATUSES,
  WORK_ITEM_INTENTS,
  intentCapabilityStatus,
  requireIntentSupport,
  supportsAgentFeature,
  supportsIntent,
  validateAgentCapabilities,
} from "../src/agent-capabilities.js";
import { CODEX_BROWSER_CAPABILITIES } from "../src/adapters/codex/browser-capabilities.js";

function descriptor(overrides = {}) {
  return {
    schema: AGENT_CAPABILITIES_SCHEMA,
    adapter: "test-adapter",
    provider: "test-provider",
    surface: "test-surface",
    intents: {
      implement: { status: "verified", features: ["branch-mutation", "result-report"] },
      review: { status: "verified", features: ["review-guidance", "result-report"] },
    },
    ...overrides,
  };
}

test("capability descriptor is strict, normalized, and immutable", () => {
  const capabilities = validateAgentCapabilities(descriptor({
    intents: {
      review: { status: "verified", features: ["review-guidance", "review-guidance", "result-report"] },
      implement: { status: "experimental", features: ["branch-mutation"] },
    },
  }));
  assert.deepEqual(capabilities.intents.review.features, ["review-guidance", "result-report"]);
  assert.equal(capabilities.intents.implement.status, "experimental");
  assert.ok(Object.isFrozen(capabilities));
  assert.ok(Object.isFrozen(capabilities.intents));
  assert.ok(Object.isFrozen(capabilities.intents.review));
  assert.ok(Object.isFrozen(capabilities.intents.review.features));
});

test("unknown fields and unsupported values fail closed", () => {
  assert.throws(() => validateAgentCapabilities(descriptor({ accidental: true })), /unknown field: accidental/);
  assert.throws(() => validateAgentCapabilities(descriptor({ intents: { "deploy-to-production": { status: "verified" } } })), /unsupported work-item intent/);
  assert.throws(() => validateAgentCapabilities(descriptor({ intents: { review: { status: "trusted" } } })), /status must be one of/);
  assert.throws(() => validateAgentCapabilities(descriptor({ intents: { review: { status: "verified", features: ["magic"] } } })), /unsupported value/);
  assert.throws(() => validateAgentCapabilities(descriptor({ intents: { review: { status: "verified", accidental: true } } })), /unknown field: accidental/);
});

test("intent and feature queries reject unknown vocabulary", () => {
  assert.throws(() => supportsIntent(descriptor(), "scheduled"), /unsupported work-item intent/);
  assert.throws(() => supportsAgentFeature(descriptor(), "review", "auto-approve"), /unsupported agent feature/);
  assert.throws(() => supportsAgentFeature(descriptor(), "scheduled", "result-report"), /unsupported work-item intent/);
});

test("intent support is explicit and can be required before delegation", () => {
  assert.equal(supportsIntent(descriptor(), "review"), true);
  assert.equal(supportsIntent(descriptor(), "verify"), false);
  assert.doesNotThrow(() => requireIntentSupport(descriptor(), "implement"));
  assert.throws(() => requireIntentSupport(descriptor(), "verify"), /does not support work-item intent: verify/);
});

test("features are scoped to an intent instead of being globally combinable", () => {
  const capabilities = descriptor();
  assert.equal(supportsAgentFeature(capabilities, "implement", "branch-mutation"), true);
  assert.equal(supportsAgentFeature(capabilities, "review", "branch-mutation"), false);
  assert.equal(supportsAgentFeature(capabilities, "review", "review-guidance"), true);
  assert.equal(supportsAgentFeature(capabilities, "implement", "review-guidance"), false);
});

test("experimental capabilities require explicit opt-in", () => {
  const capabilities = descriptor({ intents: { implement: { status: "experimental", features: ["branch-mutation"] } } });
  assert.equal(intentCapabilityStatus(capabilities, "implement"), "experimental");
  assert.equal(supportsIntent(capabilities, "implement"), false);
  assert.equal(supportsIntent(capabilities, "implement", { allowExperimental: true }), true);
  assert.equal(supportsAgentFeature(capabilities, "implement", "branch-mutation"), false);
  assert.equal(supportsAgentFeature(capabilities, "implement", "branch-mutation", { allowExperimental: true }), true);
  assert.throws(() => requireIntentSupport(capabilities, "implement"), /only experimentally/);
  assert.doesNotThrow(() => requireIntentSupport(capabilities, "implement", { allowExperimental: true }));
});

test("capability metadata does not encode scheduling or parallel families as intents", () => {
  assert.ok(!WORK_ITEM_INTENTS.includes("scheduled"));
  assert.ok(!WORK_ITEM_INTENTS.includes("parallel-family"));
  assert.ok(AGENT_FEATURES.includes("scheduled-execution"));
  assert.ok(AGENT_FEATURES.includes("parallel-execution"));
  assert.deepEqual(CAPABILITY_STATUSES, ["experimental", "verified"]);
});

test("current Codex browser descriptor is explicitly experimental until live validation", () => {
  assert.equal(CODEX_BROWSER_CAPABILITIES.adapter, "codex-cloud-browser");
  assert.equal(intentCapabilityStatus(CODEX_BROWSER_CAPABILITIES, "implement"), "experimental");
  assert.equal(supportsIntent(CODEX_BROWSER_CAPABILITIES, "implement"), false);
  assert.equal(supportsIntent(CODEX_BROWSER_CAPABILITIES, "implement", { allowExperimental: true }), true);
  assert.equal(supportsIntent(CODEX_BROWSER_CAPABILITIES, "review", { allowExperimental: true }), false);
  assert.equal(supportsAgentFeature(CODEX_BROWSER_CAPABILITIES, "implement", "branch-mutation"), false);
  assert.equal(supportsAgentFeature(CODEX_BROWSER_CAPABILITIES, "implement", "branch-mutation", { allowExperimental: true }), true);
  assert.equal(supportsAgentFeature(CODEX_BROWSER_CAPABILITIES, "implement", "result-report", { allowExperimental: true }), true);
  assert.equal(supportsAgentFeature(CODEX_BROWSER_CAPABILITIES, "implement", "review-guidance", { allowExperimental: true }), false);
});
