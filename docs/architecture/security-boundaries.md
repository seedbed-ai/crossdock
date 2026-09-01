# Security Boundaries

Crossdock sits between authenticated development systems, so its security model begins with separation rather than convenience.

## Public source vs private task data

The Crossdock repository contains application source and public project documentation. It is not a default storage location for user prompts, reports, repository context, or operational logs.

## Browser sessions

Browser integrations may act inside sessions the user already authenticated, but Crossdock should not extract session cookies/tokens and turn them into its own credential store. Content scripts and browser permissions should be scoped to the minimum origins and operations required.

## Active-task recovery data

Durable task-record evidence and transient browser recovery state are separate data boundaries.

The current browser client can persist active-task state in `chrome.storage.local` to survive dashboard/browser restarts. Prompt plaintext persistence is explicit: `recovery.prompt: persist` allows the prompt in local recovery state, while `recovery.prompt: memory` removes prompt plaintext from both persisted active-task state and persisted dashboard-form state.

Memory-only recovery is deliberately lossy across restart. Crossdock must not reconstruct, recapture, or silently persist a missing prompt merely to complete `full` or `hash` durable evidence. If the original prompt bytes are gone and the selected durable evidence still requires them, recovery fails clearly. Durable prompt `omit` may recover without the prompt because no prompt plaintext or digest is required in the final record.

This setting does not encrypt browser memory and does not yet control report recovery state, history, diagnostics, expiration, or secure OS-backed storage. Those remain separate lifecycle/security boundaries.

## GitHub credentials

GitHub API credentials should be narrowly scoped and stored using an appropriate local/OS credential mechanism. Tokens must not appear in task records, logs, screenshots, test fixtures, or repository configuration.

## Remote completion

Local success is insufficient. Crossdock must re-read durable state required by a handoff—such as the task record and any configured publication linkage—before declaring the operation complete.

## Ambiguity

Provider UI changes, multiple matching PRs, missing branch identity, unresolved storage, unsupported recovery state, or uncertain controls are errors. Crossdock should stop and surface a recoverable or explicitly unrecoverable state rather than guessing.
