# Live Adapter Validation

The browser adapter is intentionally fail closed and must be validated against the authenticated provider UI before Crossdock claims a supported integration.

## Initial-task validation

Verify that Crossdock can:

1. identify exactly one ordinary ChatGPT tab and capture the intended latest assistant response;
2. identify exactly one Codex task surface and submit the exact captured prompt;
3. detect completion only when the task exposes the expected durable handoff state;
4. capture the complete final Codex report rather than an intermediate assistant message;
5. invoke `Create PR` only when it resolves uniquely;
6. identify the resulting target-repository PR URL;
7. hydrate base branch, head branch, and head SHA from GitHub rather than browser assumptions;
8. persist the immutable task record to the explicitly configured destination;
9. update and re-read the existing PR body with the task-record link.

## Branch-update validation

Verify that Crossdock snapshots the PR head before the update, invokes `Update branch` only when unique, waits until GitHub reports a different head SHA, persists a new task record, and creates a new top-level PR comment without rewriting the original PR body merely for later provenance.

## Failure cases

Exercise multiple matching tabs, missing/duplicate buttons, changed semantic selectors, missing report content, invalid storage, stale PR identity, localhost service unavailability, and task/browser restart recovery. Each case must produce a recoverable error rather than a guessed mutation.

Passing syntax/unit/HTTP-boundary CI is necessary but not sufficient for provider support. Live compatibility evidence should be recorded with the provider UI/version/date observed and converted into fixtures/tests where practical.
