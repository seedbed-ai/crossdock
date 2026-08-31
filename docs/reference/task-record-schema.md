# Crossdock Task Record Schema

Schema identifier: `crossdock.task-record/v1`

A task record is an immutable Markdown record of one completed coding-agent execution.

## Path

```text
crossdock/tasks/<target-owner>/<target-repo>/<yyyy>/<mm>/<task-id>.md
```

Existing records must not be overwritten. Corrections or follow-up executions create new task records.

## Structure

Each record uses YAML front matter followed by the exact canonical prompt and complete execution report. Current fields are:

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
- `prompt_sha256`
- `report_sha256`

## Invariants

1. Prompt and report text is canonicalized to UTF-8/LF semantics before hashing/rendering.
2. `prompt_sha256` and `report_sha256` are SHA-256 digests of their canonical text.
3. Initial tasks have no parent task.
4. Update tasks identify a pull request and should identify their preceding related task when known.
5. Known secret-like material must fail closed before GitHub-backed persistence.
6. Storage is explicitly configured and must be appropriate for the data's confidentiality.
7. Initial task records are linked from the PR body; later update records are linked from new top-level PR comments rather than rewriting earlier provenance.
8. Durable task record and PR linkage are remotely re-read before a handoff is reported complete.

Readers should reject unknown major schema versions unless they explicitly support them. Additive compatible metadata may be introduced later without weakening these invariants.
