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

test("legacy target-only discovery baselines cannot manufacture cross-repository incidents", () => {
  assert.match(background, /crossRepositorySafe: true/);
  assert.match(background, /crossRepositorySafe: false/);
  assert.match(background, /if \(!baseline\.crossRepositorySafe\)/);
  assert.match(background, /repositoryFromGitHubPrUrl\(url\) === targetRepository/);
});

test("integrity failure is persisted instead of entering uncertain retry", () => {
  const integrityIndex = dashboard.indexOf("if (result.integrityError)");
  const uncertainIndex = dashboard.indexOf('taskState.phase = "pr-create-uncertain"');
  assert.ok(integrityIndex >= 0);
  assert.ok(uncertainIndex > integrityIndex);
  assert.match(dashboard.slice(integrityIndex, uncertainIndex), /await saveTaskState\(\)/);
});


test("existing-PR update snapshots PR evidence before provider publication", () => {
  const start = background.indexOf('case "crossdock.applyBranchUpdate"');
  const end = background.indexOf('case "crossdock.openChatGPT"');
  const updateCase = background.slice(start, end);
  assert.match(updateCase, /beforePrUrls: await snapshotPrEvidence/);
  assert.match(updateCase, /crossdock\.prepareBranchUpdate/);
  assert.match(updateCase, /crossdock\.inspectUpdatePrEvidence/);
});

test("update PR integrity permits the expected existing PR but rejects another PR", () => {
  assert.match(background, /expectedPrUrl/);
  assert.match(background, /unexpectedTarget = evidence\.target\.filter/);
  assert.match(background, /update PR integrity failure/);
  assert.match(dashboard, /pr-update-integrity-error/);
});

test("update readiness accepts one provider publication control instead of requiring Update branch", () => {
  assert.match(dashboard, /updateActionCount/);
  assert.match(dashboard, /state\.updateBranchAvailable/);
  assert.match(dashboard, /state\.createPrAvailable/);
  assert.match(dashboard, /updateActionCount === 1/);
});
