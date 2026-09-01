# Agent Capabilities

Crossdock should coordinate more than implementation tasks without turning any one coding-agent product surface into the Crossdock domain model.

The core abstraction is a **work item**: a bounded request delegated to an agent, with explicit intent, target, evidence policy, lifecycle state, durable result linkage, and optional ancestry to earlier work.

## Work-item intents

The initial intent set is:

- `implement` — produce or update code and usually a branch or pull request;
- `review` — inspect an existing change and produce review findings without treating the review itself as implementation;
- `investigate` — analyze a defect, CI failure, architecture question, or repository state and produce findings/recommendations;
- `triage` — classify, prioritize, or route issues/work without necessarily changing code;
- `remediate` — address a known finding, review comment, security issue, CI failure, or other identified defect;
- `verify` — independently check a claimed result, fix, release candidate, or compatibility state;
- `scheduled` — repeat another supported intent according to user-approved scheduling semantics;
- `parallel-family` — coordinate multiple related work items whose executions are intentionally independent or concurrent.

These names describe user intent. A provider adapter may expose only a subset.

## Provider capabilities

Adapters should advertise capabilities rather than forcing Crossdock to infer them from product names or UI controls. A capability description can state whether an adapter supports, for example:

- implementation tasks;
- pull-request review;
- review guidance/focus;
- follow-up fixes from review findings;
- parallel task execution;
- local/CLI execution;
- cloud execution;
- scheduled execution;
- image or screenshot inputs;
- security-specific analysis;
- branch or pull-request creation/update;
- result/report retrieval; and
- supported durable identifiers or URLs.

Unsupported combinations should fail explicitly before delegation.

## Review is a first-class work item

A code review is not merely a comment attached to an implementation task. It has its own request, execution, result, evidence policy, and lineage.

A review work item should be able to persist:

- the exact review request or its selected evidence representation;
- repository and pull-request identity;
- reviewed commit/head SHA;
- optional review focus such as correctness, security, compatibility, performance, tests, accessibility, or architecture;
- provider task/review identifier;
- completion time and outcome;
- complete review report or configured hash/omission representation;
- durable GitHub review/comment/thread identifiers when applicable; and
- ancestry to the implementation or earlier review that caused it.

The immutable record should make it possible to answer: **what was reviewed, at which commit, with what instructions, what did the agent report, and what durable GitHub artifact corresponds to that execution?**

A review result never becomes human merge approval merely because it found no issues.

## Review → fix → re-review lineage

Crossdock should preserve a chain such as:

```text
implementation work item
  -> review work item
      -> finding(s)
          -> remediation work item
              -> re-review work item
```

Each execution remains immutable. Later work references earlier work rather than rewriting its record.

A finding may be represented by a durable GitHub review thread/comment, a structured finding identifier in a review report, or both. Crossdock should not invent thread identity when the provider/GitHub surface cannot prove it.

## Persistence model

The existing `crossdock.task-record/v2` schema is intentionally implementation-oriented: `task_type` currently distinguishes only initial and update handoffs. Expanding Crossdock to review/investigation/remediation should not overload those two values with unrelated meanings.

Before implementation, define a compatible successor record model that separates at least:

- work-item `intent` from Git/PR handoff phase;
- parent/causal lineage from branch-update ancestry;
- result evidence from provider-specific durable artifacts; and
- reviewed/target commit identity from a resulting implementation commit.

Existing v1/v2 records remain immutable and readable under their historical meaning.

## Human authority

Crossdock can request, persist, and surface agent review. It must not silently:

- approve a pull request on behalf of a human;
- merge because an agent review is clean;
- resolve human-authored review threads without explicit authority;
- convert an agent finding into a fact without preserving the underlying evidence; or
- allow retries to duplicate equivalent durable reviews/comments when the provider supports stable identity.

## Codex mapping

Codex currently maps naturally onto several of these capabilities. Its GitHub integration can review pull requests automatically or through `@codex review`, and review guidance can focus the analysis. Codex can also act on review feedback in the same PR context. Crossdock should expose those behaviors through the generic `review` and `remediate` intents rather than making `@codex review` itself a core concept.

Codex also supports broader engineering work such as implementation, repository questions/investigation, parallel agent work, reusable Skills, and multiple execution surfaces. Those capabilities should be added only where Crossdock contributes durable coordination, state, evidence, or cross-surface handoff rather than duplicating Codex UI for its own sake.
