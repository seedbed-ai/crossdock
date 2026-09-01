export const AGENT_CAPABILITIES_SCHEMA = "crossdock.agent-capabilities/v1";

export const WORK_ITEM_INTENTS = Object.freeze([
  "implement",
  "review",
  "investigate",
  "triage",
  "remediate",
  "verify",
]);

export const AGENT_FEATURES = Object.freeze([
  "review-guidance",
  "parallel-execution",
  "scheduled-execution",
  "image-input",
  "security-analysis",
  "branch-mutation",
  "result-report",
  "stable-artifacts",
]);

/**
 * Validate and normalize one adapter capability descriptor.
 *
 * Capability metadata says what an adapter can technically do. It does not
 * grant repository access, mutation authority, evidence-publication consent,
 * or any other user/deployment permission.
 */
export function validateAgentCapabilities(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("agent capabilities must be an object");
  assertKnownKeys(value, new Set(["schema", "adapter", "provider", "surface", "intents", "features"]), "agent capabilities");
  if (value.schema !== AGENT_CAPABILITIES_SCHEMA) throw new Error(`agent capabilities schema must be ${AGENT_CAPABILITIES_SCHEMA}`);

  const adapter = requireNonEmptyString(value.adapter, "adapter");
  const provider = requireNonEmptyString(value.provider, "provider");
  const surface = requireNonEmptyString(value.surface, "surface");
  const intents = normalizeEnumList(value.intents, WORK_ITEM_INTENTS, "intents");
  const features = normalizeEnumList(value.features ?? [], AGENT_FEATURES, "features");

  return deepFreeze({
    schema: AGENT_CAPABILITIES_SCHEMA,
    adapter,
    provider,
    surface,
    intents,
    features,
  });
}

export function supportsIntent(capabilities, intent) {
  assertKnownIntent(intent);
  return validateAgentCapabilities(capabilities).intents.includes(intent);
}

export function requireIntentSupport(capabilities, intent) {
  const normalized = validateAgentCapabilities(capabilities);
  assertKnownIntent(intent);
  if (!normalized.intents.includes(intent)) {
    throw new Error(`adapter ${normalized.adapter} does not support work-item intent: ${intent}`);
  }
  return normalized;
}

export function supportsAgentFeature(capabilities, feature) {
  assertKnownFeature(feature);
  return validateAgentCapabilities(capabilities).features.includes(feature);
}

function normalizeEnumList(value, allowed, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  const allowedSet = new Set(allowed);
  const result = [];
  for (const item of value) {
    if (typeof item !== "string" || !allowedSet.has(item)) throw new Error(`${label} contains unsupported value: ${String(item)}`);
    if (!result.includes(item)) result.push(item);
  }
  return result;
}

function assertKnownIntent(intent) {
  if (!WORK_ITEM_INTENTS.includes(intent)) throw new Error(`unsupported work-item intent: ${String(intent)}`);
}

function assertKnownFeature(feature) {
  if (!AGENT_FEATURES.includes(feature)) throw new Error(`unsupported agent feature: ${String(feature)}`);
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function assertKnownKeys(value, allowed, label) {
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`${label} contains unknown field: ${key}`);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
