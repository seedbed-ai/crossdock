import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const background = await readFile(new URL("../extension/background.js", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../extension/dashboard.js", import.meta.url), "utf8");

test("PR discovery snapshots all GitHub PR evidence before Create PR", () => {
  assert.match(background, /beforePrUrls: await snapshotPrEvidence/);
  assert.match(background, /targetRepository: null/);
  assert.match(background, /allPrTabUrls/);
  assert.match(background, /classifyNewPrUrls/);
});

test("new wrong-repository PR evidence becomes an integrity failure", () => {
  assert.match(background, /wrongRepository\.length/);
  assert.match(background, /created PR integrity failure/);
  assert.match(background, /integrityError/);
  assert.match(dashboard, /pr-create-integrity-error/);
  assert.match(dashboard, /PR creation integrity failure/);
});

test("integrity failure is persisted instead of entering uncertain retry", () => {
  const integrityIndex = dashboard.indexOf("if (result.integrityError)");
  const uncertainIndex = dashboard.indexOf('taskState.phase = "pr-create-uncertain"');
  assert.ok(integrityIndex >= 0);
  assert.ok(uncertainIndex > integrityIndex);
  assert.match(dashboard.slice(integrityIndex, uncertainIndex), /await saveTaskState\(\)/);
});
