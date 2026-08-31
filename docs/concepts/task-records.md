# Task Records

A completed Crossdock execution has one immutable task record containing the exact canonical delegated prompt, complete final execution report, stable task metadata, and integrity digests.

The record is execution provenance, not merge authority. It allows a reviewer or later automation to reconstruct what was delegated and what the coding agent reported without stuffing the complete transcript into every PR body.

Task records may contain private development context. Their storage location is therefore explicit configuration. The public Crossdock source repository is never an implicit task-record destination.

Initial tasks link the record from the PR body. Subsequent executions on the same PR branch receive distinct records and distinct top-level PR comments so earlier provenance is not overwritten.

See the implementation-level schema in [`../reference/task-record-schema.md`](../reference/task-record-schema.md).
