import test from "node:test";
import assert from "node:assert/strict";
import {
  COMMITTED_FILE_PRESENTATIONS,
  CONFIG_SCHEMA,
  DEFAULT_CONFIG,
  DEFAULT_SERVICE_URL,
  PUBLICATION_PRESENTATIONS,
  RECOVERY_PROMPT_MODES,
  RECOVERY_REPORT_MODES,
  effectiveConfigSummary,
  normalizeServiceUrl,
  resolveConfig,
  validateConfig,
} from "../src/config.js";

test("defaults are explicit and immutable", () => {
  assert.equal(DEFAULT_CONFIG.schema, CONFIG_SCHEMA);
  assert.equal(DEFAULT_CONFIG.handoff_mode, "review");
  assert.deepEqual(DEFAULT_CONFIG.evidence_policy, { prompt: "full", report: "full" });
  assert.equal(DEFAULT_CONFIG.storage, null);
  assert.equal(DEFAULT_CONFIG.service_url, DEFAULT_SERVICE_URL);
  assert.deepEqual(DEFAULT_CONFIG.publication, {
    change_description: "link",
    change_comment: "link",
    committed_file: null,
  });
  assert.deepEqual(DEFAULT_CONFIG.recovery, { prompt: "persist", report: "persist" });
  assert.equal(DEFAULT_SERVICE_URL, "http://127.0.0.1:3210");
  assert.ok(Object.isFrozen(DEFAULT_CONFIG));
  assert.ok(Object.isFrozen(DEFAULT_CONFIG.evidence_policy));
  assert.ok(Object.isFrozen(DEFAULT_CONFIG.publication));
  assert.ok(Object.isFrozen(DEFAULT_CONFIG.recovery));
});

test("scope precedence is global then provider then workspace then repository then task", () => {
  const config = resolveConfig({
    global: {
      handoff_mode: "automatic",
      evidence_policy: { prompt: "hash" },
      service_url: "http://127.0.0.1:3200",
      publication: { change_description: "summary" },
      recovery: { prompt: "persist", report: "memory" },
    },
    provider: { evidence_policy: { report: "hash" }, publication: { change_comment: "none" } },
    workspace: { handoff_mode: "review", service_url: "http://127.0.0.1:3201" },
    repository: {
      evidence_policy: { prompt: "omit" },
      storage: { repository: "example/records", branch: "main" },
      publication: {
        committed_file: {
          presentation: "link",
          repository: "example/provenance",
          branch: "main",
          path_template: "crossdock/{task_id}.md",
        },
      },
    },
    task: {
      evidence_policy: { report: "omit" },
      handoff_mode: "automatic",
      service_url: "http://127.0.0.1:4321",
      publication: { change_description: "none" },
      recovery: { prompt: "memory" },
    },
  });
  assert.equal(config.handoff_mode, "automatic");
  assert.deepEqual(config.evidence_policy, { prompt: "omit", report: "omit" });
  assert.deepEqual(config.storage, { type: "github", repository: "example/records", branch: "main" });
  assert.equal(config.service_url, "http://127.0.0.1:4321");
  assert.deepEqual(config.recovery, { prompt: "memory", report: "memory" });
  assert.deepEqual(config.publication, {
    change_description: "none",
    change_comment: "none",
    committed_file: {
      presentation: "link",
      adapter: "github",
      repository: "example/provenance",
      branch: "main",
      path_template: "crossdock/{task_id}.md",
    },
  });
});

test("higher scope can explicitly clear inherited storage and committed-file publication", () => {
  const config = resolveConfig({
    global: {
      storage: { repository: "example/records", branch: "main" },
      publication: {
        committed_file: {
          presentation: "reference",
          repository: "example/provenance",
          branch: "main",
          path_template: "crossdock/{task_id}.md",
        },
      },
    },
    task: { storage: null, publication: { committed_file: null } },
  });
  assert.equal(config.storage, null);
  assert.equal(config.publication.committed_file, null);
});

test("partial evidence, publication, and recovery layers preserve unrelated choices", () => {
  const config = resolveConfig({
    provider: { recovery: { report: "memory" } },
    repository: {
      evidence_policy: { report: "hash" },
      publication: { change_comment: "summary" },
      recovery: { prompt: "memory" },
    },
  });
  assert.deepEqual(config.evidence_policy, { prompt: "full", report: "hash" });
  assert.deepEqual(config.publication, {
    change_description: "link",
    change_comment: "summary",
    committed_file: null,
  });
  assert.deepEqual(config.recovery, { prompt: "memory", report: "memory" });
});

test("resolved config does not mutate caller layers", () => {
  const layer = {
    evidence_policy: { prompt: "omit" },
    storage: { repository: "example/records", branch: "main" },
    publication: { change_description: "none" },
    recovery: { prompt: "memory", report: "memory" },
  };
  const snapshot = structuredClone(layer);
  resolveConfig({ task: layer });
  assert.deepEqual(layer, snapshot);
});

test("unknown scope and config fields fail instead of being ignored", () => {
  assert.throws(() => resolveConfig({ mystery: {} }), /unknown field: mystery/);
  assert.throws(() => resolveConfig({ global: { made_up: true } }), /unknown field: made_up/);
  assert.throws(() => resolveConfig({ global: { evidence_policy: { unknown: "omit" } } }), /unknown field: unknown/);
  assert.throws(() => resolveConfig({ global: { publication: { mystery: "none" } } }), /unknown field: mystery/);
  assert.throws(() => resolveConfig({ global: { recovery: { future: "memory" } } }), /unknown field: future/);
});

