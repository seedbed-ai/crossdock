# Workflow

Crossdock models one bounded engineering execution as a task rather than as a collection of browser clicks.

The initial route is:

1. capture or explicitly supply the engineering prompt;
2. identify the target repository/base branch and whether the work starts a PR or updates an existing PR branch;
3. delegate the exact canonical prompt to the configured coding-agent adapter;
4. observe execution state and capture the complete final report;
5. persist one immutable task record at the configured durable destination;
6. for an initial task, create/finalize the PR body with a permanent task-record link;
7. for an update, add a new top-level PR comment with a permanent link rather than rewriting historical provenance;
8. re-read the required remote state and only then report the handoff complete.

The workflow core should not depend on visual labels such as a particular provider's `Create PR` button. Provider adapters may use UI automation when no supported API exists, but those mechanics must remain isolated and fail closed when the expected state is ambiguous.
