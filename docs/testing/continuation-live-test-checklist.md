# Existing-PR continuation live-test checklist

Use this checklist for the next authenticated browser validation of Crossdock's Codex continuation path. It is intentionally fail-closed and should be followed without manual rescue.

## Preconditions

- Crossdock extension is loaded from the current merged `main` build under test.
- Loopback service is running on the configured local service URL.
- GitHub credentials are valid for the disposable target and task-record repositories.
- Exactly one controlled Codex tab is open under current browser assumptions.
- ChatGPT, Codex, and GitHub sessions are authenticated.
- The disposable target PR is open.
- The target PR has a durable Crossdock origin binding that resolves to exactly one originating Codex task.
- The next requested change is harmless, easily verified, and changes only the disposable fixture.

If any prerequisite is missing or ambiguous, stop before creating or continuing a provider task.

## Capture and update-mode resolution

1. Configure the target repository and existing PR number in the Crossdock dashboard.
2. Capture a fresh handoff prompt from ChatGPT.
3. Confirm Crossdock captured only the inner handoff payload.
4. Click the Crossdock action that starts the update workflow once.
5. Confirm Crossdock snapshots the existing GitHub PR and freezes:
   - repository;
   - PR number;
   - working branch;
   - head SHA.
6. Confirm Crossdock resolves the exact originating provider task from durable provenance.

Expected: Crossdock does **not** navigate to the generic Codex new-task composer for normal update mode.

## Continuation submission

7. Crossdock navigates its controlled Codex tab to the exact originating task URL.
8. Crossdock verifies the concrete task identity before writing any prompt.
9. Crossdock locates the follow-up composer semantically.
10. Crossdock writes the captured prompt and submits exactly once.
11. Crossdock proves Codex accepted the follow-up before entering `running`.

Stop and preserve evidence if:

- the task URL differs from the resolved originating task;
- the follow-up composer is absent or ambiguous;
- submission is not provably accepted;
- Crossdock creates a fresh Codex task instead.

## Running/ready state

12. Crossdock monitors the same exact task URL.
13. The user may review Codex progress; Crossdock should eventually support navigating to Logs as a non-blocking UX enhancement (#159).
14. On completion, verify the Codex diff/result is exactly the requested change.
15. Normal update readiness requires **Update branch**.

Stop if normal update mode instead exposes only **Create PR**. Do not click it and do not reinterpret it as update success.

## Review-before-handoff checkpoint

16. With handoff mode set to review, Crossdock should enter `ready` and present **Finalize PR update** (or the current equivalent Crossdock-owned action).
17. Independently verify GitHub before publication:
   - same PR remains open;
   - same working branch;
   - head SHA still equals the frozen pre-update SHA;
   - no unintended new PR exists.
18. Do not click Codex publication controls directly during the Crossdock E2E test.

## Publication

19. Click Crossdock's update-finalization action exactly once.
20. Crossdock captures the continuation report/result evidence before provider mutation.
21. Crossdock revalidates the frozen GitHub PR identity and pre-update head.
22. Crossdock invokes Codex **Update branch** exactly once.
23. Crossdock polls GitHub without retrying the provider action.

Expected success:

- same target repository;
- same PR number;
- same working branch;
- head SHA changes from the frozen pre-update value;
- no new PR is created;
- intended change appears on the existing PR;
- immutable update task record is created;
- update record points to the same originating Codex task URL;
- update record has the expected Crossdock parent linkage;
- configured update provenance comment is added when enabled;
- original initial PR body is not rewritten for update provenance;
- prompt/report evidence follows configured full/hash/omit policy;
- no secrets appear in public or task-record surfaces.

## Terminal integrity failures

Stop immediately and preserve state if Crossdock reports any integrity error, including:

- unexpected new PR;
- wrong repository;
- working-branch mismatch;
- stale/changed pre-publication head;
- provider-task identity mismatch;
- ambiguous provider publication controls;
- publication invoked but existing PR cannot be reconciled safely.

Do not manually merge/cherry-pick a child PR, re-run provider publication, move branches, rewrite provenance, or clear the active task until evidence is documented.

## Evidence to record

For each authenticated run, record:

- Crossdock commit/build SHA;
- browser/extension reload state;
- target repository and PR;
- frozen pre-update working branch/head SHA;
- originating provider task URL;
- submitted continuation prompt (or digest, according to evidence policy);
- provider ready action shown;
- result/report summary;
- provider publication action invoked;
- post-publication PR branch/head SHA;
- whether any new PR appeared;
- task-record URL/version;
- provenance-comment URL/id when enabled;
- exact failure text and phase for any stopped run.

Authenticated compatibility evidence must remain separate from independent public handoff-discoverability claims.