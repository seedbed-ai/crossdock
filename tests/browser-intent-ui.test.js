import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CODEX_BROWSER_CAPABILITIES } from "../src/adapters/codex/browser-capabilities.js";
import { WORK_ITEM_INTENTS } from "../src/agent-capabilities.js";

const html = await readFile(new URL("../extension/dashboard.html", import.meta.url), "utf8");

function optionFor(intent) {
  const match = html.match(new RegExp(`<option value="${intent}"([^>]*)>([^<]+)<\\/option>`));
  assert.ok(match, `dashboard should expose work intent ${intent}`);
  return { attributes: match[1], label: match[2] };
}

test("browser work-intent UI reflects canonical Codex browser capabilities", () => {
  assert.deepEqual(Object.keys(CODEX_BROWSER_CAPABILITIES.intents), ["implement"]);
  assert.equal(CODEX_BROWSER_CAPABILITIES.intents.implement.status, "experimental");

  for (const intent of WORK_ITEM_INTENTS) {
    const option = optionFor(intent);
    const support = CODEX_BROWSER_CAPABILITIES.intents[intent] ?? null;
    if (support) {
      assert.doesNotMatch(option.attributes, /\bdisabled\b/);
      assert.match(option.label.toLowerCase(), new RegExp(support.status));
    } else {
      assert.match(option.attributes, /\bdisabled\b/);
      assert.match(option.label.toLowerCase(), /unsupported/);
    }
  }
});

test("browser describes experimental capability status without claiming verification", () => {
  assert.match(html, /current Codex browser adapter only advertises implementation/);
  assert.match(html, /remains experimental until authenticated compatibility testing verifies it/);
  assert.doesNotMatch(html, /Implementation — verified/);
});
