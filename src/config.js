import { EVIDENCE_MODES } from "./task-log.js";

export const CONFIG_SCHEMA = "crossdock.config/v1";
export const HANDOFF_MODES = Object.freeze(["review", "automatic"]);
export const CONFIG_SCOPES = Object.freeze(["global", "provider", "workspace", "repository", "task"]);

export const DEFAULT_CONFIG = deepFreeze({
  schema: CONFIG_SCHEMA,
  handoff_mode: "review",
  evidence_policy: { prompt: "full", report: "full" },
  storage: null,
});

export function resolveConfig(scopes = {}) {
  if (!scopes || typeof scopes !== "object" || Array.isArray(scopes)) throw new TypeError("config scopes must be an object");
  assertKnownKeys(scopes, new Set(CONFIG_SCOPES), "config scopes");

  let resolved = clone(DEFAULT_CONFIG);
  for (const scope of CONFIG_SCOPES) {
    const layer = scopes[scope];
    if (layer == null) continue;
    resolved = mergeLayer(resolved, normalizeLayer(layer, scope));
  }
  return deepFreeze(validateConfig(resolved));
}

export function validateConfig(config, { requireStorage = false } = {}) {
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new TypeError("config must be an object");
  assertKnownKeys(config, new Set(["schema", "handoff_mode", "evidence_policy", "storage"]), "config");
  if (config.schema !== CONFIG_SCHEMA) throw new Error(`config.schema must be ${CONFIG_SCHEMA}`);
  if (!HANDOFF_MODES.includes(config.handoff_mode)) throw new Error(`handoff_mode must be one of: ${HANDOFF_MODES.join(", ")}`);

  const evidence = normalizeEvidence(config.evidence_policy, "config.evidence_policy", true);
  const storage = normalizeStorage(config.storage, "config.storage");
  if (requireStorage && storage == null) throw new Error("task-record storage must be configured");

  return {
    schema: CONFIG_SCHEMA,
    handoff_mode: config.handoff_mode,
    evidence_policy: evidence,
    storage,
  };
}

export function effectiveConfigSummary(config) {
  const validated = validateConfig(config);
  return {
    handoff_mode: validated.handoff_mode,
    prompt_evidence: validated.evidence_policy.prompt,
    report_evidence: validated.evidence_policy.report,
    storage: validated.storage == null ? null : {
      type: validated.storage.type,
      repository: validated.storage.repository,
      branch: validated.storage.branch,
    },
  };
}

function normalizeLayer(layer, scope) {
  if (!layer || typeof layer !== "object" || Array.isArray(layer)) throw new TypeError(`${scope} config must be an object`);
  assertKnownKeys(layer, new Set(["schema", "handoff_mode", "evidence_policy", "storage"]), `${scope} config`);
  if (layer.schema != null && layer.schema !== CONFIG_SCHEMA) throw new Error(`${scope} config schema must be ${CONFIG_SCHEMA}`);

  const normalized = {};
  if (Object.hasOwn(layer, "handoff_mode")) {
    if (!HANDOFF_MODES.includes(layer.handoff_mode)) throw new Error(`${scope}.handoff_mode must be one of: ${HANDOFF_MODES.join(", ")}`);
    normalized.handoff_mode = layer.handoff_mode;
  }
  if (Object.hasOwn(layer, "evidence_policy")) normalized.evidence_policy = normalizeEvidence(layer.evidence_policy, `${scope}.evidence_policy`, false);
  if (Object.hasOwn(layer, "storage")) normalized.storage = normalizeStorage(layer.storage, `${scope}.storage`);
  return normalized;
}

function normalizeEvidence(value, label, requireBoth) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  assertKnownKeys(value, new Set(["prompt", "report"]), label);
  const result = {};
  for (const field of ["prompt", "report"]) {
    if (!Object.hasOwn(value, field)) {
      if (requireBoth) throw new Error(`${label}.${field} is required`);
      continue;
    }
    if (!EVIDENCE_MODES.includes(value[field])) throw new Error(`${label}.${field} must be one of: ${EVIDENCE_MODES.join(", ")}`);
    result[field] = value[field];
  }
  return result;
}

function normalizeStorage(value, label) {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object or null`);
  assertKnownKeys(value, new Set(["type", "repository", "branch"]), label);
  const type = value.type ?? "github";
  if (type !== "github") throw new Error(`${label}.type is unsupported: ${type}`);
  if (typeof value.repository !== "string" || !/^[^/\s]+\/[^/\s]+$/.test(value.repository)) throw new Error(`${label}.repository must be owner/repo`);
  if (typeof value.branch !== "string" || !value.branch.trim()) throw new Error(`${label}.branch is required`);
  return { type, repository: value.repository, branch: value.branch };
}

function mergeLayer(base, layer) {
  const next = clone(base);
  if (Object.hasOwn(layer, "handoff_mode")) next.handoff_mode = layer.handoff_mode;
  if (Object.hasOwn(layer, "evidence_policy")) next.evidence_policy = { ...next.evidence_policy, ...layer.evidence_policy };
  if (Object.hasOwn(layer, "storage")) next.storage = layer.storage == null ? null : clone(layer.storage);
  return next;
}

function assertKnownKeys(value, allowed, label) {
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`${label} contains unknown field: ${key}`);
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
