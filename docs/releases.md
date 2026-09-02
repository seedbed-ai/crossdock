# Release and Compatibility Policy

Crossdock is in early public development. This policy defines what version numbers, compatibility claims, and migration guarantees mean before 1.0 so contributors and testers can distinguish implemented code from verified or supported behavior.

## Pre-1.0 versioning

Crossdock uses semantic-version-shaped releases (`0.MINOR.PATCH`) before 1.0.

- **Patch** releases should contain compatible fixes, documentation, tests, and narrowly compatible behavior changes.
- **Minor** releases may add features and may contain breaking changes while the product and provider integrations are still stabilizing.
- Every release that changes observable behavior, configuration, schemas, provider assumptions, or setup requirements must say so in its release notes.

Before 1.0, a minor-version bump is the normal signal for an intentional breaking product/API/configuration change. Security fixes or provider breakages may require faster changes; those still need an explicit release-note entry rather than being hidden as compatibility.

## Compatibility levels

Crossdock uses three distinct compatibility concepts.

### Experimental

Implemented and available for testing, but not backed by enough current live evidence for a compatibility commitment. Experimental integrations may change as provider surfaces evolve.

### Verified

A particular workflow completed successfully on a stated Crossdock ref, date, operating system, browser/client, and provider surface. Verification is evidence, not a perpetual guarantee. The public compatibility matrix records this level.

### Supported

A release explicitly declares the integration or platform supported and states the supported boundary. Support is a maintainer commitment to treat regressions inside that boundary as release defects, subject to upstream provider availability and documented constraints.

No integration becomes supported merely because code exists or one live test succeeds. Until a release explicitly says otherwise, the current browser/provider path remains experimental even after individual environments become verified.

## Current platform boundary

At the time this policy was introduced:

- the Node handoff core and repository tests are development surfaces;
- the desktop Chromium-compatible Manifest V3 extension + loopback service is experimental;
- authenticated ChatGPT/Codex/GitHub browser compatibility requires dated live evidence;
- mobile is not an implemented provider-integration path; and
- future desktop wrappers, mobile clients, provider APIs/SDKs, and additional adapters must declare their own compatibility level rather than inheriting one implicitly.

See [`testing/compatibility.md`](testing/compatibility.md) for live evidence rather than inferring support from this document.

## Provider UI and adapter breakage

Provider-specific behavior belongs behind adapters where practical. Provider UI changes can break an adapter without a Crossdock source change.

When a provider surface changes materially:

1. keep prior compatibility evidence as historical evidence;
2. mark newly observed failures explicitly rather than deleting older successes;
3. avoid claiming current verification until the affected path is re-tested; and
4. fail closed when Crossdock cannot identify the intended control, repository, PR, branch, task, or result unambiguously.

A provider workaround must not silently weaken privacy, evidence, publication, recovery, or remote-verification semantics.

## Configuration compatibility

The configuration schema has its own explicit schema identifier. Compatible additions to an existing schema version may define deterministic defaults for fields that older documents could not contain.

Configuration handling must:

- preserve an explicit user choice when a defined migration exists;
- use documented historical defaults only for genuinely absent legacy fields;
- reject explicit invalid/unsupported values rather than treating them as missing;
- merge scoped partial configuration without resetting unrelated choices; and
- fail with an actionable error instead of silently coercing a future or misspelled option.

A change that cannot obey those rules should use a new configuration schema version rather than redefining old bytes ambiguously.

## Task-record compatibility

Immutable task records are historical evidence. Released task-record schema versions are never migrated in place or rewritten merely because Crossdock gains a newer schema.

A new task-record schema version may add capabilities or change representation, but existing records retain their original schema identity and bytes. Readers may add support for older versions; writers must not relabel an old record as a new version without constructing a new record under the new contract.

Production adoption of a newer schema is separate from implementing or experimenting with its codec.

## Deprecation

Before 1.0, Crossdock will prefer an explicit deprecation period when a safe compatibility path exists, but it does not promise a fixed number of releases for every experimental surface. Provider removals, security boundaries, or dangerous behavior may require immediate disablement.

A deprecation should state:

- what is being deprecated;
- the replacement or migration path, when one exists;
- the earliest release in which removal may occur; and
- whether the change affects stored data, configuration, adapters, or user-visible workflow behavior.

Silent deprecation is not acceptable.

## Release notes

Contributor-facing releases should summarize at least:

- notable user-visible changes;
- compatibility level changes;
- provider/browser/platform observations that materially affect use;
- configuration or schema additions/migrations;
- privacy/security boundary changes;
- known limitations and live-test gaps; and
- breaking changes or deprecations.

A release should link the compatibility matrix rather than copying transient live-test claims into permanent marketing language.

## What CI proves

Repository CI proves the deterministic code/test surfaces exercised by the workflow. It does **not** prove authenticated provider UI compatibility, browser rollout compatibility, account/workspace variants, or mobile behavior.

Those claims require live evidence. Keeping these evidence classes separate lets contributors trust a green test suite without mistaking it for a promise about an external provider surface.