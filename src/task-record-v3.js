import { createHash } from "node:crypto";
import { WORK_ITEM_INTENTS } from "./agent-capabilities.js";

export const TASK_RECORD_V3_SCHEMA = "crossdock.task-record/v3";
export const TASK_RECORD_V3_EVIDENCE_MODES = Object.freeze(["full", "hash", "omit"]);
export const TASK_RECORD_V3_HANDOFF_PHASES = Object.freeze(["none", "initial-pr", "branch-update", "review-publication", "artifact-publication"]);
export const TASK_RECORD_V3_PUBLICATION_REQUESTS = Object.freeze(["forbidden", "not-requested", "authorized"]);
export const TASK_RECORD_V3_PUBLICATION_OUTCOMES = Object.freeze(["not-attempted", "published", "failed"]);

const TOP_LEVEL_FIELDS = new Set([
  "task_id", "intent", "status", "created_at", "completed_at", "handoff_phase",
  "parent_task_id", "causal_artifact", "family_id", "schedule_id", "schedule_occurrence",
  "source", "agent", "evidence_policy", "request", "result", "publications", "artifacts", "recovery_state",
]);

/** Canonicalize retained evidence before hashing, byte-counting, or persistence. */
export function canonicalizeTaskRecordV3Evidence(value) {
  if (typeof value !== "string") throw new TypeError("evidence must be a string");
  return value.replace(/\r\n?/g, "\n");
}

export function sha256TaskRecordV3Evidence(value) {
  return createHash("sha256").update(canonicalizeTaskRecordV3Evidence(value), "utf8").digest("hex");
}

/**
 * Render an execution result into the proposed v3 wire format.
 *
 * v3 is intentionally isolated from the active v2 writer. Metadata is encoded
 * as canonical JSON inside YAML front matter (JSON is a YAML 1.2 subset), and
 * arbitrary full evidence is consumed by UTF-8 byte length rather than by
 * scanning for Markdown headings or terminators.
 */
export function renderTaskRecordV3(record) {
  const normalized = validateTaskRecordV3Input(record);
  const evidence = buildEvidenceMetadata(normalized);
  const metadata = canonicalObject({
    schema: TASK_RECORD_V3_SCHEMA,
    task_id: normalized.task_id,
    intent: normalized.intent,
    status: "completed",
    created_at: normalized.created_at,
    completed_at: normalized.completed_at,
    handoff_phase: normalized.handoff_phase,
    parent_task_id: normalized.parent_task_id,
    causal_artifact: normalized.causal_artifact,
    family_id: normalized.family_id,
    schedule_id: normalized.schedule_id,
    schedule_occurrence: normalized.schedule_occurrence,
    source: normalized.source,
    agent: normalized.agent,
    evidence,
    publications: normalized.publications,
    artifacts: normalized.artifacts,
    recovery_state: normalized.recovery_state,
  });

  let output = `---\n${JSON.stringify(metadata, null, 2)}\n---\n`;
  for (const field of ["request", "result"]) {
    if (evidence[field].mode !== "full") continue;
    const text = normalized[field];
    output += `X-Crossdock-Evidence: ${field}; bytes=${evidence[field].bytes}\n${text}\n`;
  }
  return output;
}

/** Parse and fully verify one v3 record without relying on Markdown headings. */
export function parseTaskRecordV3(value) {
  if (typeof value !== "string") throw new TypeError("task record must be a string");
  const bytes = Buffer.from(value, "utf8");
  const opening = Buffer.from("---\n");
  if (!bytes.subarray(0, opening.length).equals(opening)) throw new Error("task record must start with YAML front matter");

  const closing = Buffer.from("\n---\n");
  const closeAt = bytes.indexOf(closing, opening.length);
  if (closeAt < 0) throw new Error("task record front matter is not terminated");

  const metadataText = bytes.subarray(opening.length, closeAt).toString("utf8");
  let metadata;
  try {
    metadata = JSON.parse(metadataText);
  } catch {
    throw new Error("task record v3 front matter must use canonical JSON-compatible YAML");
  }
  validateTaskRecordV3Metadata(metadata);

  let cursor = closeAt + closing.length;
  const retained = {};
  for (const field of ["request", "result"]) {
    const descriptor = metadata.evidence[field];
    if (descriptor.mode !== "full") continue;

    const headerEnd = bytes.indexOf(0x0a, cursor);
    if (headerEnd < 0) throw new Error(`${field} evidence header is incomplete`);
    const header = bytes.subarray(cursor, headerEnd).toString("utf8");
    const expectedHeader = `X-Crossdock-Evidence: ${field}; bytes=${descriptor.bytes}`;
    if (header !== expectedHeader) throw new Error(`${field} evidence header does not match metadata`);

    const start = headerEnd + 1;
    const end = start + descriptor.bytes;
    if (end > bytes.length) throw new Error(`${field} evidence is truncated`);
    const payloadBytes = bytes.subarray(start, end);
    const text = payloadBytes.toString("utf8");
    if (!Buffer.from(text, "utf8").equals(payloadBytes)) throw new Error(`${field} evidence is not valid UTF-8`);
    if (canonicalizeTaskRecordV3Evidence(text) !== text) throw new Error(`${field} evidence is not canonically LF-normalized`);
    if (sha256TaskRecordV3Evidence(text) !== descriptor.sha256) throw new Error(`${field} evidence digest does not match metadata`);
    retained[field] = text;

    if (bytes[end] !== 0x0a) throw new Error(`${field} evidence is not followed by the required separator newline`);
    cursor = end + 1;
  }

  if (cursor !== bytes.length) throw new Error("task record contains unexpected bytes after declared evidence");
  return deepFreeze({ metadata, evidence: retained });
}

