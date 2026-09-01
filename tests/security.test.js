import test from "node:test";
import assert from "node:assert/strict";
import { assertGithubSafe } from "../src/security.js";

test("ordinary GitHub-bound content passes safety preflight", () => {
  assert.doesNotThrow(() => assertGithubSafe("Normal pull request summary.\n", "pull request body"));
});

test("common secret-like GitHub-bound content fails closed", () => {
  assert.throws(
    () => assertGithubSafe("access_token=ghp_abcdefghijklmnopqrstuvwxyz123456", "pull request body"),
    /Forbidden-from-GitHub/,
  );
});

test("safety preflight normalizes CRLF without mutating the returned value", () => {
  const value = "line one\r\nline two\r\n";
  assert.equal(assertGithubSafe(value), value);
});