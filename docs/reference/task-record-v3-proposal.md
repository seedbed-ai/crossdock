# Task Record v3 Proposal

Status: **design proposal; not yet emitted by Crossdock**.

This proposal extends Crossdock's durable execution record so code reviews, investigations, remediations, verifications, scheduled occurrences, and parallel task families can use the same provenance system as implementation work without changing the historical meaning of `crossdock.task-record/v1` or `/v2`.

## Decision: keep the `task-record` name

The proposed successor identifier is:

```text
crossdock.task-record/v3
```

A review, investigation, or remediation is still a bounded delegated task. Keeping the established `task-record` name avoids an unnecessary public vocabulary and path migration while version 3 changes the record semantics explicitly.

Existing v1/v2 records remain immutable and are never rewritten into v3.

## Design goals

Version 3 must answer, for any one agent execution:

1. What bounded work was requested?
2. What was the intent of that work?
3. What exact target state was acted on or inspected?
4. Which adapter/provider execution performed it?
5. What result did that execution produce under the selected evidence policy?
6. What later durable artifacts were published or linked, under what publication authority?
7. How was each durable artifact remotely verified?
8. What earlier task caused this task, and what family/schedule does it belong to?
9. If a remote mutation became ambiguous, what state prevents an unsafe duplicate retry?

## Orthogonal concepts

Version 3 keeps these concepts independent:

- **intent** — `implement`, `review`, `investigate`, `triage`, `remediate`, or `verify`;
- **handoff phase** — Git/source-control state such as initial PR creation, branch update, review publication, or no source-control mutation;
- **execution policy** — ordinary one-shot execution or a scheduled occurrence;
- **family membership** — optional grouping for related/parallel tasks;
- **lineage** — causal parent task or finding;
- **retention evidence policy** — what Crossdock stores in this immutable record;
- **publication policy/outcome** — what Crossdock was authorized to publish to each external destination;
- **durable artifacts** — remotely addressable objects created or linked by the execution/handoff.

Scheduling and parallelism are not intents. Every scheduled occurrence and every parallel child has its own task ID and immutable record.

## Proposed front matter

Version 3 remains a Markdown record with deterministic YAML front matter and Markdown evidence sections.

Core scalar fields:

```yaml
schema: "crossdock.task-record/v3"
task_id: "crossdock-..."
intent: "review"
status: "completed"
created_at: "2026-09-01T00:00:00Z"
completed_at: "2026-09-01T00:05:00Z"

handoff_phase: "review-publication"
parent_task_id: "crossdock-previous"
parent_finding_id: null
family_id: null
schedule_id: null
schedule_occurrence: null

target_repository: "owner/repo"
target_pull_request: 42
target_ref: "feature/example"
target_commit: "<reviewed head sha>"
result_commit: null

agent_adapter: "codex-github-review"
agent_provider: "codex"
agent_surface: "github-review"
agent_task_url: "https://..."

request_evidence: "full"
result_evidence: "full"
request_sha256: "..."
result_sha256: "..."

artifact_count: 2
recovery_state: "clear"
```

`target_commit` is the state inspected or acted on. `result_commit` is a new implementation state produced by the task when one exists. A code review normally has a `target_commit` and no `result_commit`; remediation normally has both.

`handoff_phase` is intentionally separate from `intent`. An implementation task can create an initial PR or update an existing branch; a review can publish a review, persist privately without publication, or attach only a durable reference.

## Evidence sections

Version 3 generalizes v2's prompt/report wording to **Request** and **Result** while preserving the same evidence modes:

- `full` — canonical plaintext plus SHA-256 digest;
- `hash` — digest only;
- `omit` — neither plaintext nor digest.

When `request_evidence: full`:

```markdown
## Request

Review this pull request for correctness and compatibility.
```

When `result_evidence: full`:

```markdown
## Result

### Findings
...
```

The digest is always over the canonical UTF-8/LF representation of the corresponding complete text. `hash` and `omit` never imply that Crossdock is authorized to publish plaintext to another system.

## Durable artifact sections

Each externally addressable artifact is represented by a numbered, machine-readable metadata section. The first implementation may encode these fields as deterministic YAML-like key/value blocks inside Markdown; the parser/writer tests must define the exact grammar before v3 ships.

Conceptual example:

```markdown
## Artifact 1

- type: source-control.review
- adapter: github
- id: 123456
- url: https://github.com/owner/repo/pull/42#pullrequestreview-123456
- target: owner/repo#42
- version: <reviewed head sha>
- visibility: public
- published_evidence: full
- publication_authority: explicit-user
- verification: verified

## Artifact 2

- type: crossdock.task-record
- adapter: github-task-record-storage
- id: <immutable commit/path identity>
- url: https://github.com/.../blob/<sha>/...
- visibility: private
- published_evidence: full
- publication_authority: configured-storage
- verification: verified
```

Core artifact types are namespaced rather than GitHub-specific. A GitHub adapter maps review IDs, PR comments, review threads, PRs, commits, and similar objects into generic typed references. Other providers use their own adapters without inventing GitHub fields.

### Artifact publication metadata

For every external mutation, the record must truthfully preserve enough information to establish:

- destination/provider adapter;
- durable target identity;
- payload/evidence class actually published;
- expected visibility/classification when knowable;
- authority that permitted the publication; and
- remote verification outcome.

