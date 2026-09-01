# Task Record v3 Proposal

Status: **design proposal; not yet emitted by Crossdock**.

This proposal extends Crossdock's durable execution record so code reviews, investigations, remediations, verifications, scheduled occurrences, and parallel task families can use the same provenance system as implementation work without changing the historical meaning of `crossdock.task-record/v1` or `/v2`.

## Decision: keep the `task-record` name

The proposed successor identifier is:

```text
crossdock.task-record/v3
```

A review, investigation, or remediation is still a bounded delegated task. Existing v1/v2 records remain immutable and are never rewritten into v3.

## Design goals

Version 3 must answer, for one agent execution:

1. What bounded work was requested and with what intent?
2. What globally unambiguous repository/change/commit state was inspected or changed?
3. Which agent adapter/provider execution performed it?
4. What result was retained under the selected evidence policy?
5. What external publication was requested, forbidden, attempted, completed, or left ambiguous?
6. What remotely addressable artifacts were created or linked, and how were they verified?
7. What earlier task or durable finding caused this task?
8. What schedule occurrence or parallel family does it belong to without collapsing independent executions?
9. If a remote mutation became ambiguous, what prevents an unsafe duplicate retry?

## Orthogonal concepts

Version 3 keeps these concepts independent:

- **intent** — `implement`, `review`, `investigate`, `triage`, `remediate`, or `verify`;
- **source target** — source-control adapter, host, repository identity, refs, PR/change identity, and exact commit state;
- **handoff phase** — source-control state such as initial PR creation, branch update, review publication, or no source-control mutation;
- **execution policy** — ordinary one-shot execution or one occurrence of a schedule;
- **family membership** — optional grouping for related/parallel tasks;
- **lineage** — causal parent task and, only when durably resolvable, a causal finding artifact;
- **retention evidence policy** — what Crossdock stores in this immutable record;
- **publication decisions** — independent authorization and outcome for each external payload/destination;
- **durable artifacts** — externally addressable objects created or linked by the execution/handoff.

Scheduling and parallelism are not intents. Every scheduled occurrence and every parallel child has its own task ID and immutable record.

## Proposed deterministic structure

Version 3 remains one UTF-8/LF Markdown file, but metadata and arbitrary evidence must not share an ambiguous Markdown-heading grammar.

The file has:

1. deterministic YAML front matter containing all machine-readable metadata, including publication decisions and durable-artifact references; then
2. zero, one, or two **byte-length-delimited** plaintext evidence payloads for Request and Result when their mode is `full`.

A parser consumes each payload by its declared UTF-8 byte length. It must never scan evidence text for headings or sentinels. This means a review request/result may itself contain `## Artifact 1`, YAML, fenced code, or any other text without changing parse boundaries.

Conceptual framing:

```text
---
<deterministic YAML metadata>
---

X-Crossdock-Evidence: request; bytes=123
<exactly 123 UTF-8 bytes>
X-Crossdock-Evidence: result; bytes=456
<exactly 456 UTF-8 bytes>
```

The exact framing syntax is still proposal-level; golden parser/renderer fixtures must freeze it before v3 ships. Byte count, not a terminator string, defines each evidence boundary.

## Proposed front matter

Representative fields:

```yaml
schema: "crossdock.task-record/v3"
task_id: "crossdock-..."
intent: "review"
status: "completed"
created_at: "2026-09-01T00:00:00Z"
completed_at: "2026-09-01T00:05:00Z"

handoff_phase: "review-publication"
parent_task_id: "crossdock-previous"
causal_artifact: null
family_id: null
schedule_id: null
schedule_occurrence: null

source_adapter: "github"
source_host: "github.com"
target_repository: "owner/repo"
target_pull_request: 42
base_ref: "main"
working_ref: "feature/example"
target_commit: "<reviewed or pre-change sha>"
result_commit: null

agent_adapter: "codex-github-review"
agent_provider: "codex"
agent_surface: "github-review"
agent_task_url: "https://..."

request_evidence: "full"
result_evidence: "full"
request_sha256: "..."
result_sha256: "..."
request_bytes: 123
result_bytes: 456

publication_count: 1
artifact_count: 1
recovery_state: "clear"
```

`source_adapter` and `source_host` qualify the repository independently of the agent adapter. `owner/repo` alone is not globally unique across GitHub.com, GitHub Enterprise hosts, or other forges.

`base_ref` and `working_ref` remain separate so v3 does not lose provenance already present in v2 initial handoffs. Either may be null only when it has no meaning for the intent/target.

`target_commit` is the exact state inspected or acted on. `result_commit` is a new implementation state produced by the task when one exists. A review normally has `target_commit` and no `result_commit`; remediation that changes code normally has both.

