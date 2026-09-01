# Agent Capabilities

Crossdock should coordinate more than implementation tasks without turning any one coding-agent product surface into the Crossdock domain model.

The core abstraction is a **work item**: one bounded request delegated to an agent, with explicit intent, target, evidence policy, lifecycle state, durable result linkage, and optional ancestry to earlier work.

## Work-item intents

The initial intent set is:

- `implement` — produce or update code and usually a branch or pull request;
- `review` — inspect an existing change and produce review findings without treating the review itself as implementation;
- `investigate` — analyze a defect, CI failure, architecture question, or repository state and produce findings/recommendations;
- `triage` — classify, prioritize, or route issues/work without necessarily changing code;
- `remediate` — address a known finding, review comment, security issue, CI failure, or other identified defect; and
- `verify` — independently check a claimed result, fix, release candidate, or compatibility state.

These names describe user intent. A provider adapter may expose only a subset.

Scheduling and parallelism are deliberately **not** intents. A scheduled review is still a `review` work item with recurrence/execution-policy metadata. A parallel family is a coordinator/group that contains multiple independently executed work items; each child keeps its own intent, execution identity, result, evidence policy, and immutable record.

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

A code review is not merely a comment attached to an implementation task. It has its own request, execution, result, evidence policy, publication policy, and lineage.

A review work item should be able to persist:

- the exact review request or its selected evidence representation;
- repository and pull-request identity;
- reviewed commit/head SHA;
- optional review focus such as correctness, security, compatibility, performance, tests, accessibility, or architecture;
- provider task/review identifier;
- completion time and outcome;
- complete review report or configured hash/omission representation;
- zero or more typed durable-artifact references produced by the execution; and
- ancestry to the implementation or earlier review that caused it.

The immutable record should make it possible to answer: **what was reviewed, at which commit, with what instructions, what did the agent report, and which durable artifacts—if any—were proven to correspond to that execution?**

A review result never becomes human merge approval merely because it found no issues.

## Publication is separate from retained review evidence

Task-record/result retention and external publication are different data flows and must have different authorization.

For example, `report: hash` or `report: omit` controls what Crossdock retains in its durable record. It does **not** imply permission to post full review text into a GitHub review, PR comment, another source-control system, chat, or other external destination.

Every externally published artifact should therefore carry or resolve an explicit publication decision that identifies at least:

- artifact type;
- destination/provider;
- target identity;
- expected visibility/classification when knowable;
- payload/evidence class being published; and
- user/deployment authority for the mutation.

A provider adapter must fail before publication when the effective policy does not authorize the payload/destination combination. Crossdock should never infer publication permission merely because equivalent text was available transiently or retained somewhere else.

## Typed durable artifacts

The core provenance contract uses generic typed durable-artifact references rather than GitHub-specific fields. An artifact reference should identify, where supported:

- adapter/provider and artifact type;
- stable remote identifier;
- durable URL or fetch locator;
- target repository/workspace identity;
- published payload classification/evidence mode when relevant; and
- verification state or version/commit identity when the remote system exposes one.

The GitHub adapter can map review IDs, PR comments, review threads, pull requests, commits, and other GitHub-native objects into this contract. Another source-control or review adapter can provide equivalent native artifacts without pretending they are GitHub objects.

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

A finding may be represented by a typed durable review-thread/comment artifact, a structured finding identifier in a review report, or both. Crossdock should not invent artifact or thread identity when the remote/provider surface cannot prove it.

## Retry and ambiguous remote state

Durable external mutations need the same fail-closed retry semantics as current task-record and PR-linkage handoffs.

Where possible, Crossdock should include a stable Crossdock idempotency marker or other provider-supported correlation value that can be searched/reconciled remotely after a timeout. A retry may reuse a remote artifact only when equivalence can be proven.

If a review/comment/publication might already have succeeded but Crossdock cannot recover a stable remote identity or otherwise prove equivalence, the work item enters an **ambiguous recovery state**. Crossdock must not blindly repeat the mutation and risk duplicate reviews/comments simply because the provider lacks a convenient stable identifier.

## Persistence model

The existing `crossdock.task-record/v2` schema is intentionally implementation-oriented: `task_type` currently distinguishes only initial and update handoffs. Expanding Crossdock to review/investigation/remediation should not overload those two values with unrelated meanings.

Before implementation, define a compatible successor record model that separates at least:

- work-item `intent` from Git/PR handoff phase;
- execution policy (including scheduling) from intent;
- family/group membership from individual execution identity;
- parent/causal lineage from branch-update ancestry;
- retained result evidence from external publication policy;
- generic typed durable artifacts from provider-specific identifiers; and
- reviewed/target commit identity from a resulting implementation commit.

Existing v1/v2 records remain immutable and readable under their historical meaning.

## Human authority

Crossdock can request, persist, and surface agent review. It must not silently:

- approve a pull request on behalf of a human;
- merge because an agent review is clean;
- resolve human-authored review threads without explicit authority;
- convert an agent finding into a fact without preserving the underlying evidence;
- publish full review content merely because the durable record retained or processed it; or
- repeat an external review/comment mutation when prior remote success cannot be ruled out.

## Codex mapping

Codex currently maps naturally onto several of these capabilities. Its GitHub integration can review pull requests automatically or through `@codex review`, and review guidance can focus the analysis. Codex can also act on review feedback in the same PR context. Crossdock should expose those behaviors through the generic `review` and `remediate` intents rather than making `@codex review` itself a core concept.

Codex also supports broader engineering work such as implementation, repository questions/investigation, parallel agent work, reusable Skills, and multiple execution surfaces. Scheduling and parallelism remain execution-policy/grouping concerns around those underlying intents. Those capabilities should be added only where Crossdock contributes durable coordination, state, evidence, or cross-surface handoff rather than duplicating Codex UI for its own sake.
