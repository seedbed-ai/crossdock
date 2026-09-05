export const ORIGIN_BINDING_SCHEMA = "crossdock.origin-binding/v1";

export function normalizeOriginRepository(value) {
  if (typeof value !== "string") throw new TypeError("target_repository must be a string");
  const repository = value.trim();
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) throw new Error("target_repository must be owner/repo");
  return repository;
}

export function normalizePullRequestNumber(value) {
  if (!Number.isInteger(value) || value <= 0) throw new Error("pull_request must be a positive integer");
  return value;
}

export function normalizeOriginTaskUrl(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("agent_task_url is required");
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("agent_task_url must be an absolute URL");
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error("agent_task_url must use http or https");
  url.hash = "";
  return url.toString();
}

function requireString(binding, field) {
  if (typeof binding[field] !== "string" || !binding[field].trim()) throw new Error(`${field} is required`);
  return binding[field].trim();
}

function normalizeTimestamp(value, field) {
  if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} must be an RFC 3339 timestamp`);
  }
  return new Date(value).toISOString();
}

export function validateOriginBinding(binding) {
  if (!binding || typeof binding !== "object" || Array.isArray(binding)) throw new TypeError("origin binding is required");

  const schema = binding.schema ?? ORIGIN_BINDING_SCHEMA;
  if (schema !== ORIGIN_BINDING_SCHEMA) throw new Error(`unsupported origin binding schema: ${schema}`);

  const targetRepository = normalizeOriginRepository(binding.target_repository);
  const pullRequest = normalizePullRequestNumber(binding.pull_request);
  const taskId = requireString(binding, "originating_task_id");
  if (!/^[A-Za-z0-9._-]+$/.test(taskId)) throw new Error("originating_task_id may contain only letters, numbers, dot, underscore, and hyphen");
  const provider = requireString(binding, "provider");
  if (!/^[A-Za-z0-9._-]+$/.test(provider)) throw new Error("provider may contain only letters, numbers, dot, underscore, and hyphen");
  const taskUrl = normalizeOriginTaskUrl(binding.agent_task_url);
  const createdAt = normalizeTimestamp(binding.created_at, "created_at");

  for (const forbidden of ["prompt", "report", "prompt_sha256", "report_sha256"]) {
    if (Object.hasOwn(binding, forbidden)) throw new Error(`origin binding must not contain ${forbidden}`);
  }

  const normalized = {
    schema: ORIGIN_BINDING_SCHEMA,
    target_repository: targetRepository,
    pull_request: pullRequest,
    originating_task_id: taskId,
    provider,
    agent_task_url: taskUrl,
    created_at: createdAt,
  };

  if (binding.initial_working_branch != null) {
    normalized.initial_working_branch = requireString(binding, "initial_working_branch");
  }

  return Object.freeze(normalized);
}

export function originBindingPath(binding) {
  const normalized = validateOriginBinding(binding);
  const [owner, repository] = normalized.target_repository.split("/");
  return `crossdock/origins/${owner}/${repository}/pull/${normalized.pull_request}.json`;
}

export function renderOriginBinding(binding) {
  const normalized = validateOriginBinding(binding);
  return `${JSON.stringify(normalized, null, 2)}\n`;
}
