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

Refreshing both the Crossdock dashboard and the existing ChatGPT tab caused the current content script to be injected, after which capture reached the new parser and returned the expected envelope-validation error. Test instructions should explicitly account for refreshing provider tabs after an unpacked extension reload when content scripts changed.

The dashboard retained the previously captured prompt text after a failed capture. This is consistent with capture assigning new prompt text only after a successful result, but the stale value can be confusing and should be considered in future UX/error-state work.

## Protocol design conclusions

The purpose of the conversational handoff syntax is to tell Crossdock where coding-prompt text begins and ends when that prompt is surrounded by ordinary conversational text.

The producer should not be made responsible for Crossdock-owned concerns merely because they simplify Crossdock's parser. In particular:

- a `crossdock: handoff` field duplicates what delimiters can establish;
- a producer-declared schema/protocol version is unnecessary if Crossdock can absorb compatibility on the consuming side;
- an `agent`/provider field violates routing separation of concerns when Crossdock owns destination selection;
- JSON encoding adds visible conversational intrusion and escaping/formatting burden when the payload is fundamentally plain prompt text.

The replacement direction is therefore a minimal visible delimiter contract:

```text
⟦CROSSDOCK⟧
plain coding-agent prompt text
⟦/CROSSDOCK⟧
```

Visible delimiters are preferred to invisible whitespace/control characters because invisible characters may be normalized or removed by rendering, DOM extraction, Markdown, copy/paste, Unicode processing, accessibility tools, or model output without leaving a diagnosable visual indication.

See #92 for the general producer-responsibility principle.

## Current limitations versus intended semantics

For initial live testing, the implementation may temporarily accept one prompt block in the latest visible assistant response. This is an implementation constraint, not a permanent protocol rule.

Crossdock should eventually scan an appropriate conversation scope and preserve multiple valid prompt blocks without silently truncating, selecting, merging, discarding, or guessing why multiple prompts exist. Users commonly refine a prompt, ask follow-up questions, or decide to execute an earlier prompt only after later conversation. See #93.

## Test discipline

- Stop at an observed Crossdock boundary failure rather than manually rescuing the workflow.
- Do not submit stale or malformed captured text to Codex merely to force an end-to-end success.
- Record authenticated compatibility separately from public protocol discoverability.
- Future discoverability testing must use an environment without prior Crossdock account/context contamination as described in #94.
