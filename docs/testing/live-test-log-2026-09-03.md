# Authenticated handoff live-test log — 2026-09-03

This log records material observations and design decisions from the first authenticated ChatGPT → Crossdock boundary test. It is test evidence, not a claim of independent public discoverability.

## Environment and scope

- Windows EC2 test host with authenticated ChatGPT, Codex, and GitHub browser sessions.
- Crossdock extension loaded unpacked from the repository checkout.
- Crossdock loopback service remained on `http://127.0.0.1:3210`.
- Disposable intended target: `seedbed-ai/crossdock-live-target`.
- Private task-record repository: `seedbed-ai/crossdock-live-records`.
- The ChatGPT account already had substantial Crossdock context. Therefore this run can establish authenticated integration behavior but cannot establish that an uninformed chat agent discovers the public protocol independently. See #94.

## Initial capture failure

The first test asked ChatGPT directly to add `crossdock-live-test.txt`. ChatGPT acted on repository access instead of merely preparing a coding-agent prompt and created an unintended branch in `seedbed-ai/crossdock`. The branch was subsequently deleted by the tester.

Crossdock's original capture adapter selected the latest visible assistant response wholesale. It therefore captured an implementation/result message rather than a coding-agent instruction. No Crossdock task was created and the test was stopped rather than manually repairing the captured text.

This established that arbitrary latest-assistant prose is not a sufficient deterministic handoff boundary. See #89.

## First structured-envelope attempt

PR #91 introduced an explicitly versioned JSON envelope with begin/end marker lines. Its goal was to fail closed rather than infer a prompt from arbitrary prose.

During the next authenticated test, ChatGPT produced the semantic JSON object containing `crossdock`, `version`, `agent`, and `prompt`, but did not reproduce the required outer marker lines. Crossdock correctly rejected the response with:

`latest ChatGPT assistant response must contain exactly one valid Crossdock handoff v1 envelope`

This was useful interoperability evidence: the contract required the conversational agent to reproduce metadata and transport structure that were not necessary to the user's actual purpose.

## Extension reload observation

Immediately after reloading the unpacked extension, capture initially reported:

`Could not establish connection. Receiving end does not exist.`

Refreshing both the Crossdock dashboard and the existing ChatGPT tab caused the current content script to be injected, after which capture reached the parser. Test instructions should explicitly account for refreshing provider tabs after an unpacked extension reload when content scripts changed.

The dashboard retained the previously captured prompt text after a failed capture. This is consistent with capture assigning new prompt text only after a successful result, but the stale value can be confusing and should be considered in future UX/error-state work.

A visible NUL-like trailing character was also repeatedly observed after dashboard status messages, including connection and parser errors. Its source and significance were not established during this test and should be investigated separately rather than assumed to be part of the underlying error.

## Protocol design conclusions

The purpose of the conversational handoff syntax is to tell Crossdock where coding-prompt text begins and ends when that prompt is surrounded by ordinary conversational text.

The producer should not be made responsible for Crossdock-owned concerns merely because they simplify Crossdock's parser. In particular:

- a `crossdock: handoff` field duplicates what delimiters can establish;
- a producer-declared schema/protocol version is unnecessary if Crossdock can absorb compatibility on the consuming side;
- an `agent`/provider field violates routing separation of concerns when Crossdock owns destination selection;
- JSON encoding adds visible conversational intrusion and escaping/formatting burden when the payload is fundamentally plain prompt text.

The replacement contract is therefore a minimal generic visible delimiter pair:

```text
[[[HANDOFF]]]
plain coding-agent prompt text
[[[/HANDOFF]]]
```

The markers are deliberately not branded as Crossdock. The producer only declares a handoff boundary; Crossdock owns the downstream interpretation and routing. Triple brackets are preferred to common double-bracket/wiki syntax to reduce accidental collisions.

