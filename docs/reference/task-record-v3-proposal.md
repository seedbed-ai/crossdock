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

Version 3 must answer, for one completed agent execution:

1. What bounded work was requested and with what intent?
2. What globally unambiguous source repository/change/version was inspected or changed?
3. What originating issue/work item, if any, caused the request?
4. Which agent adapter/provider execution performed it?
5. What result was retained under the selected evidence policy?
6. What external publication was forbidden, not requested, authorized and completed, or terminally failed?
7. What remotely addressable artifacts were created or linked, and how were they verified?
8. What earlier immutable task record or durable finding caused this task?
9. What schedule occurrence or parallel family does it belong to without collapsing independent executions?

Ambiguous in-flight remote state is deliberately **not** encoded as a completed v3 task record. It belongs to recoverable operational state until reconciled.

## Orthogonal concepts

Version 3 keeps these concepts independent:

- **intent** — `implement`, `review`, `investigate`, `triage`, `remediate`, or `verify`;
- **source target** — source-control adapter, host, opaque native repository/change identities, refs, and exact version state;
- **origin** — optional provider-neutral issue/work-item identity that caused the delegated work;
- **handoff phase** — source-control state such as initial change creation, branch update, review publication, or no source-control mutation;
- **execution policy** — ordinary one-shot execution or one occurrence of a schedule;
- **family membership** — optional grouping for related/parallel tasks;
- **lineage** — causal parent task plus a durable locator for its already-finalized record and, only when resolvable, a causal finding artifact within that parent context;
- **retention evidence policy** — what Crossdock stores in this immutable record;
- **publication decisions** — independent authorization and terminal outcome for each external payload/destination;
- **durable artifacts** — externally addressable objects created or linked by the execution/handoff.

Scheduling and parallelism are not intents. Every scheduled occurrence and every parallel child has its own task ID and immutable record.

## Proposed deterministic structure

Version 3 remains one UTF-8/LF Markdown file, but metadata and arbitrary evidence must not share an ambiguous Markdown-heading grammar.

The file has:

1. deterministic YAML front matter containing all machine-readable metadata, including source/origin identity, lineage, publication decisions, and durable-artifact references; then
2. zero, one, or two **byte-length-delimited** plaintext evidence payloads for Request and Result when their mode is `full`.

A parser consumes each payload by its declared UTF-8 byte length. It must never scan evidence text for headings or sentinels. A review request/result may itself contain YAML, `## Artifact 1`, fenced code, or arbitrary Unicode without changing parse boundaries.

Conceptual framing:

```text
---
<deterministic metadata>
---
X-Crossdock-Evidence: request; bytes=123
<exactly 123 UTF-8 bytes>
X-Crossdock-Evidence: result; bytes=456
<exactly 456 UTF-8 bytes>
```

The experimental codec may use canonical JSON-compatible YAML (JSON is a YAML 1.2 subset) to freeze one deterministic metadata grammar without adding a YAML dependency. Golden parser/renderer fixtures must freeze the exact wire representation before production v3 writing is enabled.

## Proposed metadata

Representative conceptual fields:

```yaml
schema: "crossdock.task-record/v3"
task_id: "crossdock-..."
intent: "review"
status: "completed"
created_at: "2026-09-01T00:00:00Z"
completed_at: "2026-09-01T00:05:00Z"

handoff_phase: "review-publication"
family_id: null
schedule_id: null
schedule_occurrence: null

source:
  adapter: "github"
  host: "github.com"
  repository_id: "owner/repo"
  change_id: "42"
  base_ref: "main"
  working_ref: "feature/example"
  target_version: "<reviewed or pre-change sha>"
  result_version: null

origin:
  adapter: "github"
  host: "github.com"
  type: "issue"
  id: "17"
  url: "https://github.com/owner/repo/issues/17"

parent_task_id: "crossdock-previous"
parent_record:
  storage_adapter: "github-task-record-storage"
  locator: "owner/private-records:crossdock/tasks/.../crossdock-previous.md"
  version: "<immutable storage version>"
  sha256: "<digest of exact parent-record bytes>"
causal_artifact: null

agent:
  adapter: "codex-github-review"
  provider: "codex"
  surface: "github-review"
  task_url: "https://..."

evidence:
  request: { mode: "full", sha256: "...", bytes: 123 }
  result: { mode: "full", sha256: "...", bytes: 456 }

publications: []
artifacts: []
recovery_state: "clear"
```

### Opaque source identity

The v3 core does not define repository slugs or numeric pull-request IDs. `source.repository_id` and optional `source.change_id` are **opaque native identifiers interpreted by the named source adapter**.

For GitHub.com an adapter may map:

- repository ID: `owner/repo`;
- change ID: `42` for pull request 42.

Another forge may use hierarchical, UUID, URI-like, or otherwise native identifiers without inventing a GitHub-shaped convention. `source.adapter` and `source.host` qualify those opaque values.

`base_ref` and `working_ref` remain separate so v3 does not lose provenance already present in v2 initial handoffs. `target_version` is the exact source state inspected/acted on; `result_version` is a new state produced by the execution when one exists.

