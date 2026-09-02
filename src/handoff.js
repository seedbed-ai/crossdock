import { DEFAULT_CONFIG, validatePublicationPolicy } from "./config.js";
import { assertGithubSafe } from "./security.js";
import { resolveTaskRecordStorage } from "./storage.js";
import { renderTaskRecord, taskRecordPath, validateTaskRecord } from "./task-record.js";
import { prepareCommittedFilePublication, publishCommittedFile } from "./committed-file-publication.js";

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

export async function publishInitialHandoff({ github, storage, task, pr, publication }) {
  const policy = resolvePublicationPolicy(publication);
  preflightPublicationSupport(policy, "initial");

  const destination = resolveTaskRecordStorage({ github, storage });
  const preflightRecord = { ...task, task_type: "initial", pull_request: null, parent_task_id: null };
  validateTaskRecord(preflightRecord);
  prepareCommittedFilePublication(policy.committed_file, preflightRecord);
  preflightTaskRecord(destination, preflightRecord);
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
    publication: policy,
  });
}

export async function publishExistingInitialHandoff({ github, storage, task, pr, publication }) {
  const policy = resolvePublicationPolicy(publication);
  const presentation = preflightPublicationSupport(policy, "initial");
  const destination = resolveTaskRecordStorage({ github, storage });
  const record = { ...task, task_type: "initial", parent_task_id: null };
  validateTaskRecord(record);
  if (!record.pull_request) throw new Error("existing initial handoff requires pull_request");
  const committedFile = prepareCommittedFilePublication(policy.committed_file, record);
  if (presentation === "link") preflightPrDescription(pr);

  const persisted = await persistTaskRecord({ github, storage: destination, record });
  await destination.verifyImmutable({ path: persisted.path, version: persisted.version, expectedContent: persisted.content });
  const committedResult = await publishCommittedFile({ github, prepared: committedFile, task: record, recordUrl: persisted.url });
  let verified;

  if (presentation === "link") {
    const body = buildPrBody({
      summary: pr.summary,
      validation: pr.validation,
      issue: task.issue,
      recordUrl: persisted.url,
      branch: task.working_branch,
      commit: task.result_commit,
    });
    assertGithubSafe(body, "pull request body");

    const current = await github.getPullRequest(task.target_repository, record.pull_request);
    if (current.body !== body) await github.updatePullRequest(task.target_repository, record.pull_request, { body });
    verified = await github.getPullRequest(task.target_repository, record.pull_request);
    if (!verified.body?.includes(persisted.url)) throw new Error("initial handoff verification failed: PR body does not link task record");
  } else {
    verified = await github.getPullRequest(task.target_repository, record.pull_request);
  }

  return { pullRequest: verified, taskRecord: persisted, publication: publicationResult("change_description", presentation, committedResult) };
}

export async function publishUpdateHandoff({ github, storage, task, update, publication }) {
  const policy = resolvePublicationPolicy(publication);
  const presentation = preflightPublicationSupport(policy, "update");
  const destination = resolveTaskRecordStorage({ github, storage });
  const record = { ...task, task_type: "update" };
  validateTaskRecord(record);
  const committedFile = prepareCommittedFilePublication(policy.committed_file, record);
  if (presentation === "link") preflightDescription(update, "update");

  const persisted = await persistTaskRecord({ github, storage: destination, record });
  await destination.verifyImmutable({ path: persisted.path, version: persisted.version, expectedContent: persisted.content });
  const committedResult = await publishCommittedFile({ github, prepared: committedFile, task: record, recordUrl: persisted.url });
  if (presentation === "none") {
    return { comment: null, taskRecord: persisted, publication: publicationResult("change_comment", "none", committedResult) };
  }

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
  return { comment: verifiedComment, taskRecord: persisted, publication: publicationResult("change_comment", "link", committedResult) };
}

export async function persistTaskRecord({ github, storage, record }) {
  const destination = resolveTaskRecordStorage({ github, storage });
  const path = taskRecordPath(record);
  const content = renderTaskRecord(record);
  const input = { path, content, message: `crossdock: record task ${record.task_id}` };
  if (typeof destination.preflightImmutable === "function") destination.preflightImmutable(input);

  const persisted = await destination.persistImmutable(input);
  if (!persisted || typeof persisted !== "object") throw new Error("task-record storage adapter returned no persistence result");
  if (persisted.path !== path || persisted.content !== content) throw new Error("task-record storage adapter returned inconsistent persistence metadata");
  if (typeof persisted.version !== "string" || !persisted.version) throw new Error("task-record storage adapter returned no immutable version");
  if (typeof persisted.url !== "string" || !persisted.url) throw new Error("task-record storage adapter returned no durable URL");
  return persisted;
}

function resolvePublicationPolicy(publication) {
  return validatePublicationPolicy(publication ?? DEFAULT_CONFIG.publication);
}

function preflightPublicationSupport(policy, phase) {
  const field = phase === "initial" ? "change_description" : "change_comment";
  const presentation = policy[field];
  if (presentation === "summary") {
    throw new Error(`${field} summary provenance publication is configured but not implemented by the current handoff service`);
  }
  return presentation;
}

function publicationResult(field, presentation, committedFile) {
  return { [field]: presentation, ...(committedFile == null ? {} : { committed_file: committedFile }) };
}

function preflightTaskRecord(destination, record) {
  if (typeof destination.preflightImmutable !== "function") return;
  const path = taskRecordPath(record);
  const content = renderTaskRecord(record);
  destination.preflightImmutable({ path, content, message: `crossdock: record task ${record.task_id}` });
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
