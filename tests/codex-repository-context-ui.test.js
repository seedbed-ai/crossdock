import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contentSource = await readFile(new URL("../extension/content.js", import.meta.url), "utf8");
const backgroundSource = await readFile(new URL("../extension/background.js", import.meta.url), "utf8");

test("background snapshots repository default branch and passes frozen provider target into Codex submission", () => {
  assert.match(backgroundSource, /postServiceJson/);
  assert.match(backgroundSource, /path: "\/repository\/snapshot"/);
  assert.match(backgroundSource, /snapshot\.default_branch/);
  assert.match(backgroundSource, /targetRepository/);
  assert.match(backgroundSource, /targetBranch/);
  assert.match(backgroundSource, /crossdock\.submitCodex[\s\S]*targetRepository[\s\S]*targetBranch/);
});

test("background activates Codex before provider-context automation", () => {
  const start = backgroundSource.indexOf('case "crossdock.submitCodex"');
  const end = backgroundSource.indexOf('case "crossdock.inspectCodex"');
  const submitCase = backgroundSource.slice(start, end);
  assert.ok(start >= 0 && end > start);
  const ensureTab = submitCase.indexOf("const tab = await ensureCodexTab()");
  const activate = submitCase.indexOf("await chrome.tabs.update(tab.id, { active: true })");
  const send = submitCase.indexOf("const result = await sendToTab(tab.id");
  assert.ok(ensureTab >= 0 && ensureTab < activate);
  assert.ok(activate < send);
});

test("Codex submission resolves repository and branch context before writing or clicking", () => {
  const start = contentSource.indexOf("async function submitCodexPrompt");
  const end = contentSource.indexOf("async function ensureCodexRepositoryContext");
  const submit = contentSource.slice(start, end);
  assert.ok(start >= 0 && end > start);
  const repositoryResolution = submit.indexOf("await ensureCodexRepositoryContext(targetRepository)");
  const branchResolution = submit.indexOf("await ensureCodexBranchContext(targetBranch)");
  const promptWrite = submit.indexOf("setEditableValue(input, prompt)");
  const submitReady = submit.indexOf("await waitForCodexSubmitButton(5_000)");
  const submitClick = submit.indexOf("submitButton.click()");
  assert.ok(repositoryResolution >= 0 && repositoryResolution < branchResolution);
  assert.ok(branchResolution < promptWrite);
  assert.ok(promptWrite < submitReady);
  assert.ok(submitReady < submitClick);
});

test("repository selection uses authenticated Codex semantic controls and human-readable environment fallback", () => {
  assert.match(contentSource, /View all code environments/);
  assert.match(contentSource, /waitForControlledDialog/);
  assert.match(contentSource, /exactVisibleButtonChoices\(dialog, targetRepository\)/);
  assert.match(contentSource, /exactVisibleButtonChoices\(dialog, repositoryName\)/);
  assert.match(contentSource, /neither exact repository nor matching environment is visible/);
  assert.match(contentSource, /matching environment choices/);
  assert.match(contentSource, /exact repository choices/);
});

test("repository confirmation re-resolves the live semantic selector after selection", () => {
  const start = contentSource.indexOf("async function ensureCodexRepositoryContext");
  const end = contentSource.indexOf("async function ensureCodexBranchContext");
  const repositorySelection = contentSource.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(repositorySelection, /candidates\[0\]\.click\(\);[\s\S]*await waitFor\(\(\) => \{[\s\S]*const currentSelector = findUniqueSemanticButton\("View all code environments"\)/);
  assert.match(repositorySelection, /visibleText\(currentSelector\) === expectedSelection/);
  assert.match(repositorySelection, /currentSelector\.getAttribute\("aria-expanded"\) !== "true"/);
  assert.doesNotMatch(repositorySelection, /await waitFor\(\(\) => visibleText\(selector\) === targetRepository/);
});

test("repository confirmation allows observed slow provider transitions to settle with margin", () => {
  const start = contentSource.indexOf("async function ensureCodexRepositoryContext");
  const end = contentSource.indexOf("async function ensureCodexBranchContext");
  const repositorySelection = contentSource.slice(start, end);
  assert.match(contentSource, /const CODEX_CONTEXT_SELECTION_TIMEOUT_MS = 120_000;/);
  assert.match(repositorySelection, /CODEX_CONTEXT_SELECTION_TIMEOUT_MS/);
  assert.doesNotMatch(repositorySelection, /\}, 45_000, `Codex repository selection was not confirmed/);
  assert.doesNotMatch(repositorySelection, /\}, 20_000, `Codex repository selection was not confirmed/);
  assert.doesNotMatch(repositorySelection, /\}, 5_000, `Codex repository selection was not confirmed/);
});

test("branch selection uses authenticated Codex semantic controls and exact branch text", () => {
  assert.match(contentSource, /Search for your branch/);
  assert.match(contentSource, /ensureCodexBranchContext/);
  assert.match(contentSource, /exactVisibleButtonChoices\(dialog, expected\)/);
  assert.match(contentSource, /branch is not visible in the branch chooser/);
  assert.match(contentSource, /Codex branch selection was not confirmed/);
  assert.match(contentSource, /selected provider branch/);
});

test("branch confirmation re-resolves the live semantic selector after selection", () => {
  const start = contentSource.indexOf("async function ensureCodexBranchContext");
  const end = contentSource.indexOf("function assertCodexRepositoryContext");
  const branchSelection = contentSource.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(branchSelection, /candidates\[0\]\.click\(\);[\s\S]*await waitFor\(\(\) => \{[\s\S]*const currentSelector = findUniqueSemanticButton\("Search for your branch"\)/);
  assert.match(branchSelection, /visibleText\(currentSelector\) === expected/);
  assert.match(branchSelection, /currentSelector\.getAttribute\("aria-expanded"\) !== "true"/);
  assert.doesNotMatch(branchSelection, /await waitFor\(\(\) => visibleText\(selector\) === expected/);
});

test("branch confirmation uses the same extended transition timeout", () => {
  const start = contentSource.indexOf("async function ensureCodexBranchContext");
  const end = contentSource.indexOf("function assertCodexRepositoryContext");
  const branchSelection = contentSource.slice(start, end);
  assert.match(branchSelection, /CODEX_CONTEXT_SELECTION_TIMEOUT_MS/);
  assert.doesNotMatch(branchSelection, /\}, 45_000, `Codex branch selection was not confirmed/);
  assert.doesNotMatch(branchSelection, /\}, 20_000, `Codex branch selection was not confirmed/);
  assert.doesNotMatch(branchSelection, /\}, 5_000, `Codex branch selection was not confirmed/);
});

