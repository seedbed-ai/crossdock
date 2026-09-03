export const CROSSDOCK_HANDOFF_VERSION = 1;
export const CROSSDOCK_HANDOFF_BEGIN = "<<<CROSSDOCK_HANDOFF_V1>>>";
export const CROSSDOCK_HANDOFF_END = "<<<END_CROSSDOCK_HANDOFF_V1>>>";

export function extractCrossdockHandoff(assistantResponse) {
  if (typeof assistantResponse !== "string" || !assistantResponse.trim()) {
    throw new Error("ChatGPT assistant response is empty");
  }

  const lines = assistantResponse.replace(/\r\n?/g, "\n").split("\n");
  const starts = markerIndexes(lines, CROSSDOCK_HANDOFF_BEGIN);
  const ends = markerIndexes(lines, CROSSDOCK_HANDOFF_END);

  if (starts.length !== 1 || ends.length !== 1 || ends[0] <= starts[0]) {
    throw new Error("latest ChatGPT assistant response must contain exactly one valid Crossdock handoff v1 envelope");
  }

  const payloadText = lines.slice(starts[0] + 1, ends[0]).join("\n").trim();
  if (!payloadText) throw new Error("Crossdock handoff payload is empty");

  let payload;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    throw new Error("Crossdock handoff payload must be valid JSON");
  }

  assertExactKeys(payload, ["agent", "crossdock", "prompt", "version"]);
  if (payload.crossdock !== "handoff") throw new Error('Crossdock handoff field "crossdock" must equal "handoff"');
  if (payload.version !== CROSSDOCK_HANDOFF_VERSION) throw new Error(`unsupported Crossdock handoff version: ${String(payload.version)}`);
  if (payload.agent !== "codex") throw new Error(`unsupported Crossdock handoff agent: ${String(payload.agent)}`);
  if (typeof payload.prompt !== "string" || !payload.prompt.trim()) throw new Error("Crossdock handoff prompt must be a non-empty string");

  return Object.freeze({ version: payload.version, agent: payload.agent, prompt: payload.prompt });
}

function markerIndexes(lines, marker) {
  const indexes = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() === marker) indexes.push(index);
  }
  return indexes;
}

function assertExactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Crossdock handoff payload must be a JSON object");
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`Crossdock handoff payload fields must be exactly: ${wanted.join(", ")}`);
  }
}
