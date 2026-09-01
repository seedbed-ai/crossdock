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

## Local handoff service

The experimental browser adapter talks to a loopback Node service. Set a GitHub token in your local environment, then start the service:

```text
GITHUB_TOKEN=... npm start
```

The default endpoint is:

```text
http://127.0.0.1:3210
```

To use another loopback port, start the service with `PORT` and set the same origin in the dashboard's **Crossdock service URL** field:

```text
GITHUB_TOKEN=... PORT=8787 npm start
```

```text
http://127.0.0.1:8787
```

`PORT` must be an integer from 1 through 65535. The browser-facing service URL is intentionally restricted to `http://127.0.0.1:<explicit-port>`; arbitrary hosts, HTTPS endpoints, credentials, paths, query parameters, and fragments are rejected. This is a local security boundary, not a general remote-service configuration option.

When a task starts, Crossdock freezes the selected service URL into the active task state so changing the dashboard preference does not redirect an in-progress handoff or recovery operation.

## What works today

The public implementation can:

- deterministically render immutable task records with independently configurable prompt/report evidence (`full`, `hash`, or `omit`);
- reject several known secret-like patterns before GitHub-backed plaintext persistence;
- create and verify initial PR/update-comment provenance;
- use an explicitly configured GitHub task-record repository;
- recover exact immutable task records and update comments idempotently after retries;
- expose a configurable loopback handoff service with browser-origin restrictions; and
- run an experimental Chromium Manifest V3 adapter/dashboard for ChatGPT → Codex Cloud → GitHub workflows.

The provider adapter intentionally fails closed on ambiguous tabs, controls, repositories, PRs, and recovery states.

## Live testing

Use [`testing/public-live-test.md`](testing/public-live-test.md) for the provider-neutral desktop live-test procedure. That procedure requires an unpacked Chromium-compatible extension, the local Node service, a disposable target repository, and an appropriate private task-record destination.

Syntax/unit/HTTP-boundary CI does not establish authenticated provider compatibility. The live procedure is necessary because provider DOM/control behavior can change independently of Crossdock.

## What does not exist yet

Crossdock does not yet provide a packaged supported desktop application, a mobile implementation, an end-user credential/setup flow, a finalized pluggable storage UI, or a supported compatibility guarantee for the live browser adapter. Those items are tracked publicly rather than implied by the experimental implementation.
