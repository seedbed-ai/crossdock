import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../extension/dashboard.js", import.meta.url), "utf8");

test("dashboard does not hard-code service requests to the historical port", () => {
  assert.ok(!source.includes('fetch(`http://127.0.0.1:3210'));
  assert.match(source, /fetch\(`\$\{serviceUrl\}\$\{path\}`/);
});

test("active task state freezes the resolved service URL", () => {
  assert.match(source, /service_url: serviceUrl/);
  assert.match(source, /taskState\?\.service_url \?\? requireServiceUrl\(\)/);
});

test("legacy active tasks migrate to the deterministic historical endpoint", () => {
  assert.match(source, /if \(!taskState\.service_url\)/);
  assert.match(source, /taskState\.service_url = DEFAULT_SERVICE_URL/);
});

test("dashboard requires an explicit numeric loopback port", () => {
  assert.match(source, /if \(!url\.port\) throw new Error\("Crossdock service URL must include an explicit port"\)/);
  assert.match(source, /url\.hostname !== "127\.0\.0\.1"/);
});
