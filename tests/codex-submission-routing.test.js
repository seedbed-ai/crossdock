import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const backgroundSource = await readFile(new URL("../extension/background.js", import.meta.url), "utf8");

test("new Codex submissions return an existing task tab to the composer before provider automation", () => {
  const start = backgroundSource.indexOf('case "crossdock.submitCodex"');
  const end = backgroundSource.indexOf('case "crossdock.inspectCodex"');
  const submitCase = backgroundSource.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(submitCase, /const tab = await ensureCodexComposerTab\(\)/);
  assert.match(backgroundSource, /const CODEX_URL = "https:\/\/chatgpt\.com\/codex\/cloud"/);
  assert.match(backgroundSource, /async function ensureCodexComposerTab\(\)[\s\S]*chrome\.tabs\.update\(tab\.id, \{ url: CODEX_URL, active: true \}\)[\s\S]*await waitForTabComplete\(tab\.id\)/);

  const composer = submitCase.indexOf("const tab = await ensureCodexComposerTab()");
  const activate = submitCase.indexOf("await chrome.tabs.update(tab.id, { active: true })");
  const send = submitCase.indexOf("const result = await sendToTab(tab.id");
  assert.ok(composer >= 0 && composer < activate);
  assert.ok(activate < send);
});

test("existing PR updates resolve the Codex branch from the PR working branch", () => {
  assert.match(backgroundSource, /async function resolveSubmissionBranch/);
  assert.match(backgroundSource, /path: "\/pr\/snapshot"/);
  assert.match(backgroundSource, /pull_request: Number\(rawPullRequest\)/);
  assert.match(backgroundSource, /snapshot\.working_branch/);
  assert.match(backgroundSource, /return snapshot\.working_branch\.trim\(\)/);
});

test("initial Codex submissions still resolve the repository default branch", () => {
  assert.match(backgroundSource, /path: "\/repository\/snapshot"/);
  assert.match(backgroundSource, /snapshot\.default_branch/);
  assert.match(backgroundSource, /return snapshot\.default_branch\.trim\(\)/);
});

test("submission branch is resolved before Codex page navigation or prompt mutation", () => {
  const start = backgroundSource.indexOf('case "crossdock.submitCodex"');
  const end = backgroundSource.indexOf('case "crossdock.inspectCodex"');
  const submitCase = backgroundSource.slice(start, end);

  const branch = submitCase.indexOf("const targetBranch = await resolveSubmissionBranch");
  const composer = submitCase.indexOf("const tab = await ensureCodexComposerTab()");
  const send = submitCase.indexOf("const result = await sendToTab(tab.id");
  assert.ok(branch >= 0 && branch < composer);
  assert.ok(composer < send);
});
