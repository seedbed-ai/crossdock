import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../extension/content.js", import.meta.url), "utf8");

test("Codex report capture preserves semantic selectors and has a heading-anchored fallback", () => {
  assert.match(source, /codex-task-report/);
  assert.match(source, /final-report/);
  assert.match(source, /task-report/);
  assert.match(source, /data-message-author-role=\\?"assistant\\?"/);

  assert.match(source, /findHeadingAnchoredCodexReports/);
  assert.match(source, /h1, h2, h3, h4, h5, h6, \[role=\\?"heading\\?"\]/);
  assert.match(source, /=== "Summary"/);
  assert.match(source, /line === "Testing"/);
});

test("Codex report fallback remains fail-closed and does not capture arbitrary page text", () => {
  assert.match(source, /structuredCandidates\.length !== 1/);
  assert.match(source, /unable to identify the complete Codex report from known semantic structure/);
  assert.doesNotMatch(source, /document\.body\.innerText/);
  assert.doesNotMatch(source, /document\.documentElement\.innerText/);
});

test("Finalize captures report before invoking Create PR", () => {
  const prepareStart = source.indexOf("function prepareCreatePr");
  const prepareEnd = source.indexOf("function prepareBranchUpdate");
  const prepare = source.slice(prepareStart, prepareEnd);
  assert.ok(prepareStart >= 0 && prepareEnd > prepareStart);
  assert.ok(prepare.indexOf("captureCodexReport()") < prepare.indexOf('findButton(["Create PR"], true).click()'));
});
