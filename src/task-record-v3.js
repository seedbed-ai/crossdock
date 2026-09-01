import { createHash } from "node:crypto";
import { domainToASCII } from "node:url";
import { WORK_ITEM_INTENTS } from "./agent-capabilities.js";

export const TASK_RECORD_V3_SCHEMA = "crossdock.task-record/v3";
export const TASK_RECORD_V3_EVIDENCE_MODES = Object.freeze(["full", "hash", "omit"]);
export const TASK_RECORD_V3_HANDOFF_PHASES = Object.freeze(["none", "initial-change", "branch-update", "review-publication", "artifact-publication"]);
export const TASK_RECORD_V3_PUBLICATION_REQUESTS = Object.freeze(["forbidden", "not-requested", "authorized"]);
export const TASK_RECORD_V3_PUBLICATION_OUTCOMES = Object.freeze(["not-attempted", "published", "failed"]);
export const TASK_RECORD_V3_ARTIFACT_TYPES = Object.freeze([
  "source-control.review",
  "source-control.comment",
  "source-control.thread",
  "source-control.change",
  "source-control.commit",
  "crossdock.finding",
]);

const CAUSAL_ARTIFACT_TYPES = new Set(["source-control.thread", "crossdock.finding"]);
const INPUT_FIELDS = new Set([
  "task_id", "intent", "status", "created_at", "completed_at", "handoff_phase",
  "parent_task_id", "parent_record", "causal_artifact", "family_id", "schedule_id", "schedule_occurrence",
  "source", "origin", "agent", "evidence_policy", "request", "result", "publications", "artifacts", "recovery_state",
]);
const METADATA_FIELDS = new Set([
  "schema", "task_id", "intent", "status", "created_at", "completed_at", "handoff_phase",
  "parent_task_id", "parent_record", "causal_artifact", "family_id", "schedule_id", "schedule_occurrence",
  "source", "origin", "agent", "evidence", "publications", "artifacts", "recovery_state",
]);
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

/** Canonicalize retained evidence before hashing, byte-counting, or persistence. */
export function canonicalizeTaskRecordV3Evidence(value) {
  assertUnicodeScalarString(value, "evidence");
  return value.replace(/\r\n?/g, "\n");
}

export function sha256TaskRecordV3Evidence(value) {
  return createHash("sha256").update(canonicalizeTaskRecordV3Evidence(value), "utf8").digest("hex");
}

/** Render the experimental v3 wire format without changing the active v2 writer. */
export function renderTaskRecordV3(record) {
  const normalized = validateTaskRecordV3Input(record);
  const evidence = buildEvidenceMetadata(normalized);
  const metadata = buildMetadata(normalized, evidence);

  let output = `---\n${JSON.stringify(metadata, null, 2)}\n---\n`;
  for (const field of ["request", "result"]) {
    if (evidence[field].mode !== "full") continue;
    output += `X-Crossdock-Evidence: ${field}; bytes=${evidence[field].bytes}\n${normalized[field]}\n`;
  }
  return output;
}

/**
 * Parse and fully verify one v3 record from its original bytes.
 *
 * Accepting only Uint8Array/Buffer is intentional: converting arbitrary wire
 * bytes to a JavaScript string before this boundary could already replace
 * malformed UTF-8 and make byte-level validation impossible.
 */
