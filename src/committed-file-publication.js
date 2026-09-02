import { assertGithubSafe } from "./security.js";
import { decodeGitHubFileContent } from "./github-client.js";

export function resolveCommittedFilePath(pathTemplate, taskId) {
  if (typeof taskId !== "string" || !/^[A-Za-z0-9._-]+$/.test(taskId)) throw new Error("committed-file publication requires a validated task_id");
  if (typeof pathTemplate !== "string" || !pathTemplate.includes("{task_id}")) throw new Error("committed-file path template must include {task_id}");
  const path = pathTemplate.replaceAll("{task_id}", taskId);
  const segments = path.split("/");
  if (!path || path.startsWith("/") || path.endsWith("/") || path.includes("\\") || path.includes("\0") || /\{[^}]*\}/.test(path) || segments.some((part) => !part || part === "." || part === "..")) {
    throw new Error("resolved committed-file path must be a valid repository-relative path without unresolved placeholders");
  }
  return path;
}

export function renderCommittedFile({ presentation, task, recordUrl }) {
  if (typeof recordUrl !== "string" || !recordUrl) throw new Error("durable task-record URL is required for committed-file publication");
  if (presentation === "link") return `# Crossdock provenance\n\nTask record: ${recordUrl}\n`;
  if (presentation !== "reference") throw new Error(`unsupported committed-file presentation: ${presentation}`);
  const lines = ["# Crossdock provenance", "", `Task: \`${task.task_id}\``, `Repository: \`${task.target_repository}\``];
  if (task.pull_request != null) lines.push(`Pull request: \`#${task.pull_request}\``);
  if (task.result_commit) lines.push(`Commit: \`${task.result_commit}\``);
  lines.push("", `Task record: ${recordUrl}`);
  return `${lines.join("\n")}\n`;
}

export function prepareCommittedFilePublication(configuration, task) {
  if (configuration == null) return null;
  if (configuration.adapter !== "github") throw new Error(`unsupported committed-file adapter: ${configuration.adapter}`);
  if (!["link", "reference"].includes(configuration.presentation)) throw new Error(`unsupported committed-file presentation: ${configuration.presentation}`);
  const path = resolveCommittedFilePath(configuration.path_template, task.task_id);
  if (configuration.presentation === "reference") {
    assertGithubSafe(renderCommittedFile({ presentation: "reference", task, recordUrl: "https://example.invalid/task-record" }), "committed provenance file");
  }
  return Object.freeze({ presentation: configuration.presentation, repository: configuration.repository, branch: configuration.branch, path });
}

export async function publishCommittedFile({ github, prepared, task, recordUrl }) {
  if (prepared == null) return null;
  for (const method of ["getFile", "createFile"]) if (typeof github?.[method] !== "function") throw new Error(`GitHub client must implement ${method}() for committed-file publication`);
  const content = renderCommittedFile({ presentation: prepared.presentation, task, recordUrl });
  assertGithubSafe(content, "committed provenance file");
  const expected = Buffer.from(content, "utf8");
  let result = "existing";
  let existing;
  try {
    existing = await github.getFile(prepared.repository, prepared.path, prepared.branch);
  } catch (error) {
    if (error?.status !== 404) throw error;
  }
  if (existing) {
    if (!decodeGitHubFileContent(existing, "committed-file reconciliation").equals(expected)) throw new Error("committed-file publication conflict: existing file has different content");
  } else {
    await github.createFile(prepared.repository, prepared.path, content, `crossdock: publish provenance for ${task.task_id}`, prepared.branch);
    result = "created";
  }
  const verifiedFile = await github.getFile(prepared.repository, prepared.path, prepared.branch);
  if (!decodeGitHubFileContent(verifiedFile, "committed-file verification").equals(expected)) throw new Error("committed-file publication verification failed: remote content mismatch");
  return { presentation: prepared.presentation, repository: prepared.repository, branch: prepared.branch, path: prepared.path, verification: "verified", result };
}
