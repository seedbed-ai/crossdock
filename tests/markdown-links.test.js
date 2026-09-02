import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  extractLocalMarkdownTargets,
  findBrokenMarkdownLinks,
} from "../scripts/check-markdown-links.js";

async function fixture(files, run) {
  const root = await mkdtemp(path.join(os.tmpdir(), "crossdock-links-"));
  try {
    for (const [name, content] of Object.entries(files)) {
      const filename = path.join(root, name);
      await mkdir(path.dirname(filename), { recursive: true });
      await writeFile(filename, content);
    }
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("extracts repository-local links and ignores external or fragment-only links", () => {
  assert.deepEqual(
    extractLocalMarkdownTargets([
      "[root](README.md)",
      "[nested](docs/guide.md#setup)",
      "[web](https://example.com/path)",
      "[mail](mailto:test@example.com)",
      "[fragment](#local-heading)",
    ].join("\n")),
    ["README.md", "docs/guide.md"],
  );
});

test("resolves links relative to nested Markdown files and strips fragments", async () => {
  await fixture({
    "README.md": "[guide](docs/guide.md#setup)\n",
    "docs/guide.md": "[parent](../README.md) [peer](reference.md#api)\n",
    "docs/reference.md": "# API\n",
  }, async (root) => {
    assert.deepEqual(await findBrokenMarkdownLinks(root), []);
  });
});

test("reports missing targets with source and resolved path", async () => {
  await fixture({
    "docs/guide.md": "[missing](../missing.md#section)\n",
  }, async (root) => {
    assert.deepEqual(await findBrokenMarkdownLinks(root), [{
      source: path.join("docs", "guide.md"),
      target: "../missing.md",
      resolved: "missing.md",
    }]);
  });
});

test("does not crawl external links", async () => {
  await fixture({
    "README.md": "[web](https://example.invalid/no-network) [protocol](custom:thing)\n",
  }, async (root) => {
    assert.deepEqual(await findBrokenMarkdownLinks(root), []);
  });
});
