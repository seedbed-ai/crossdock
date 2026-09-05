# Authenticated continuation live-test log — 2026-09-05

This log records authenticated browser evidence gathered while validating Crossdock's existing-PR update semantics against the current Codex Cloud UI. It complements `live-test-log-2026-09-03.md`.

## Scope and discipline

The disposable target repository was `seedbed-ai/crossdock-live-target`. Existing PR #1 was the intended update target. The test continued the established discipline: stop at failures, preserve evidence before cleanup, do not manually rescue an unintended provider outcome into the intended PR, and do not weaken repository/branch/PR integrity checks to force a successful run.

## Existing-PR update attempt using a fresh Codex task

Crossdock was configured in update mode for PR #1. Before submission, GitHub showed:

- repository: `seedbed-ai/crossdock-live-target`;
- PR: `#1`;
- working branch: `codex/add-crossdock-live-test.txt-file`;
- head SHA: `a72bc13fdd4bc9cebad77e22d2337871bbc96286`.

Crossdock returned to the Codex composer, selected the target repository, selected the exact existing PR working branch, submitted a fresh Codex task, and navigated to that concrete task.

The task correctly produced only the requested second line:

```text
This repository is a disposable Crossdock integration test.
The existing-PR update path was tested successfully.
```

The completed fresh task exposed **Create PR**, not **Update branch**.

Crossdock's then-current update implementation intentionally treated `Create PR` and `Update branch` as possible provider publication controls while relying on GitHub state as the authority for whether the existing PR was actually updated. Crossdock invoked the visible provider publication action exactly once.

Codex created a new child PR instead of updating PR #1:

- new PR: `seedbed-ai/crossdock-live-target#2`;
- base branch: `codex/add-crossdock-live-test.txt-file`;
- head branch: `codex/add-second-line-to-crossdock-live-test.txt`;
- head SHA: `d6f8bf62467970815a9cb5c1c43bf9404edb3270`;
- diff: exactly the requested one-line addition.

Crossdock detected the newly visible unexpected target-repository PR and entered terminal phase `pr-update-integrity-error` with an error equivalent to:

```text
update PR integrity failure: expected existing PR https://github.com/seedbed-ai/crossdock-live-target/pull/1, but new target-repository PR evidence appeared: https://github.com/seedbed-ai/crossdock-live-target/pull/2
```

This was a successful safety result but a failed update workflow. Crossdock did not retry the provider action and did not treat PR #2 as success. PR #2 was preserved as failure evidence rather than merged into PR #1.

See #160.

## Provider-semantics hypothesis

The observed behavior suggested a different Codex model:

- a **fresh task** is a new provider work unit and can produce its own task-owned branch/PR, even when started from an existing PR branch;
- a **follow-up instruction inside the original task** may be the provider-native way to continue work associated with an existing PR.

This hypothesis was tested directly before changing Crossdock again.

## Original-task follow-up capability

The original Codex task that created PR #1 was reopened:

`https://chatgpt.com/codex/cloud/tasks/task_e_6a9c3a9dc3208322bfb14f0cdd6fa105`

Before the continuation instruction:

- the task still accepted follow-up text through the bottom composer (`Request changes or ask a qu...`);
- the top-right publication control was **View PR**;
- the task was still associated with the disposable repository and the PR #1 work.

This established that the original provider task remained a live conversation/workspace after PR creation.

See #153.

## Manual continuation experiment

A tightly controlled manual provider experiment sent this follow-up instruction into the exact original task:

```text
Add a second line to crossdock-live-test.txt stating that the existing-PR update path was tested successfully. Preserve the existing first line exactly. Make no other changes.
```

Observed after completion:

- the browser remained on the same concrete Codex task URL;
- Codex produced exactly the intended two-line result;
- Codex reported commit `c3d9073` (`Document existing PR update test`);
- the follow-up composer remained available;
- the top-right provider control changed from **View PR** to **Update branch**.

An important UI observation occurred during the completed continuation state: the task header displayed `main`, even though the intended GitHub PR working branch remained `codex/add-crossdock-live-test.txt-file`. Therefore the post-continuation task-header branch label is not a safe authority for PR working-branch identity.

Before **Update branch** was clicked, GitHub PR #1 was independently checked and still had:

- head branch `codex/add-crossdock-live-test.txt-file`;
- old head SHA `a72bc13fdd4bc9cebad77e22d2337871bbc96286`;
- one commit;
- only the original first line.

Therefore the follow-up computes a new task result inside the same provider task but does not publish that result to the existing PR automatically.

## Manual Update branch publication

The provider **Update branch** control was then clicked exactly once.

After publication:

- the provider control returned to **View PR**;
- the task header again showed the PR working branch `codex/add-crossdock-live-test.txt-file`;
- PR #1 remained the same open PR;
- PR #1 remained on the same working branch;
- PR #1 head advanced to `9e3b3d292c1adb9d0bf3146d0f114c734b3a28f8`;
- PR #1 now had two commits;
- PR #1 diff contained exactly the two intended lines.

PR #2 remained a separate, unchanged child PR and did not participate in the successful continuation update.

This validates the provider lifecycle for the current Codex UI:

```text
new task
  -> Create PR
  -> PR exists
  -> follow-up in the exact same task
  -> Update branch
  -> same existing PR head advances
```

## Crossdock design consequence

The normal existing-PR update path should no longer create a fresh Codex task from the PR branch.

Instead, Crossdock should:

1. retain or resolve the exact originating Codex task identity for the existing PR;
2. snapshot and freeze the GitHub repository, PR number, working branch, and pre-update head SHA;
3. navigate its controlled Codex tab to the exact originating task;
4. submit the new instruction through that task's follow-up composer;
5. monitor the same task until **Update branch** is available;
6. capture the follow-up report/result evidence before provider mutation;
7. revalidate the frozen GitHub PR identity immediately before publication;
8. invoke **Update branch** exactly once;
9. verify that the same PR and working branch remain while the head SHA advances;
10. publish a new immutable Crossdock task record and configured update provenance without pretending a new provider task was created.

Crossdock must not infer continuation identity from whichever Codex task page happens to be open, nor may it infer the PR working branch from the post-continuation task-header label. The exact provider task identity and GitHub PR snapshot are separate authorities.

## Distinct workflows

The provider evidence now supports keeping three concepts separate:

1. **New task -> new PR**: the normal initial handoff path.
2. **Continue originating task -> update existing PR**: the normal existing-PR update path.
3. **New task -> child PR -> explicit integration into another branch/PR**: a possible future workflow, but it must be explicit and must never be an automatic fallback for an existing-PR update.

See #153, #160, and #161.

## Preserved failure evidence and cleanup

`seedbed-ai/crossdock-live-target#2` remains open as preserved failure evidence from the fresh-task experiment. It should not be merged into PR #1 merely to make the earlier test succeed. Cleanup may occur once the continuation implementation and documentation no longer need the artifact.

## Next authenticated test target

Before the next authenticated browser window, implementation should be prepared so that update mode targets the exact originating provider task and uses the follow-up composer. The next live test should then verify the complete Crossdock-driven path without manual provider interaction:

```text
Capture prompt
-> resolve existing PR and originating Codex task
-> submit follow-up in same task
-> detect Update branch readiness
-> review
-> Crossdock invokes Update branch once
-> verify same PR head advanced
-> publish immutable update record and provenance
```

The user expects to be available for additional authenticated testing on the next Thursday, Friday, and Saturday windows.