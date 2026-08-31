# Crossdock Task Record Schema

Schema identifier: `crossdock.task-record/v2`

A task record is an immutable Markdown record of one completed coding-agent execution. It always preserves stable handoff metadata. Prompt and report evidence are independently configurable.

## Path

```text
crossdock/tasks/<target-owner>/<target-repo>/<yyyy>/<mm>/<task-id>.md
```

Existing records must not be overwritten. Corrections or follow-up executions create new task records.

## Evidence policy

Each evidence class currently supports three modes:

- `full` — persist the complete canonical plaintext and its SHA-256 digest;
- `hash` — persist only the SHA-256 digest, not plaintext;
- `omit` — persist neither plaintext nor digest.

Prompt and report modes are independent, so the schema supports full evidence, prompt-only, report-only, metadata-only, and mixed hash/plaintext profiles.

If `evidence_policy` is absent at the API boundary, Crossdock currently resolves it to `full` for both fields for compatibility. User-facing clients should expose the effective policy before durable persistence rather than relying on an invisible default.

The schema is intentionally extensible for future explicit modes such as encrypted, external-reference, redacted/transformed, local-only, or expiring evidence. Those modes must not claim plaintext was retained when it was not.

## Structure

Each record uses YAML front matter followed only by plaintext evidence selected as `full`. Current fields are:

- `schema`
- `task_id`
- `task_type` (`initial` or `update`)
- `status`
- `created_at`
- `completed_at`
- `target_repository`
- `base_branch`
- `working_branch`
- `pull_request`
- `issue`
- `agent_task_url`
- `result_commit`
- `parent_task_id`
- `prompt_evidence`
- `report_evidence`
- `prompt_sha256`
- `report_sha256`

`prompt_sha256` or `report_sha256` is `null` when that evidence class uses `omit`. A hash-only record contains the digest but no corresponding Markdown plaintext section.

## Invariants

1. Retained or hashed text is canonicalized to UTF-8/LF semantics before hashing.
2. `full` preserves complete canonical plaintext and its SHA-256 digest.
3. `hash` preserves a digest without plaintext and must not be represented as equivalent to retained plaintext evidence.
4. `omit` preserves neither plaintext nor digest and is represented explicitly in metadata.
5. Secret-like content fails closed when a GitHub-backed record would persist it as plaintext. Omitted/hash-only content is not copied into the record.
6. Initial tasks have no parent task.
7. Update tasks identify a pull request and should identify their preceding related task when known.
8. Storage is explicitly configured and must be appropriate for the confidentiality of the evidence actually retained.
9. Initial task records are linked from the PR body; later update records are linked from new top-level PR comments rather than rewriting earlier provenance.
10. Durable task record and PR linkage are remotely re-read before a handoff is reported complete.
11. Crossdock must not silently broaden evidence retention beyond the effective selected policy.

## Versioning

Version 1 required full prompt and full report evidence. Version 2 adds explicit independent evidence policy and optional prompt/report content.

Readers should reject unknown major schema versions unless they explicitly support them. Additive compatible metadata may be introduced later without weakening truthful provenance, classification, immutability, or linkage semantics.
