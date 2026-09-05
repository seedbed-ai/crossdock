# Provider-task continuation for existing-PR updates

## Purpose

Crossdock treats a coding-provider task/conversation and a GitHub pull request as related but distinct identities. Authenticated Codex testing established that an existing PR is updated by continuing the exact provider task that originated it, not by creating a fresh provider task from the PR branch.

This document defines the provider-neutral architecture consequence while recording the current Codex adapter behavior as an implementation example.

## Work-item identity model

An existing-PR update spans four identities:

1. **Crossdock work item** — the user-visible repository/PR operation and immutable Crossdock task record.
2. **GitHub PR identity** — exact target repository plus pull-request number.
3. **GitHub working state** — current PR working branch and head SHA, read live from GitHub.
4. **Provider task identity** — the exact coding-provider task/conversation that originated the PR.

No one identity substitutes for another.

In particular:

- a matching repository/branch does not prove that a fresh provider task is the originating task;
- whichever provider task page happens to be open is not authoritative;
- a provider task's displayed branch label is not authoritative for GitHub PR working state;
- a PR-visible provenance link is optional presentation, not the durable routing authority.

## Authenticated Codex evidence

The current Codex Cloud browser UI demonstrated this lifecycle:

```text
new task
  -> Create PR
  -> PR exists
  -> follow-up in the same task
  -> Update branch
  -> same PR head advances
```

A fresh task created from the existing PR's working branch instead produced a new child PR. Crossdock's integrity guard correctly rejected that outcome, but the experiment showed that `fresh task from branch` and `continue originating task` are semantically different operations.

The same task also temporarily displayed `main` after a follow-up completed even though GitHub's existing PR still used its `codex/...` working branch. Crossdock therefore must keep GitHub branch/head identity separate from provider UI labels.

See `docs/testing/live-test-log-2026-09-05.md`.

## Normal existing-PR update flow

For an existing PR, the normal workflow is:

1. Resolve the exact originating provider task from durable Crossdock-owned provenance.
2. Read the current GitHub PR snapshot and freeze:
   - repository;
   - PR number;
   - working branch;
   - pre-update head SHA.
3. Navigate the controlled provider tab to the exact provider task.
4. Verify the provider task identity before mutation.
5. Submit the captured handoff prompt through the provider task's continuation/follow-up input.
6. Prove that the provider accepted the follow-up; do not enter `running` merely because text was written or a button was clicked.
7. Monitor the same provider task identity until provider-native update publication is available.
8. Capture the continuation result/report evidence before provider publication.
9. Re-read the GitHub PR immediately before publication and require the frozen repository, PR number, working branch, and pre-update head SHA to remain unchanged.
10. Invoke the provider's update publication action exactly once.
11. Poll GitHub without re-invoking the provider action.
12. Succeed only when the same PR/working branch remains and the head SHA advances.
13. Persist a new immutable Crossdock update task record and configured update provenance.

## Provider-task origin binding

The originating provider task must be recoverable from the work-item identity without relying on browser history or PR-visible presentation.

Crossdock's existing immutable task record already carries `agent_task_url`. For deterministic lookup by `{repository, pull_request}`, Crossdock should maintain an immutable origin binding in the configured task-record store. See #163.

The origin binding is routing/provenance metadata, not evidence content. It should not duplicate prompt/report plaintext.

A browser-local cache may accelerate lookup, but the cache is not durable authority.

## Continuation state

A continuation update should retain at least:

- Crossdock task id for the new update instruction;
- parent Crossdock task id where applicable;
- target repository;
- PR number;
- frozen GitHub working branch;
- frozen pre-update head SHA;
- exact provider task URL/identity;
- evidence/recovery/publication policy;
- continuation submission status;
- provider publication-invoked status;
- PR-discovery baseline for integrity checks.

The update task record should point to the same provider task URL used by the continuation. Reusing the provider task does not mean reusing the Crossdock task record: each Crossdock instruction remains a separate immutable record.

## Failure semantics

Fail closed before provider mutation when:

- the origin binding is missing, malformed, ambiguous, or conflicting;
- the exact provider task cannot be opened or verified;
- the provider task no longer accepts continuation;
- GitHub repository/PR/branch/head identity cannot be frozen exactly.

Fail closed after continuation submission when:

- provider readiness is ambiguous;
- the provider exposes only a new-PR action where normal update mode requires an update-existing-branch action;
- the frozen GitHub PR state changes before publication;
- a newly visible unexpected PR appears;
- the repository or working branch changes after provider publication;
- the provider publication action was invoked but the resulting GitHub state cannot be reconciled safely.

After the provider publication action has been invoked, retries may poll/inspect state but must never invoke the publication action again automatically.

## Codex adapter consequence

For the current Codex UI, normal update readiness is **Update branch** after a follow-up in the originating task.

`Create PR` in a fresh task is not an interchangeable update action. If it appears in normal update mode, Crossdock should not treat it as successful update readiness.

The adapter should navigate directly to the exact known `/codex/cloud/tasks/<task-id>` URL, wait for the follow-up composer to be semantically ready, submit once, prove acceptance, and continue monitoring that same task URL.

## Distinct explicit workflow: child task/PR

Crossdock may later support an explicit workflow where a user intentionally creates a fresh provider task from another branch, obtains a child PR, and deliberately integrates that work into another work item.

That is a separate operation. It must not be an automatic fallback for normal existing-PR update mode.

## Public handoff boundary

None of this changes the conversational producer contract. The producer still emits only the minimal handoff payload boundary. Provider task selection, continuation, GitHub identity verification, provenance, and recovery remain Crossdock-owned responsibilities.