test("invalid handoff, evidence, publication, and recovery modes fail clearly", () => {
  assert.throws(() => resolveConfig({ task: { handoff_mode: "sometimes" } }), /handoff_mode/);
  assert.throws(() => resolveConfig({ task: { evidence_policy: { prompt: "sometimes" } } }), /evidence_policy.prompt/);
  assert.throws(() => resolveConfig({ task: { publication: { change_description: "sometimes" } } }), /change_description/);
  assert.throws(() => resolveConfig({ task: { publication: { committed_file: { presentation: "full", repository: "example/provenance", branch: "main", path_template: "crossdock/{task_id}.md" } } } }), /presentation/);
  assert.throws(() => resolveConfig({ task: { recovery: { prompt: "encrypted" } } }), /recovery.prompt/);
  assert.throws(() => resolveConfig({ task: { recovery: { report: "encrypted" } } }), /recovery.report/);
  assert.deepEqual(PUBLICATION_PRESENTATIONS, ["link", "summary", "none"]);
  assert.deepEqual(COMMITTED_FILE_PRESENTATIONS, ["link", "reference"]);
  assert.deepEqual(RECOVERY_PROMPT_MODES, ["persist", "memory"]);
  assert.deepEqual(RECOVERY_REPORT_MODES, ["persist", "memory"]);
});

test("GitHub storage normalizes type and validates destination", () => {
  const config = resolveConfig({ task: { storage: { repository: "example/private-records", branch: "records/main" } } });
  assert.deepEqual(config.storage, { type: "github", repository: "example/private-records", branch: "records/main" });
  assert.throws(() => resolveConfig({ task: { storage: { type: "future", repository: "example/records", branch: "main" } } }), /unsupported/);
  assert.throws(() => resolveConfig({ task: { storage: { repository: "not-a-repo", branch: "main" } } }), /owner\/repo/);
});

test("committed-file publication is explicit and collision-safe", () => {
  const config = resolveConfig({
    task: {
      publication: {
        committed_file: {
          presentation: "reference",
          adapter: "github",
          repository: "example/provenance",
          branch: "records",
          path_template: "provenance/{task_id}.md",
        },
      },
    },
  });
  assert.equal(config.publication.committed_file.presentation, "reference");
  assert.equal(config.publication.committed_file.path_template, "provenance/{task_id}.md");

  for (const committed_file of [
    { presentation: "link", adapter: "future", repository: "example/provenance", branch: "main", path_template: "p/{task_id}.md" },
    { presentation: "link", repository: "bad", branch: "main", path_template: "p/{task_id}.md" },
    { presentation: "link", repository: "example/provenance", branch: "main", path_template: "/p/{task_id}.md" },
    { presentation: "link", repository: "example/provenance", branch: "main", path_template: "../p/{task_id}.md" },
    { presentation: "link", repository: "example/provenance", branch: "main", path_template: "provenance/task.md" },
  ]) {
    assert.throws(() => resolveConfig({ task: { publication: { committed_file } } }), /(unsupported|owner\/repo|repository-relative|include \{task_id\})/);
  }
});

test("all GitHub-visible source-change presentation may be disabled independently of storage", () => {
  const config = resolveConfig({
    task: {
      storage: { repository: "example/private-records", branch: "main" },
      publication: { change_description: "none", change_comment: "none", committed_file: null },
    },
  });
  assert.deepEqual(config.publication, { change_description: "none", change_comment: "none", committed_file: null });
  assert.deepEqual(config.storage, { type: "github", repository: "example/private-records", branch: "main" });
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

test("existing v1 config defaults newly introduced service URL, publication, and recovery settings", () => {
  const legacy = {
    schema: CONFIG_SCHEMA,
    handoff_mode: "review",
    evidence_policy: { prompt: "full", report: "full" },
    storage: null,
  };
  const validated = validateConfig(legacy);
  assert.equal(validated.service_url, DEFAULT_SERVICE_URL);
  assert.deepEqual(validated.publication, {
    change_description: "link",
    change_comment: "link",
    committed_file: null,
  });
  assert.deepEqual(validated.recovery, { prompt: "persist", report: "persist" });

  const promptRecoveryEra = validateConfig({
    ...legacy,
    service_url: DEFAULT_SERVICE_URL,
    publication: { change_description: "link", change_comment: "link", committed_file: null },
    recovery: { prompt: "memory" },
  });
  assert.deepEqual(promptRecoveryEra.recovery, { prompt: "memory", report: "persist" });

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
      publication: { change_description: "summary", change_comment: "none" },
      recovery: { prompt: "memory", report: "memory" },
    },
  });
  assert.deepEqual(effectiveConfigSummary(config), {
    handoff_mode: "automatic",
    prompt_evidence: "hash",
    report_evidence: "omit",
    storage: { type: "github", repository: "example/private-records", branch: "main" },
    service_url: "http://127.0.0.1:4321",
    publication: {
      change_description: "summary",
      change_comment: "none",
      committed_file: null,
    },
    recovery: { prompt: "memory", report: "memory" },
  });
});
