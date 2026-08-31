# Crossdock

Crossdock is an open-source workflow tool for moving bounded engineering work across conversation, coding-agent execution, and GitHub review without making the developer manually copy state between tools.

> **Status:** early public development. The deterministic handoff core, loopback service, and experimental desktop Chromium browser adapter are public and under test. Crossdock does not yet have a supported end-user desktop/mobile release, and authenticated provider compatibility still requires live validation.

## What Crossdock is building

The initial route is ChatGPT → Codex Cloud → GitHub. Crossdock keeps that provider integration replaceable where practical rather than making provider names the product model.

A completed Crossdock task creates an immutable task record with stable handoff metadata. Prompt and execution-report evidence are independently configurable: current records can retain full canonical evidence, retain only an integrity hash, or omit either evidence class entirely. Crossdock links the record from the initial pull request or a later top-level PR update comment and independently verifies the durable GitHub handoff before reporting completion.

Automation is a choice, not an assumption. The current dashboard supports both automatic handoff and review-before-handoff, plus explicit task-record storage. User-facing configuration is intended to expand rather than force one privacy, retention, storage, or workflow preference on every user.

## Desktop and mobile

Crossdock targets one task-centric workflow across form factors:

- **Desktop:** a clean workspace with task state, external surfaces, handoff controls, errors, and history visible together where useful. The current experimental implementation uses a Chromium extension plus a loopback Node service; packaging/wrapper architecture remains under evaluation.
- **Mobile:** a focused step flow with compact task state and links/deep links to external surfaces rather than three desktop panes squeezed onto a phone. The current browser-extension/localhost integration is not a mobile implementation.

Both experiences must expose the same essential state and capabilities while using layouts and integration mechanisms appropriate to the device.

## Current repository contents

The repository currently contains:

- the deterministic task-record and GitHub handoff core;
- explicit configurable GitHub task-record storage;
- configurable prompt/report evidence retention;
- idempotent immutable-record and update-comment retry handling;
- a loopback HTTP handoff service;
- an experimental Manifest V3 browser adapter and responsive dashboard;
- public live-test, architecture, configuration, security, and contribution documentation; and
- GitHub Actions validation for the Node/JavaScript surfaces.

The browser adapter remains fail-closed and experimental until authenticated live compatibility testing establishes the current provider DOM/control behavior.

## Documentation

Start with [`docs/README.md`](docs/README.md). Public testers should use [`docs/testing/public-live-test.md`](docs/testing/public-live-test.md). The documentation covers the workflow model, configurable task evidence, configuration direction, architecture/security boundaries, live-testing expectations, and roadmap.

## Contributing

Crossdock is intended for public contribution. See [`CONTRIBUTING.md`](CONTRIBUTING.md) and the public issue tracker. UX, graphic design, documentation, accessibility, adapters, packaging, privacy controls, configuration, and implementation work are all expected contribution areas.

## Security and privacy

Prompts and execution reports may contain private development context. Crossdock source is public; user task records are not therefore public. Users can choose how much prompt/report evidence to retain, and broader transient-data controls are under active design. See [`SECURITY.md`](SECURITY.md), [`docs/architecture/security-boundaries.md`](docs/architecture/security-boundaries.md), and the task-record schema reference.

## License

Crossdock is free/open-source software licensed under **GNU AGPL-3.0-or-later**. See [`LICENSE`](LICENSE).
