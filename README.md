# Crossdock

Crossdock is an open-source workflow tool for moving bounded engineering work across conversation, coding-agent execution, and GitHub review without making the developer manually copy state between tools.

> **Status:** early public development. The deterministic GitHub handoff core is being migrated from private incubation; the desktop/mobile application and live browser integration are not yet a supported release.

## What Crossdock is building

The initial route is ChatGPT → Codex Cloud → GitHub. Crossdock keeps that provider integration replaceable where practical rather than making provider names the product model.

A Crossdock task can preserve the exact delegated prompt and complete execution report as one durable task record, create an initial pull request or update an existing PR branch, and independently verify that the durable GitHub handoff exists before reporting completion.

Automation is a choice, not an assumption. The product is being designed to support both automatic handoff and review-before-handoff, plus configurable task-record storage so a public source repository never becomes the accidental destination for private prompts or reports.

## Desktop and mobile

Crossdock targets one task-centric workflow across form factors:

- **Desktop:** a clean workspace with task state, external surfaces, handoff controls, errors, and history visible together where useful.
- **Mobile:** a focused step flow with compact task state and links/deep links to external surfaces rather than three desktop panes squeezed onto a phone.

Both experiences must expose the same essential state and capabilities while using layouts appropriate to the device.

## Current repository contents

The first public bootstrap migrates the provider-neutral parts of the existing deterministic handoff core and establishes public project documentation. Browser/Codex UI automation will move only after it is separated from Seedbed-private defaults and reviewed for public disclosure.

## Documentation

Start with [`docs/README.md`](docs/README.md). The documentation will grow with the implementation and currently covers the workflow model, task records, configuration direction, architecture/security boundaries, and roadmap.

## Contributing

Crossdock is intended for public contribution. See [`CONTRIBUTING.md`](CONTRIBUTING.md) and the public issue tracker. UX, graphic design, documentation, accessibility, adapters, packaging, and implementation work are all expected contribution areas.

## Security and privacy

Prompts and execution reports may contain private development context. Crossdock source is public; user task records are not therefore public. See [`SECURITY.md`](SECURITY.md) and [`docs/architecture/security-boundaries.md`](docs/architecture/security-boundaries.md).

## License

Crossdock will use a free/open-source GNU-family copyleft license. Exact GPL-vs-AGPL selection is being finalized before the first public release; no license grant should be inferred until the `LICENSE` file is added.