## Retained evidence

Version 3 generalizes v2's prompt/report wording to **Request** and **Result** while preserving the same modes:

- `full` — canonical plaintext plus SHA-256 digest and byte length;
- `hash` — digest only; no plaintext payload and byte length is null;
- `omit` — neither plaintext nor digest; byte length is null.

The digest is over the complete canonical UTF-8/LF evidence text. `hash` and `omit` never grant permission to publish plaintext elsewhere.

## Publication decisions are independent records of authority and outcome

Publication metadata must exist even when no external artifact was created. A private review therefore remains auditable without inventing an artifact.

Each publication decision is a structured front-matter entry with at least:

- stable Crossdock publication ID/correlation marker;
- destination adapter and host;
- target identity;
- payload class: `request`, `result`, `summary`, `finding`, or another versioned class;
- representation: `full`, `hash`, `omit`, or another explicitly supported publication representation;
- expected visibility/classification when knowable;
- authority source;
- requested state: `forbidden`, `not-requested`, or `authorized`;
- outcome: `not-attempted`, `published`, `failed`, or `ambiguous`;
- durable artifact reference when publication produced one and identity was reconciled.

Conceptual YAML:

```yaml
publications:
  - publication_id: "pub-review-result"
    destination_adapter: "github"
    destination_host: "github.com"
    target: "owner/repo#42"
    payload_class: "result"
    representation: "full"
    visibility: "public"
    authority: "explicit-user"
    requested: "authorized"
    outcome: "published"
    artifact_id: "artifact-review-1"
```

A scalar such as `published_evidence: full` is insufficient because it cannot say *which* evidence class was published. An adapter must never infer permission to publish Request text merely because Result publication was authorized.

For `forbidden` or `not-requested`, `artifact_id` is null and no mutation is allowed. `authorized + not-attempted` may permit a later attempt according to workflow state. `ambiguous` prohibits blind retry until remote equivalence is reconciled.

## Durable artifacts

Durable artifacts are typed references stored structurally in front matter, not Markdown sections. Core fields are provider-neutral; adapters map provider-specific IDs into them.

Conceptual YAML:

```yaml
artifacts:
  - artifact_id: "artifact-review-1"
    type: "source-control.review"
    adapter: "github"
    host: "github.com"
    remote_id: "123456"
    url: "https://github.com/owner/repo/pull/42#pullrequestreview-123456"
    target: "owner/repo#42"
    version: "<reviewed head sha>"
    verification: "verified"
```

The task record **must not contain a durable artifact entry for itself** when that entry depends on the record's own storage commit/hash/URL. That would be self-referential: writing the final identity into the bytes would change the identity being described.

Task-record storage identity and post-write verification belong to the storage/handoff result or a separately persisted verification envelope/index. The immutable task record describes the delegated execution and external artifacts whose identity exists independently before record bytes are finalized.

## Review example

A review task should include approximately:

```yaml
intent: "review"
handoff_phase: "review-publication"
source_adapter: "github"
source_host: "github.com"
target_repository: "owner/repo"
target_pull_request: 42
base_ref: "main"
working_ref: "feature/example"
target_commit: "abc123..."
result_commit: null
parent_task_id: "implementation-task-id"
causal_artifact: null
```

Request contains the review instructions under its selected retention mode. Result contains the review report under its selected retention mode. Publication decisions independently say whether any Result, summary, or finding may be sent to the source-control review surface.

A clean agent review never becomes human approval or merge authority.

## Findings and remediation lineage

Crossdock must not invent a free-form `parent_finding_id` that cannot be resolved later.

A remediation may point to:

1. the parent review task alone; or
2. a **typed durable finding artifact** referenced by `causal_artifact` when the parent execution/provider/source-control surface produced a stable, remotely or durably resolvable finding/thread identity.

If Result evidence is `hash`/`omit` and no durable finding artifact exists, the remediation may truthfully say it descends from the review task, but it must not claim a more specific finding identity.

Example:

```yaml
intent: "remediate"
parent_task_id: "review-task-id"
causal_artifact: "artifact-review-thread-2"
target_commit: "abc123..."
result_commit: "def456..."
```

A later re-review is a new `review` task whose parent is the remediation and whose `target_commit` is `def456...`.

## Investigation and verification

An `investigate` task may have no publication decisions beyond explicitly recorded `not-requested`/`forbidden` policy and may produce no external durable artifacts.

A `verify` task identifies the exact target state being checked. Its result is verification evidence, not an implementation result. If a fix is produced, model the fix as a separate remediation/implementation execution rather than silently mixing intents.

