# Task-Record Storage

Task records can contain private source context, prompts, and execution reports. Crossdock therefore requires storage to be selected independently from the public application source repository.

The migrated core currently supports a GitHub-backed destination expressed as an explicit repository and branch. It intentionally has no hard-coded public or Seedbed-private default.

A future configuration layer may support:

- a user-selected private GitHub repository;
- a dedicated private repository configured for Crossdock records;
- local filesystem storage with a stable linking strategy; and
- other adapters that preserve immutable addressing, integrity, and access-control semantics.

A deployment must choose a destination appropriate to the information being persisted. If the destination would expose data beyond its intended confidentiality boundary, persistence should fail closed rather than silently downgrade privacy.
