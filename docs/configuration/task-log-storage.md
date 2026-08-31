# Task-Record Storage

Task records can contain private source context, prompts, and execution reports. Crossdock therefore requires storage to be selected independently from the public application source repository.

## Adapter boundary

Crossdock now routes task-record persistence through an implementation-level storage adapter contract identified as `crossdock.task-record-storage/v1`.

A conforming adapter must provide:

- `persistImmutable(...)`, returning the exact path/content, a non-empty immutable version identifier, and a durable URL; and
- `verifyImmutable(...)`, independently re-reading/verifying the expected content for that immutable version.

The handoff core validates the adapter result before it links the record from a pull request. An adapter is therefore responsible for its persistence/addressing mechanics, while Crossdock's handoff layer remains responsible for task-record rendering and PR linkage.

## GitHub adapter

The first implemented adapter is GitHub-backed storage configured with:

```json
{
  "type": "github",
  "repository": "owner/private-records",
  "branch": "main"
}
```

For compatibility, `type` currently defaults to `github` when omitted.

GitHub persistence is create-only. If a retry finds the path already present, Crossdock accepts it only when the existing remote bytes exactly match the expected immutable record, then recovers the commit that introduced/last addressed that path for the durable link. Conflicting content fails closed.

## Future adapters

The adapter boundary is intended to support additional storage without making GitHub repositories the permanent domain model. Candidate backends include:

- a dedicated private record repository;
- local filesystem or local application storage with a stable linking strategy;
- encrypted object storage;
- user-controlled remote stores;
- split-evidence arrangements where different approved stores hold different evidence classes; and
- other backends that can satisfy the selected durability/linkage contract.

Serialized `crossdock.config/v1` currently accepts only the implemented `github` storage kind. Unsupported kinds fail instead of silently falling back. A future adapter must be added deliberately to the configuration schema and public documentation before it is presented as supported.

## Privacy and evidence policy

A storage adapter receives an already-rendered task record. It must not silently add prompt/report evidence that the resolved evidence policy omitted or transform a hash-only record into plaintext retention.

A deployment must choose a destination appropriate to the information actually persisted. If the destination would expose data beyond its intended confidentiality boundary, persistence should fail closed rather than silently downgrade privacy.

Durable storage remains distinct from transient browser/application recovery state. Choosing a private task-record adapter does not by itself authorize additional local history, telemetry, or recovery retention.
