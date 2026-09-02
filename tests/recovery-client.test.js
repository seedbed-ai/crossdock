import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PROMPT_RECOVERY_MODE,
  assertPromptAvailableForRecovery,
  migrateActiveTaskRecovery,
  normalizePromptRecoveryMode,
  taskStateForLocalPersistence,
} from "../extension/recovery-client.js";

function task(overrides = {}) {
  return {
    task_id: "task-1",
    prompt: "private prompt",
    evidence_policy: { prompt: "full", report: "omit" },
    recovery: { prompt: "persist" },
    phase: "running",
    ...overrides,
  };
}

test("persist mode retains prompt in local recovery state", () => {
  const original = task();
  const stored = taskStateForLocalPersistence(original);
  assert.equal(stored.prompt, "private prompt");
  assert.deepEqual(stored.recovery, { prompt: "persist" });
  assert.notEqual(stored, original);
});

test("memory mode removes prompt from local recovery state without mutating live state", () => {
  const original = task({ recovery: { prompt: "memory" } });
  const stored = taskStateForLocalPersistence(original);
  assert.equal(stored.prompt, undefined);
  assert.equal(original.prompt, "private prompt");
  assert.deepEqual(stored.recovery, { prompt: "memory" });
});

test("legacy active tasks migrate to historical prompt persistence", () => {
  const original = { task_id: "legacy", prompt: "prompt", phase: "ready" };
  const migrated = migrateActiveTaskRecovery(original);
  assert.equal(migrated.changed, true);
  assert.deepEqual(migrated.taskState.recovery, { prompt: DEFAULT_PROMPT_RECOVERY_MODE });
  assert.equal(original.recovery, undefined);
});

test("memory-only restart fails clearly when full or hash prompt evidence needs original bytes", () => {
  for (const promptMode of ["full", "hash"]) {
    assert.throws(
      () => assertPromptAvailableForRecovery(task({ prompt: undefined, evidence_policy: { prompt: promptMode, report: "omit" }, recovery: { prompt: "memory" } })),
      /memory-only prompt recovery/,
    );
  }
});

test("memory-only restart remains recoverable when durable prompt evidence is omitted", () => {
  assert.doesNotThrow(() => assertPromptAvailableForRecovery(task({
    prompt: undefined,
    evidence_policy: { prompt: "omit", report: "full" },
    recovery: { prompt: "memory" },
  })));
});

test("invalid prompt recovery modes fail rather than coercing", () => {
  assert.throws(() => normalizePromptRecoveryMode("encrypted"), /must be one of/);
  assert.throws(() => migrateActiveTaskRecovery({ task_id: "task", recovery: { prompt: "encrypted" } }), /must be one of/);
});