## Scheduled occurrences

A schedule is coordinator/policy state outside one execution record. Each occurrence receives a new `task_id` and may include:

```yaml
schedule_id: "nightly-review"
schedule_occurrence: "2026-09-01T02:00:00Z"
```

The intent remains `review`, `verify`, `investigate`, or another supported intent. Retrying the same occurrence must preserve idempotency and correlation rather than create an indistinguishable second occurrence.

## Parallel families

A family groups related work without collapsing executions:

```yaml
family_id: "crossdock-family-..."
```

Each child has its own task ID, intent, target, agent execution, result, publication decisions, artifacts, and record.

## Recovery and idempotency

`recovery_state` describes whether all required remote mutations were reconciled for this completed record.

Each external publication/mutation should carry a stable Crossdock correlation marker when the destination allows one. If a mutation may have succeeded but Crossdock cannot prove whether the intended remote artifact exists, its publication outcome becomes `ambiguous` and the workflow must stop rather than repeat the mutation.

Only after reconciliation may an ambiguous outcome become `published` or `failed`. A completed record must never claim `verified` for an artifact whose identity remains ambiguous.

Operational state for an unfinished/ambiguous execution may need a separate recoverable state document; it must not fabricate a completed immutable task record.

## Validation invariants

A v3 writer/parser must enforce at least:

1. `schema` is exactly `crossdock.task-record/v3`.
2. `task_id`, intent, timestamps, agent adapter/provider/surface, and intent-required target fields are valid and non-empty.
3. Source repository identity includes source adapter and host; `owner/repo` alone is insufficient.
4. `base_ref` and `working_ref` remain independent fields and are required when the handoff semantics require them.
5. `intent` is a supported v3 intent; scheduling/family values are never accepted as intents.
6. `review` requires an exact `target_commit`; PR review requires a target PR/change identity.
7. `review` never encodes human approval or merge authority.
8. `remediate` identifies target state and resulting commit when code changed.
9. Evidence modes, hashes, byte lengths, and presence/absence of payloads obey deterministic canonicalization rules.
10. Evidence parsing is byte-length-delimited; arbitrary evidence text can never be parsed as metadata.
11. `publication_count` and `artifact_count` match their structured front-matter collections.
12. Every publication states payload class, representation, authority, requested state, and outcome independently of artifact creation.
13. `hash`/`omit` retained evidence never grants plaintext publication authority.
14. Durable artifact types are provider-neutral at the core boundary; provider-specific IDs remain adapter metadata.
15. The task record never embeds a self-referential final storage identity that cannot exist before its bytes are committed.
16. A specific causal finding is accepted only when it resolves to a durable typed artifact; otherwise lineage stops at the parent task.
17. A completed record never claims a remote artifact was verified while publication identity is ambiguous.
18. Scheduling and family membership never collapse multiple executions into one task record.
19. Existing v1/v2 paths/content are never mutated as part of v3 migration.
20. Destination-specific secret/classification preflight occurs before every external mutation.

## Path compatibility

For repository-scoped work, the proposed path remains:

```text
crossdock/tasks/<target-owner>/<target-repo>/<yyyy>/<mm>/<task-id>.md
```

The record itself carries `source_adapter` and `source_host`, so identical repository slugs on different forges remain distinguishable even if a configured store uses the same path convention. A future multi-forge storage layout may add host/adapter path namespaces; that is a storage-addressing concern and must not rewrite existing records.

For work with no source repository, a future target namespace must be designed explicitly rather than inserting fake repository names. The first v3 implementation remains repository-scoped.

## Migration

There is no in-place migration.

- v1 readers keep v1 semantics.
- v2 readers keep v2 semantics.
- v3-aware readers may read all three versions through version-specific parsers.
- the writer switches to v3 only after parser/renderer, storage, handoff, and compatibility tests are complete.
- historical task records remain byte-for-byte unchanged.

## Implementation sequence

1. Freeze the exact deterministic YAML subset and byte-length evidence framing with golden fixtures.
2. Implement v3 parser/renderer validation without changing the active v2 writer.
3. Add source-target, publication-decision, typed-artifact, and lineage domain helpers.
4. Add review-specific target/result validation and publication preflight.
5. Extend storage/handoff code while preserving v1/v2 readers and immutable historical content.
6. Implement one review path end-to-end behind an experimental capability flag.
7. Add remediation and re-review lineage using durable typed finding artifacts where available.
8. Perform live review → remediation → re-review validation against disposable public PRs.
9. Promote adapter capability status only after dated compatibility evidence exists.

Related: #29, #30, #37, #38.
