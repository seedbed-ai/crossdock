import { renderTaskLog, taskLogPath, validateTaskRecord } from "./task-log.js";

export function buildPrBody({ summary, validation = [], issue, logUrl, branch, commit }) {
  const lines = ["## Summary", "", summary.trim(), ""];
  if (validation.length) lines.push("## Validation", "", ...validation.map((item) => `- ${item}`), "");
  lines.push("## Crossdock", "", `Task record: ${logUrl}`);
  if (branch) lines.push(`Branch: \`${branch}\``);
  if (commit) lines.push(`Commit: \`${commit}\``);
  if (issue) lines.push("", `Closes #${issue}`);
  return `${lines.join("\n")}\n`;
}

export function buildUpdateComment({ summary, validation = [], logUrl, commit }) {
  const lines = ["## Crossdock branch update", "", summary.trim(), ""];
  if (validation.length) lines.push(...validation.map((item) => `- ${item}`));
  if (commit) lines.push(`- Commit: \`${commit}\``);
  lines.push(`- Task record: ${logUrl}`);
  return `${lines.join("\n")}\n`;
}

export async function publishInitialHandoff({ github, storage, task, pr }) {
  const destination = requireStorage(storage);
  validateTaskRecord({ ...task, task_type: "initial", pull_request: null, parent_task_id: null });
  const createdPr = await github.createPullRequest(task.target_repository, {
    title: pr.title,
    body: pr.provisionalBody ?? pr.summary,
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
  const destination = requireStorage(storage);
  const record = { ...task, task_type: "initial", parent_task_id: null };
  validateTaskRecord(record);
  if (!record.pull_request) throw new Error("existing initial handoff requires pull_request");

  const persisted = await persistTaskLog({ github, storage: destination, record });
  const body = buildPrBody({
    summary: pr.summary,
    validation: pr.validation,
    issue: task.issue,
    logUrl: persisted.url,
    branch: task.working_branch,
    commit: task.result_commit,
  });
  await github.updatePullRequest(task.target_repository, record.pull_request, { body });
  const verified = await github.getPullRequest(task.target_repository, record.pull_request);
  if (!verified.body?.includes(persisted.url)) throw new Error("initial handoff verification failed: PR body does not link task record");
  await verifyTaskLog({ github, storage: destination, path: persisted.path, ref: persisted.commitSha, expectedContent: persisted.content });
  return { pullRequest: verified, taskLog: persisted };
}

export async function publishUpdateHandoff({ github, storage, task, update }) {
  const destination = requireStorage(storage);
  const record = { ...task, task_type: "update" };
  const persisted = await persistTaskLog({ github, storage: destination, record });
  const commentBody = buildUpdateComment({ summary: update.summary, validation: update.validation, logUrl: persisted.url, commit: task.result_commit });

  const before = await github.getIssueComments(task.target_repository, task.pull_request);
  const linked = before.filter((item) => typeof item.body === "string" && item.body.includes(persisted.url));
  const conflicting = linked.find((item) => item.body !== commentBody);
  if (conflicting) throw new Error("update handoff retry conflict: existing task-record comment has different content");

  let comment = linked.find((item) => item.body === commentBody) ?? null;
  if (!comment) comment = await github.addIssueComment(task.target_repository, task.pull_request, commentBody);

  const comments = await github.getIssueComments(task.target_repository, task.pull_request);
  const verifiedComment = comments.find((item) => item.id === comment.id && item.body === commentBody);
  if (!verifiedComment) throw new Error("update handoff verification failed: durable PR comment does not match expected task record linkage");
  await verifyTaskLog({ github, storage: destination, path: persisted.path, ref: persisted.commitSha, expectedContent: persisted.content });
  return { comment: verifiedComment, taskLog: persisted };
}

export async function persistTaskLog({ github, storage, record }) {
  const destination = requireStorage(storage);
  const path = taskLogPath(record);
  const content = renderTaskLog(record);

  try {
    const response = await github.createFile(destination.repository, path, content, `crossdock: record task ${record.task_id}`, destination.branch);
    const commitSha = response.commit?.sha;
    if (!commitSha) throw new Error("task-record persistence did not return a commit SHA");
    return persistedTaskLog(destination.repository, path, content, commitSha);
  } catch (error) {
    if (![409, 422].includes(error?.status)) throw error;
  }

  const existing = await github.getFile(destination.repository, path, destination.branch);
  const actual = decodeFileContent(existing, "task-record retry recovery");
  if (actual !== content) throw new Error("task-record retry conflict: existing immutable record has different content");

  const commit = await github.getLatestCommitForPath(destination.repository, path, destination.branch);
  return persistedTaskLog(destination.repository, path, content, commit.sha);
}

function persistedTaskLog(repository, path, content, commitSha) {
  const url = `https://github.com/${repository}/blob/${commitSha}/${path}`;
  return { path, content, commitSha, url };
}

function requireStorage(storage) {
  if (!storage || typeof storage !== "object") throw new Error("task-record storage must be configured explicitly");
  if (!/^[^/]+\/[^/]+$/.test(storage.repository ?? "")) throw new Error("storage.repository must be owner/repo");
  if (typeof storage.branch !== "string" || !storage.branch) throw new Error("storage.branch is required");
  return storage;
}

function decodeFileContent(file, context) {
  if (!file?.sha || typeof file.content !== "string") throw new Error(`${context} failed: remote file missing content`);
  return Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8");
}

async function verifyTaskLog({ github, storage, path, ref, expectedContent }) {
  const file = await github.getFile(storage.repository, path, ref);
  const actual = decodeFileContent(file, "task-record verification");
  if (actual !== expectedContent) throw new Error("task-record verification failed: remote content mismatch");
}
