# Getting Started

Crossdock does not yet have a supported end-user release. This guide covers contributor setup and points live testers to the current experimental desktop adapter procedure.

## Requirements

- Node.js 22 or newer
- Git

## Development

Clone the public repository, then run:

```text
npm test
npm run check
```

The current code has no third-party runtime dependencies.

## What works today

The public implementation can:

- deterministically render immutable task records with independently configurable prompt/report evidence (`full`, `hash`, or `omit`);
- reject several known secret-like patterns before GitHub-backed plaintext persistence;
- create and verify initial PR/update-comment provenance;
- use an explicitly configured GitHub task-record repository;
- recover exact immutable task records and update comments idempotently after retries;
- expose a loopback handoff service with browser-origin restrictions; and
- run an experimental Chromium Manifest V3 adapter/dashboard for ChatGPT → Codex Cloud → GitHub workflows.

The provider adapter intentionally fails closed on ambiguous tabs, controls, repositories, PRs, and recovery states.

## Live testing

Use [`testing/public-live-test.md`](testing/public-live-test.md) for the provider-neutral desktop live-test procedure. That procedure requires an unpacked Chromium-compatible extension, the local Node service, a disposable target repository, and an appropriate private task-record destination.

Syntax/unit/HTTP-boundary CI does not establish authenticated provider compatibility. The live procedure is necessary because provider DOM/control behavior can change independently of Crossdock.

## What does not exist yet

Crossdock does not yet provide a packaged supported desktop application, a mobile implementation, an end-user credential/setup flow, a finalized pluggable storage UI, or a supported compatibility guarantee for the live browser adapter. Those items are tracked publicly rather than implied by the experimental implementation.
