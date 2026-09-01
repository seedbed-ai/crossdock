import test from "node:test";
import assert from "node:assert/strict";
import {
  AGENT_CAPABILITIES_SCHEMA,
  AGENT_FEATURES,
  WORK_ITEM_INTENTS,
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
    intents: ["implement", "review"],
    features: ["review-guidance", "result-report"],
    ...overrides,
  };
}

test("capability descriptor is strict, normalized, and immutable", () => {
  const capabilities = validateAgentCapabilities(descriptor({ intents: ["review", "review", "implement"] }));
  assert.deepEqual(capabilities.intents, ["review", "implement"]);
  assert.deepEqual(capabilities.features, ["review-guidance", "result-report"]);
  assert.ok(Object.isFrozen(capabilities));
  assert.ok(Object.isFrozen(capabilities.intents));
  assert.ok(Object.isFrozen(capabilities.features));
});

test("unknown fields and unsupported values fail closed", () => {
  assert.throws(() => validateAgentCapabilities(descriptor({ accidental: true })), /unknown field: accidental/);
  assert.throws(() => validateAgentCapabilities(descriptor({ intents: ["deploy-to-production"] })), /unsupported value/);
  assert.throws(() => validateAgentCapabilities(descriptor({ features: ["magic"] })), /unsupported value/);
});

test("intent and feature queries reject unknown vocabulary", () => {
  assert.throws(() => supportsIntent(descriptor(), "scheduled"), /unsupported work-item intent/);
  assert.throws(() => supportsAgentFeature(descriptor(), "auto-approve"), /unsupported agent feature/);
});

test("intent support is explicit and can be required before delegation", () => {
  assert.equal(supportsIntent(descriptor(), "review"), true);
  assert.equal(supportsIntent(descriptor(), "verify"), false);
  assert.doesNotThrow(() => requireIntentSupport(descriptor(), "implement"));
  assert.throws(() => requireIntentSupport(descriptor(), "verify"), /does not support work-item intent: verify/);
});

test("capability metadata does not encode scheduling or parallel families as intents", () => {
  assert.ok(!WORK_ITEM_INTENTS.includes("scheduled"));
  assert.ok(!WORK_ITEM_INTENTS.includes("parallel-family"));
  assert.ok(AGENT_FEATURES.includes("scheduled-execution"));
  assert.ok(AGENT_FEATURES.includes("parallel-execution"));
});

test("current Codex browser descriptor claims only implemented Crossdock behavior", () => {
  assert.equal(CODEX_BROWSER_CAPABILITIES.adapter, "codex-cloud-browser");
  assert.deepEqual(CODEX_BROWSER_CAPABILITIES.intents, ["implement"]);
  assert.equal(supportsIntent(CODEX_BROWSER_CAPABILITIES, "review"), false);
  assert.equal(supportsAgentFeature(CODEX_BROWSER_CAPABILITIES, "branch-mutation"), true);
  assert.equal(supportsAgentFeature(CODEX_BROWSER_CAPABILITIES, "result-report"), true);
  assert.equal(supportsAgentFeature(CODEX_BROWSER_CAPABILITIES, "review-guidance"), false);
});
