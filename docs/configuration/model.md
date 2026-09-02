# Configuration Model

Crossdock uses one configuration model across workflow surfaces so desktop, mobile, service, and future clients can resolve the same effective behavior.

Schema identifier: `crossdock.config/v1`.

## Current fields

The shared model contains:

- `handoff_mode`: `review` or `automatic`;
- `evidence_policy.prompt`: `full`, `hash`, or `omit`;
- `evidence_policy.report`: `full`, `hash`, or `omit`;
- `storage`: `null` or a configured task-record storage destination. The first implemented storage kind is `github` with `repository` and `branch`;
- `service_url`: the local loopback handoff-service origin used by the browser adapter;
- `publication`: where task-record provenance is presented outside the durable task-record store;
- `recovery.prompt`: whether prompt plaintext may be persisted locally for crash/restart recovery; and
- `recovery.report`: whether captured provider-report plaintext may be persisted locally for crash/restart recovery.

The model is intentionally conservative: a setting should not appear as implemented merely because Product intends to support it later. Additional privacy, lifecycle, provider, storage, and UI settings can extend versioned configuration as their behavior becomes real.

## Precedence

`resolveConfig()` applies layers from least to most specific:

1. built-in defaults;
2. global user/deployment settings;
3. provider settings;
4. workspace settings;
5. repository settings;
6. per-task settings.

A more specific layer overrides only the fields it supplies. Partial evidence, publication, and recovery policy are merged field-by-field, so a repository or task can change one choice without accidentally changing unrelated retention/publication behavior.

A more specific layer can explicitly set `storage: null` to clear an inherited destination, and can set `publication.committed_file: null` to disable an inherited committed-file destination. A workflow that requires durable storage must fail clearly until another valid destination is selected.

Provider limitations and security rules are constraints, not hidden high-priority preference layers: validation should reject an unsupported effective configuration rather than silently overriding the user's visible choice.

## Defaults

The current compatibility defaults are:

```json
{
  "schema": "crossdock.config/v1",
  "handoff_mode": "review",
  "evidence_policy": {
    "prompt": "full",
    "report": "full"
  },
  "storage": null,
  "service_url": "http://127.0.0.1:3210",
  "publication": {
    "change_description": "link",
    "change_comment": "link",
    "committed_file": null
  },
  "recovery": {
    "prompt": "persist",
    "report": "persist"
  }
}
```

The compatibility defaults preserve Crossdock's historical behavior while making publication and recovery persistence explicit rather than hidden implementation policy. Existing v1 configuration documents and active browser tasks that predate these fields migrate to the historical defaults. A config written during the prompt-only recovery era therefore gains `recovery.report: persist` rather than silently changing prior report recovery behavior.

These are implementation defaults, not permanent product policy. User-facing clients should display consequential effective choices before durable persistence or external mutation. Future evidence may justify different defaults without removing supported alternatives.

## Recovery persistence is separate from durable evidence

`evidence_policy.prompt` and `evidence_policy.report` answer what evidence belongs in the immutable task record. `recovery.prompt` and `recovery.report` independently answer whether the corresponding plaintext may be written into transient browser-local state while an active task is recoverable.

Both recovery fields use the same modes:

- `persist` — allow that active-task plaintext to be stored in local recovery state so a dashboard/browser restart can continue a task that still needs the original bytes; and
- `memory` — keep that plaintext only in the live process after capture and remove it from persisted active-task recovery state.

Prompt recovery also covers the persisted dashboard form because prompt content exists there before task submission. Memory-only prompt recovery therefore removes prompt plaintext from both the persisted form and active-task state.

`memory` is intentionally a privacy/recoverability tradeoff, not an encryption feature. While the dashboard remains alive, Crossdock can complete normally using in-memory content. After a restart, intentionally discarded bytes are unavailable. If durable evidence is `full` or `hash`, Crossdock must fail recovery clearly when those original bytes are already required; it must not reconstruct, recapture, or silently widen persistence. If the corresponding durable evidence is `omit`, recovery may continue without those bytes.

For reports, the bytes only become recovery-critical after the provider report has actually been captured. A task configured with `recovery.report: memory` can therefore restart normally while it is still waiting for provider completion. After report capture, a restart may make `full`/`hash` report evidence intentionally unrecoverable; report `omit` remains recoverable without report bytes.

Changing a visible recovery preference after a task starts must not alter that task's frozen recovery policy. Crossdock never silently turns `memory` into `persist` merely to make recovery succeed.

The shared configuration contract now carries both recovery choices. The current browser UI still exposes prompt recovery only; report-recovery UI/state wiring is the next execution slice. Encrypted/OS-secure recovery storage, retention windows, completed-task history, diagnostics, expiration, and deletion remain separate lifecycle work rather than being inferred from these fields.

## Publication and durable storage are separate

