import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contentSource = await readFile(new URL("../extension/content.js", import.meta.url), "utf8");
const backgroundSource = await readFile(new URL("../extension/background.js", import.meta.url), "utf8");

test("background passes configured target repository into Codex submission", () => {
  assert.match(backgroundSource, /chrome\.storage\.local\.get\("dashboard"\)/);
  assert.match(backgroundSource, /targetRepository/);
  assert.match(backgroundSource, /crossdock\.submitCodex[\s\S]*targetRepository/);
});

test("Codex submission resolves repository context before writing or clicking", () => {
  const start = contentSource.indexOf("async function submitCodexPrompt");
  const end = contentSource.indexOf("async function ensureCodexRepositoryContext");
  const submit = contentSource.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.ok(submit.indexOf("await ensureCodexRepositoryContext(targetRepository)") < submit.indexOf("setEditableValue(input, prompt)"));
  assert.ok(submit.indexOf("await ensureCodexRepositoryContext(targetRepository)") < submit.indexOf("findCodexSubmitButton(true).click()"));
});

test("repository selection uses authenticated Codex semantic controls and exact repository text", () => {
  assert.match(contentSource, /View all code environments/);
  assert.match(contentSource, /waitForControlledDialog/);
  assert.match(contentSource, /visibleText\(node\) === targetRepository/);
  assert.match(contentSource, /repository is not visible in the environment chooser/);
  assert.match(contentSource, /found \$\{candidates\.length\} exact repository choices/);
});

test("repository selection is confirmed before the old fail-closed assertion returns", () => {
  assert.match(contentSource, /visibleText\(selector\) === targetRepository/);
  assert.match(contentSource, /Codex repository selection was not confirmed/);
  assert.match(contentSource, /selected provider context/);
});