A durable artifact identifier alone is insufficient because publication is a separate data flow from record retention.

## Review example

A review task should have approximately:

```yaml
intent: "review"
handoff_phase: "review-publication"
target_repository: "owner/repo"
target_pull_request: 42
target_commit: "abc123..."
result_commit: null
parent_task_id: "implementation-task-id"
```

The Request contains the exact review instructions and optional guidance. The Result contains the complete review report according to the selected retention policy. Typed artifacts link the resulting source-control review/comments/threads where the adapter can prove their identity.

A review with no findings still records what was reviewed and what the agent reported. It does not encode human approval or merge authority.

## Remediation example

A remediation task caused by a review finding should have approximately:

```yaml
intent: "remediate"
handoff_phase: "branch-update"
parent_task_id: "review-task-id"
parent_finding_id: "finding-2"
target_commit: "abc123..."
result_commit: "def456..."
```

The Result describes the remediation and validation. A later re-review is a new `review` task whose `parent_task_id` points to the remediation task and whose `target_commit` is `def456...`.

## Investigation and verification

An `investigate` task may have no external mutation and therefore `artifact_count: 1` only for its immutable task record, or additional artifacts if findings are published elsewhere.

A `verify` task identifies the exact target state being checked. Its result is verification evidence, not an implementation result unless the task also produced a change—in which case that should normally be a separate remediation/implementation task rather than silently mixing intents.

## Scheduled occurrences

A schedule is a coordinator/policy outside one execution record. Each run receives a new `task_id` and may include:

```yaml
schedule_id: "nightly-review"
schedule_occurrence: "2026-09-01T02:00:00Z"
```

The task's intent remains `review`, `verify`, `investigate`, or another supported intent. Retries of the *same occurrence* must preserve idempotency semantics rather than creating an indistinguishable second occurrence record.

## Parallel families

A family groups related work without collapsing executions:

```yaml
family_id: "crossdock-family-..."
```

Each child has its own task ID, intent, target, agent execution, result, artifacts, and record. The family coordinator may maintain separate transient/UI state but must not replace child provenance.

## Recovery state and idempotency

`recovery_state` begins as `clear` and may only be written as completed after required remote verification succeeds.

If an external mutation may have succeeded but Crossdock cannot reconcile a stable remote artifact identity, the task must enter an **ambiguous** operational recovery state and must not blindly repeat that mutation. A final completed record should describe the reconciled durable outcome; abandoned/failed execution-state persistence is a separate lifecycle design and must not fabricate completed provenance.

Adapters should use a stable Crossdock task/artifact correlation marker where the remote system allows one. Retrying an operation may reuse an existing artifact only when equivalence is provable.

## Validation invariants

A v3 writer/parser must enforce at least:

1. `schema` is exactly `crossdock.task-record/v3`.
2. `task_id`, intent, timestamps, adapter/provider/surface, and target identity required by the intent are valid and non-empty.
3. `intent` is a supported v3 vocabulary value; scheduling/family values are never accepted as intents.
4. `review` requires an exact `target_commit`; if a PR is the review target, `target_pull_request` is required.
5. `review` does not imply or encode human approval.
6. `remediate` identifies the target state and resulting commit when code changed.
7. Evidence modes and hashes obey the same canonicalization/truthfulness rules as v2.
8. `artifact_count` exactly matches parsed artifact sections.
9. Every published artifact records publication authority and verification state.
10. Artifact types/identifiers are provider-neutral at the core boundary and adapter-specific only within typed metadata.
11. `hash`/`omit` retained evidence never grants plaintext publication authority.
12. A completed record never claims an external artifact was verified when reconciliation was ambiguous.
13. Scheduling and family membership never collapse multiple executions into one task record.
14. Existing v1/v2 paths/content are never mutated as part of v3 migration.
15. Secret/classification preflight remains destination-adapter-specific and occurs before mutation.

## Path compatibility

Proposed path remains:

```text
crossdock/tasks/<target-owner>/<target-repo>/<yyyy>/<mm>/<task-id>.md
```

The schema identifier, not a path rename, distinguishes v3. Keeping the established path avoids needless storage migration and allows one immutable history containing multiple schema generations.

For work with no source repository, a future target namespace must be designed explicitly rather than inserting fake repository names. The first v3 implementation should remain repository-scoped.

## Migration

There is no in-place migration.

- v1 readers keep v1 semantics.
- v2 readers keep v2 semantics.
- v3-aware readers may read all three versions through version-specific parsers.
- the writer switches to v3 only after parser/renderer, storage, handoff, and compatibility tests are complete.
- historical task records remain byte-for-byte unchanged.

## Implementation sequence

1. Finalize the exact deterministic artifact-section grammar and vocabulary.
2. Add v3 parser/renderer validation tests and golden fixtures.
3. Add typed artifact and publication-policy domain helpers.
4. Add review-specific target/result validation.
5. Extend storage/handoff code without changing v1/v2 readers.
6. Implement one review path end-to-end behind an experimental capability flag.
7. Perform live review → remediation → re-review validation against disposable public PRs.
8. Promote adapter capability status only after dated compatibility evidence exists.

Related: #29, #30, #37, #38.
