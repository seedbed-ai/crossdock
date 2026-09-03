import test from "node:test";
import assert from "node:assert/strict";
import {
  CROSSDOCK_HANDOFF_BEGIN,
  CROSSDOCK_HANDOFF_END,
  extractCrossdockHandoff,
} from "../extension/chat-agent-handoff.js";

function envelope(payload, before = "", after = "") {
  return [before, CROSSDOCK_HANDOFF_BEGIN, JSON.stringify(payload), CROSSDOCK_HANDOFF_END, after]
    .filter((value) => value !== "")
    .join("\n");
}

const valid = {
  crossdock: "handoff",
  version: 1,
  agent: "codex",
  prompt: "Add example.txt and make no other changes.",
};

test("extracts one declared Codex prompt while ignoring surrounding prose", () => {
  assert.deepEqual(
    extractCrossdockHandoff(envelope(valid, "Here is the requested Crossdock handoff.", "I can also explain the prompt.")),
    { version: 1, agent: "codex", prompt: valid.prompt },
  );
});

test("preserves prompt bytes represented by the JSON string", () => {
  const prompt = "Line one.\n\nLine two with  spacing.";
  assert.equal(extractCrossdockHandoff(envelope({ ...valid, prompt })).prompt, prompt);
});

test("fails closed when ordinary assistant prose has no handoff envelope", () => {
  assert.throws(
    () => extractCrossdockHandoff("Created the requested file and made no other changes."),
    /exactly one valid Crossdock handoff v1 envelope/,
  );
});

test("fails closed for duplicate or reversed markers", () => {
  assert.throws(
    () => extractCrossdockHandoff(`${envelope(valid)}\n${envelope(valid)}`),
    /exactly one valid Crossdock handoff v1 envelope/,
  );
  assert.throws(
    () => extractCrossdockHandoff(`${CROSSDOCK_HANDOFF_END}\n${JSON.stringify(valid)}\n${CROSSDOCK_HANDOFF_BEGIN}`),
    /exactly one valid Crossdock handoff v1 envelope/,
  );
});

test("fails closed for malformed JSON", () => {
  assert.throws(
    () => extractCrossdockHandoff(`${CROSSDOCK_HANDOFF_BEGIN}\n{not json}\n${CROSSDOCK_HANDOFF_END}`),
    /must be valid JSON/,
  );
});

test("requires exact v1 fields and supported values", () => {
  assert.throws(() => extractCrossdockHandoff(envelope({ ...valid, extra: true })), /fields must be exactly/);
  assert.throws(() => extractCrossdockHandoff(envelope({ ...valid, version: 2 })), /unsupported Crossdock handoff version/);
  assert.throws(() => extractCrossdockHandoff(envelope({ ...valid, agent: "other" })), /unsupported Crossdock handoff agent/);
  assert.throws(() => extractCrossdockHandoff(envelope({ ...valid, prompt: "   " })), /non-empty string/);
});
