import { postServiceJson } from "./service-client.js";

export async function persistOriginBinding({
  storage,
  repository,
  pullRequest,
  originatingTaskId,
  provider,
  agentTaskUrl,
  createdAt,
  initialWorkingBranch = null,
  taskState = null,
  serviceUrl = null,
  fetchImpl = globalThis.fetch,
}) {
  const body = {
    storage,
    target_repository: requireRepository(repository),
    pull_request: requirePullRequest(pullRequest),
    originating_task_id: requireString(originatingTaskId, "originating task id"),
    provider: requireString(provider, "provider"),
    agent_task_url: requireAbsoluteUrl(agentTaskUrl, "agent task URL"),
    created_at: requireString(createdAt, "created timestamp"),
    ...(initialWorkingBranch == null ? {} : { initial_working_branch: requireString(initialWorkingBranch, "initial working branch") }),
  };

  const result = await postServiceJson({
    path: "/origin-binding/persist",
    body,
    taskState,
    preference: serviceUrl,
    fetchImpl,
  });

  assertResolvedIdentity(result, body.target_repository, body.pull_request);
  if (result.originating_task_id !== body.originating_task_id) throw new Error("persisted origin binding returned a different originating task id");
  if (result.provider !== body.provider) throw new Error("persisted origin binding returned a different provider");
  if (result.agent_task_url !== body.agent_task_url) throw new Error("persisted origin binding returned a different agent task URL");
  if (typeof result.origin_binding_url !== "string" || !result.origin_binding_url) throw new Error("persisted origin binding returned no durable URL");
  if (typeof result.origin_binding_version !== "string" || !result.origin_binding_version) throw new Error("persisted origin binding returned no immutable version");
  return Object.freeze({ ...result });
}

export async function resolveOriginBinding({
  storage,
  repository,
  pullRequest,
  taskState = null,
  serviceUrl = null,
  fetchImpl = globalThis.fetch,
}) {
  const targetRepository = requireRepository(repository);
  const pr = requirePullRequest(pullRequest);
  const result = await postServiceJson({
    path: "/origin-binding/resolve",
    body: { storage, target_repository: targetRepository, pull_request: pr },
    taskState,
    preference: serviceUrl,
    fetchImpl,
  });

  assertResolvedIdentity(result, targetRepository, pr);
  requireString(result.originating_task_id, "resolved originating task id");
  requireString(result.provider, "resolved provider");
  requireAbsoluteUrl(result.agent_task_url, "resolved agent task URL");
  requireString(result.created_at, "resolved created timestamp");
  if (result.initial_working_branch != null) requireString(result.initial_working_branch, "resolved initial working branch");
  return Object.freeze({ ...result });
}

function assertResolvedIdentity(result, repository, pullRequest) {
  if (!result || typeof result !== "object") throw new Error("origin binding service returned no result");
  if (result.repository !== repository || result.pull_request !== pullRequest) {
    throw new Error("origin binding service returned a different repository or PR identity");
  }
}

function requireRepository(value) {
  if (typeof value !== "string" || !/^[^/\s]+\/[^/\s]+$/.test(value.trim())) throw new Error("repository must be owner/repo");
  return value.trim();
}

function requirePullRequest(value) {
  if (!Number.isInteger(value) || value <= 0) throw new Error("pull request must be a positive integer");
  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function requireAbsoluteUrl(value, label) {
  const text = requireString(value, label);
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`${label} must be an absolute URL`);
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error(`${label} must use http or https`);
  url.hash = "";
  return url.toString();
}
