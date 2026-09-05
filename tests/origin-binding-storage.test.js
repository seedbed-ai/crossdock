import test from "node:test";
import assert from "node:assert/strict";
import {
  originBindingLookupPath,
  persistOriginBinding,
  resolveOriginBinding,
} from "../src/origin-binding-storage.js";

const binding = {
  target_repository: "owner/repo",
  pull_request: 9,
  originating_task_id: "crossdock-origin",
  provider: "codex",
  agent_task_url: "https://chatgpt.com/codex/cloud/tasks/task_origin",
  created_at: "2026-09-05T17:00:00Z",
  initial_working_branch: "codex/example",
};

function encode(content) {
  return Buffer.from(content, "utf8").toString("base64");
}

function createStorageMock() {
  const files = new Map();
  let writes = 0;
  const github = {
    async createFile(repository, path, content, _message, branch) {
      const key = `${repository}:${branch}:${path}`;
      if (files.has(key)) {
        const error = new Error("exists");
        error.status = 422;
        throw error;
      }
      files.set(key, content);
      writes += 1;
      return { commit: { sha: `commit-${writes}` } };
    },
    async getFile(repository, path, ref) {
      const branchKey = `${repository}:${ref}:${path}`;
      const exact = files.get(branchKey);
      if (exact != null) return { sha: "blob", content: encode(exact) };

      for (const [key, content] of files) {
        if (key.endsWith(`:${path}`)) return { sha: "blob", content: encode(content) };
      }
      const error = new Error("missing");
      error.status = 404;
      throw error;
    },
    async getLatestCommitForPath() {
      return { sha: `commit-${writes || 1}` };
    },
  };
  return { github, files, writes: () => writes };
}

const storage = { repository: "owner/private-records", branch: "main" };

test("origin binding lookup path depends only on repository and PR identity", () => {
  assert.equal(originBindingLookupPath("owner/repo", 9), "crossdock/origins/owner/repo/pull/9.json");
});

test("origin binding persistence writes and verifies one immutable record", async () => {
  const mock = createStorageMock();
  const result = await persistOriginBinding({ github: mock.github, storage, binding });

  assert.equal(mock.writes(), 1);
  assert.equal(result.path, "crossdock/origins/owner/repo/pull/9.json");
  assert.equal(result.binding.agent_task_url, binding.agent_task_url);
  assert.match(result.url, /owner\/private-records\/blob\/commit-1\/crossdock\/origins\/owner\/repo\/pull\/9\.json$/);
});

test("identical origin binding retry is idempotent", async () => {
  const mock = createStorageMock();
  const first = await persistOriginBinding({ github: mock.github, storage, binding });
  const second = await persistOriginBinding({ github: mock.github, storage, binding: { ...binding } });

  assert.equal(mock.writes(), 1);
  assert.equal(second.content, first.content);
  assert.equal(second.path, first.path);
});

test("conflicting origin binding retry fails closed", async () => {
  const mock = createStorageMock();
  await persistOriginBinding({ github: mock.github, storage, binding });

  await assert.rejects(
    persistOriginBinding({
      github: mock.github,
      storage,
      binding: { ...binding, agent_task_url: "https://chatgpt.com/codex/cloud/tasks/task_other" },
    }),
    /existing immutable record has different content/,
  );
});

test("origin binding resolves by repository and PR without PR-visible provenance", async () => {
  const mock = createStorageMock();
  await persistOriginBinding({ github: mock.github, storage, binding });

  const resolved = await resolveOriginBinding({
    github: mock.github,
    storage,
    targetRepository: "owner/repo",
    pullRequest: 9,
  });

  assert.equal(resolved.binding.originating_task_id, "crossdock-origin");
  assert.equal(resolved.binding.agent_task_url, binding.agent_task_url);
  assert.equal(resolved.storage_repository, "owner/private-records");
  assert.equal(resolved.storage_branch, "main");
  assert.ok(Object.isFrozen(resolved));
});

test("malformed or mismatched remote origin binding fails closed", async () => {
  const malformed = createStorageMock();
  const path = originBindingLookupPath("owner/repo", 9);
  malformed.files.set(`owner/private-records:main:${path}`, "not json\n");
  await assert.rejects(
    resolveOriginBinding({ github: malformed.github, storage, targetRepository: "owner/repo", pullRequest: 9 }),
    /not valid JSON/,
  );

  const mismatch = createStorageMock();
  await persistOriginBinding({ github: mismatch.github, storage, binding: { ...binding, target_repository: "owner/other" } });
  const otherPath = originBindingLookupPath("owner/repo", 9);
  const stored = [...mismatch.files.values()][0];
  mismatch.files.set(`owner/private-records:main:${otherPath}`, stored);
  await assert.rejects(
    resolveOriginBinding({ github: mismatch.github, storage, targetRepository: "owner/repo", pullRequest: 9 }),
    /identity does not match requested PR/,
  );
});
