import { DEFAULT_SERVICE_URL, normalizeServiceUrl } from "./service-endpoint.js";
import { EVIDENCE_MODES } from "./task-record.js";

export { DEFAULT_SERVICE_URL, normalizeServiceUrl } from "./service-endpoint.js";

export const CONFIG_SCHEMA = "crossdock.config/v1";
export const HANDOFF_MODES = Object.freeze(["review", "automatic"]);
export const CONFIG_SCOPES = Object.freeze(["global", "provider", "workspace", "repository", "task"]);
export const PUBLICATION_PRESENTATIONS = Object.freeze(["link", "summary", "none"]);
export const COMMITTED_FILE_PRESENTATIONS = Object.freeze(["link", "reference"]);

const CONFIG_FIELDS = new Set(["schema", "handoff_mode", "evidence_policy", "storage", "service_url", "publication"]);
const PUBLICATION_FIELDS = new Set(["change_description", "change_comment", "committed_file"]);
const COMMITTED_FILE_FIELDS = new Set(["presentation", "adapter", "repository", "branch", "path_template"]);

const DEFAULT_PUBLICATION = {
  change_description: "link",
  change_comment: "link",
  committed_file: null,
};

export const DEFAULT_CONFIG = deepFreeze({
  schema: CONFIG_SCHEMA,
  handoff_mode: "review",
  evidence_policy: { prompt: "full", report: "full" },
  storage: null,
  service_url: DEFAULT_SERVICE_URL,
  publication: DEFAULT_PUBLICATION,
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
  assertKnownKeys(config, CONFIG_FIELDS, "config");
  if (config.schema !== CONFIG_SCHEMA) throw new Error(`config.schema must be ${CONFIG_SCHEMA}`);
  if (!HANDOFF_MODES.includes(config.handoff_mode)) throw new Error(`handoff_mode must be one of: ${HANDOFF_MODES.join(", ")}`);

  const evidence = normalizeEvidence(config.evidence_policy, "config.evidence_policy", true);
  const storage = normalizeStorage(config.storage, "config.storage");
  const rawServiceUrl = Object.hasOwn(config, "service_url") ? config.service_url : DEFAULT_SERVICE_URL;
  const serviceUrl = normalizeServiceUrl(rawServiceUrl, "config.service_url");
  const publication = Object.hasOwn(config, "publication")
    ? normalizePublication(config.publication, "config.publication", true)
    : clone(DEFAULT_PUBLICATION);
  if (requireStorage && storage == null) throw new Error("task-record storage must be configured");

  return {
    schema: CONFIG_SCHEMA,
    handoff_mode: config.handoff_mode,
    evidence_policy: evidence,
    storage,
    service_url: serviceUrl,
    publication,
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
    service_url: validated.service_url,
    publication: clone(validated.publication),
  };
}

function normalizeLayer(layer, scope) {
  if (!layer || typeof layer !== "object" || Array.isArray(layer)) throw new TypeError(`${scope} config must be an object`);
  assertKnownKeys(layer, CONFIG_FIELDS, `${scope} config`);
  if (layer.schema != null && layer.schema !== CONFIG_SCHEMA) throw new Error(`${scope} config schema must be ${CONFIG_SCHEMA}`);

  const normalized = {};
  if (Object.hasOwn(layer, "handoff_mode")) {
    if (!HANDOFF_MODES.includes(layer.handoff_mode)) throw new Error(`${scope}.handoff_mode must be one of: ${HANDOFF_MODES.join(", ")}`);
    normalized.handoff_mode = layer.handoff_mode;
  }
  if (Object.hasOwn(layer, "evidence_policy")) normalized.evidence_policy = normalizeEvidence(layer.evidence_policy, `${scope}.evidence_policy`, false);
  if (Object.hasOwn(layer, "storage")) normalized.storage = normalizeStorage(layer.storage, `${scope}.storage`);
  if (Object.hasOwn(layer, "service_url")) normalized.service_url = normalizeServiceUrl(layer.service_url, `${scope}.service_url`);
  if (Object.hasOwn(layer, "publication")) normalized.publication = normalizePublication(layer.publication, `${scope}.publication`, false);
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

function normalizePublication(value, label, requireAll) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  assertKnownKeys(value, PUBLICATION_FIELDS, label);
  const result = {};

  for (const field of ["change_description", "change_comment"]) {
    if (!Object.hasOwn(value, field)) {
      if (requireAll) throw new Error(`${label}.${field} is required`);
      continue;
    }
    if (!PUBLICATION_PRESENTATIONS.includes(value[field])) {
      throw new Error(`${label}.${field} must be one of: ${PUBLICATION_PRESENTATIONS.join(", ")}`);
    }
    result[field] = value[field];
  }

  if (!Object.hasOwn(value, "committed_file")) {
    if (requireAll) throw new Error(`${label}.committed_file is required`);
  } else {
    result.committed_file = normalizeCommittedFile(value.committed_file, `${label}.committed_file`);
  }
  return result;
}

function normalizeCommittedFile(value, label) {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object or null`);
  assertKnownKeys(value, COMMITTED_FILE_FIELDS, label);

  if (!COMMITTED_FILE_PRESENTATIONS.includes(value.presentation)) {
    throw new Error(`${label}.presentation must be one of: ${COMMITTED_FILE_PRESENTATIONS.join(", ")}`);
  }
  const adapter = value.adapter ?? "github";
  if (adapter !== "github") throw new Error(`${label}.adapter is unsupported: ${adapter}`);
  if (typeof value.repository !== "string" || !/^[^/\s]+\/[^/\s]+$/.test(value.repository)) throw new Error(`${label}.repository must be owner/repo`);
  if (typeof value.branch !== "string" || !value.branch.trim()) throw new Error(`${label}.branch is required`);
  if (typeof value.path_template !== "string" || !value.path_template.trim()) throw new Error(`${label}.path_template is required`);

  const pathTemplate = value.path_template.trim();
  if (pathTemplate.startsWith("/") || pathTemplate.split("/").includes("..")) throw new Error(`${label}.path_template must be a repository-relative path`);
  if (!pathTemplate.includes("{task_id}")) throw new Error(`${label}.path_template must include {task_id} for collision-safe publication`);

  return {
    presentation: value.presentation,
    adapter,
    repository: value.repository,
    branch: value.branch.trim(),
    path_template: pathTemplate,
  };
}

function mergeLayer(base, layer) {
  const next = clone(base);
  if (Object.hasOwn(layer, "handoff_mode")) next.handoff_mode = layer.handoff_mode;
  if (Object.hasOwn(layer, "evidence_policy")) next.evidence_policy = { ...next.evidence_policy, ...layer.evidence_policy };
  if (Object.hasOwn(layer, "storage")) next.storage = layer.storage == null ? null : clone(layer.storage);
  if (Object.hasOwn(layer, "service_url")) next.service_url = layer.service_url;
  if (Object.hasOwn(layer, "publication")) next.publication = { ...next.publication, ...clone(layer.publication) };
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
