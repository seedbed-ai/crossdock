# Configuration Model

Crossdock uses one configuration model across workflow surfaces so desktop, mobile, service, and future clients can resolve the same effective behavior.

Schema identifier: `crossdock.config/v1`.

## Current fields

The shared model contains:

- `handoff_mode`: `review` or `automatic`;
- `evidence_policy.prompt`: `full`, `hash`, or `omit`;
- `evidence_policy.report`: `full`, `hash`, or `omit`;
- `storage`: `null` or a configured task-record storage destination. The first implemented storage kind is `github` with `repository` and `branch`;
- `service_url`: the local loopback handoff-service origin used by the browser adapter; and
- `publication`: where task-record provenance is presented outside the durable task-record store.

The model is intentionally conservative: a setting should not appear as implemented merely because Product intends to support it later. Additional privacy, lifecycle, provider, storage, and UI settings can extend versioned configuration as their behavior becomes real.

## Precedence

`resolveConfig()` applies layers from least to most specific:

1. built-in defaults;
2. global user/deployment settings;
3. provider settings;
4. workspace settings;
5. repository settings;
6. per-task settings.

A more specific layer overrides only the fields it supplies. Partial evidence policy and publication policy are merged field-by-field, so a repository can change one presentation surface without accidentally changing evidence retention or another surface.

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
  }
}
```

The publication defaults preserve Crossdock's current behavior while making it explicit rather than mandatory Product policy. Existing v1 configuration documents that predate `publication` normalize to these compatibility defaults.

These are implementation defaults, not permanent product policy. User-facing clients should display consequential effective choices before durable persistence or external mutation. Future evidence may justify different defaults without removing supported alternatives.

## Publication and durable storage are separate

`storage` answers where the immutable task record is persisted. `publication` answers whether and how a reference or summary is presented on other durable surfaces. Disabling a publication surface must never silently disable task-record persistence or widen retained prompt/report evidence somewhere else.

The current source-control presentation fields are provider-neutral concepts:

- `change_description`: provenance presentation in the source change's durable description/body;
- `change_comment`: provenance presentation in a durable source-change comment/update surface.

Each supports:

- `link` — publish a durable task-record link/reference;
- `summary` — publish a bounded summary representation under the later publication adapter's safety rules; or
- `none` — do not publish provenance on that surface.

It is valid to set both source-change surfaces to `none` while retaining an immutable task record elsewhere. Completion must remain truthful about what was and was not published.

### Committed-file publication

`publication.committed_file` is either `null` or an explicit destination object. The initial implemented configuration accepts only the GitHub adapter:

```json
{
  "presentation": "reference",
  "adapter": "github",
  "repository": "owner/provenance",
  "branch": "main",
  "path_template": "crossdock/provenance/{task_id}.md"
}
```

`presentation` currently supports `link` and `reference`. Crossdock deliberately does not expose a retained-record/full-record committed-file mode yet because that requires a separate self-reference, classification, and immutable-identity design rather than silently copying task-record bytes into another GitHub path.

The path template must be repository-relative, may not traverse with `..`, and must contain `{task_id}` so independent task publications cannot collide by default. Actual publication still requires classification/secret preflight, retry/idempotency handling, remote verification, and mapping into the provider-neutral v3 publication/artifact contract before it can be considered implemented end-to-end.

Configuration support therefore does not by itself mean the handoff service currently executes every configured publication destination. Unsupported execution combinations must fail clearly rather than being silently coerced back to the compatibility defaults.

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

Unknown scopes, unknown fields, unsupported enum values, malformed repositories, invalid service endpoints, unsafe committed-file templates, and unsupported storage/publication adapters fail instead of being ignored. This prevents a misspelled privacy, publication, or transport setting from silently falling back to broader behavior.

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

Configuration is the user's statement of desired behavior. Crossdock must not silently retain more evidence, perform more automation, or select a broader publication/data destination than the resolved configuration says.

Durable evidence settings are not a complete data-lifecycle policy. Collection, transient processing, crash recovery, local history, diagnostics, expiration, deletion, encryption, and sharing are separate future configuration areas and must remain distinguishable as they are implemented.

## Effective summary

The core exposes `effectiveConfigSummary()` so user interfaces can show the consequential resolved choices without exposing unrelated internal configuration structure. The summary includes the effective service URL and publication policy because those choices change where task data or provenance may be sent. Desktop and mobile clients should use an equivalent effective-summary concept before a consequential action.
