# Crossdock

Crossdock is an open-source workflow tool for moving bounded engineering work across conversation, AI coding-agent execution, and GitHub review without making the developer manually shuttle prompts, state, results, and recovery context between tools.

> **Status:** early public development. The deterministic handoff core, loopback service, and experimental desktop Chromium browser adapter are public and under test. Crossdock does not yet have a supported end-user desktop/mobile release, and authenticated provider compatibility still requires live validation.

> **Testers wanted:** independent public live testing is the current highest-value contribution. See [issue #28](https://github.com/seedbed-ai/crossdock/issues/28) and [`docs/testing/public-live-test.md`](docs/testing/public-live-test.md). No private Seedbed infrastructure is required.

## Why Crossdock?

AI coding agents can already implement, review, investigate, and update software. The awkward part is often the handoff around them: carrying the right context into the task, keeping repository/PR identity straight, recovering safely after partial remote mutations, deciding what task evidence should be retained or published, and proving that the intended GitHub state actually exists.

Crossdock is building that coordination layer. Its goal is not to replace ChatGPT, Codex, GitHub, or future providers; it is to make work move between them as one recoverable, user-controlled workflow.

The initial route is ChatGPT → Codex Cloud → GitHub. Crossdock keeps that provider integration replaceable where practical rather than making provider names the product model.

## What exists today

The public repository currently contains:

- a deterministic task-record and GitHub handoff core;
- a task-record storage adapter boundary with a GitHub-backed adapter;
- independently configurable prompt/report evidence retention (`full`, `hash`, or `omit`);
- idempotent immutable-record and update-comment retry handling;
- a shared configuration resolver with explicit scope precedence;
- a configurable loopback HTTP handoff service restricted to numeric loopback;
- an experimental Manifest V3 browser adapter and responsive dashboard;
- provider-neutral agent capability modeling and a proposed/experimental v3 task-record path for review and other non-implementation work;
- public live-test, compatibility, architecture, configuration, security, development, and contribution documentation; and
- GitHub Actions validation for the Node/JavaScript surfaces.

The current v2 implementation still presents task-record linkage through the initial PR body and later update comments. Product direction now treats durable storage and GitHub-visible presentation as independent user choices; [issue #44](https://github.com/seedbed-ai/crossdock/issues/44) tracks configurable publication surfaces. The browser adapter remains fail-closed and experimental until authenticated live compatibility testing establishes current provider behavior.

## Ways to help right now

You do not need private Seedbed access to contribute. Particularly useful work includes:

- **Live testing:** exercise the real ChatGPT → Codex → GitHub flow and report successes or failures in [#28](https://github.com/seedbed-ai/crossdock/issues/28).
- **Browser compatibility:** help harden provider/UI boundaries and recovery behavior in [#11](https://github.com/seedbed-ai/crossdock/issues/11).
- **Code review workflows:** help make agent review a first-class Crossdock task in [#29](https://github.com/seedbed-ai/crossdock/issues/29).
- **Design:** contribute visual identity [#2](https://github.com/seedbed-ai/crossdock/issues/2), desktop UX [#3](https://github.com/seedbed-ai/crossdock/issues/3), or mobile UX [#4](https://github.com/seedbed-ai/crossdock/issues/4).
- **Accessibility:** establish and exercise the cross-device baseline in [#14](https://github.com/seedbed-ai/crossdock/issues/14).
- **Configuration/privacy/storage:** contribute to [#7](https://github.com/seedbed-ai/crossdock/issues/7), [#8](https://github.com/seedbed-ai/crossdock/issues/8), [#19](https://github.com/seedbed-ai/crossdock/issues/19), or [#44](https://github.com/seedbed-ai/crossdock/issues/44).
- **Documentation/community:** improve the public documentation [#9](https://github.com/seedbed-ai/crossdock/issues/9) or contributor/community infrastructure [#10](https://github.com/seedbed-ai/crossdock/issues/10).

Small, focused contributions are welcome. A reproducible compatibility failure, accessibility finding, documentation correction, or narrow regression test can be as useful as a larger feature.

## Workflow and user control

A completed Crossdock task creates an immutable task record with stable handoff metadata. Prompt and execution-report evidence are independently configurable: current records can retain full canonical evidence, retain only an integrity hash, or omit either evidence class entirely.

Automation is a choice, not an assumption. The current dashboard supports both automatic handoff and review-before-handoff, plus explicit task-record storage. User-facing configuration is intended to expand rather than force one privacy, retention, storage, publication, or workflow preference on every user.

Crossdock independently verifies durable handoff state before reporting completion and fails closed when repository, PR, branch, provider control, or recovery identity is ambiguous.

## Desktop and mobile

Crossdock targets one task-centric workflow across form factors:

- **Desktop:** a clean workspace with task state, external surfaces, handoff controls, errors, and history visible together where useful. The current experimental implementation uses a Chromium extension plus a loopback Node service; packaging/wrapper architecture remains under evaluation.
- **Mobile:** a focused step flow with compact task state and links/deep links to external surfaces rather than three desktop panes squeezed onto a phone. The current browser-extension/localhost integration is not a mobile implementation.

Both experiences must expose the same essential state and capabilities while using layouts and integration mechanisms appropriate to the device.

## Try it or contribute

For local development, Crossdock currently requires Node.js 22 or newer and has no third-party runtime dependencies:

```text
npm test
npm run check
```

For the experimental authenticated workflow, follow [`docs/testing/public-live-test.md`](docs/testing/public-live-test.md) rather than guessing setup or manually rescuing a failed handoff. Successful environment reports are useful too; compatibility evidence is accumulated in [`docs/testing/compatibility.md`](docs/testing/compatibility.md).

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for contribution expectations and [`docs/README.md`](docs/README.md) for the full documentation map. GitHub Discussions is a good place for questions, ideas, workflow/design conversation, and testing/compatibility discussion that is not yet a concrete bug or scoped issue.

## Security and privacy

Prompts and execution reports may contain private development context. Crossdock source is public; user task records are not therefore public. Users can choose how much prompt/report evidence to retain, and broader transient-data controls are under active design. See [`SECURITY.md`](SECURITY.md), [`docs/architecture/security-boundaries.md`](docs/architecture/security-boundaries.md), and [`docs/reference/task-record-schema.md`](docs/reference/task-record-schema.md).

Never post access tokens, cookies, credentials, private prompts/reports, private repository contents, or other sensitive material in a public issue, discussion, screenshot, fixture, commit, or pull request.

## License

Crossdock is free/open-source software licensed under **GNU AGPL-3.0-or-later**. See [`LICENSE`](LICENSE).
