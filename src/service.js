import { publishExistingInitialHandoff, publishUpdateHandoff } from "./handoff.js";
import { persistOriginBinding, resolveOriginBinding } from "./origin-binding-storage.js";

export async function dispatchHandoff({ method, path, body, github }) {
  if (method === "GET" && path === "/health") return { status: 200, body: { ok: true } };
  if (method !== "POST") return { status: 405, body: { error: "method_not_allowed" } };

  if (path === "/repository/snapshot") {
    requireObject(body, "body");
    const repository = requireRepository(body.target_repository);
    const remote = await github.getRepository(repository);
    if (typeof remote?.default_branch !== "string" || !remote.default_branch.trim()) throw new Error("target repository is missing default-branch metadata");
    return { status: 200, body: { repository, default_branch: remote.default_branch.trim() } };
  }

  if (path === "/pr/snapshot") {
    requireObject(body, "body");
    const task = await hydrateTaskFromPullRequest(github, {
      target_repository: body.target_repository,
      pull_request: body.pull_request,
    });
    return { status: 200, body: { repository: task.target_repository, pull_request: task.pull_request, base_branch: task.base_branch, working_branch: task.working_branch, head_sha: task.result_commit } };
  }

  if (path === "/origin-binding/persist") {
    requireObject(body, "body");
    requireObject(body.storage, "storage");
    const repository = requireRepository(body.target_repository);
    const pullRequest = requirePullRequest(body.pull_request);
    const result = await persistOriginBinding({
      github,
      storage: body.storage,
      binding: {
        target_repository: repository,
        pull_request: pullRequest,
        originating_task_id: body.originating_task_id,
        provider: body.provider,
        agent_task_url: body.agent_task_url,
        created_at: body.created_at,
        ...(body.initial_working_branch == null ? {} : { initial_working_branch: body.initial_working_branch }),
      },
    });
    return {
      status: 200,
      body: {
        repository: result.binding.target_repository,
        pull_request: result.binding.pull_request,
        originating_task_id: result.binding.originating_task_id,
        provider: result.binding.provider,
        agent_task_url: result.binding.agent_task_url,
        origin_binding_url: result.url,
        origin_binding_version: result.version,
      },
    };
  }

  if (path === "/origin-binding/resolve") {
    requireObject(body, "body");
    requireObject(body.storage, "storage");
    const repository = requireRepository(body.target_repository);
    const pullRequest = requirePullRequest(body.pull_request);
    const resolved = await resolveOriginBinding({
      github,
      storage: body.storage,
      targetRepository: repository,
      pullRequest,
    });
    const binding = resolved.binding;
    return {
      status: 200,
      body: {
        repository: binding.target_repository,
        pull_request: binding.pull_request,
        originating_task_id: binding.originating_task_id,
        provider: binding.provider,
        agent_task_url: binding.agent_task_url,
        created_at: binding.created_at,
        initial_working_branch: binding.initial_working_branch ?? null,
      },
    };
  }

  if (path === "/handoff/initial" || path === "/handoff/update") {
    requireObject(body, "body");
    requireObject(body.task, "task");
    requireObject(body.storage, "storage");
    const task = await hydrateTaskFromPullRequest(github, body.task);

    if (path === "/handoff/initial") {
      const result = await publishExistingInitialHandoff({ github, storage: body.storage, task, pr: body.pr, publication: body.publication });
      return { status: 200, body: summarizeInitial(result) };
    }

    const result = await publishUpdateHandoff({ github, storage: body.storage, task, update: body.update, publication: body.publication });
    return { status: 200, body: summarizeUpdate(result) };
  }

  return { status: 404, body: { error: "not_found" } };
}

export async function hydrateTaskFromPullRequest(github, task) {
  const repository = requireRepository(task.target_repository);
  if (!Number.isInteger(task.pull_request) || task.pull_request <= 0) throw new Error("pull_request is required");
  const pr = await github.getPullRequest(repository, task.pull_request);
  if (!pr?.base?.ref || !pr?.head?.ref || !pr?.head?.sha) throw new Error("target PR is missing base/head metadata");
  return { ...task, target_repository: repository, base_branch: pr.base.ref, working_branch: pr.head.ref, result_commit: pr.head.sha };
}

function summarizeInitial(result) {
  return {
    pull_request: result.pullRequest.number,
    pull_request_url: result.pullRequest.html_url ?? result.pullRequest.url ?? null,
    task_record_url: result.taskRecord.url,
    publication: result.publication,
  };
}

function summarizeUpdate(result) {
  return {
    comment_id: result.comment?.id ?? null,
    comment_url: result.comment?.html_url ?? result.comment?.url ?? null,
    task_record_url: result.taskRecord.url,
    publication: result.publication,
  };
}

function requireRepository(value) {
  if (typeof value !== "string" || !/^[^/\s]+\/[^/\s]+$/.test(value.trim())) throw new Error("target_repository is required in owner/repo form");
  return value.trim();
}

function requirePullRequest(value) {
  if (!Number.isInteger(value) || value <= 0) throw new Error("pull_request is required");
  return value;
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
}
