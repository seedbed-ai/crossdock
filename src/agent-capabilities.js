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

export const CAPABILITY_STATUSES = Object.freeze(["experimental", "verified"]);

/**
 * Validate and normalize one adapter capability descriptor.
 *
 * Capability metadata says what an adapter can technically do. It does not
 * grant repository access, mutation authority, evidence-publication consent,
 * or any other user/deployment permission. Features are scoped to one intent
 * so callers cannot accidentally combine capabilities that the adapter never
 * promised together.
 */
export function validateAgentCapabilities(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("agent capabilities must be an object");
  assertKnownKeys(value, new Set(["schema", "adapter", "provider", "surface", "intents"]), "agent capabilities");
  if (value.schema !== AGENT_CAPABILITIES_SCHEMA) throw new Error(`agent capabilities schema must be ${AGENT_CAPABILITIES_SCHEMA}`);

  const adapter = requireNonEmptyString(value.adapter, "adapter");
  const provider = requireNonEmptyString(value.provider, "provider");
  const surface = requireNonEmptyString(value.surface, "surface");
  const intents = normalizeIntentMap(value.intents);

  return deepFreeze({
    schema: AGENT_CAPABILITIES_SCHEMA,
    adapter,
    provider,
    surface,
    intents,
  });
}

/**
 * Return whether an intent is usable for ordinary routing.
 *
 * Experimental provider paths are opt-in so capability discovery never turns
 * an unvalidated browser integration into an implicit supported workflow.
 */
export function supportsIntent(capabilities, intent, { allowExperimental = false } = {}) {
  assertKnownIntent(intent);
  const support = validateAgentCapabilities(capabilities).intents[intent];
  if (!support) return false;
  return support.status === "verified" || allowExperimental;
}

export function requireIntentSupport(capabilities, intent, options = {}) {
  const normalized = validateAgentCapabilities(capabilities);
  assertKnownIntent(intent);
  const support = normalized.intents[intent];
  if (!support) throw new Error(`adapter ${normalized.adapter} does not support work-item intent: ${intent}`);
  if (support.status !== "verified" && options.allowExperimental !== true) {
    throw new Error(`adapter ${normalized.adapter} supports work-item intent ${intent} only experimentally`);
  }
  return normalized;
}

export function intentCapabilityStatus(capabilities, intent) {
  assertKnownIntent(intent);
  return validateAgentCapabilities(capabilities).intents[intent]?.status ?? null;
}

export function supportsAgentFeature(capabilities, intent, feature, { allowExperimental = false } = {}) {
  assertKnownIntent(intent);
  assertKnownFeature(feature);
  const normalized = validateAgentCapabilities(capabilities);
  const support = normalized.intents[intent];
  if (!support) return false;
  if (support.status !== "verified" && !allowExperimental) return false;
  return support.features.includes(feature);
}

function normalizeIntentMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("intents must be an object");
  const result = {};
  for (const [intent, support] of Object.entries(value)) {
    assertKnownIntent(intent);
    if (!support || typeof support !== "object" || Array.isArray(support)) throw new TypeError(`intents.${intent} must be an object`);
    assertKnownKeys(support, new Set(["status", "features"]), `intents.${intent}`);
    if (!CAPABILITY_STATUSES.includes(support.status)) throw new Error(`intents.${intent}.status must be one of: ${CAPABILITY_STATUSES.join(", ")}`);
    result[intent] = {
      status: support.status,
      features: normalizeEnumList(support.features ?? [], AGENT_FEATURES, `intents.${intent}.features`),
    };
  }
  return result;
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