`storage` answers where the immutable task record is persisted. `publication` answers whether and how a reference or summary is presented on other durable surfaces. Disabling a publication surface must never silently disable task-record persistence or widen retained prompt/report evidence somewhere else.

The current source-control presentation fields are provider-neutral concepts:

- `change_description`: provenance presentation in the source change's durable description/body;
- `change_comment`: provenance presentation in a durable source-change comment/update surface.

The shared configuration schema accepts:

- `link` — publish a durable task-record link/reference;
- `summary` — publish a bounded summary representation under publication-specific safety rules; or
- `none` — do not publish Crossdock provenance on that surface.

The current browser + loopback-service execution path implements **`link` and `none`** for both source-change surfaces. It deliberately rejects `summary` before any publication or task-record mutation because summary construction/publication semantics are not implemented yet. The browser UI therefore exposes only `link` and `none` today rather than silently coercing unsupported choices.

It is valid to set both source-change surfaces to `none` while retaining an immutable task record elsewhere. In that mode the current handoff still persists and remotely verifies the configured task record, but does not rewrite the initial PR body for Crossdock provenance and does not create an update provenance comment. Completion remains truthful about what was and was not published.

Publication choices are frozen into active browser task state at submission. Editing the visible preference while a task is running must not change recovery or publication behavior for that already-started task.

### Committed-file publication

`publication.committed_file` is either `null` or an explicit destination object. The initial configuration contract accepts only the GitHub adapter:

```json
{
  "presentation": "reference",
  "adapter": "github",
  "repository": "owner/provenance",
  "branch": "main",
  "path_template": "crossdock/provenance/{task_id}.md"
}
```

`presentation` currently supports `link` and `reference` in the configuration contract. Crossdock deliberately does not expose a retained-record/full-record committed-file mode because that requires a separate self-reference, classification, and immutable-identity design rather than silently copying task-record bytes into another GitHub path.

The path template must be repository-relative, may not traverse with `..`, and must contain `{task_id}` so independent task publications cannot collide by default.

**Committed-file publication is not executed by the current handoff service yet.** A configured committed-file destination fails before durable or source-control mutation. Implementation still requires classification/secret preflight, retry/idempotency handling, independent remote verification, and mapping into the provider-neutral v3 publication/artifact contract.

## Loopback service URL

`service_url` is deliberately narrower than a generic HTTP endpoint. The current browser/service architecture accepts only:

```text
http://127.0.0.1:<explicit-port>
```

The scheme must be `http`, the host must be exactly the numeric loopback host `127.0.0.1`, and an explicit TCP port from 1 through 65535 is required. Credentials, paths, query parameters, and fragments are rejected.

This restriction is a security boundary. A configurable arbitrary host would allow task data and GitHub-bound handoff requests to be redirected away from the local Crossdock service. Supporting a future remote/control-plane service therefore requires a separate authenticated transport design rather than relaxing this field.

The extension permission is host-scoped (`http://127.0.0.1/*`) so the configured port may change without granting arbitrary network access.

When a browser task begins, its resolved service URL is copied into the active task state. Recovery and subsequent handoff operations continue using that frozen endpoint even if the dashboard preference changes mid-task. Tasks created by builds that predate `service_url` deterministically migrate to the historical fixed endpoint `http://127.0.0.1:3210`.

The Node service remains bound to `127.0.0.1`; its `PORT` environment variable must match the browser's selected `service_url` port.

## Strict validation

Unknown scopes, unknown fields, unsupported enum values, malformed repositories, invalid service endpoints, unsafe committed-file templates, unsupported recovery modes, and unsupported storage/publication adapters fail instead of being ignored. This prevents a misspelled privacy, publication, recovery, or transport setting from silently falling back to broader behavior.

Configuration parsers must not treat an unsupported future option as its nearest current equivalent. Preserve the user's requested value when possible, migrate it explicitly when a defined migration exists, or fail with an actionable explanation.

## Storage normalization

The first storage representation is:

```json
{
  "type": "github",
  "repository": "owner/private-records",
  "branch": "main"
}
```

For compatibility, `type` may be omitted and currently normalizes to `github`. The shared model must not make GitHub storage the permanent architectural boundary; future storage adapters will add explicit kinds and their own validated settings.

## Privacy and user agency

Configuration is the user's statement of desired behavior. Crossdock must not silently retain more evidence, perform more automation, persist more recovery plaintext, or select a broader publication/data destination than the resolved configuration says.

Durable evidence settings are not a complete data-lifecycle policy. Collection, transient processing, crash recovery, local history, diagnostics, expiration, deletion, encryption, and sharing are separate configuration areas and must remain distinguishable as they are implemented.

## Effective summary

The core exposes `effectiveConfigSummary()` so user interfaces can show the consequential resolved choices without exposing unrelated internal configuration structure. The summary includes the effective service URL, publication policy, and recovery policy because those choices change where task data may be sent or retained. Desktop and mobile clients should use an equivalent effective-summary concept before a consequential action.
