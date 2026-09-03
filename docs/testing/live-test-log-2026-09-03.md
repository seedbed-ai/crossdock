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

A visible NUL-like trailing character was also repeatedly observed after dashboard status messages, including connection and parser errors. It later appeared when copying text from non-Crossdock tabs as well, so the leading hypothesis is now an RDP/clipboard-path artifact rather than Crossdock output. It remains tracked separately in #98 and is not treated as a blocker unless reproduced outside that environment.

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

## Discovery-hardened authenticated retry

After the README/`HANDOFF.md` discovery hardening merged, the same natural user request was issued in a fresh ChatGPT conversation. ChatGPT emitted the current canonical marker block:

```text
[[[HANDOFF]]]
Add a file named crossdock-live-test.txt containing a short statement that this repository is a disposable Crossdock integration test. Make no other changes.
[[[/HANDOFF]]]
```

Crossdock then captured exactly the inner coding prompt and reported `Captured Crossdock handoff prompt.` This is the first successful authenticated ChatGPT → Crossdock capture boundary using the minimal generic protocol. Because the account already had Crossdock context, it remains integration evidence rather than independent-discoverability proof.

The stale-prompt ambiguity observed earlier was fixed separately: a new capture attempt now invalidates the old prompt before provider/parser work, so a failed capture cannot leave older text available as though it were current. See #97 and PR #99.

## Codex submission boundary

The first `Create Codex task` attempt populated the Codex composer but did not press the current blue submit/start control. Crossdock nevertheless entered phase `running` and began waiting for `Create PR`. The tester did not manually click the Codex button, preserving the failure. See #100.

Source diagnosis showed that the adapter relied on a narrow text-label set and returned success immediately after `.click()` without proving Codex accepted the task. PR #101 expanded semantic/current submit-control recognition and added positive submission verification. The adapter now fails closed unless the task URL changes or the prompt leaves the composer and the submit control disappears.

After clearing only the false local active-task state from the failed test, reloading the extension, and retrying the same boundary, Crossdock switched to Codex and started the task automatically with one click. The dashboard's `running` phase then matched the provider's actual state.

## Codex task completion boundary

The authenticated Codex task completed in approximately 1m28s. The submitted prompt was preserved exactly. Codex produced exactly one intended change:

- new file `crossdock-live-test.txt`;
- content: `This repository is a disposable Crossdock integration test.`;
- commit shown by Codex: `0674743` (`Add Crossdock live test marker`).

Visible Codex validation included `git diff --check`, `git status --short --branch`, `git show --stat --oneline --decorate HEAD`, and `nl -ba crossdock-live-test.txt`.

Codex's report said it could not create a pull request from inside its task environment because no `make_pr` tool or Git remote was available. This was not treated as a failure because the authenticated Codex browser UI exposed `Create PR`, which is the external action Crossdock is designed to invoke. Crossdock independently detected that readiness and transitioned to phase `ready` with status:

`Task is ready. Review the task and choose Finalize new PR.`

Review-before-handoff behavior therefore worked at this boundary.

## Finalize-new-PR report-capture failure

Clicking Crossdock `Finalize new PR` failed before PR creation with:

`unable to identify the complete Codex report from known semantic selectors`

The complete Codex completion report was visibly rendered in the task UI, including `Summary` and `Testing` sections, and the UI still exposed `Create PR`. Crossdock's existing report selectors only recognized older report-specific `data-testid` values or ChatGPT-style assistant-message markers, none of which matched this current Codex rendering.

Crossdock correctly restored/retained phase `ready` after the failed finalization rather than claiming success. No manual Codex `Create PR` action was taken, and no new PR was created by the attempt. See #102.

PR #103 added a narrow `Summary`/`Testing` structural fallback for the current Codex completion report while retaining fail-closed behavior and avoiding arbitrary whole-page text capture. On retry, report capture succeeded and Crossdock proceeded to invoke provider `Create PR`.

## Wrong-repository execution and PR creation

The report-capture retry exposed a more serious repository-routing defect. Crossdock was configured throughout for target repository `seedbed-ai/crossdock-live-target`, but the Codex browser session had remained on repository/environment `sb` and base branch `arch/init`. Crossdock had not set or verified provider repository identity before submission.

The task therefore executed in `seedbed-ai/sb`, not the disposable target. After Crossdock invoked `Create PR`, Codex created branch `codex/add-crossdock-live-test.txt-file` and GitHub PR `seedbed-ai/sb#177` (`Add Crossdock live test marker`) targeting `arch/init`. The PR contained the intended one-file test change, but in the wrong repository.

Crossdock simultaneously continued to display repository `seedbed-ai/crossdock-live-target` and entered phase `pr-create-uncertain` with status:

`Create PR was invoked, but the resulting PR URL is not visible yet. Waiting without invoking Create PR again…`

Because PR discovery filtered to the configured target repository, it could not see the newly created wrong-repository PR. This is tracked as the critical routing/integrity defect #104, with focused defense-in-depth follow-ups #108, #109, and #111. The accidental PR/branch cleanup is tracked by #107 and must not be merged into Seedbed.

The test stopped at this failure; the wrong-repository PR was not manually redirected or otherwise rescued. After the incident was documented, `seedbed-ai/sb#177` was closed without merge. Its head branch remained pending deletion because the available GitHub connector did not expose branch deletion.

## Pre-submit repository safety guard

PR #114 introduced the immediate safety barrier from #105/#110. Crossdock now passes its configured target repository into the Codex content adapter and validates visible provider repository/environment context before writing the prompt or clicking submit. This does not yet perform deterministic provider environment selection; it only prevents execution when provider context cannot be proven to match the configured target.

Authenticated safety retesting after #114 showed no new task was created and Crossdock remained at `No active task` in both tested stale-context cases. On the completed wrong-repository task page, submission failed with:

`Codex repository context does not match target seedbed-ai/crossdock-live-target; visible provider context: Add files and more, Start dictation, Submit`

After navigating to the main Codex Cloud page and refreshing, it again failed closed before submission with:

`Codex repository context does not match target seedbed-ai/crossdock-live-target; visible provider context: View all code environments, Add files and more, Search for your branch, Start dictation, Submit`

No Codex task was created in either case. The safety objective therefore held, although the diagnostic context extraction is currently too noisy/generic to serve as a useful provider-context description. Automatic repository/environment selection and a more explicit provider-context model remain necessary before the E2E path can continue safely.

PR #115 subsequently documented the provider-context identity model: the Crossdock target repository is canonical; provider repository/environment and base-branch identity must be resolved and verified before mutation; persisted provider mappings are hints requiring live verification; provider context must be rechecked before later mutations; and wrong-repository PR evidence is an integrity failure rather than a recovery timeout.

## Current limitations versus intended semantics

For initial live testing, the implementation may temporarily accept one prompt block in the latest visible assistant response. This is an implementation constraint, not a permanent protocol rule.

Crossdock should eventually scan an appropriate conversation scope and preserve multiple valid prompt blocks without silently truncating, selecting, merging, discarding, or guessing why multiple prompts exist. Users commonly refine a prompt, ask follow-up questions, or decide to execute an earlier prompt only after later conversation. See #93.

## Test discipline

- Stop at an observed Crossdock boundary failure rather than manually rescuing the workflow.
- Do not submit stale or malformed captured text to Codex merely to force an end-to-end success.
- Record authenticated compatibility separately from public protocol discoverability.
- Treat post-hoc agent accounts as useful supporting evidence, not authoritative hidden traces.
- Future discoverability testing must use an environment without prior Crossdock account/context contamination as described in #94.