export function parseTaskRecordV3(value) {
  if (!(value instanceof Uint8Array)) throw new TypeError("task record must be a Uint8Array or Buffer containing original bytes");
  const bytes = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  const opening = Buffer.from("---\n");
  if (!bytes.subarray(0, opening.length).equals(opening)) throw new Error("task record must start with YAML front matter");

  const closing = Buffer.from("\n---\n");
  const closeAt = bytes.indexOf(closing, opening.length);
  if (closeAt < 0) throw new Error("task record front matter is not terminated");

  const metadataText = decodeUtf8(bytes.subarray(opening.length, closeAt), "task record front matter");
  let metadata;
  try {
    metadata = JSON.parse(metadataText);
  } catch {
    throw new Error("task record v3 front matter must use canonical JSON-compatible YAML");
  }

  const canonicalMetadata = JSON.stringify(canonicalObject(metadata), null, 2);
  if (canonicalMetadata !== metadataText) throw new Error("task record v3 front matter is not canonical");
  validateTaskRecordV3Metadata(metadata);

  let cursor = closeAt + closing.length;
  const retained = {};
  for (const field of ["request", "result"]) {
    const descriptor = metadata.evidence[field];
    if (descriptor.mode !== "full") continue;

    const headerEnd = bytes.indexOf(0x0a, cursor);
    if (headerEnd < 0) throw new Error(`${field} evidence header is incomplete`);
    const header = decodeUtf8(bytes.subarray(cursor, headerEnd), `${field} evidence header`);
    if (header !== `X-Crossdock-Evidence: ${field}; bytes=${descriptor.bytes}`) {
      throw new Error(`${field} evidence header does not match metadata`);
    }

    const start = headerEnd + 1;
    const end = start + descriptor.bytes;
    if (end > bytes.length) throw new Error(`${field} evidence is truncated`);
    const text = decodeUtf8(bytes.subarray(start, end), `${field} evidence`);
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
  assertKnownKeys(record, INPUT_FIELDS, "record");

  const taskId = requireString(record.task_id, "task_id");
  if (!/^[A-Za-z0-9._-]+$/.test(taskId)) throw new Error("task_id may contain only letters, numbers, dot, underscore, and hyphen");
  const intent = requireEnum(record.intent, WORK_ITEM_INTENTS, "intent");
  if ((record.status ?? "completed") !== "completed") throw new Error("v3 immutable task records support only completed status");

  const parentTaskId = optionalString(record.parent_task_id, "parent_task_id");
  const parentRecord = normalizeParentRecord(record.parent_record, parentTaskId);
  const causalArtifact = normalizeCausalArtifact(record.causal_artifact, parentRecord);
  const policy = normalizeEvidencePolicy(record.evidence_policy);
  const request = normalizeEvidenceInput(record.request, policy.request, "request");
  const result = normalizeEvidenceInput(record.result, policy.result, "result");
  const artifacts = normalizeArtifacts(record.artifacts ?? []);
  const publications = normalizePublications(record.publications ?? []);
  validatePublicationArtifactLinks(publications, artifacts);

  const handoffPhase = requireEnum(record.handoff_phase ?? "none", TASK_RECORD_V3_HANDOFF_PHASES, "handoff_phase");
  return deepFreeze({
    task_id: taskId,
    intent,
    status: "completed",
    created_at: requireTimestamp(record.created_at, "created_at"),
    completed_at: requireTimestamp(record.completed_at, "completed_at"),
    handoff_phase: handoffPhase,
    parent_task_id: parentTaskId,
    parent_record: parentRecord,
    causal_artifact: causalArtifact,
    family_id: optionalString(record.family_id, "family_id"),
    schedule_id: optionalString(record.schedule_id, "schedule_id"),
    schedule_occurrence: optionalTimestamp(record.schedule_occurrence, "schedule_occurrence"),
    source: normalizeSource(record.source, intent, handoffPhase),
    origin: normalizeOrigin(record.origin),
    agent: normalizeAgent(record.agent),
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
  assertKnownKeys(metadata, METADATA_FIELDS, "v3 metadata");
  assertRequiredKeys(metadata, METADATA_FIELDS, "v3 metadata");
  if (metadata.schema !== TASK_RECORD_V3_SCHEMA) throw new Error(`schema must be ${TASK_RECORD_V3_SCHEMA}`);
  if (!metadata.evidence || typeof metadata.evidence !== "object" || Array.isArray(metadata.evidence)) throw new Error("metadata.evidence is required");
  assertKnownKeys(metadata.evidence, new Set(["request", "result"]), "metadata.evidence");
  assertRequiredKeys(metadata.evidence, new Set(["request", "result"]), "metadata.evidence");
  validateStoredEvidenceDescriptor(metadata.evidence.request, "request");
  validateStoredEvidenceDescriptor(metadata.evidence.result, "result");

  const normalized = validateTaskRecordV3Input({
    task_id: metadata.task_id,
    intent: metadata.intent,
    status: metadata.status,
    created_at: metadata.created_at,
    completed_at: metadata.completed_at,
    handoff_phase: metadata.handoff_phase,
    parent_task_id: metadata.parent_task_id,
    parent_record: metadata.parent_record,
    causal_artifact: metadata.causal_artifact,
    family_id: metadata.family_id,
    schedule_id: metadata.schedule_id,
    schedule_occurrence: metadata.schedule_occurrence,
    source: metadata.source,
    origin: metadata.origin,
    agent: metadata.agent,
    evidence_policy: {
      request: metadata.evidence.request.mode,
      result: metadata.evidence.result.mode,
    },
    request: metadata.evidence.request.mode === "omit" ? undefined : "placeholder",
    result: metadata.evidence.result.mode === "omit" ? undefined : "placeholder",
    publications: metadata.publications,
    artifacts: metadata.artifacts,
    recovery_state: metadata.recovery_state,
  });

  const expected = buildMetadata(normalized, metadata.evidence);
  if (JSON.stringify(expected) !== JSON.stringify(canonicalObject(metadata))) {
    throw new Error("task record v3 metadata contains noncanonical or implicit values");
  }
  return metadata;
}

function buildMetadata(record, evidence) {
  return canonicalObject({
    schema: TASK_RECORD_V3_SCHEMA,
    task_id: record.task_id,
    intent: record.intent,
    status: "completed",
    created_at: record.created_at,
    completed_at: record.completed_at,
    handoff_phase: record.handoff_phase,
    parent_task_id: record.parent_task_id,
    parent_record: record.parent_record,
    causal_artifact: record.causal_artifact,
    family_id: record.family_id,
    schedule_id: record.schedule_id,
    schedule_occurrence: record.schedule_occurrence,
    source: record.source,
    origin: record.origin,
    agent: record.agent,
    evidence,
    publications: record.publications,
    artifacts: record.artifacts,
    recovery_state: record.recovery_state,
  });
}

function buildEvidenceMetadata(record) {
  const result = {};
  for (const field of ["request", "result"]) {
    const mode = record.evidence_policy[field];
    if (mode === "omit") {
      result[field] = { mode, sha256: null, bytes: null };
      continue;
    }
    result[field] = {
      mode,
      sha256: sha256TaskRecordV3Evidence(record[field]),
      bytes: mode === "full" ? Buffer.byteLength(record[field], "utf8") : null,
    };
  }
  return canonicalObject(result);
}

function normalizeSource(source, intent, handoffPhase) {
  if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("source is required");
  assertKnownKeys(source, new Set(["adapter", "host", "repository_id", "change_id", "base_ref", "working_ref", "target_version", "result_version"]), "source");
  const normalized = canonicalObject({
    adapter: requireString(source.adapter, "source.adapter"),
    host: requireHost(source.host, "source.host"),
    repository_id: requireString(source.repository_id, "source.repository_id"),
    change_id: optionalString(source.change_id, "source.change_id"),
    base_ref: optionalString(source.base_ref, "source.base_ref"),
    working_ref: optionalString(source.working_ref, "source.working_ref"),
    target_version: requireString(source.target_version, "source.target_version"),
    result_version: optionalString(source.result_version, "source.result_version"),
  });
  if (intent === "review" && !normalized.change_id) throw new Error("review requires source.change_id");
  if (handoffPhase === "initial-change" && (!normalized.base_ref || !normalized.working_ref)) {
    throw new Error("initial-change requires source.base_ref and source.working_ref");
  }
  if (handoffPhase === "branch-update" && (!normalized.change_id || !normalized.working_ref || !normalized.result_version)) {
    throw new Error("branch-update requires source.change_id, source.working_ref, and source.result_version");
  }
  return normalized;
}

function normalizeOrigin(origin) {
  if (origin == null) return null;
  if (typeof origin !== "object" || Array.isArray(origin)) throw new Error("origin must be an object or null");
  assertKnownKeys(origin, new Set(["adapter", "host", "type", "id", "url"]), "origin");
  return canonicalObject({
    adapter: requireString(origin.adapter, "origin.adapter"),
    host: requireHost(origin.host, "origin.host"),
    type: requireString(origin.type, "origin.type"),
    id: requireString(origin.id, "origin.id"),
    url: optionalString(origin.url, "origin.url"),
  });
}

function normalizeParentRecord(parentRecord, parentTaskId) {
  if (!parentTaskId) {
    if (parentRecord != null) throw new Error("parent_record requires parent_task_id");
    return null;
  }
  if (!parentRecord || typeof parentRecord !== "object" || Array.isArray(parentRecord)) throw new Error("parent_task_id requires parent_record");
  assertKnownKeys(parentRecord, new Set(["storage_adapter", "locator", "version", "sha256"]), "parent_record");
  const digest = requireString(parentRecord.sha256, "parent_record.sha256");
  if (!/^[0-9a-f]{64}$/.test(digest)) throw new Error("parent_record.sha256 must be lowercase SHA-256");
  return canonicalObject({
    storage_adapter: requireString(parentRecord.storage_adapter, "parent_record.storage_adapter"),
    locator: requireString(parentRecord.locator, "parent_record.locator"),
    version: optionalString(parentRecord.version, "parent_record.version"),
    sha256: digest,
  });
}

function normalizeCausalArtifact(value, parentRecord) {
  if (value == null) return null;
  if (!parentRecord) throw new Error("causal_artifact requires parent_record so its namespace is durable");
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("causal_artifact must be a durable artifact locator object");
  assertKnownKeys(value, new Set(["artifact_id", "type", "adapter", "host", "remote_id", "target", "version"]), "causal_artifact");
  const type = requireEnum(value.type, [...CAUSAL_ARTIFACT_TYPES], "causal_artifact.type");
  return canonicalObject({
    artifact_id: requireString(value.artifact_id, "causal_artifact.artifact_id"),
    type,
    adapter: requireString(value.adapter, "causal_artifact.adapter"),
    host: requireHost(value.host, "causal_artifact.host"),
    remote_id: requireString(value.remote_id, "causal_artifact.remote_id"),
    target: requireString(value.target, "causal_artifact.target"),
    version: optionalString(value.version, "causal_artifact.version"),
  });
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
  const normalized = values.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`publications[${index}] must be an object`);
    assertKnownKeys(value, new Set(["publication_id", "destination_adapter", "destination_host", "target", "payload_class", "representation", "visibility", "authority", "requested", "outcome", "artifact_id"]), `publications[${index}]`);
    const publication = canonicalObject({
      publication_id: requireString(value.publication_id, `publications[${index}].publication_id`),
      destination_adapter: requireString(value.destination_adapter, `publications[${index}].destination_adapter`),
      destination_host: requireHost(value.destination_host, `publications[${index}].destination_host`),
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
    if (publication.representation === "omit" && publication.outcome !== "not-attempted") throw new Error(`${publication.publication_id} cannot publish an omitted payload`);
    return publication;
  });
  normalized.sort((a, b) => a.publication_id.localeCompare(b.publication_id));
  return deepFreeze(normalized);
}

function normalizeArtifacts(values) {
  if (!Array.isArray(values)) throw new Error("artifacts must be an array");
  const ids = new Set();
  const normalized = values.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`artifacts[${index}] must be an object`);
    assertKnownKeys(value, new Set(["artifact_id", "type", "adapter", "host", "remote_id", "url", "target", "version", "verification"]), `artifacts[${index}]`);
    const artifact = canonicalObject({
      artifact_id: requireString(value.artifact_id, `artifacts[${index}].artifact_id`),
      type: requireEnum(value.type, TASK_RECORD_V3_ARTIFACT_TYPES, `artifacts[${index}].type`),
      adapter: requireString(value.adapter, `artifacts[${index}].adapter`),
      host: requireHost(value.host, `artifacts[${index}].host`),
      remote_id: requireString(value.remote_id, `artifacts[${index}].remote_id`),
      url: requireString(value.url, `artifacts[${index}].url`),
      target: requireString(value.target, `artifacts[${index}].target`),
      version: optionalString(value.version, `artifacts[${index}].version`),
      verification: requireEnum(value.verification, ["verified"], `artifacts[${index}].verification`),
    });
    if (ids.has(artifact.artifact_id)) throw new Error(`duplicate artifact_id: ${artifact.artifact_id}`);
    ids.add(artifact.artifact_id);
    return artifact;
  });
  normalized.sort((a, b) => a.artifact_id.localeCompare(b.artifact_id));
  return deepFreeze(normalized);
}

