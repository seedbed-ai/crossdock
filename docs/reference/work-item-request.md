# Work-item request contract

`crossdock.work-item-request/v1` is Crossdock's provider-neutral pre-delegation request contract. It describes what the user asked an agent to do before any provider-specific execution begins.

The contract is intentionally separate from `crossdock.task-record/v3`: a request is mutable pre-execution state, while a task record is immutable completed-work provenance.

## Fields

A request contains:

- `schema`: `crossdock.work-item-request/v1`;
- `intent`: one of the provider-neutral work-item intents;
- `source`: adapter-qualified source identity;
- `request`: the non-empty natural-language request passed to the agent; and
- `review`: review-only options or `null` for other intents.

`source` uses:

- `adapter`: source-control/source adapter identity;
- `host`: canonical bare hostname;
- `repository`: provider-native repository/project identity;
- `change`: optional provider-native change identity; and
- `version`: optional exact source version.

For `review`, both `change` and `version` are required. Crossdock must know which change and exact version are being reviewed before delegation; a moving pull-request head is not sufficient provenance.

## Review options

Review requests may include:

- `focus`: zero or more user-selected focus labels such as correctness, security, tests, accessibility, performance, or architecture; and
- `guidance`: optional free-form additional review guidance.

Focus values are not a closed Product vocabulary. Crossdock preserves user intent rather than limiting review to a fixed list of preferences.

## Capability preflight

`preflightWorkItemRequest()` validates the request against one provider adapter's capability descriptor before execution.

It fails before delegation when:

- the adapter does not advertise the requested intent;
- the intent is only experimental and the caller did not explicitly opt into experimental behavior; or
- a review contains focus/guidance but the adapter does not advertise `review-guidance` for the `review` intent.

Crossdock does not silently discard unsupported user guidance to make a route appear successful.

Capability support remains separate from authorization. Passing preflight does not grant repository access, publication permission, evidence-retention permission, merge authority, or any other user/deployment permission.

## Current Codex browser boundary

The current Codex browser capability descriptor still advertises only experimental `implement`. `review` is deliberately not advertised yet. The request/preflight core is therefore ready for review work without making an unsupported live-provider claim before authenticated compatibility evidence exists.
