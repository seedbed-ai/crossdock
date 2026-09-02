import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_REPORT_RECOVERY_MODE,
  REPORT_RECOVERY_MODES,
  assertReportAvailableForRecovery,
  migrateActiveTaskRecovery,
  normalizeReportRecoveryMode,
  taskStateForLocalPersistence,
} from "../extension/recovery-client.js";

function task(overrides = {}) {
  return {
    task_id: "task-1",
    evidence_policy: { prompt: "omit", report: "full" },
    recovery: { prompt: "persist", report: "persist" },
    phase: "running",
    ...overrides,
  };
}

test("report recovery modes are explicit and strict", () => {
  assert.deepEqual(REPORT_RECOVERY_MODES, ["persist", "memory"]);
  assert.equal(DEFAULT_REPORT_RECOVERY_MODE, "persist");
  assert.equal(normalizeReportRecoveryMode("memory"), "memory");
  assert.throws(() => normalizeReportRecoveryMode("encrypted"), /report recovery mode/);
});

test("memory-only report is removed only from the persisted clone", () => {
  const original = task({ recovery: { prompt: "persist", report: "memory" }, final_report: "private report" });
  const stored = taskStateForLocalPersistence(original);
  assert.equal(stored.final_report, undefined);
  assert.equal(original.final_report, "private report");
  assert.deepEqual(stored.recovery, { prompt: "persist", report: "memory" });
});

test("prompt-era active tasks migrate report recovery to historical persistence", () => {
  const migrated = migrateActiveTaskRecovery(task({ recovery: { prompt: "memory" } }));
  assert.equal(migrated.changed, true);
  assert.deepEqual(migrated.taskState.recovery, { prompt: "memory", report: "persist" });
});

test("memory-only report remains recoverable before provider report capture", () => {
  assert.doesNotThrow(() => assertReportAvailableForRecovery(task({ recovery: { prompt: "persist", report: "memory" }, phase: "ready" })));
});

test("memory-only captured report fails after restart when full or hash evidence requires bytes", () => {
  for (const evidence of ["full", "hash"]) {
    assert.throws(() => assertReportAvailableForRecovery(task({
      recovery: { prompt: "persist", report: "memory" },
      evidence_policy: { prompt: "omit", report: evidence },
      final_task_url: "https://agent.example/tasks/1",
      final_report: undefined,
      phase: "pr-created",
    })), /memory-only report recovery/);
  }
});

test("omitted durable report evidence never requires recovered report bytes", () => {
  assert.doesNotThrow(() => assertReportAvailableForRecovery(task({
    recovery: { prompt: "persist", report: "memory" },
    evidence_policy: { prompt: "omit", report: "omit" },
    final_task_url: "https://agent.example/tasks/1",
    phase: "branch-update-clicked",
  })));
});