## Originating issue/work item

Version 2 persists an optional `issue`. Version 3 preserves and generalizes that provenance through optional `origin` metadata rather than a GitHub-only numeric field.

An origin contains at least adapter, host, type, opaque native ID, and optionally a verified URL. Example types include `issue`, `ticket`, or another versioned provider-neutral work-item class.

The origin is not necessarily the source target. A review may target one change while originating from a separate issue/ticket.

## Retained evidence

Version 3 generalizes v2's prompt/report wording to **Request** and **Result** while preserving the same modes:

- `full` — canonical plaintext plus SHA-256 digest and byte length;
- `hash` — digest only; no plaintext payload and byte length is null;
- `omit` — neither plaintext nor digest; byte length is null.

The digest is over the complete canonical UTF-8/LF evidence text. `hash` and `omit` never grant permission to publish plaintext elsewhere.

## Publication decisions are independent from retention and artifacts

Publication metadata exists even when no external artifact is created. A private review remains auditable without inventing a review object.

Each publication decision contains at least:

- stable Crossdock publication/correlation ID;
- destination adapter and host;
- opaque target identity;
- payload class such as `request`, `result`, `summary`, or `finding`;
- representation such as `full`, `hash`, or `omit`;
- expected visibility/classification when knowable;
- authority source;
- requested state: `forbidden`, `not-requested`, or `authorized`;
- **terminal completed-record outcome**: `not-attempted`, `published`, or `failed`;
- durable artifact reference only when publication succeeded and identity was reconciled.

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

A scalar `published_evidence: full` is insufficient because it cannot identify which evidence class was published. Authorizing Result publication never authorizes Request publication by implication.

For `forbidden` or `not-requested`, no mutation is allowed and `artifact_id` is null. For a completed record, `authorized + not-attempted` represents an explicitly authorized action that was intentionally not part of this completed handoff; `failed` is a terminal known failure. A remotely ambiguous mutation does not finalize a task record at all until reconciled.

## Durable artifacts

Durable artifacts are typed references stored structurally in front matter. Core fields are provider-neutral; adapters map provider-specific identifiers into them.

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

The task record **must not contain a durable artifact entry for itself** when that entry depends on the record's own storage commit/hash/URL. The final storage identity does not exist until the record bytes are committed.

Task-record storage identity and post-write verification belong to the storage/handoff result or a separately persisted verification/index envelope. The immutable task record describes the delegated execution and independently existing external artifacts.

## Independently traversable lineage

A bare `parent_task_id` is not sufficient for durable lineage because task-record location depends on storage destination/path/version and the parent may have been written to a different store.

When `parent_task_id` is present, v3 requires `parent_record`, describing the already-finalized parent's immutable location with:

- storage adapter/type;
- opaque locator/address understood by that storage adapter;
- immutable version when the backend has one; and
- SHA-256 of the exact parent-record bytes.

The child can therefore locate and verify its parent without relying on transient coordinator state. This is not self-reference: the **child** records identity for an already-finalized parent.

`causal_artifact` is optional and resolves **inside the parent record identified by `parent_record`**. It may name a durable typed review finding/thread artifact defined by that parent record. If no durable finding identity exists, lineage stops truthfully at the parent task.

Example remediation:

```yaml
intent: "remediate"
parent_task_id: "review-task-id"
parent_record:
  storage_adapter: "github-task-record-storage"
  locator: "..."
  version: "..."
  sha256: "..."
causal_artifact: "artifact-review-thread-2"
source:
  target_version: "abc123..."
  result_version: "def456..."
```

A later re-review is a new `review` record whose parent is the remediation and whose `target_version` is the remediation's resulting source version.

## Review example

A review record identifies:

- source adapter/host;
- opaque repository and change identity;
- base/working refs where meaningful;
- exact `target_version` reviewed;
- optional originating issue/work item;
- exact retained Request and Result evidence policy;
- independent publication decisions;
- durable review/comment/thread artifacts only when actually produced and verified; and
- independently resolvable parent lineage when the review follows implementation/remediation.

A clean agent review never becomes human approval or merge authority.

## Investigation and verification

An `investigate` task may have no external publication and may produce no external durable artifacts. Its publication policy can explicitly say `forbidden` or `not-requested`.

A `verify` task identifies the exact target version being checked. Its result is verification evidence, not an implementation result. If a fix is produced, model it as a separate remediation/implementation execution rather than silently mixing intents.

## Scheduled occurrences

A schedule is coordinator/policy state outside one execution record. Each occurrence receives a new `task_id` and may include:

```yaml
schedule_id: "nightly-review"
schedule_occurrence: "2026-09-01T02:00:00Z"
```

The intent remains `review`, `verify`, `investigate`, or another supported intent. Retrying the same occurrence must preserve correlation/idempotency rather than create an indistinguishable second occurrence.

## Parallel families

A family groups related work without collapsing executions:

```yaml
family_id: "crossdock-family-..."
```

