import { createHash } from "node:crypto";

export const TASK_LOG_SCHEMA = "crossdock.task-record/v1";

const FORBIDDEN_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:password|passwd|api[_-]?key|access[_-]?token|secret)\s*[:=]\s*[^\s]{8,}/i,
];

export function canonicalizeText(value) {
  if (typeof value !== "string") throw new TypeError("text must be a string");
  return value.replace(/\r\n?/g, "\n");
}

export function sha256(value) {
  return createHash("sha256").update(canonicalizeText(value), "utf8").digest("hex");
}

export function assertGithubSafe(value, label = "content") {
  const canonical = canonicalizeText(value);
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(canonical)) throw new Error(`${label} appears to contain Forbidden-from-GitHub material`);
  }
}

function quoteYaml(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return String(value);
  return JSON.stringify(String(value));
}

function requireString(record, field) {
  if (typeof record[field] !== "string" || record[field].length === 0) throw new Error(`${field} is required`);
}

function assertTimestamp(value, field) {
  requireString({ [field]: value }, field);
  if (Number.isNaN(Date.parse(value))) throw new Error(`${field} must be an RFC 3339 timestamp`);
}

export function validateTaskRecord(record) {
  if (!record || typeof record !== "object") throw new TypeError("record is required");
  requireString(record, "task_id");
  requireString(record, "target_repository");
  requireString(record, "base_branch");
  requireString(record, "working_branch");
  requireString(record, "prompt");
  requireString(record, "report");
  assertTimestamp(record.created_at, "created_at");
  assertTimestamp(record.completed_at, "completed_at");

  if (!/^[^/]+\/[^/]+$/.test(record.target_repository)) throw new Error("target_repository must be owner/repo");
  if (!/^[A-Za-z0-9._-]+$/.test(record.task_id)) throw new Error("task_id may contain only letters, numbers, dot, underscore, and hyphen");
  if (!["initial", "update"].includes(record.task_type)) throw new Error("task_type must be initial or update");
  if (record.task_type === "initial" && record.parent_task_id != null) throw new Error("initial task parent_task_id must be null");
  if (record.task_type === "update" && !record.pull_request) throw new Error("update task requires pull_request");

  assertGithubSafe(record.prompt, "prompt");
  assertGithubSafe(record.report, "report");
  return record;
}

export function taskLogPath(record) {
  validateTaskRecord(record);
  const completed = new Date(record.completed_at);
  const year = String(completed.getUTCFullYear());
  const month = String(completed.getUTCMonth() + 1).padStart(2, "0");
  const [owner, repo] = record.target_repository.split("/");
  return `crossdock/tasks/${owner}/${repo}/${year}/${month}/${record.task_id}.md`;
}

export function renderTaskLog(record) {
  validateTaskRecord(record);
  const prompt = canonicalizeText(record.prompt);
  const report = canonicalizeText(record.report);
  const fields = [
    ["schema", TASK_LOG_SCHEMA], ["task_id", record.task_id], ["task_type", record.task_type], ["status", "completed"],
    ["created_at", record.created_at], ["completed_at", record.completed_at], ["target_repository", record.target_repository],
    ["base_branch", record.base_branch], ["working_branch", record.working_branch], ["pull_request", record.pull_request ?? null],
    ["issue", record.issue ?? null], ["agent_task_url", record.agent_task_url ?? record.codex_task_url ?? null],
    ["result_commit", record.result_commit ?? null], ["parent_task_id", record.parent_task_id ?? null],
    ["prompt_sha256", sha256(prompt)], ["report_sha256", sha256(report)],
  ];
  const frontMatter = fields.map(([key, value]) => `${key}: ${quoteYaml(value)}`).join("\n");
  return `---\n${frontMatter}\n---\n\n# Crossdock Task\n\n## Prompt\n\n${prompt}\n\n## Report\n\n${report}\n`;
}
