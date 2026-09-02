import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CODEX_BROWSER_CAPABILITIES } from "../src/adapters/codex/browser-capabilities.js";
import { WORK_ITEM_INTENTS } from "../src/agent-capabilities.js";
import { DEFAULT_BROWSER_INTENT, normalizeBrowserIntent } from "../extension/intent-client.js";

const html = await readFile(new URL("../extension/dashboard.html", import.meta.url), "utf8");
const workIntentMarkup = html.match(/<select id="work-intent"[\s\S]*?<\/select>/)?.[0] ?? "";

function optionFor(intent) {
  const match = workIntentMarkup.match(new RegExp(`<option value="${intent}"([^>]*)>([^<]+)<\\/option>`));
  assert.ok(match, `dashboard should expose work intent ${intent}`);
  return { attributes: match[1], label: match[2] };
}

test("browser work-intent UI reflects canonical Codex browser capabilities", () => {
  assert.ok(workIntentMarkup, "dashboard should expose a work-intent selector");
  assert.deepEqual(Object.keys(CODEX_BROWSER_CAPABILITIES.intents), ["implement"]);
  assert.equal(CODEX_BROWSER_CAPABILITIES.intents.implement.status, "experimental");
  assert.equal(DEFAULT_BROWSER_INTENT, "implement");
  assert.deepEqual(Object.keys(CODEX_BROWSER_CAPABILITIES.intents), [DEFAULT_BROWSER_INTENT]);

  for (const intent of WORK_ITEM_INTENTS) {
    const option = optionFor(intent);
    const support = CODEX_BROWSER_CAPABILITIES.intents[intent] ?? null;
    if (support) {
      assert.equal(normalizeBrowserIntent(intent), intent);
      assert.doesNotMatch(option.attributes, /\bdisabled\b/);
      assert.match(option.label.toLowerCase(), new RegExp(support.status));
    } else {
      assert.throws(() => normalizeBrowserIntent(intent), /unsupported/);
      assert.match(option.attributes, /\bdisabled\b/);
      assert.match(option.label.toLowerCase(), /unsupported/);
    }
  }
});

test("browser work-intent UI defaults to implementation", () => {
  assert.equal(optionFor("implement").attributes.trim(), "");
  assert.equal(workIntentMarkup.match(/<option value="implement"/g)?.length, 1);
});

test("browser describes experimental capability status without claiming verification", () => {
  assert.match(html, /current Codex browser adapter only advertises implementation/);
  assert.match(html, /remains experimental until authenticated compatibility testing verifies it/);
  assert.doesNotMatch(html, /Implementation — verified/);
});
