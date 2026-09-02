import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../extension/dashboard.html", import.meta.url), "utf8");
const css = await readFile(new URL("../extension/dashboard.css", import.meta.url), "utf8");

test("dashboard exposes basic document and live-region semantics", () => {
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<meta name="viewport" content="width=device-width,initial-scale=1">/);
  assert.match(html, /id="status" role="status" aria-live="polite"/);
  assert.match(html, /<nav class="surfaces" aria-label="Connected work surfaces">/);
  assert.match(html, /<section class="grid" aria-label="Task setup">/);
  assert.match(html, /<section class="actions" aria-label="Task actions">/);
});

test("dashboard keeps form controls programmatically labeled", () => {
  for (const id of [
    "repository", "issue", "pull-request", "handoff-mode", "work-intent", "service-url", "storage-repository", "storage-branch",
    "prompt-evidence", "report-evidence", "prompt-recovery", "report-recovery", "change-description-publication",
    "change-comment-publication", "summary", "validation", "prompt",
    "committed-file-publication", "committed-file-repository", "committed-file-branch", "committed-file-path-template",
  ]) {
    assert.match(html, new RegExp(`<label[^>]*>[\\s\\S]*?(?:<input|<select|<textarea) id="${id}"`), `${id} should remain inside a label`);
  }
  assert.match(html, /id="work-intent" aria-describedby="work-intent-help"/);
  assert.match(html, /id="work-intent-help"/);
});

test("dashboard CSS preserves focus, target-size, reflow, and reduced-motion guardrails", () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /outline: 3px solid currentColor/);
  assert.match(css, /button, input, select \{ min-height: 44px; \}/);
  assert.match(css, /@media \(max-width: 430px\)/);
  assert.match(css, /min-height: 48px/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /grid-template-columns: 1fr/);
});
