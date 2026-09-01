import { assertGithubSafe } from "./security.js";
import { resolveTaskRecordStorage } from "./storage.js";
import { renderTaskRecord, taskRecordPath, validateTaskRecord } from "./task-record.js";

export function buildPrBody({ summary, validation = [], issue, recordUrl, branch, commit }) {
  const lines = ["## Summary", "", summary.trim(), ""];
  if (validation.length) lines.push("## Validation", "", ...validation.map((item) => `- ${item}`), "");
  lines.push("## Crossdock", "", `Task record: ${recordUrl}`);
  if (branch) lines.push(`Branch: \`${branch}\``);
  if (commit) lines.push(`Commit: \`${commit}\``);
  if (issue) lines.push("", `Closes #${issue}`);
  return `${lines.join("\n")}\n`;
}

export function buildUpdateComment({ summary, validation = [], recordUrl, commit }) {
  const lines = ["## Crossdock branch update", "", summary.trim(), ""];
  if (validation.length) lines.push(...validation.map((item) => `- ${item}`));
  if (commit) lines.push(`- Commit: \`${commit}\``);
  lines.push(`- Task record: ${recordUrl}`);
  return `${lines.join("\n")}\n`;
}

export async function publishInitialHandoff({ github, storage, task, pr }) {
  const destination = resolveTaskRecordStorage({ github, storage });
  const preflightRecord = { ...task, task_type: "initial", pull_request: null, parent_task_id: null };
  validateTaskRecord(preflightRecord);
  preflightTaskRecordForDestination(destination, preflightRecord);
  preflightPrDescription(pr);

  const provisionalBody = pr.provisionalBody ?? pr.summary;
  assertGithubSafe(provisionalBody, "pull request body");

  const createdPr = await github.createPullRequest(task.target_repository, {
    title: pr.title,
    body: provisionalBody,
    head: task.working_branch,
    base: task.base_branch,
    draft: pr.draft ?? false,
  });
  return publishExistingInitialHandoff({
    github,
    storage: destination,
    task: { ...task, pull_request: createdPr.number },
    pr,
  });
}

export async function publishExistingInitialHandoff({ github, storage, task, pr }) {
  const destination = resolveTaskRecordStorage({ github, storage });
  const record = { ...task, task_type: "initial", parent_task_id: null };
  validateTaskRecord(record);
  if (!record.pull_request) throw new Error("existing initial handoff requires pull_request");
  preflightPrDescription(pr);

  const persisted = await persistTaskRecord({ github, storage: destination, record });
  const body = buildPrBody({
    summary: pr.summary,
    validation: pr.validation,
    issue: task.issue,
    recordUrl: persisted.url,
    branch: task.working_branch,
    commit: task.result_commit,
  });
  assertGithubSafe(body, "pull request body");

  await github.updatePullRequest(task.target_repository, record.pull_request, { body });
  const verified = await github.getPullRequest(task.target_repository, record.pull_request);
  if (!verified.body?.includes(persisted.url)) throw new Error("initial handoff verification failed: PR body does not link task record");
  await destination.verifyImmutable({ path: persisted.path, version: persisted.version, expectedContent: persisted.content });
  return { pullRequest: verified, taskRecord: persisted };
}

export async function publishUpdateHandoff({ github, storage, task, update }) {
  const destination = resolveTaskRecordStorage({ github, storage });
  const record = { ...task, task_type: "update" };
  preflightDescription(update, "update");

  const persisted = await persistTaskRecord({ github, storage: destination, record });
  const commentBody = buildUpdateComment({ summary: update.summary, validation: update.validation, recordUrl: persisted.url, commit: task.result_commit });
  assertGithubSafe(commentBody, "pull request comment");

  const before = await github.getIssueComments(task.target_repository, task.pull_request);
  const linked = before.filter((item) => typeof item.body === "string" && item.body.includes(persisted.url));
  const conflicting = linked.find((item) => item.body !== commentBody);
  if (conflicting) throw new Error("update handoff retry conflict: existing task-record comment has different content");

  let comment = linked.find((item) => item.body === commentBody) ?? null;
  if (!comment) comment = await github.addIssueComment(task.target_repository, task.pull_request, commentBody);

  const comments = await github.getIssueComments(task.target_repository, task.pull_request);
  const verifiedComment = comments.find((item) => item.id === comment.id && item.body === commentBody);
  if (!verifiedComment) throw new Error("update handoff verification failed: durable PR comment does not match expected task record linkage");
  await destination.verifyImmutable({ path: persisted.path, version: persisted.version, expectedContent: persisted.content });
  return { comment: verifiedComment, taskRecord: persisted };
}

export async function persistTaskRecord({ github, storage, record }) {
  const destination = resolveTaskRecordStorage({ github, storage });
  const path = taskRecordPath(record);
  const content = renderTaskRecord(record);
  const persisted = await destination.persistImmutable({
    path,
    content,
    message: `crossdock: record task ${record.task_id}`,
  });
  if (!persisted || typeof persisted !== "object") throw new Error("task-record storage adapter returned no persistence result");
  if (persisted.path !== path || persisted.content !== content) throw new Error("task-record storage adapter returned inconsistent persistence metadata");
  if (typeof persisted.version !== "string" || !persisted.version) throw new Error("task-record storage adapter returned no immutable version");
  if (typeof persisted.url !== "string" || !persisted.url) throw new Error("task-record storage adapter returned no durable URL");
  return persisted;
}

function preflightTaskRecordForDestination(destination, record) {
  if (destination.type !== "github") return;
  assertGithubSafe(renderTaskRecord(record), "task record");
}

function preflightPrDescription(pr) {
  assertGithubSafe(String(pr?.title ?? ""), "pull request title");
  preflightDescription(pr, "pull request");
  if (pr?.provisionalBody != null) assertGithubSafe(String(pr.provisionalBody), "provisional pull request body");
}

function preflightDescription(description, label) {
  assertGithubSafe(String(description?.summary ?? ""), `${label} summary`);
  for (const item of description?.validation ?? []) {
    assertGithubSafe(String(item), `${label} validation`);
  }
}