Each child has its own task ID, intent, source target, agent execution, result, publication decisions, artifacts, lineage, and immutable record.

## Recoverable operational state and ambiguous mutations

A completed immutable record cannot truthfully contain an `ambiguous` publication outcome that later mutates into `published` or `failed`. Therefore ambiguity is prohibited in completed v3 records.

Crossdock needs a separate recoverable operational-state envelope, proposed as a distinct versioned concept such as `crossdock.recovery-state/v1`. It is **not** a completed provenance record. Its purpose is crash/retry safety while an execution is unresolved.

At minimum it preserves:

- task ID and intended final record schema;
- current workflow phase;
- source target/version;
- agent execution identity;
- effective retention/publication policy;
- publication correlation marker(s);
- pre-mutation remote snapshot when available;
- whether a remote mutation was invoked;
- any candidate remote artifact identities discovered;
- last verification/error state; and
- enough information to prove equivalence or refuse retry.

If a remote mutation may have succeeded but equivalence cannot be proven, recovery state becomes `ambiguous` and blind retry is prohibited. After reconciliation, Crossdock may complete the original execution with terminal `published` or `failed` publication metadata and then persist the immutable v3 task record. Recovery state may then be archived/deleted according to the configured lifecycle policy.

If an operator chooses to abandon an unresolved execution, that abandonment should be recorded as a separate immutable operational event/record rather than rewriting a completed task record that never existed.

## Validation invariants

A v3 writer/parser must enforce at least:

1. `schema` is exactly `crossdock.task-record/v3`.
2. `task_id`, intent, timestamps, agent adapter/provider/surface, and intent-required source fields are valid and non-empty.
3. Source identity includes adapter and host plus **opaque** native repository/change identifiers; core validation never assumes `owner/repo` or numeric PR syntax.
4. Optional originating issue/work-item provenance uses a provider-neutral origin object with opaque native ID.
5. `base_ref` and `working_ref` remain independent and are required where handoff semantics require them.
6. `intent` is a supported v3 intent; scheduling/family values are never intents.
7. `review` requires an exact target version and a source change identity.
8. `review` never encodes human approval or merge authority.
9. A source-changing branch-update/remediation records both target and resulting version.
10. Evidence modes, hashes, byte lengths, and payload presence obey deterministic canonicalization rules.
11. Evidence parsing is byte-length-delimited; arbitrary evidence text can never be parsed as metadata.
12. Every publication states payload class, representation, authority, requested state, and **terminal** outcome independently of artifact creation.
13. Ambiguous mutation state is rejected from completed v3 records and handled only in recoverable operational state.
14. `hash`/`omit` retained evidence never grants plaintext publication authority.
15. Durable artifact types are provider-neutral at the core boundary; provider-specific IDs remain adapter metadata.
16. The task record never embeds its own self-referential final storage identity.
17. `parent_task_id` requires an immutable parent-record locator/version/digest so lineage is independently traversable.
18. A specific causal finding resolves within the identified parent record to a durable typed artifact; otherwise lineage stops at the parent task.
19. A completed record never claims a remote artifact was verified unless reconciliation succeeded.
20. Scheduling and family membership never collapse multiple executions into one task record.
21. Existing v1/v2 paths/content are never mutated as part of v3 migration.
22. Destination-specific secret/classification preflight occurs before every external mutation.

## Path compatibility

The current GitHub task-record store uses:

```text
crossdock/tasks/<target-owner>/<target-repo>/<yyyy>/<mm>/<task-id>.md
```

That storage layout is an adapter convention, not a v3 core identity grammar. Because v3 `source.repository_id` is opaque, future stores/forges may require a host/adapter namespace or another addressing strategy. Storage adapters must expose an immutable locator that can later be embedded in child `parent_record` lineage.

Existing v1/v2 paths are never renamed. The first v3 implementation may remain GitHub/repository-scoped while the core model stays provider-neutral.

## Migration

There is no in-place migration.

- v1 readers keep v1 semantics.
- v2 readers keep v2 semantics.
- v3-aware readers may read all three through version-specific parsers.
- the writer switches to v3 only after parser/renderer, storage, lineage, handoff, recovery-state, and compatibility tests are complete.
- historical task records remain byte-for-byte unchanged.

## Implementation sequence

1. Freeze deterministic metadata and byte-length evidence framing with golden fixtures.
2. Implement an isolated v3 parser/renderer without changing the active v2 writer.
3. Add opaque source/origin identity, publication-decision, durable-artifact, and immutable parent-locator helpers.
4. Define and implement recoverable operational state for ambiguous remote mutations.
5. Add review-specific target/result validation and publication preflight.
6. Extend storage/handoff code while preserving v1/v2 readers and historical records.
7. Implement one review path end-to-end behind an experimental capability flag.
8. Add remediation/re-review lineage using parent-record locators and durable typed finding artifacts where available.
9. Perform live review → remediation → re-review validation against disposable public PRs.
10. Promote adapter capability status only after dated compatibility evidence exists.

Related: #29, #30, #37, #38.
