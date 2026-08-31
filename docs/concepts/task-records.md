# Task Records

A completed Crossdock execution has one immutable task record containing stable handoff metadata and whatever prompt/report evidence the user or deployment explicitly selected.

Task records are execution provenance, not merge authority. They provide a durable index of what Crossdock did without forcing every user to retain the same amount of private task content.

Prompt and report evidence are independent choices. A user may retain complete plaintext, retain only a hash, or omit that evidence class entirely. The record must state the effective policy truthfully so absence is never mistaken for evidence that exists elsewhere.

Crossdock should favor user control and data minimization. Defaults are convenience, not a reason to lock users into a retention policy. Future schema/configuration work may add encrypted, external-reference, redacted/transformed, local-only, expiring, or other evidence modes where their meaning can be represented unambiguously.

Task records may contain private development context. Their storage location is therefore explicit configuration. The public Crossdock source repository is never an implicit task-record destination.

Initial tasks link the record from the PR body. Subsequent executions on the same PR branch receive distinct records and distinct top-level PR comments so earlier provenance is not overwritten.

Durable task-record retention is separate from transient collection and crash-recovery state. A user who omits durable evidence may still care whether Crossdock temporarily holds that content locally; that lifecycle is tracked as an independent privacy/control concern.

See the implementation-level schema in [`../reference/task-record-schema.md`](../reference/task-record-schema.md).
