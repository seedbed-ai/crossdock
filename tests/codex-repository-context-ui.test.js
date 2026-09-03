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

test("Codex submission validates repository context before writing or clicking", () => {
  const start = contentSource.indexOf("async function submitCodexPrompt");
  const end = contentSource.indexOf("async function waitForCodexSubmission");
  const submit = contentSource.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.ok(submit.indexOf("assertCodexRepositoryContext(targetRepository)") < submit.indexOf("setEditableValue(input, prompt)"));
  assert.ok(submit.indexOf("assertCodexRepositoryContext(targetRepository)") < submit.indexOf("findCodexSubmitButton(true).click()"));
});

test("repository context mismatch and ambiguity fail closed", () => {
  assert.match(contentSource, /Codex repository context does not match target/);
  assert.match(contentSource, /Codex repository context is ambiguous/);
  assert.match(contentSource, /data-testid\*=\\?"repository\\?"/);
  assert.match(contentSource, /aria-label\*=\\?"repository\\?" i/);
});