test("provider context is returned with exact repository and frozen base branch", () => {
  assert.match(contentSource, /providerContext: \{ repository: targetRepository, base_branch: targetBranch \}/);
  assert.match(backgroundSource, /providerContext: \{ repository: targetRepository, base_branch: targetBranch \}/);
});

test("Codex submission waits boundedly for the semantic submit control to become ready", () => {
  const start = contentSource.indexOf("async function submitCodexPrompt");
  const end = contentSource.indexOf("async function ensureCodexRepositoryContext");
  const submit = contentSource.slice(start, end);
  assert.match(submit, /setEditableValue\(input, prompt\)[\s\S]*await waitForCodexSubmitButton\(5_000\)[\s\S]*submitButton\.click\(\)/);
  assert.match(contentSource, /async function waitForCodexSubmitButton\(timeoutMs\)[\s\S]*findCodexSubmitButton\(false\)[\s\S]*Codex submit control did not become ready after prompt entry/);
});

test("repository context accepts a selected environment matching the repository basename", () => {
  const start = contentSource.indexOf("async function ensureCodexRepositoryContext");
  const end = contentSource.indexOf("async function ensureCodexBranchContext");
  const repositorySelection = contentSource.slice(start, end);
  assert.match(repositorySelection, /const repositoryName = targetRepository\.split\("\/"\)\.at\(-1\)/);
  assert.match(repositorySelection, /selectedContext === targetRepository \|\| selectedContext === repositoryName/);
  assert.match(repositorySelection, /expectedSelection = repositoryName/);
});

test("repository environment fallback stays fail-closed on ambiguity", () => {
  assert.match(contentSource, /environmentCandidates\.length > 1/);
  assert.match(contentSource, /found \$\{environmentCandidates\.length\} matching environment choices/);
});

test("Codex submission requires a concrete task URL before reporting success", () => {
  const submitStart = contentSource.indexOf("async function submitCodexPrompt");
  const submitEnd = contentSource.indexOf("async function ensureCodexRepositoryContext");
  const submit = contentSource.slice(submitStart, submitEnd);

  assert.match(submit, /const beforeTaskUrls = findCodexTaskLinks\(\)/);
  assert.match(
    submit,
    /submitButton\.click\(\)[\s\S]*await waitForCodexSubmission\(\{ beforeTaskUrls \}\)[\s\S]*scheduleCodexTaskNavigation\(taskUrl\)/,
  );

  const waitStart = contentSource.indexOf("async function waitForCodexSubmission");
  const waitEnd = contentSource.indexOf("function findCodexPromptInput");
  const wait = contentSource.slice(waitStart, waitEnd);

  assert.match(wait, /canonicalCodexTaskUrl\(location\.href\)/);
  assert.match(wait, /findCodexTaskLinks\(\)\.filter/);
  assert.match(wait, /new concrete task URLs/);
  assert.match(wait, /not confirmed with a concrete task URL/);
  assert.doesNotMatch(wait, /return location\.href/);
});

test("Codex concrete task discovery is same-origin, semantic, and schedules task-page navigation", () => {
  assert.match(contentSource, /a\[href\*="\/codex\/cloud\/tasks\/"\]/);
  assert.match(contentSource, /url\.origin !== location\.origin/);
  assert.match(contentSource, /\^\\\/codex\\\/cloud\\\/tasks\\\//);
  assert.match(contentSource, /function scheduleCodexTaskNavigation\(taskUrl\)/);
  assert.match(contentSource, /location\.assign\(taskUrl\)/);
});
