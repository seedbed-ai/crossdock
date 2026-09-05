import { originBindingPath, renderOriginBinding, validateOriginBinding } from "./origin-binding.js";
import { resolveTaskRecordStorage } from "./storage.js";

export async function persistOriginBinding({ github, storage, binding }) {
  const destination = resolveTaskRecordStorage({ github, storage });
  const normalized = validateOriginBinding(binding);
  const path = originBindingPath(normalized);
  const content = renderOriginBinding(normalized);
  const input = {
    path,
    content,
    message: `crossdock: bind PR #${normalized.pull_request} to originating task`,
  };

  if (typeof destination.preflightImmutable === "function") destination.preflightImmutable(input);
  const persisted = await destination.persistImmutable(input);
  if (!persisted || typeof persisted !== "object") throw new Error("origin-binding storage returned no persistence result");
  if (persisted.path !== path || persisted.content !== content) throw new Error("origin-binding storage returned inconsistent persistence metadata");
  if (typeof persisted.version !== "string" || !persisted.version) throw new Error("origin-binding storage returned no immutable version");
  if (typeof persisted.url !== "string" || !persisted.url) throw new Error("origin-binding storage returned no durable URL");

  await destination.verifyImmutable({
    path: persisted.path,
    version: persisted.version,
    expectedContent: content,
  });
  return { binding: normalized, ...persisted };
}

export async function resolveOriginBinding({ github, storage, targetRepository, pullRequest }) {
  const destination = resolveTaskRecordStorage({ github, storage });
  const path = originBindingLookupPath(targetRepository, pullRequest);
  const file = await github.getFile(destination.repository, path, destination.branch);
  const content = decodeGitHubTextFile(file, "origin-binding lookup");

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("origin-binding lookup failed: remote content is not valid JSON");
  }

  const binding = validateOriginBinding(parsed);
  if (binding.target_repository !== targetRepository.trim() || binding.pull_request !== pullRequest) {
    throw new Error("origin-binding lookup failed: remote binding identity does not match requested PR");
  }

  return Object.freeze({
    binding,
    path,
    storage_repository: destination.repository,
    storage_branch: destination.branch,
  });
}

export function originBindingLookupPath(targetRepository, pullRequest) {
  const probe = validateOriginBinding({
    target_repository: targetRepository,
    pull_request: pullRequest,
    originating_task_id: "lookup",
    provider: "lookup",
    agent_task_url: "https://invalid.example/lookup",
    created_at: "1970-01-01T00:00:00Z",
  });
  return originBindingPath(probe);
}

function decodeGitHubTextFile(file, context) {
  if (!file?.sha || typeof file.content !== "string") throw new Error(`${context} failed: remote file missing content`);
  return Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8");
}
