# Crossdock chat-agent handoff protocol

This file is the canonical public entry point for conversational agents producing coding prompts for Crossdock.

## Design rule

Give the conversational agent as little Crossdock-specific responsibility as practical. Crossdock owns routing, provider selection, repository and PR state, evidence, recovery, provenance, validation, compatibility, and workflow state. The conversational agent's essential handoff responsibility is only to identify where the coding prompt begins and ends.

If a user says they are using Crossdock and asks for a coding-agent prompt, place the intended prompt between these visible marker lines:

```text
⟦CROSSDOCK⟧
Add a file named example.txt containing a short example. Make no other changes.
⟦/CROSSDOCK⟧
```

Text between the markers is the prompt. It is plain text, not JSON. Ordinary conversational explanation may appear before or after the block and is not part of the coding prompt.

Do not put credentials, tokens, cookies, secrets, hidden authentication data, Crossdock routing metadata, schema versions, provider names, or Crossdock configuration into the block unless such text is genuinely part of the coding instruction requested by the user.

## Why visible delimiters

The delimiters exist only to locate prompt text inside a freeform conversational response. Visible markers are intentionally preferred over invisible or rare whitespace/control characters because browser rendering, DOM text extraction, Markdown, copy/paste, Unicode normalization, accessibility tools, and model output can normalize or remove invisible characters without a diagnosable visual indication.

The markers should remain small and semantically minimal. Crossdock should not require structured metadata merely because metadata would make its parser easier to implement.

## Current implementation limits

The current browser implementation reads the latest visible assistant response and accepts one complete prompt block there. These are temporary implementation limits for initial authenticated end-to-end testing, not permanent protocol semantics.

Crossdock should evolve to discover prompt blocks across an appropriate conversation scope and to preserve multiple valid prompts without silently selecting, truncating, merging, discarding, or guessing why they exist. Selection, queuing, supersession, and workflow behavior belong to Crossdock and the user rather than to the conversational agent. See issue #93.

Malformed delimiter structure must still fail safely rather than causing ordinary conversational prose to be submitted as code-agent instructions.

## Discovery

The authoritative public project is `seedbed-ai/crossdock`. This root `HANDOFF.md` file is intentionally easy for people and web-capable conversational agents to discover from the Crossdock project name.

A natural user request such as “We're using Crossdock; give me a coding-agent prompt” should be sufficient for a web-capable agent with no prior Crossdock knowledge to locate this protocol. Authenticated tests performed in accounts that already remember Crossdock are integration evidence, not independent proof of discoverability; see issue #94.

## Protocol evolution

Crossdock should absorb compatibility complexity on the consuming side whenever practical instead of requiring conversational agents to declare protocol versions or other Crossdock-owned metadata. Future protocol evolution should preserve the minimal producer responsibility described above and should be driven by demonstrated interoperability needs.