function validatePublicationArtifactLinks(publications, artifacts) {
  const byId = new Map(artifacts.map((artifact) => [artifact.artifact_id, artifact]));
  for (const publication of publications) {
    if (!publication.artifact_id) continue;
    const artifact = byId.get(publication.artifact_id);
    if (!artifact) throw new Error(`${publication.publication_id} references unknown artifact_id: ${publication.artifact_id}`);
    if (artifact.adapter !== publication.destination_adapter || artifact.host !== publication.destination_host || artifact.target !== publication.target) {
      throw new Error(`${publication.publication_id} artifact does not match publication destination`);
    }
  }
}

function validateStoredEvidenceDescriptor(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`metadata.evidence.${field} is required`);
  assertKnownKeys(value, new Set(["mode", "sha256", "bytes"]), `metadata.evidence.${field}`);
  assertRequiredKeys(value, new Set(["mode", "sha256", "bytes"]), `metadata.evidence.${field}`);
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

function requireHost(value, label) {
  const host = requireString(value, label);
  if (host !== host.trim()) throw new Error(`${label} must not contain surrounding whitespace`);
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(host) || host.includes("/") || host.includes(":") || /\s/.test(host)) {
    throw new Error(`${label} must be a host name without scheme, port, path, or whitespace`);
  }
  const ascii = domainToASCII(host.toLowerCase());
  if (!ascii || ascii.length > 253 || !/^[a-z0-9.-]+$/.test(ascii) || ascii.startsWith(".") || ascii.endsWith(".") || ascii.includes("..")) {
    throw new Error(`${label} must be a valid DNS host name`);
  }
  for (const part of ascii.split(".")) {
    if (!part || part.length > 63 || part.startsWith("-") || part.endsWith("-")) throw new Error(`${label} must be a valid DNS host name`);
  }
  return ascii;
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  assertUnicodeScalarString(value, label);
  return value;
}

