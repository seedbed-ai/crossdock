# Security Boundaries

Crossdock sits between authenticated development systems, so its security model begins with separation rather than convenience.

## Public source vs private task data

The Crossdock repository contains application source and public project documentation. It is not a default storage location for user prompts, reports, repository context, or operational logs.

## Browser sessions

Browser integrations may act inside sessions the user already authenticated, but Crossdock should not extract session cookies/tokens and turn them into its own credential store. Content scripts and browser permissions should be scoped to the minimum origins and operations required.

## GitHub credentials

GitHub API credentials should be narrowly scoped and stored using an appropriate local/OS credential mechanism. Tokens must not appear in task records, logs, screenshots, test fixtures, or repository configuration.

## Remote completion

Local success is insufficient. Crossdock must re-read durable state required by a handoff—such as the task record and its PR linkage—before declaring the operation complete.

## Ambiguity

Provider UI changes, multiple matching PRs, missing branch identity, unresolved storage, or uncertain controls are errors. Crossdock should stop and surface a recoverable state rather than guessing.
