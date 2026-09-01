import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG_SCHEMA, DEFAULT_CONFIG, DEFAULT_SERVICE_URL, effectiveConfigSummary, normalizeServiceUrl, resolveConfig, validateConfig } from "../src/config.js";

test("defaults are explicit and immutable", () => {
  assert.equal(DEFAULT_CONFIG.schema, CONFIG_SCHEMA);
  assert.equal(DEFAULT_CONFIG.handoff_mode, "review");
  assert.deepEqual(DEFAULT_CONFIG.evidence_policy, { prompt: "full", report: "full" });
  assert.equal(DEFAULT_CONFIG.storage, null);
  assert.equal(DEFAULT_CONFIG.service_url, DEFAULT_SERVICE_URL);
  assert.equal(DEFAULT_SERVICE_URL, "http://127.0.0.1:3210");
  assert.ok(Object.isFrozen(DEFAULT_CONFIG));
  assert.ok(Object.isFrozen(DEFAULT_CONFIG.evidence_policy));
});

test("scope precedence is global then provider then workspace then repository then task", () => {
  const config = resolveConfig({
    global: { handoff_mode: "automatic", evidence_policy: { prompt: "hash" }, service_url: "http://127.0.0.1:3200" },
    provider: { evidence_policy: { report: "hash" } },
    workspace: { handoff_mode: "review", service_url: "http://127.0.0.1:3201" },
    repository: { evidence_policy: { prompt: "omit" }, storage: { repository: "example/records", branch: "main" } },
    task: { evidence_policy: { report: "omit" }, handoff_mode: "automatic", service_url: "http://127.0.0.1:4321" },
  });
  assert.equal(config.handoff_mode, "automatic");
  assert.deepEqual(config.evidence_policy, { prompt: "omit", report: "omit" });
  assert.deepEqual(config.storage, { type: "github", repository: "example/records", branch: "main" });
  assert.equal(config.service_url, "http://127.0.0.1:4321");
});

test("higher scope can explicitly clear inherited storage", () => {
  const config = resolveConfig({
    global: { storage: { repository: "example/records", branch: "main" } },
    task: { storage: null },
  });
  assert.equal(config.storage, null);
});

test("partial evidence layers merge without changing unrelated evidence", () => {
  const config = resolveConfig({ repository: { evidence_policy: { report: "hash" } } });
  assert.deepEqual(config.evidence_policy, { prompt: "full", report: "hash" });
});

test("resolved config does not mutate caller layers", () => {
  const layer = { evidence_policy: { prompt: "omit" }, storage: { repository: "example/records", branch: "main" } };
  const snapshot = structuredClone(layer);
  resolveConfig({ task: layer });
  assert.deepEqual(layer, snapshot);
});

test("unknown scope and config fields fail instead of being ignored", () => {
  assert.throws(() => resolveConfig({ mystery: {} }), /unknown field: mystery/);
  assert.throws(() => resolveConfig({ global: { made_up: true } }), /unknown field: made_up/);
  assert.throws(() => resolveConfig({ global: { evidence_policy: { unknown: "omit" } } }), /unknown field: unknown/);
});

test("invalid handoff and evidence modes fail clearly", () => {
  assert.throws(() => resolveConfig({ task: { handoff_mode: "sometimes" } }), /handoff_mode/);
  assert.throws(() => resolveConfig({ task: { evidence_policy: { prompt: "sometimes" } } }), /evidence_policy.prompt/);
});

test("GitHub storage normalizes type and validates destination", () => {
  const config = resolveConfig({ task: { storage: { repository: "example/private-records", branch: "records/main" } } });
  assert.deepEqual(config.storage, { type: "github", repository: "example/private-records", branch: "records/main" });
  assert.throws(() => resolveConfig({ task: { storage: { type: "future", repository: "example/records", branch: "main" } } }), /unsupported/);
  assert.throws(() => resolveConfig({ task: { storage: { repository: "not-a-repo", branch: "main" } } }), /owner\/repo/);
});

test("service URL accepts only an explicit numeric loopback origin", () => {
  assert.equal(normalizeServiceUrl("http://127.0.0.1:4321"), "http://127.0.0.1:4321");
  assert.equal(normalizeServiceUrl("http://127.0.0.1:80"), "http://127.0.0.1:80");
  for (const invalid of [
    "https://127.0.0.1:4321",
    "http://localhost:4321",
    "http://192.168.1.10:4321",
    "http://127.0.0.1",
    "http://127.0.0.1:4321/path",
    "http://user:pass@127.0.0.1:4321",
    "http://127.0.0.1:4321/?x=1",
    "http://127.0.0.1:4321/#fragment",
  ]) assert.throws(() => normalizeServiceUrl(invalid), /HTTP 127\.0\.0\.1 loopback origin with an explicit port/);
});

test("existing v1 config defaults only an absent service URL", () => {
  const legacy = {
    schema: CONFIG_SCHEMA,
    handoff_mode: "review",
    evidence_policy: { prompt: "full", report: "full" },
    storage: null,
  };
  assert.equal(validateConfig(legacy).service_url, DEFAULT_SERVICE_URL);
  assert.throws(() => validateConfig({ ...legacy, service_url: null }), /config\.service_url is required/);
  assert.throws(() => validateConfig({ ...legacy, service_url: "" }), /config\.service_url is required/);
});

test("validateConfig can require a durable storage destination", () => {
  assert.throws(() => validateConfig(DEFAULT_CONFIG, { requireStorage: true }), /storage must be configured/);
  assert.doesNotThrow(() => validateConfig(resolveConfig({ task: { storage: { repository: "example/records", branch: "main" } } }), { requireStorage: true }));
});

test("effectiveConfigSummary exposes consequential choices without extra config structure", () => {
  const config = resolveConfig({
    task: {
      handoff_mode: "automatic",
      evidence_policy: { prompt: "hash", report: "omit" },
      storage: { repository: "example/private-records", branch: "main" },
      service_url: "http://127.0.0.1:4321",
    },
  });
  assert.deepEqual(effectiveConfigSummary(config), {
    handoff_mode: "automatic",
    prompt_evidence: "hash",
    report_evidence: "omit",
    storage: { type: "github", repository: "example/private-records", branch: "main" },
    service_url: "http://127.0.0.1:4321",
  });
});