Visible delimiters are preferred to invisible whitespace/control characters because invisible characters may be normalized or removed by rendering, DOM extraction, Markdown, copy/paste, Unicode processing, accessibility tools, or model output without leaving a diagnosable visual indication. ASCII is preferred to uncommon Unicode punctuation so that a human can type a manual handoff in unusual or recovery situations without special-character input.

See #92 for the general producer-responsibility principle.

## Post-merge minimal-delimiter retry

After PR #95 merged the generic ASCII delimiter contract, the authenticated test was retried using a natural request equivalent to “We're using Crossdock. Give me the coding-agent prompt …”. ChatGPT produced semantically correct coding-agent prompt text but omitted both required handoff markers.

The first capture attempt after the extension reload again returned:

`Could not establish connection. Receiving end does not exist.`

The dashboard still displayed the much older successfully captured text. After force-refreshing the ChatGPT tab and refreshing Crossdock, capture reached the current parser and correctly failed closed with:

`latest ChatGPT assistant response must contain exactly one complete handoff prompt block`

No captured prompt was manually edited and no Codex task was created.

## Post-hoc agent interrogation

The same ChatGPT conversation was explicitly asked for a cautious post-hoc account of its discovery actions and why it omitted the markers. This evidence must be taken as agent-reported/reconstructed evidence rather than hidden execution telemetry.

The agent reported recoverable web searches for:

- `Crossdock coding agent prompt schema crossdock-live-test.txt seedbed-ai`
- `"Crossdock" "coding-agent" prompt schema`

It also reported a preserved browser/search summary saying `Searched 13 websites`. It could not establish that it opened the Crossdock repository, README, `HANDOFF.md`, or another canonical Crossdock document, and could not name any public source it treated as authoritative.

The agent reported no evidence that it knew the current delimiters before answering and no evidence that Markdown, rendering, safety policy, instruction hierarchy, or UI behavior removed them. Its high-confidence root-cause hypothesis was that it recognized Crossdock enough to initiate public search but did not complete authoritative protocol discovery/validation; it then interpreted “give me the coding-agent prompt” as a request for the human-readable payload and returned that payload without the machine-consumable handoff boundaries.

This suggests three distinct discovery/compliance stages worth testing separately:

1. **Recognition:** does the natural mention of Crossdock trigger protocol discovery behavior?
2. **Authority resolution:** does the agent locate and treat the canonical Crossdock specification as normative?
3. **Output compliance:** does it validate the emitted handoff against that specification?

This authenticated retry provides evidence that recognition occurred but authority resolution did not complete. Because the account already had substantial Crossdock context, it still does not prove independent public discoverability. See #94.

## Discovery-hardening consequence

A repository-root `HANDOFF.md` can be public and authoritative without being reliably surfaced by natural web search. Crossdock's discovery surface should therefore make likely search phrases such as “Crossdock coding agent prompt”, “Crossdock coding-agent handoff protocol”, and “Crossdock handoff format” lead as directly as practical to the normative contract.

The repository README and `HANDOFF.md` should front-load the exact delimiter requirement and clearly identify `HANDOFF.md` as authoritative. Search indexing may lag publication, so immediate retries after documentation changes are integration experiments rather than proof of search-engine discoverability.

## Current limitations versus intended semantics

For initial live testing, the implementation may temporarily accept one prompt block in the latest visible assistant response. This is an implementation constraint, not a permanent protocol rule.

Crossdock should eventually scan an appropriate conversation scope and preserve multiple valid prompt blocks without silently truncating, selecting, merging, discarding, or guessing why multiple prompts exist. Users commonly refine a prompt, ask follow-up questions, or decide to execute an earlier prompt only after later conversation. See #93.

## Test discipline

- Stop at an observed Crossdock boundary failure rather than manually rescuing the workflow.
- Do not submit stale or malformed captured text to Codex merely to force an end-to-end success.
- Record authenticated compatibility separately from public protocol discoverability.
- Treat post-hoc agent accounts as useful supporting evidence, not authoritative hidden traces.
- Future discoverability testing must use an environment without prior Crossdock account/context contamination as described in #94.
