import { requireIntentSupport, supportsAgentFeature, WORK_ITEM_INTENTS } from "./agent-capabilities.js";

export const WORK_ITEM_REQUEST_SCHEMA = "crossdock.work-item-request/v1";

const REQUEST_FIELDS = new Set(["schema", "intent", "source", "request", "review"]);
const SOURCE_FIELDS = new Set(["adapter", "host", "repository", "change", "version"]);
const REVIEW_FIELDS = new Set(["focus", "guidance"]);

/**
 * Validate and normalize one provider-neutral work-item request.
 *
 * A review is anchored to an exact source version before delegation. This
 * prevents an adapter from silently reviewing a moving PR head and makes the
 * eventual immutable record able to state exactly what was requested.
 */
export function validateWorkItemRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("work-item request must be an object");
  assertKnownKeys(value, REQUEST_FIELDS, "work-item request");
  if (value.schema !== WORK_ITEM_REQUEST_SCHEMA) throw new Error(`work-item request schema must be ${WORK_ITEM_REQUEST_SCHEMA}`);
  if (!WORK_ITEM_INTENTS.includes(value.intent)) throw new Error(`unsupported work-item intent: ${String(value.intent)}`);

  const source = normalizeSource(value.source, value.intent);
  const request = requireNonEmptyString(value.request, "request");
  const review = normalizeReview(value.review, value.intent);

  return deepFreeze({
    schema: WORK_ITEM_REQUEST_SCHEMA,
    intent: value.intent,
    source,
    request,
    review,
  });
}

/**
 * Fail before delegation when the selected adapter cannot perform the request.
 *
 * Experimental support remains opt-in. Review focus/guidance additionally
 * requires the adapter's `review-guidance` feature so the core never drops
 * user instructions merely to make an unsupported route appear successful.
 */
export function preflightWorkItemRequest({ request, capabilities, allowExperimental = false }) {
  const normalized = validateWorkItemRequest(request);
  const validatedCapabilities = requireIntentSupport(capabilities, normalized.intent, { allowExperimental });

  if (normalized.intent === "review" && hasReviewGuidance(normalized.review)) {
    const supported = supportsAgentFeature(validatedCapabilities, "review", "review-guidance", { allowExperimental });
    if (!supported) throw new Error(`adapter ${validatedCapabilities.adapter} does not support review guidance`);
  }

  return deepFreeze({ request: normalized, capabilities: validatedCapabilities });
}

function normalizeSource(value, intent) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("source must be an object");
  assertKnownKeys(value, SOURCE_FIELDS, "source");

  const source = {
    adapter: requireNonEmptyString(value.adapter, "source.adapter"),
    host: requireNonEmptyString(value.host, "source.host"),
    repository: requireNonEmptyString(value.repository, "source.repository"),
    change: optionalNonEmptyString(value.change, "source.change"),
    version: optionalNonEmptyString(value.version, "source.version"),
  };

  if (intent === "review") {
    if (!source.change) throw new Error("review source.change is required");
    if (!source.version) throw new Error("review source.version is required");
  }
  return source;
}

function normalizeReview(value, intent) {
  if (intent !== "review") {
    if (value != null) throw new Error("review options are only valid for review work items");
    return null;
  }
  if (value == null) return { focus: [], guidance: null };
  if (typeof value !== "object" || Array.isArray(value)) throw new TypeError("review must be an object");
  assertKnownKeys(value, REVIEW_FIELDS, "review");

  const focus = value.focus == null ? [] : normalizeStringList(value.focus, "review.focus");
  const guidance = optionalNonEmptyString(value.guidance, "review.guidance");
  return { focus, guidance };
}

function hasReviewGuidance(review) {
  return Boolean(review && (review.focus.length || review.guidance));
}

function normalizeStringList(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  const result = [];
  for (const item of value) {
    const normalized = requireNonEmptyString(item, `${label} item`);
    if (!result.includes(normalized)) result.push(normalized);
  }
  return result;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function optionalNonEmptyString(value, label) {
  if (value == null) return null;
  return requireNonEmptyString(value, label);
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
