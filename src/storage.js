import { assertGithubSafe } from "./security.js";

export const TASK_RECORD_STORAGE_ADAPTER = "crossdock.task-record-storage/v1";

export function createGitHubTaskRecordStorage({ github, repository, branch }) {
  requireGithub(github);
  if (typeof repository !== "string" || !/^[^/\s]+\/[^/\s]+$/.test(repository)) throw new Error("storage.repository must be owner/repo");
  if (typeof branch !== "string" || !branch.trim()) throw new Error("storage.branch is required");

  return Object.freeze({
    adapter: TASK_RECORD_STORAGE_ADAPTER,
    type: "github",
    repository,
    branch,

    async persistImmutable({ path, content, message }) {
      requireRecordInput(path, content, message);
      assertGithubSafe(content, "task record");

      try {
        const response = await github.createFile(repository, path, content, message, branch);
        const commitSha = response.commit?.sha;
        if (!commitSha) throw new Error("task-record persistence did not return a commit SHA");
        return githubResult({ repository, path, content, commitSha });
      } catch (error) {
        if (![409, 422].includes(error?.status)) throw error;
      }

      const existing = await github.getFile(repository, path, branch);
      const actual = decodeGitHubFile(existing, "task-record retry recovery");
      if (actual !== content) throw new Error("task-record retry conflict: existing immutable record has different content");
      if (typeof github.getLatestCommitForPath !== "function") throw new Error("GitHub client must implement getLatestCommitForPath() for task-record retry recovery");

      const commit = await github.getLatestCommitForPath(repository, path, branch);
      return githubResult({ repository, path, content, commitSha: commit.sha });
    },

    async verifyImmutable({ path, version, expectedContent }) {
      if (typeof version !== "string" || !version) throw new Error("task-record version is required for verification");
      if (typeof expectedContent !== "string") throw new Error("expected task-record content is required for verification");
      const file = await github.getFile(repository, path, version);
      const actual = decodeGitHubFile(file, "task-record verification");
      if (actual !== expectedContent) throw new Error("task-record verification failed: remote content mismatch");
      return true;
    },
  });
}

export function resolveTaskRecordStorage({ github, storage }) {
  if (isTaskRecordStorageAdapter(storage)) return storage;
  if (!storage || typeof storage !== "object" || Array.isArray(storage)) throw new Error("task-record storage must be configured explicitly");
  const allowed = new Set(["type", "repository", "branch"]);
  for (const key of Object.keys(storage)) if (!allowed.has(key)) throw new Error(`storage contains unknown field: ${key}`);
  const type = storage.type ?? "github";
  if (type !== "github") throw new Error(`unsupported task-record storage type: ${type}`);
  return createGitHubTaskRecordStorage({ github, repository: storage.repository, branch: storage.branch });
}

export function isTaskRecordStorageAdapter(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    value.adapter === TASK_RECORD_STORAGE_ADAPTER &&
    typeof value.type === "string" &&
    typeof value.persistImmutable === "function" &&
    typeof value.verifyImmutable === "function"
  );
}

function githubResult({ repository, path, content, commitSha }) {
  if (typeof commitSha !== "string" || !commitSha) throw new Error("GitHub task-record version is missing");
  return {
    path,
    content,
    version: commitSha,
    commitSha,
    url: `https://github.com/${repository}/blob/${commitSha}/${path}`,
  };
}

function requireGithub(github) {
  if (!github || typeof github !== "object") throw new Error("GitHub client is required for GitHub task-record storage");
  for (const method of ["createFile", "getFile"]) {
    if (typeof github[method] !== "function") throw new Error(`GitHub client must implement ${method}()`);
  }
}

function requireRecordInput(path, content, message) {
  if (typeof path !== "string" || !path) throw new Error("task-record path is required");
  if (typeof content !== "string") throw new Error("task-record content is required");
  if (typeof message !== "string" || !message) throw new Error("task-record commit message is required");
}

function decodeGitHubFile(file, context) {
  if (!file?.sha || typeof file.content !== "string") throw new Error(`${context} failed: remote file missing content`);
  return Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8");
}