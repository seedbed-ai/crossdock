import test from "node:test";
import assert from "node:assert/strict";
import {
  ORIGIN_BINDING_SCHEMA,
  normalizeOriginRepository,
  normalizeOriginTaskUrl,
  normalizePullRequestNumber,
  originBindingPath,
  renderOriginBinding,
  validateOriginBinding,
} from "../src/origin-binding.js";

const binding = {
  target_repository: "owner/repo",
  pull_request: 17,
  originating_task_id: "crossdock-1234",
  provider: "codex",
  agent_task_url: "https://chatgpt.com/codex/cloud/tasks/task_abc",
  created_at: "2026-09-05T17:00:00Z",
  initial_working_branch: "codex/example",
};

test("origin binding validates and freezes canonical routing identity", () => {
  const normalized = validateOriginBinding(binding);
  assert.deepEqual(normalized, {
    schema: ORIGIN_BINDING_SCHEMA,
    target_repository: "owner/repo",
    pull_request: 17,
    originating_task_id: "crossdock-1234",
    provider: "codex",
    agent_task_url: "https://chatgpt.com/codex/cloud/tasks/task_abc",
    created_at: "2026-09-05T17:00:00.000Z",
    initial_working_branch: "codex/example",
  });
  assert.ok(Object.isFrozen(normalized));
});

test("origin binding path is deterministic from repository and PR identity", () => {
  assert.equal(originBindingPath(binding), "crossdock/origins/owner/repo/pull/17.json");
});

test("origin binding rendering is deterministic JSON with a trailing newline", () => {
  const first = renderOriginBinding(binding);
  const second = renderOriginBinding({ ...binding });
  assert.equal(first, second);
  assert.equal(first.endsWith("\n"), true);
  assert.deepEqual(JSON.parse(first), validateOriginBinding(binding));
});

test("origin binding excludes prompt and report evidence", () => {
  for (const [field, value] of [["prompt", "private"], ["report", "private"], ["prompt_sha256", "abc"], ["report_sha256", "def"]]) {
    assert.throws(() => validateOriginBinding({ ...binding, [field]: value }), new RegExp(`must not contain ${field}`));
  }
});

test("repository and pull request identity fail closed", () => {
  assert.equal(normalizeOriginRepository(" owner/repo "), "owner/repo");
  assert.equal(normalizePullRequestNumber(1), 1);
  for (const value of ["repo", "owner/repo/extra", "owner /repo", ""]) {
    assert.throws(() => normalizeOriginRepository(value));
  }
  for (const value of [0, -1, 1.5, "1", null]) {
    assert.throws(() => normalizePullRequestNumber(value));
  }
});

test("task URL must be absolute http or https and strips fragments", () => {
  assert.equal(
    normalizeOriginTaskUrl("https://chatgpt.com/codex/cloud/tasks/task_abc#report"),
    "https://chatgpt.com/codex/cloud/tasks/task_abc",
  );
  for (const value of ["/relative", "javascript:alert(1)", "", null]) {
    assert.throws(() => normalizeOriginTaskUrl(value));
  }
});

test("schema, task id, provider, and timestamp validation fail closed", () => {
  assert.throws(() => validateOriginBinding({ ...binding, schema: "crossdock.origin-binding/v0" }), /unsupported origin binding schema/);
  assert.throws(() => validateOriginBinding({ ...binding, originating_task_id: "bad id" }), /originating_task_id/);
  assert.throws(() => validateOriginBinding({ ...binding, provider: "bad provider" }), /provider/);
  assert.throws(() => validateOriginBinding({ ...binding, created_at: "not-a-date" }), /created_at/);
});
