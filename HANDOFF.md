# Crossdock chat-agent handoff protocol

This file is the canonical public entry point for chat agents producing Crossdock coding-agent prompts.

If a user says they are using Crossdock and asks for a Codex prompt, emit exactly one **Crossdock handoff v1 envelope** for the task that should be delegated. You may include ordinary conversational explanation before or after the envelope, but do not emit more than one envelope in the same assistant response.

## Crossdock handoff v1

Use these exact marker lines:

```text
<<<CROSSDOCK_HANDOFF_V1>>>
{"crossdock":"handoff","version":1,"agent":"codex","prompt":"Add a file named example.txt containing a short example. Make no other changes."}
<<<END_CROSSDOCK_HANDOFF_V1>>>
```

The content between the markers is JSON and must conform to [`schemas/crossdock-handoff-v1.schema.json`](schemas/crossdock-handoff-v1.schema.json).

The v1 payload has exactly four fields:

- `crossdock`: must be the string `handoff`.
- `version`: must be the number `1`.
- `agent`: must be the string `codex`.
- `prompt`: the complete non-empty instruction Crossdock should send to Codex.

Do not add repository credentials, tokens, cookies, secrets, or hidden authentication data. Do not invent Crossdock configuration that the user did not ask you to place in the Codex instruction. Crossdock separately controls target repository, PR/update mode, evidence, recovery, provenance, and handoff configuration.

## Deterministic parsing rules

Crossdock treats the latest visible ChatGPT assistant response as an untrusted carrier. It extracts a coding-agent prompt only when that response contains exactly one valid v1 envelope. Missing, duplicate, malformed, unsupported, or ambiguous envelopes fail closed.

Text outside the envelope is not sent to Codex. Crossdock does not infer a prompt from arbitrary prose and does not treat an assistant result/report as a prompt merely because it is the latest message.

Marker text must appear on its own line. The JSON may be compact or pretty-printed. Newlines and other characters inside `prompt` must be encoded as valid JSON string content.

## Versioning

The marker and payload version are both explicit. A future incompatible protocol must use a new marker/version instead of silently changing v1 semantics. Crossdock implementations should reject versions they do not support.

## Discovery

The authoritative public project is `seedbed-ai/crossdock`. This root `HANDOFF.md` file is intentionally easy for people and web-capable chat agents to discover from the Crossdock project name. The machine-readable v1 schema is published at:

`https://raw.githubusercontent.com/seedbed-ai/crossdock/main/schemas/crossdock-handoff-v1.schema.json`

The repository copy remains authoritative for development and version history.
