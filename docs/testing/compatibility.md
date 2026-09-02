# Live Compatibility Matrix

Crossdock's browser adapter depends on authenticated provider UI behavior that repository tests cannot prove. This page records **publicly reported, reproducible live-test evidence** without turning anecdotal success into an unsupported compatibility promise.

Use [`public-live-test.md`](public-live-test.md) for the procedure and the repository's live-test issue template for reports. See [`../releases.md`](../releases.md) for the distinction between experimental, verified, and supported behavior.

## Status vocabulary

- **verified** — the listed path completed successfully on the stated Crossdock ref and environment.
- **failed** — a reproducible failure was reported; link the public issue/report.
- **partial** — some required steps completed but the full path did not.
- **not tested** — no public evidence has been recorded.

A previous verification does not guarantee compatibility with a later provider UI. Always include the Crossdock ref and test date. A verified row is dated evidence; it does not by itself promote an integration from experimental to supported.

## Reported environments

| Date | Crossdock ref | OS | Browser | Initial → PR | PR update | Automatic | Evidence modes | Report |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | not tested | not tested | not tested | — | — |

Replace the placeholder row when the first public report is accepted. Keep rows concise; detailed reproduction/evidence belongs in the linked issue or comment.

## What counts as a verified path

For **Initial → PR**, the intended PR must exist exactly once, the target change/branch must be correct, the immutable task record must be durably stored and remotely verifiable, persisted evidence must match the selected evidence policy, and any configured PR-body publication must match the selected publication policy. A `none` publication choice is successful only when the record still exists but Crossdock provenance is absent from that PR surface.

For **PR update**, the expected existing PR head must change, a new immutable task record must be created and remotely verifiable, and the configured update-publication policy must be honored. With `link`, a new top-level update comment must link the record; with `none`, Crossdock must not create that provenance comment. The original PR body must not be rewritten merely for later provenance.

For **Automatic**, the same durable outcome, privacy choices, publication choices, and safety checks must hold without the manual handoff approval step.

Evidence retention and recovery persistence are independent. A compatibility report that exercises `full`, `hash`, or `omit` should say which durable evidence modes were tested. Recovery behavior should be reported separately when prompt/report memory-only modes are exercised; a deliberately unrecoverable restart is a correct result when the selected policy intentionally discarded bytes that `full`/`hash` evidence later requires.

## Privacy

Only record environment and result metadata safe for public disclosure. Never copy private prompt/report plaintext, tokens, cookies, credentials, private source, customer information, or sensitive screenshots into this matrix.

## Maintaining the matrix

A matrix update should link a public test report that contains enough non-secret evidence to understand what was exercised. Conflicting results from the same browser/OS/provider combination should remain visible rather than being averaged away; provider account/workspace variants and UI rollouts may matter.

When a provider UI changes materially, do not erase older rows. Their date and Crossdock ref are useful historical compatibility evidence. If newer evidence shows a regression, add the new result and leave the historical row intact.