export function validateTaskRecordV3Input(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new TypeError("record is required");
  assertKnownKeys(record, TOP_LEVEL_FIELDS, "record");

  const taskId = requireString(record.task_id, "task_id");
  if (!/^[A-Za-z0-9._-]+$/.test(taskId)) throw new Error("task_id may contain only letters, numbers, dot, underscore, and hyphen");
  const intent = requireEnum(record.intent, WORK_ITEM_INTENTS, "intent");
  if ((record.status ?? "completed") !== "completed") throw new Error("v3 immutable task records currently support only completed status");
  const createdAt = requireTimestamp(record.created_at, "created_at");
  const completedAt = requireTimestamp(record.completed_at, "completed_at");
  const handoffPhase = requireEnum(record.handoff_phase ?? "none", TASK_RECORD_V3_HANDOFF_PHASES, "handoff_phase");

  const source = normalizeSource(record.source, intent, handoffPhase);
  const agent = normalizeAgent(record.agent);
  const policy = normalizeEvidencePolicy(record.evidence_policy);
  const request = normalizeEvidenceInput(record.request, policy.request, "request");
  const result = normalizeEvidenceInput(record.result, policy.result, "result");
  const publications = normalizePublications(record.publications ?? []);
  const artifacts = normalizeArtifacts(record.artifacts ?? []);
  validatePublicationArtifactLinks(publications, artifacts);

  const parentTaskId = optionalString(record.parent_task_id, "parent_task_id");
  const causalArtifact = optionalString(record.causal_artifact, "causal_artifact");
  if (causalArtifact && !parentTaskId) throw new Error("causal_artifact requires parent_task_id so its namespace is durable");

  return deepFreeze({
    task_id: taskId,
    intent,
    status: "completed",
    created_at: createdAt,
    completed_at: completedAt,
    handoff_phase: handoffPhase,
    parent_task_id: parentTaskId,
    causal_artifact: causalArtifact,
    family_id: optionalString(record.family_id, "family_id"),
    schedule_id: optionalString(record.schedule_id, "schedule_id"),
    schedule_occurrence: optionalTimestamp(record.schedule_occurrence, "schedule_occurrence"),
    source,
    agent,
    evidence_policy: policy,
    request,
    result,
    publications,
    artifacts,
    recovery_state: record.recovery_state == null ? "clear" : requireEnum(record.recovery_state, ["clear"], "recovery_state"),
  });
}

export function validateTaskRecordV3Metadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new TypeError("v3 metadata must be an object");
  const allowed = new Set([
    "schema", "task_id", "intent", "status", "created_at", "completed_at", "handoff_phase",
    "parent_task_id", "causal_artifact", "family_id", "schedule_id", "schedule_occurrence",
    "source", "agent", "evidence", "publications", "artifacts", "recovery_state",
  ]);
  assertKnownKeys(metadata, allowed, "v3 metadata");
  if (metadata.schema !== TASK_RECORD_V3_SCHEMA) throw new Error(`schema must be ${TASK_RECORD_V3_SCHEMA}`);

  // Reuse input validation for all metadata that does not depend on raw evidence.
  const skeleton = {
    task_id: metadata.task_id,
    intent: metadata.intent,
    status: metadata.status,
    created_at: metadata.created_at,
    completed_at: metadata.completed_at,
    handoff_phase: metadata.handoff_phase,
    parent_task_id: metadata.parent_task_id,
    causal_artifact: metadata.causal_artifact,
    family_id: metadata.family_id,
    schedule_id: metadata.schedule_id,
    schedule_occurrence: metadata.schedule_occurrence,
    source: metadata.source,
    agent: metadata.agent,
    evidence_policy: {
      request: metadata.evidence?.request?.mode,
      result: metadata.evidence?.result?.mode,
    },
    request: metadata.evidence?.request?.mode === "omit" ? undefined : "placeholder",
    result: metadata.evidence?.result?.mode === "omit" ? undefined : "placeholder",
    publications: metadata.publications,
    artifacts: metadata.artifacts,
    recovery_state: metadata.recovery_state,
  };
  validateTaskRecordV3Input(skeleton);
  validateStoredEvidenceDescriptor(metadata.evidence?.request, "request");
  validateStoredEvidenceDescriptor(metadata.evidence?.result, "result");
  return metadata;
}

