# Existing-PR update provider action semantics

## Live observation

An authenticated update task was submitted against the exact existing PR working branch `codex/add-crossdock-live-test.txt-file`. Codex completed the requested one-line addition correctly, but the completed task exposed **Create PR** rather than **Update branch**. Crossdock therefore remained in `running` because it treated the provider button label as the update-mode readiness contract.

## Principle

Crossdock owns the work-item meaning; the provider owns its UI vocabulary. An existing-PR update must not be classified from whether Codex says **Create PR** or **Update branch**.

GitHub state is authoritative for update success.

## Required flow

1. At task creation, snapshot the existing PR's exact repository, working branch, and head SHA.
2. Submit Codex against that exact working branch.
3. A completed update task is ready when Codex exposes exactly one supported publication action: **Update branch** or **Create PR**.
4. Before invoking that action, re-read the existing PR snapshot and require:
   - the same repository;
   - the same PR number;
   - the same working branch;
   - the same pre-update head SHA.
5. Snapshot visible PR evidence before the provider mutation.
6. Capture the Codex report, then invoke the one supported publication action exactly once.
7. After invocation, require the existing PR head SHA to advance while the working branch remains unchanged.
8. Inspect newly visible PR evidence. The expected existing PR URL is permitted; a newly visible different PR is an integrity failure.
9. On success, publish the immutable update task record and configured update provenance comment without rewriting the original PR body.
10. Never retry the provider publication action after it has been invoked.

## Failure behavior

An unexpected new PR, repository mismatch, working-branch mismatch, stale pre-action head, or ambiguous provider action is a terminal integrity failure. A delayed existing-PR head update may be polled after the provider action without invoking the action again.

## Non-goals

- Do not infer update semantics from provider button labels.
- Do not manually rescue a provider-created PR into the intended PR.
- Do not weaken repository/branch/PR integrity checks.
- Do not require the user to click Codex publication controls directly.
