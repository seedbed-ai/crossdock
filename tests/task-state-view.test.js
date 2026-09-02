import test from "node:test";
import assert from "node:assert/strict";
import { taskStateViewModel, renderTaskState } from "../extension/task-state-view.js";

test("active task view exposes operational metadata without evidence content", () => {
  const model = taskStateViewModel({
    task_id: "crossdock-secret-id",
    mode: "update",
    phase: "branch-update-clicked",
    repository: "example/repo",
    pull_request: 12,
    handoff_mode: "review",
    prompt: "private prompt",
    final_report: "private report",
    evidence_policy: { prompt: "full", report: "full" },
  });
  assert.deepEqual(model, {
    mode: "update",
    phase: "branch-update-clicked",
    repository: "example/repo",
    pull_request: "#12",
    handoff_mode: "review",
  });
  assert.equal(JSON.stringify(model).includes("private"), false);
  assert.equal(JSON.stringify(model).includes("crossdock-secret-id"), false);
});

test("new initial task is described without inventing a PR identity", () => {
  assert.equal(taskStateViewModel({ mode: "initial", phase: "running", repository: "example/repo", pull_request: null, handoff_mode: "automatic" }).pull_request, "New PR");
});

test("render toggles idle and active state using textContent only", () => {
  const elements = new Map([
    ["active-task-empty", { hidden: false }],
    ["active-task-details", { hidden: true }],
    ...["mode", "phase", "repository", "pull-request", "handoff-mode"].map((id) => [`active-task-${id}`, { textContent: "" }]),
  ]);
  const documentRef = { getElementById(id) { return elements.get(id); } };

  renderTaskState({ mode: "update", phase: "ready", repository: "example/repo", pull_request: 4, handoff_mode: "review" }, documentRef);
  assert.equal(elements.get("active-task-empty").hidden, true);
  assert.equal(elements.get("active-task-details").hidden, false);
  assert.equal(elements.get("active-task-repository").textContent, "example/repo");
  assert.equal(elements.get("active-task-pull-request").textContent, "#4");

  renderTaskState(null, documentRef);
  assert.equal(elements.get("active-task-empty").hidden, false);
  assert.equal(elements.get("active-task-details").hidden, true);
});
