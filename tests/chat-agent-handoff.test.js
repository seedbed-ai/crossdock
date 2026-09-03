import test from "node:test";
import assert from "node:assert/strict";
import {
  CROSSDOCK_HANDOFF_BEGIN,
  CROSSDOCK_HANDOFF_END,
  extractCrossdockHandoff,
} from "../extension/chat-agent-handoff.js";

function block(prompt, before = "", after = "") {
  return [before, CROSSDOCK_HANDOFF_BEGIN, prompt, CROSSDOCK_HANDOFF_END, after]
    .filter((value) => value !== "")
    .join("\n");
}

const prompt = "Add example.txt and make no other changes.";

test("extracts prompt text while ignoring surrounding conversation", () => {
  assert.deepEqual(
    extractCrossdockHandoff(block(prompt, "Here is the requested prompt.", "I can explain it if useful.")),
    { prompt },
  );
});

test("preserves multiline prompt content without JSON encoding", () => {
  const multiline = "Line one.\n\nLine two with  spacing.";
  assert.equal(extractCrossdockHandoff(block(multiline)).prompt, multiline);
});

test("fails closed when ordinary assistant prose has no prompt block", () => {
  assert.throws(
    () => extractCrossdockHandoff("Created the requested file and made no other changes."),
    /exactly one complete Crossdock prompt block/,
  );
});

test("current implementation fails closed for duplicate or reversed markers", () => {
  assert.throws(
    () => extractCrossdockHandoff(`${block(prompt)}\n${block("Second prompt")}`),
    /exactly one complete Crossdock prompt block/,
  );
  assert.throws(
    () => extractCrossdockHandoff(`${CROSSDOCK_HANDOFF_END}\n${prompt}\n${CROSSDOCK_HANDOFF_BEGIN}`),
    /exactly one complete Crossdock prompt block/,
  );
});

test("requires non-empty prompt text", () => {
  assert.throws(() => extractCrossdockHandoff(block("   ")), /prompt block is empty/);
});

test("JSON-looking prompt text is treated as ordinary prompt content", () => {
  const jsonLooking = '{"command":"do work","version":99}';
  assert.equal(extractCrossdockHandoff(block(jsonLooking)).prompt, jsonLooking);
});
