import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalGitHubPrUrl,
  classifyNewPrUrls,
  repositoryFromGitHubPrUrl,
} from "../extension/pr-discovery.js";

test("canonical GitHub PR URLs strip query and fragment", () => {
  assert.equal(
    canonicalGitHubPrUrl("https://github.com/owner/repo/pull/12?foo=bar#discussion"),
    "https://github.com/owner/repo/pull/12",
  );
  assert.equal(repositoryFromGitHubPrUrl("https://github.com/owner/repo/pull/12"), "owner/repo");
});

test("PR classification separates target and wrong-repository evidence", () => {
  const result = classifyNewPrUrls({
    before: [
      "https://github.com/owner/target/pull/1",
      "https://github.com/owner/other/pull/2",
    ],
    current: [
      "https://github.com/owner/target/pull/1",
      "https://github.com/owner/other/pull/2",
      "https://github.com/owner/target/pull/3",
      "https://github.com/owner/wrong/pull/4",
    ],
    targetRepository: "owner/target",
  });
  assert.deepEqual(result.target, ["https://github.com/owner/target/pull/3"]);
  assert.deepEqual(result.wrongRepository, ["https://github.com/owner/wrong/pull/4"]);
});

test("pre-existing wrong-repository PR evidence is ignored", () => {
  const result = classifyNewPrUrls({
    before: ["https://github.com/owner/wrong/pull/4"],
    current: ["https://github.com/owner/wrong/pull/4"],
    targetRepository: "owner/target",
  });
  assert.deepEqual(result.target, []);
  assert.deepEqual(result.wrongRepository, []);
});

test("PR discovery rejects non-GitHub and non-PR URLs", () => {
  for (const value of [
    "https://example.com/owner/repo/pull/1",
    "https://github.com/owner/repo/issues/1",
    "https://github.com/owner/repo/pull/not-a-number",
  ]) assert.throws(() => canonicalGitHubPrUrl(value));
});
