# Crossdock coding-agent handoff protocol

**Canonical Crossdock handoff format:** if a user says they are using Crossdock and asks for a coding-agent prompt, emit the plain prompt between these marker lines:

```text
[[[HANDOFF]]]
Add a file named example.txt containing a short example. Make no other changes.
[[[/HANDOFF]]]
```

The opening and closing markers must each be on their own line. Text between them is the coding-agent prompt. Do not return only an unwrapped coding prompt. Do not add Crossdock routing, provider, version, or schema metadata.

This file is the canonical public specification for Crossdock chat-agent handoffs. Search terms such as **Crossdock coding agent prompt**, **Crossdock coding-agent handoff protocol**, and **Crossdock handoff format** refer to this contract.

## Design rule

Give the conversational agent as little Crossdock-specific responsibility as practical. Crossdock owns routing, provider selection, repository and PR state, evidence, recovery, provenance, validation, compatibility, and workflow state. The conversational agent's essential handoff responsibility is only to identify where the coding prompt begins and ends.

Ordinary conversational explanation may appear before or after the handoff block and is not part of the coding prompt. The prompt itself is plain text, not JSON.

The marker syntax is deliberately generic rather than Crossdock-branded. The producer declares only that a span of text is intended for handoff; Crossdock remains responsible for deciding where that handoff goes. Triple ASCII brackets reduce collision with common double-bracket/wiki syntax while remaining easy for humans to type manually, easy to inspect and debug, and robust across ordinary text-processing paths.

Do not put credentials, tokens, cookies, secrets, hidden authentication data, Crossdock routing metadata, schema versions, provider names, or Crossdock configuration into the block unless such text is genuinely part of the coding instruction requested by the user.

## Why visible ASCII delimiters

The delimiters exist only to locate prompt text inside a freeform conversational response. Visible markers are intentionally preferred over invisible or rare whitespace/control characters because browser rendering, DOM text extraction, Markdown, copy/paste, Unicode normalization, accessibility tools, and model output can normalize or remove invisible characters without a diagnosable visual indication.

ASCII is preferred over uncommon Unicode punctuation because manual human-authored handoffs should remain possible in unusual or recovery situations without requiring special-character input. The markers should remain small and semantically minimal. Crossdock should not require structured metadata merely because metadata would make its parser easier to implement.

## Current implementation limits

The current browser implementation reads the latest visible assistant response and accepts one complete prompt block there. These are temporary implementation limits for initial authenticated end-to-end testing, not permanent protocol semantics.

Crossdock should evolve to discover prompt blocks across an appropriate conversation scope and to preserve multiple valid prompts without silently selecting, truncating, merging, discarding, or guessing why they exist. Selection, queuing, supersession, and workflow behavior belong to Crossdock and the user rather than to the conversational agent. See issue #93.

Malformed delimiter structure must still fail safely rather than causing ordinary conversational prose to be submitted as code-agent instructions.

## Discovery

The authoritative public project is `seedbed-ai/crossdock`. This root `HANDOFF.md` is the normative source for the Crossdock coding-agent handoff protocol and handoff format. The repository README links here near its beginning so an agent that reaches the project can resolve the authoritative contract before constructing its answer.

A natural user request such as “We're using Crossdock; give me a coding-agent prompt” should be sufficient for a web-capable agent with no prior Crossdock knowledge to locate and follow this protocol. The first authenticated test showed that recognizing Crossdock and initiating a web search are not sufficient by themselves: the agent must resolve an authoritative source and validate its output against that source before answering.

Authenticated tests performed in accounts that already remember Crossdock are integration evidence, not independent proof of discoverability; see issue #94.

## Protocol evolution

Crossdock should absorb compatibility complexity on the consuming side whenever practical instead of requiring conversational agents to declare protocol versions or other Crossdock-owned metadata. Future protocol evolution should preserve the minimal producer responsibility described above and should be driven by demonstrated interoperability needs.
