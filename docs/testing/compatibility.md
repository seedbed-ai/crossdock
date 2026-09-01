# Live Compatibility Matrix

Crossdock's browser adapter depends on authenticated provider UI behavior that repository tests cannot prove. This page records **publicly reported, reproducible live-test evidence** without turning anecdotal success into an unsupported compatibility promise.

Use [`public-live-test.md`](public-live-test.md) for the procedure and the repository's live-test issue template for reports.

## Status vocabulary

- **verified** — the listed path completed successfully on the stated Crossdock ref and environment.
- **failed** — a reproducible failure was reported; link the public issue/report.
- **partial** — some required steps completed but the full path did not.
- **not tested** — no public evidence has been recorded.

A previous verification does not guarantee compatibility with a later provider UI. Always include the Crossdock ref and test date.

## Reported environments

| Date | Crossdock ref | OS | Browser | Initial → PR | PR update | Automatic | Evidence modes | Report |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | not tested | not tested | not tested | — | — |

Replace the placeholder row when the first public report is accepted. Keep rows concise; detailed reproduction/evidence belongs in the linked issue or comment.

## What counts as a verified path

For **Initial → PR**, the intended PR must exist exactly once, the target change/branch must be correct, the task-record link must be durable, and persisted evidence must match the selected evidence policy.

For **PR update**, the expected existing PR head must change, a new task record must be created, a new top-level update comment must link it, and the original PR body must not be rewritten merely for later provenance.

For **Automatic**, the same durable outcome and safety checks must hold without the manual handoff approval step.

## Privacy

Only record environment and result metadata safe for public disclosure. Never copy private prompt/report plaintext, tokens, cookies, credentials, private source, customer information, or sensitive screenshots into this matrix.

## Maintaining the matrix

A matrix update should link a public test report that contains enough non-secret evidence to understand what was exercised. Conflicting results from the same browser/OS/provider combination should remain visible rather than being averaged away; provider account/workspace variants and UI rollouts may matter.

When a provider UI changes materially, do not erase older rows. Their date and Crossdock ref are useful historical compatibility evidence.