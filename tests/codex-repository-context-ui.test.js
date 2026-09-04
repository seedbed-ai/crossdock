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

test("Codex submission resolves repository and branch context before writing or clicking", () => {
  const start = contentSource.indexOf("async function submitCodexPrompt");
  const end = contentSource.indexOf("async function ensureCodexRepositoryContext");
  const submit = contentSource.slice(start, end);
  assert.ok(start >= 0 && end > start);
  const repositoryResolution = submit.indexOf("await ensureCodexRepositoryContext(targetRepository)");
  const branchResolution = submit.indexOf("await ensureCodexBranchContext(targetBranch)");
  const promptWrite = submit.indexOf("setEditableValue(input, prompt)");
  const submitClick = submit.indexOf("findCodexSubmitButton(true).click()");
  assert.ok(repositoryResolution >= 0 && repositoryResolution < branchResolution);
  assert.ok(branchResolution < promptWrite);
  assert.ok(branchResolution < submitClick);
});

test("repository selection uses authenticated Codex semantic controls and exact repository text", () => {
  assert.match(contentSource, /View all code environments/);
  assert.match(contentSource, /waitForControlledDialog/);
  assert.match(contentSource, /exactVisibleButtonChoices\(dialog, targetRepository\)/);
  assert.match(contentSource, /repository is not visible in the environment chooser/);
  assert.match(contentSource, /exact repository choices/);
});

test("repository confirmation re-resolves the live semantic selector after selection", () => {
  const start = contentSource.indexOf("async function ensureCodexRepositoryContext");
  const end = contentSource.indexOf("async function ensureCodexBranchContext");
  const repositorySelection = contentSource.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(repositorySelection, /candidates\[0\]\.click\(\);[\s\S]*await waitFor\(\(\) => \{[\s\S]*const currentSelector = findUniqueSemanticButton\("View all code environments"\)/);
  assert.match(repositorySelection, /visibleText\(currentSelector\) === targetRepository/);
  assert.match(repositorySelection, /currentSelector\.getAttribute\("aria-expanded"\) !== "true"/);
  assert.doesNotMatch(repositorySelection, /await waitFor\(\(\) => visibleText\(selector\) === targetRepository/);
});

test("repository confirmation allows authenticated slow provider transitions to settle", () => {
  const start = contentSource.indexOf("async function ensureCodexRepositoryContext");
  const end = contentSource.indexOf("async function ensureCodexBranchContext");
  const repositorySelection = contentSource.slice(start, end);
  assert.match(contentSource, /const CODEX_CONTEXT_SELECTION_TIMEOUT_MS = 20_000;/);
  assert.match(repositorySelection, /CODEX_CONTEXT_SELECTION_TIMEOUT_MS/);
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

test("branch confirmation uses the same slow-transition timeout", () => {
  const start = contentSource.indexOf("async function ensureCodexBranchContext");
  const end = contentSource.indexOf("function assertCodexRepositoryContext");
  const branchSelection = contentSource.slice(start, end);
  assert.match(branchSelection, /CODEX_CONTEXT_SELECTION_TIMEOUT_MS/);
  assert.doesNotMatch(branchSelection, /\}, 5_000, `Codex branch selection was not confirmed/);
});

test("provider context is returned with exact repository and frozen base branch", () => {
  assert.match(contentSource, /providerContext: \{ repository: targetRepository, base_branch: targetBranch \}/);
  assert.match(backgroundSource, /providerContext: \{ repository: targetRepository, base_branch: targetBranch \}/);
});
