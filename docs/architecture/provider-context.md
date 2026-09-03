# Provider context identity

Crossdock's repository target and a coding provider's currently selected browser environment are separate identities and must never be assumed to match.

The 2026-09-03 authenticated live test demonstrated why: Crossdock was configured for `seedbed-ai/crossdock-live-target`, while Codex retained stale provider state for `seedbed-ai/sb` / `arch/init`. The task executed and a PR was created in the wrong repository. See #104.

## Canonical identity

The Crossdock target repository is the canonical workflow destination. Provider-specific repository/environment state is an adapter concern that must be resolved from that target before any task mutation occurs.

The chat-agent handoff remains provider-neutral. Prompt producers must not be asked to name Codex environments, provider repository IDs, branch controls, or other routing metadata.

## Provider context snapshot

A browser adapter should resolve a provider-context snapshot before submission. Conceptually it contains:

```text
provider: codex
repository: owner/repo
environment_id: provider-stable identifier when available
environment_label: human-readable provider label when useful
base_branch: explicit verified branch
task_url: provider task identity after submission
```

Only fields that can be established deterministically should be stored. Authentication/session material must never be included.

## Required transition sequence

1. Resolve the configured Crossdock target repository.
2. Discover the provider environment/repository choices available to the authenticated browser session.
3. Resolve exactly one provider context that maps to the target repository.
4. Select that provider context if it is not already active.
5. Resolve the intended base branch explicitly; do not inherit an arbitrary stale branch from the provider UI.
6. Verify repository and branch after selection and before writing/submitting the prompt.
7. Submit the task and capture the provider task identity.
8. Verify the resulting task still identifies the expected provider context before treating it as `running`.
9. Verify task/provider repository identity again before invoking `Create PR` or `Update branch`.
10. During PR discovery, treat a newly created PR in any other repository as an integrity failure rather than waiting indefinitely for the expected repository.

At every step, ambiguity or inability to establish identity fails closed before the next mutating action.

## Mapping strategy

Crossdock may discover the provider mapping dynamically when provider semantics make that reliable, or persist an explicit target-repository → provider-environment mapping when discovery cannot be made deterministic. Such mappings belong to Crossdock configuration/recovery state, not to conversational prompt syntax.

A persisted mapping must be treated as a hint that requires live verification. Provider environment names, repository connections, permissions, and branch availability can change independently of Crossdock state.

## Diagnostics

Error messages should distinguish three cases:

- **mismatch:** a repository identity was established and differs from the Crossdock target;
- **ambiguous:** multiple plausible provider repository/environment identities were found;
- **unresolved:** no trustworthy provider repository/environment identity could be established.

Generic composer controls such as `Submit`, `Start dictation`, or `Add files` are not repository context and should not be reported as though they were observed repository identities.

## Recovery

Provider context identity is part of task recovery. If a recovered task URL, provider repository, base branch, or eventual PR cannot be reconciled with the recorded Crossdock target, Crossdock must stop with an integrity error. Recovery must never switch repositories silently to make a partial handoff appear complete.

## Related work

- #104 — critical wrong-repository incident and overall remediation.
- #108 — explicit Codex environment/repository mapping.
- #109 — wrong-repository PR detection during discovery.
- #111 — provider repository revalidation before `Create PR`.