function buildEvidenceMetadata(record) {
  const result = {};
  for (const field of ["request", "result"]) {
    const mode = record.evidence_policy[field];
    if (mode === "omit") {
      result[field] = { mode, sha256: null, bytes: null };
      continue;
    }
    const text = record[field];
    result[field] = {
      mode,
      sha256: sha256TaskRecordV3Evidence(text),
      bytes: mode === "full" ? Buffer.byteLength(text, "utf8") : null,
    };
  }
  return canonicalObject(result);
}

function normalizeSource(source, intent, handoffPhase) {
  if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("source is required");
  assertKnownKeys(source, new Set(["adapter", "host", "repository", "pull_request", "base_ref", "working_ref", "target_commit", "result_commit"]), "source");
  const normalized = {
    adapter: requireString(source.adapter, "source.adapter"),
    host: requireString(source.host, "source.host"),
    repository: requireString(source.repository, "source.repository"),
    pull_request: optionalPositiveInteger(source.pull_request, "source.pull_request"),
    base_ref: optionalString(source.base_ref, "source.base_ref"),
    working_ref: optionalString(source.working_ref, "source.working_ref"),
    target_commit: requireString(source.target_commit, "source.target_commit"),
    result_commit: optionalString(source.result_commit, "source.result_commit"),
  };
  if (/^https?:\/\//i.test(normalized.host) || normalized.host.includes("/")) throw new Error("source.host must be a host name without scheme or path");
  if (!/^[^/\s]+\/[^/\s]+$/.test(normalized.repository)) throw new Error("source.repository must be owner/repo");
  if (intent === "review" && !normalized.pull_request) throw new Error("review requires source.pull_request");
  if (handoffPhase === "initial-pr" && (!normalized.base_ref || !normalized.working_ref)) throw new Error("initial-pr requires source.base_ref and source.working_ref");
  if (handoffPhase === "branch-update" && (!normalized.pull_request || !normalized.working_ref || !normalized.result_commit)) {
    throw new Error("branch-update requires source.pull_request, source.working_ref, and source.result_commit");
  }
  return canonicalObject(normalized);
}

function normalizeAgent(agent) {
  if (!agent || typeof agent !== "object" || Array.isArray(agent)) throw new Error("agent is required");
  assertKnownKeys(agent, new Set(["adapter", "provider", "surface", "task_url"]), "agent");
  return canonicalObject({
    adapter: requireString(agent.adapter, "agent.adapter"),
    provider: requireString(agent.provider, "agent.provider"),
    surface: requireString(agent.surface, "agent.surface"),
    task_url: optionalString(agent.task_url, "agent.task_url"),
  });
}

function normalizeEvidencePolicy(policy) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) throw new Error("evidence_policy is required");
  assertKnownKeys(policy, new Set(["request", "result"]), "evidence_policy");
  return deepFreeze({
    request: requireEnum(policy.request, TASK_RECORD_V3_EVIDENCE_MODES, "evidence_policy.request"),
    result: requireEnum(policy.result, TASK_RECORD_V3_EVIDENCE_MODES, "evidence_policy.result"),
  });
}

function normalizeEvidenceInput(value, mode, field) {
  if (mode === "omit") {
    if (value != null) throw new Error(`${field} must be absent when its evidence mode is omit`);
    return undefined;
  }
  return canonicalizeTaskRecordV3Evidence(requireString(value, field));
}

