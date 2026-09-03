export const REVIEW_RESULT_SCHEMA = "crossdock.review-result/v1";

const RESULT_FIELDS = new Set(["schema", "task_id", "adapter", "source", "status", "report", "findings", "provider"]);
const SOURCE_FIELDS = new Set(["adapter", "host", "repository", "change", "version"]);
const PROVIDER_FIELDS = new Set(["task_id", "task_url", "review_id"]);
const FINDING_FIELDS = new Set(["id", "severity", "title", "body", "location"]);
const LOCATION_FIELDS = new Set(["path", "line", "version"]);
const STATUSES = new Set(["completed", "failed"]);
const SEVERITIES = new Set(["info", "low", "medium", "high", "critical"]);

/**
 * Validate one terminal provider-neutral review result.
 *
 * The reviewed source version is mandatory and immutable in the normalized
 * value. Callers must compare it with the version pinned by the corresponding
 * work-item request before accepting or publishing the result.
 */
export function validateReviewResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("review result must be an object");
  assertKnownKeys(value, RESULT_FIELDS, "review result");
  if (value.schema !== REVIEW_RESULT_SCHEMA) throw new Error(`review result schema must be ${REVIEW_RESULT_SCHEMA}`);

  const status = requireEnum(value.status, STATUSES, "review result status");
  const report = optionalNonEmptyString(value.report, "report");
  if (status === "completed" && !report) throw new Error("completed review result requires report");

  return deepFreeze({
    schema: REVIEW_RESULT_SCHEMA,
    task_id: requireNonEmptyString(value.task_id, "task_id"),
    adapter: requireNonEmptyString(value.adapter, "adapter"),
    source: normalizeSource(value.source),
    status,
    report,
    findings: normalizeFindings(value.findings),
    provider: normalizeProvider(value.provider),
  });
}

/**
 * Bind a terminal review result to the exact preflighted request.
 *
 * This prevents a provider response for another task, adapter, change, or
 * moving source version from being accepted as the requested review.
 */
export function bindReviewResult({ request, result }) {
  if (!request || request.intent !== "review") throw new Error("review request is required");
  const normalized = validateReviewResult(result);
  const expected = request.source;
  const actual = normalized.source;

  if (normalized.adapter !== expected.adapter || actual.adapter !== expected.adapter) throw new Error("review result adapter does not match request");
  for (const field of ["host", "repository", "change", "version"]) {
    if (actual[field] !== expected[field]) throw new Error(`review result source.${field} does not match request`);
  }
  return normalized;
}

function normalizeSource(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("review result source must be an object");
  assertKnownKeys(value, SOURCE_FIELDS, "review result source");
  return {
    adapter: requireNonEmptyString(value.adapter, "source.adapter"),
    host: requireNonEmptyString(value.host, "source.host").toLowerCase(),
    repository: requireNonEmptyString(value.repository, "source.repository"),
    change: requireNonEmptyString(value.change, "source.change"),
    version: requireNonEmptyString(value.version, "source.version"),
  };
}

function normalizeProvider(value) {
  if (value == null) return { task_id: null, task_url: null, review_id: null };
  if (typeof value !== "object" || Array.isArray(value)) throw new TypeError("provider must be an object");
  assertKnownKeys(value, PROVIDER_FIELDS, "provider");
  return {
    task_id: optionalNonEmptyString(value.task_id, "provider.task_id"),
    task_url: optionalNonEmptyString(value.task_url, "provider.task_url"),
    review_id: optionalNonEmptyString(value.review_id, "provider.review_id"),
  };
}

function normalizeFindings(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError("findings must be an array");
  const ids = new Set();
  return value.map((finding) => {
    if (!finding || typeof finding !== "object" || Array.isArray(finding)) throw new TypeError("finding must be an object");
    assertKnownKeys(finding, FINDING_FIELDS, "finding");
    const id = requireNonEmptyString(finding.id, "finding.id");
    if (ids.has(id)) throw new Error(`duplicate finding id: ${id}`);
    ids.add(id);
    return {
      id,
      severity: requireEnum(finding.severity, SEVERITIES, "finding.severity"),
      title: requireNonEmptyString(finding.title, "finding.title"),
      body: requireNonEmptyString(finding.body, "finding.body"),
      location: normalizeLocation(finding.location),
    };
  });
}

function normalizeLocation(value) {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new TypeError("finding.location must be an object");
  assertKnownKeys(value, LOCATION_FIELDS, "finding.location");
  const line = value.line == null ? null : value.line;
  if (line != null && (!Number.isSafeInteger(line) || line < 1)) throw new Error("finding.location.line must be a positive integer");
  return {
    path: requireNonEmptyString(value.path, "finding.location.path"),
    line,
    version: optionalNonEmptyString(value.version, "finding.location.version"),
  };
}

function requireEnum(value, allowed, label) {
  if (!allowed.has(value)) throw new Error(`${label} is invalid: ${String(value)}`);
  return value;
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
