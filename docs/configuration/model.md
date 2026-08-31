# Configuration Model

Crossdock uses one configuration model across workflow surfaces so desktop, mobile, service, and future clients can resolve the same effective behavior.

Schema identifier: `crossdock.config/v1`.

## Current fields

The initial shared model contains:

- `handoff_mode`: `review` or `automatic`;
- `evidence_policy.prompt`: `full`, `hash`, or `omit`;
- `evidence_policy.report`: `full`, `hash`, or `omit`; and
- `storage`: `null` or a configured storage destination. The first implemented storage kind is `github` with `repository` and `branch`.

The model is intentionally small: a setting should not appear as implemented merely because Product intends to support it later. Additional privacy, lifecycle, provider, storage, and UI settings can extend versioned configuration as their behavior becomes real.

## Precedence

`resolveConfig()` applies layers from least to most specific:

1. built-in defaults;
2. global user/deployment settings;
3. provider settings;
4. workspace settings;
5. repository settings;
6. per-task settings.

A more specific layer overrides only the fields it supplies. Partial evidence policy is merged field-by-field, so a repository can change report retention without accidentally changing prompt retention.

A more specific layer can explicitly set `storage: null` to clear an inherited destination. A workflow that requires durable storage must then fail clearly until another valid destination is selected.

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
  "storage": null
}
```

These are implementation defaults, not permanent product policy. User-facing clients should display consequential effective choices before durable persistence or external mutation. Future evidence may justify different defaults without removing supported alternatives.

## Strict validation

Unknown scopes, unknown fields, unsupported enum values, malformed repositories, and unsupported storage kinds fail instead of being ignored. This prevents a misspelled privacy setting from silently falling back to broader retention.

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

Configuration is the user's statement of desired behavior. Crossdock must not silently retain more evidence, perform more automation, or select a broader data destination than the resolved configuration says.

Durable evidence settings are not a complete data-lifecycle policy. Collection, transient processing, crash recovery, local history, diagnostics, expiration, deletion, encryption, and sharing are separate future configuration areas and must remain distinguishable as they are implemented.

## Effective summary

The core exposes `effectiveConfigSummary()` so user interfaces can show the consequential resolved choices without exposing unrelated internal configuration structure. Desktop and mobile clients should use an equivalent effective-summary concept before a consequential action.
