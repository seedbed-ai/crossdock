import { publishExistingInitialHandoff, publishUpdateHandoff } from "./handoff.js";

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
    comment_url: result.comment?.html_url ?? result.comment.url ?? null,
    task_record_url: result.taskRecord.url,
    publication: result.publication,
  };
}

function requireRepository(value) {
  if (typeof value !== "string" || !/^[^/\s]+\/[^/\s]+$/.test(value.trim())) throw new Error("target_repository is required in owner/repo form");
  return value.trim();
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
}
