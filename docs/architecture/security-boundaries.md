# Security Boundaries

Crossdock sits between authenticated development systems, so its security model begins with separation rather than convenience.

## Public source vs private task data

The Crossdock repository contains application source and public project documentation. It is not a default storage location for user prompts, reports, repository context, or operational logs.

## Browser sessions

Browser integrations may act inside sessions the user already authenticated, but Crossdock should not extract session cookies/tokens and turn them into its own credential store. Content scripts and browser permissions should be scoped to the minimum origins and operations required.

## Active-task recovery data

Durable task-record evidence and transient browser recovery state are separate data boundaries.

The current browser client can persist active-task state in `chrome.storage.local` to survive dashboard/browser restarts. Prompt plaintext persistence is explicit: `recovery.prompt: persist` allows the prompt in local recovery state, while `recovery.prompt: memory` removes prompt plaintext from both persisted active-task state and persisted dashboard-form state. Report plaintext has an independent boundary: `recovery.report: persist` allows a captured provider report in persisted active-task state, while `recovery.report: memory` keeps it only in live JavaScript state and removes `final_report` from local recovery snapshots.

Memory-only recovery is deliberately lossy across restart. Crossdock must not reconstruct, recapture, silently persist, or downgrade evidence for missing prompt or report bytes merely to complete `full` or `hash` durable evidence. If the original bytes are gone and the corresponding durable evidence still requires them, recovery fails clearly. Durable `omit` may recover without those bytes because no plaintext or digest is required in the final record. Before provider-report capture, restart remains recoverable in either report recovery mode; after capture, a memory-only report is intentionally unavailable following restart.

Neither setting encrypts browser memory or controls history, diagnostics, expiration, deletion, or secure OS-backed storage. Those remain separate lifecycle/security boundaries. Both policies are frozen at task submission, so editing a visible selector cannot widen persistence for an active task.

## GitHub credentials

GitHub API credentials should be narrowly scoped and stored using an appropriate local/OS credential mechanism. Tokens must not appear in task records, logs, screenshots, test fixtures, or repository configuration.

## Remote completion

Local success is insufficient. Crossdock must re-read durable state required by a handoff—such as the task record and any configured publication linkage—before declaring the operation complete.

## Ambiguity

Provider UI changes, multiple matching PRs, missing branch identity, unresolved storage, unsupported recovery state, or uncertain controls are errors. Crossdock should stop and surface a recoverable or explicitly unrecoverable state rather than guessing.
