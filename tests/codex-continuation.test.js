import test from "node:test";
import assert from "node:assert/strict";
import {
  assertCodexContinuationTaskIdentity,
  canonicalCodexTaskUrl,
  classifyCodexUpdateReadiness,
  normalizeCodexOriginBinding,
} from "../extension/codex-continuation.js";

test("Codex task URL canonicalization requires one concrete cloud task", () => {
  assert.equal(
    canonicalCodexTaskUrl("https://chatgpt.com/codex/cloud/tasks/task_abc#report"),
    "https://chatgpt.com/codex/cloud/tasks/task_abc",
  );
  for (const value of [
    "https://chatgpt.com/codex/cloud",
    "https://chatgpt.com/codex/cloud/tasks/",
    "https://example.com/codex/cloud/tasks/task_abc",
    "/codex/cloud/tasks/task_abc",
    "",
  ]) {
    assert.throws(() => canonicalCodexTaskUrl(value));
  }
});

test("Codex origin binding requires codex provider and exact task URL", () => {
  assert.deepEqual(normalizeCodexOriginBinding({
    provider: "codex",
    originating_task_id: "crossdock-origin",
    agent_task_url: "https://chatgpt.com/codex/cloud/tasks/task_abc",
  }), {
    originating_task_id: "crossdock-origin",
    task_url: "https://chatgpt.com/codex/cloud/tasks/task_abc",
  });
  assert.throws(() => normalizeCodexOriginBinding({
    provider: "other",
    originating_task_id: "crossdock-origin",
    agent_task_url: "https://chatgpt.com/codex/cloud/tasks/task_abc",
  }), /not supported/);
});

test("continuation task identity must remain exactly the originating task", () => {
  assert.equal(assertCodexContinuationTaskIdentity({
    expectedTaskUrl: "https://chatgpt.com/codex/cloud/tasks/task_abc",
    currentTaskUrl: "https://chatgpt.com/codex/cloud/tasks/task_abc#ignored",
  }), "https://chatgpt.com/codex/cloud/tasks/task_abc");

  assert.throws(() => assertCodexContinuationTaskIdentity({
    expectedTaskUrl: "https://chatgpt.com/codex/cloud/tasks/task_abc",
    currentTaskUrl: "https://chatgpt.com/codex/cloud/tasks/task_other",
  }), /identity mismatch/);
});

test("normal existing-PR readiness accepts only Update branch", () => {
  assert.deepEqual(classifyCodexUpdateReadiness({ updateBranchAvailable: false, createPrAvailable: false }), {
    ready: false,
    publication_action: null,
  });
  assert.deepEqual(classifyCodexUpdateReadiness({ updateBranchAvailable: true, createPrAvailable: false }), {
    ready: true,
    publication_action: "update_branch",
  });
  assert.throws(() => classifyCodexUpdateReadiness({ updateBranchAvailable: false, createPrAvailable: true }), /Create PR instead of Update branch/);
  assert.throws(() => classifyCodexUpdateReadiness({ updateBranchAvailable: true, createPrAvailable: true }), /ambiguous/);
});