function optionalString(value, label) {
  if (value == null) return null;
  return requireString(value, label);
}

function requireTimestamp(value, label) {
  const text = requireString(value, label);
  if (!RFC3339.test(text)) throw new Error(`${label} must be an RFC 3339 timestamp`);
  const millis = Date.parse(text);
  if (Number.isNaN(millis)) throw new Error(`${label} must be an RFC 3339 timestamp`);
  return new Date(millis).toISOString();
}

function optionalTimestamp(value, label) {
  return value == null ? null : requireTimestamp(value, label);
}

function requireEnum(value, allowed, label) {
  if (!allowed.includes(value)) throw new Error(`${label} must be one of: ${allowed.join(", ")}`);
  return value;
}

function assertKnownKeys(value, allowed, label) {
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`${label} contains unknown field: ${key}`);
}

function assertRequiredKeys(value, required, label) {
  for (const key of required) if (!Object.hasOwn(value, key)) throw new Error(`${label} is missing required field: ${key}`);
}

function assertUnicodeScalarString(value, label) {
  if (typeof value !== "string") throw new TypeError(`${label} must be a string`);
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error(`${label} contains an unpaired UTF-16 surrogate`);
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error(`${label} contains an unpaired UTF-16 surrogate`);
    }
  }
}

function decodeUtf8(bytes, label) {
  try {
    return UTF8_DECODER.decode(bytes);
  } catch {
    throw new Error(`${label} is not valid UTF-8`);
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
