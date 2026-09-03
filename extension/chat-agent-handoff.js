export const CROSSDOCK_HANDOFF_BEGIN = "[[[HANDOFF]]]";
export const CROSSDOCK_HANDOFF_END = "[[[/HANDOFF]]]";

export function extractCrossdockHandoff(assistantResponse) {
  if (typeof assistantResponse !== "string" || !assistantResponse.trim()) {
    throw new Error("ChatGPT assistant response is empty");
  }

  const lines = assistantResponse.replace(/\r\n?/g, "\n").split("\n");
  const starts = markerIndexes(lines, CROSSDOCK_HANDOFF_BEGIN);
  const ends = markerIndexes(lines, CROSSDOCK_HANDOFF_END);

  // Single-block/latest-response capture is a temporary implementation limit,
  // not a protocol rule. See the public handoff documentation and issue #93.
  if (starts.length !== 1 || ends.length !== 1 || ends[0] <= starts[0]) {
    throw new Error("latest ChatGPT assistant response must contain exactly one complete handoff prompt block");
  }

  const prompt = lines.slice(starts[0] + 1, ends[0]).join("\n").trim();
  if (!prompt) throw new Error("Handoff prompt block is empty");

  return Object.freeze({ prompt });
}

function markerIndexes(lines, marker) {
  const indexes = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() === marker) indexes.push(index);
  }
  return indexes;
}
