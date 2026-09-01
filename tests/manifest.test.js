import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"));

test("extension manifest uses Manifest V3 and minimal declared permissions", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["tabs", "storage"]);
});

test("loopback host permission is port-agnostic and does not authorize arbitrary hosts", () => {
  assert.ok(manifest.host_permissions.includes("http://127.0.0.1/*"));
  assert.ok(!manifest.host_permissions.some((value) => /127\.0\.0\.1:\d+/.test(value)));
  assert.ok(!manifest.host_permissions.includes("http://*/*"));
  assert.ok(!manifest.host_permissions.includes("https://*/*"));
});

test("provider page access remains explicitly scoped", () => {
  assert.ok(manifest.host_permissions.includes("https://chatgpt.com/*"));
  assert.deepEqual(manifest.content_scripts.map((script) => script.matches), [["https://chatgpt.com/*"]]);
});
