import { publishInitialHandoff, publishUpdateHandoff } from "./handoff.js";

export async function dispatchHandoff({ method, path, body, github }) {
  if (method === "GET" && path === "/health") return { status: 200, body: { ok: true } };
  if (method !== "POST") return { status: 405, body: { error: "method_not_allowed" } };

  if (path === "/pr/snapshot") {
    requireObject(body, "body");
    const task = await hydrateTaskFromPullRequest(github, {
      target_repository: body.target_repository,
      pull_request: body.pull_request,
    });
    return {
      status: 200,
      body: {
        repository: task.target_repository,
        pull_request: task.pull_request,
        base_branch: task.base_branch,
        working_branch: task.working_branch,
        head_sha: task.result_commit,
      },
    };
  }

  if (path === "/handoff/initial" || path === "/handoff/update") {
    requireObject(body, "body");
    requireObject(body.task, "task");
    requireObject(body.storage, "storage");
    const task = await hydrateTaskFromPullRequest(github, body.task);

    if (path === "/handoff/initial") {
      const result = await publishInitialHandoff({ github, storage: body.storage, task, pr: body.pr });
      return { status: 200, body: summarizeInitial(result) };
    }

    const result = await publishUpdateHandoff({ github, storage: body.storage, task, update: body.update });
    return { status: 200, body: summarizeUpdate(result) };
  }

  return { status: 404, body: { error: "not_found" } };
}

export async function hydrateTaskFromPullRequest(github, task) {
  if (typeof task.target_repository !== "string" || !/^[^/]+\/[^/]+$/.test(task.target_repository)) throw new Error("target_repository is required in owner/repo form");
  if (!Number.isInteger(task.pull_request) || task.pull_request <= 0) throw new Error("pull_request is required");
  const pr = await github.getPullRequest(task.target_repository, task.pull_request);
  if (!pr?.base?.ref || !pr?.head?.ref || !pr?.head?.sha) throw new Error("target PR is missing base/head metadata");
  return { ...task, base_branch: pr.base.ref, working_branch: pr.head.ref, result_commit: pr.head.sha };
}

function summarizeInitial(result) {
  return { pull_request: result.pullRequest.number, pull_request_url: result.pullRequest.html_url ?? result.pullRequest.url ?? null, task_record_url: result.taskLog.url };
}

function summarizeUpdate(result) {
  return { comment_id: result.comment.id, comment_url: result.comment.html_url ?? result.comment.url ?? null, task_record_url: result.taskLog.url };
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
}