function normalizePublications(values) {
  if (!Array.isArray(values)) throw new Error("publications must be an array");
  const ids = new Set();
  return deepFreeze(values.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`publications[${index}] must be an object`);
    assertKnownKeys(value, new Set(["publication_id", "destination_adapter", "destination_host", "target", "payload_class", "representation", "visibility", "authority", "requested", "outcome", "artifact_id"]), `publications[${index}]`);
    const publication = canonicalObject({
      publication_id: requireString(value.publication_id, `publications[${index}].publication_id`),
      destination_adapter: requireString(value.destination_adapter, `publications[${index}].destination_adapter`),
      destination_host: requireString(value.destination_host, `publications[${index}].destination_host`),
      target: requireString(value.target, `publications[${index}].target`),
      payload_class: requireEnum(value.payload_class, ["request", "result", "summary", "finding"], `publications[${index}].payload_class`),
      representation: requireEnum(value.representation, TASK_RECORD_V3_EVIDENCE_MODES, `publications[${index}].representation`),
      visibility: requireString(value.visibility, `publications[${index}].visibility`),
      authority: requireString(value.authority, `publications[${index}].authority`),
      requested: requireEnum(value.requested, TASK_RECORD_V3_PUBLICATION_REQUESTS, `publications[${index}].requested`),
      outcome: requireEnum(value.outcome, TASK_RECORD_V3_PUBLICATION_OUTCOMES, `publications[${index}].outcome`),
      artifact_id: optionalString(value.artifact_id, `publications[${index}].artifact_id`),
    });
    if (ids.has(publication.publication_id)) throw new Error(`duplicate publication_id: ${publication.publication_id}`);
    ids.add(publication.publication_id);
    if (publication.requested !== "authorized" && publication.outcome !== "not-attempted") throw new Error(`${publication.publication_id} cannot be attempted without authorization`);
    if (publication.requested !== "authorized" && publication.artifact_id) throw new Error(`${publication.publication_id} cannot reference an artifact without authorization`);
    if (publication.outcome === "published" && !publication.artifact_id) throw new Error(`${publication.publication_id} published outcome requires artifact_id`);
    if (publication.outcome !== "published" && publication.artifact_id) throw new Error(`${publication.publication_id} may reference artifact_id only when published`);
    return publication;
  }));
}

function normalizeArtifacts(values) {
  if (!Array.isArray(values)) throw new Error("artifacts must be an array");
  const ids = new Set();
  return deepFreeze(values.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`artifacts[${index}] must be an object`);
    assertKnownKeys(value, new Set(["artifact_id", "type", "adapter", "host", "remote_id", "url", "target", "version", "verification"]), `artifacts[${index}]`);
    const artifact = canonicalObject({
      artifact_id: requireString(value.artifact_id, `artifacts[${index}].artifact_id`),
      type: requireString(value.type, `artifacts[${index}].type`),
      adapter: requireString(value.adapter, `artifacts[${index}].adapter`),
      host: requireString(value.host, `artifacts[${index}].host`),
      remote_id: requireString(value.remote_id, `artifacts[${index}].remote_id`),
      url: requireString(value.url, `artifacts[${index}].url`),
      target: requireString(value.target, `artifacts[${index}].target`),
      version: optionalString(value.version, `artifacts[${index}].version`),
      verification: requireEnum(value.verification, ["verified"], `artifacts[${index}].verification`),
    });
    if (artifact.type === "crossdock.task-record") throw new Error("a v3 task record must not contain a self-referential task-record artifact");
    if (ids.has(artifact.artifact_id)) throw new Error(`duplicate artifact_id: ${artifact.artifact_id}`);
    ids.add(artifact.artifact_id);
    return artifact;
  }));
}

function validatePublicationArtifactLinks(publications, artifacts) {
  const ids = new Set(artifacts.map((artifact) => artifact.artifact_id));
  for (const publication of publications) {
    if (publication.artifact_id && !ids.has(publication.artifact_id)) throw new Error(`${publication.publication_id} references unknown artifact_id: ${publication.artifact_id}`);
  }
}

function validateStoredEvidenceDescriptor(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`metadata.evidence.${field} is required`);
  assertKnownKeys(value, new Set(["mode", "sha256", "bytes"]), `metadata.evidence.${field}`);
  const mode = requireEnum(value.mode, TASK_RECORD_V3_EVIDENCE_MODES, `metadata.evidence.${field}.mode`);
  if (mode === "omit") {
    if (value.sha256 !== null || value.bytes !== null) throw new Error(`${field} omit metadata must have null digest and bytes`);
    return;
  }
  if (typeof value.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(value.sha256)) throw new Error(`${field} evidence digest must be lowercase SHA-256`);
  if (mode === "hash" && value.bytes !== null) throw new Error(`${field} hash metadata must not retain byte length`);
  if (mode === "full" && (!Number.isInteger(value.bytes) || value.bytes < 0)) throw new Error(`${field} full metadata requires a non-negative byte length`);
}

function canonicalObject(value) {
  if (Array.isArray(value)) return value.map(canonicalObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalObject(value[key])]));
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value;
}

function optionalString(value, label) {
  if (value == null) return null;
  return requireString(value, label);
}

function requireTimestamp(value, label) {
  const text = requireString(value, label);
  if (Number.isNaN(Date.parse(text))) throw new Error(`${label} must be an RFC 3339 timestamp`);
  return text;
}

function optionalTimestamp(value, label) {
  return value == null ? null : requireTimestamp(value, label);
}

function optionalPositiveInteger(value, label) {
  if (value == null) return null;
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
  return value;
}

function requireEnum(value, allowed, label) {
  if (!allowed.includes(value)) throw new Error(`${label} must be one of: ${allowed.join(", ")}`);
  return value;
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
