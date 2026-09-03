# Live Compatibility Matrix

Crossdock's browser adapter depends on authenticated provider UI behavior that repository tests cannot prove. This page records **publicly reported, reproducible live-test evidence** without turning anecdotal success into an unsupported compatibility promise.

Use [`public-live-test.md`](public-live-test.md) for the procedure and the repository's live-test issue template for reports. See [`../releases.md`](../releases.md) for the distinction between experimental, verified, and supported behavior.

## Status vocabulary

- **verified** — the listed path completed successfully on the stated Crossdock ref and environment.
- **failed** — a reproducible failure was reported; link the public issue/report.
- **partial** — some required steps completed but the full path did not.
- **not tested** — no public evidence has been recorded.

A previous verification does not guarantee compatibility with a later provider UI. Always include the Crossdock ref and test date. A verified row is dated evidence; it does not by itself promote an integration from experimental to supported.

Capability status and live compatibility are related but distinct. `crossdock.agent-capabilities/v1` describes what a provider adapter currently advertises and whether that path is experimental or verified. A compatibility row records what actually happened for one specific intent, Crossdock ref, provider surface, and environment. Evidence for `implement` must never be treated as evidence for `review`, `verify`, or another intent.

## Reported environments

| Date | Crossdock ref | OS | Browser | Intent / capability | Initial → PR | PR update | Automatic | Evidence / recovery | Publication | Report |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-09-03 | `525a03a` | Windows Server (EC2) | Chrome | implement / experimental | **failed** — Codex task completed, but stale provider repository context caused Crossdock to create `seedbed-ai/sb#177` instead of a PR in the configured disposable target | not tested | not tested | prompt/report `hash`; prompt/report recovery `persist` | initial PR link configured; final provenance stage not reached | [live-test log](live-test-log-2026-09-03.md), #104 |
| 2026-09-03 | `0393d0e` | Windows Server (EC2) | Chrome | implement / experimental | **partial** — pre-submit repository guard correctly stopped stale/unresolved Codex context before task creation; E2E remained blocked pending deterministic environment selection | not tested | not tested | prompt/report `hash`; prompt/report recovery `persist` | not reached | [live-test log](live-test-log-2026-09-03.md), #104, #108 |

These rows come from one authenticated integration session in an account that already had Crossdock conversational context. They establish browser/provider behavior, not independent public handoff discoverability; see #94. The first row records a safety failure rather than compatibility success. The second records the subsequent fail-closed mitigation and should not be interpreted as a completed Initial → PR path.

For the current Codex browser adapter, `implement` is the only advertised intent and remains **experimental** until authenticated live testing establishes compatibility. The dashboard validates that intent before provider delegation or an update-task PR snapshot and freezes it in active recovery state. Disabled dashboard intents are presentational hints rather than the safety boundary: manipulated, empty, or unknown values fail closed and do not receive compatibility credit from implementation-path tests.

## What counts as a verified path

For **Initial → PR**, the intended PR must exist exactly once, the target change/branch must be correct, the immutable task record must be durably stored and remotely verifiable, persisted evidence must match the selected evidence policy, and any configured PR-body publication must match the selected publication policy. A `none` publication choice is successful only when the record still exists but Crossdock provenance is absent from that PR surface.

For **PR update**, the expected existing PR head must change, a new immutable task record must be created and remotely verifiable, and the configured update-publication policy must be honored. With `link`, a new top-level update comment must link the record; with `none`, Crossdock must not create that provenance comment. The original PR body must not be rewritten merely for later provenance.

For **Automatic**, the same durable outcome, privacy choices, publication choices, and safety checks must hold without the manual handoff approval step.

Committed-file publication is an independent presentation path. When exercised, the report should identify `link` or `reference` and verify the file at the exact configured repository/branch/path, with create-or-identical/no-overwrite behavior and no prompt/report evidence leakage.

Evidence retention and recovery persistence are independent. A compatibility report that exercises `full`, `hash`, or `omit` should say which durable evidence modes were tested. Recovery behavior should be reported separately when prompt/report memory-only modes are exercised; a deliberately unrecoverable restart is a correct result when the selected policy intentionally discarded bytes that `full`/`hash` evidence later requires.

## Privacy

Only record environment and result metadata safe for public disclosure. Never copy private prompt/report plaintext, tokens, cookies, credentials, private source, customer information, or sensitive screenshots into this matrix.

## Maintaining the matrix

A matrix update should link a public test report that contains enough non-secret evidence to understand what was exercised. Conflicting results from the same browser/OS/provider combination should remain visible rather than being averaged away; provider account/workspace variants and UI rollouts may matter.

When a provider UI changes materially, do not erase older rows. Their date and Crossdock ref are useful historical compatibility evidence. If newer evidence shows a regression, add the new result and leave the historical row intact.
