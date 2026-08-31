# Contributing to Crossdock

Crossdock is in early public development. Contributions are welcome across implementation, browser integration, desktop/mobile UX, accessibility, documentation, graphic design, testing, packaging, provider adapters, and workflow research.

## Start here

1. Read [`README.md`](README.md), [`AGENTS.md`](AGENTS.md), and the documentation index in [`docs/README.md`](docs/README.md).
2. Search the public issues before starting work.
3. For a substantial new direction, open or join an issue before investing heavily so the user need and architecture boundary can be discussed publicly.
4. Keep private material out of the public repository. Never include private prompts/reports, credentials, access tokens, cookies, customer data, or private source in issues, fixtures, screenshots, commits, or pull requests.

Good first contributions include documentation fixes, focused tests, accessibility improvements, narrow provider-compatibility fixes, and reproducible live-test reports.

## Development

Crossdock currently requires Node.js 22 or newer and has no third-party runtime dependencies.

```text
npm test
npm run check
```

Both commands must pass for implementation changes. Add focused tests for new behavior and regression tests for defects whenever the behavior can be exercised without a live provider session.

The current browser adapter also has a live compatibility boundary. Follow [`docs/testing/public-live-test.md`](docs/testing/public-live-test.md) when testing authenticated provider behavior. A failure report is useful; do not manually repair the workflow before recording the failing state.

## Code quality

Keep modules cohesive and put behavior at the narrowest appropriate boundary:

- provider-independent workflow/configuration/storage logic belongs in `src/`;
- browser-extension UI and provider DOM automation belong in `extension/`;
- executable service startup stays at the repository root only when it is a true entry point;
- tests mirror the behavior they cover under `tests/`;
- public concepts, architecture, configuration, testing, and development guidance belong under the corresponding `docs/` section.

Prefer small functions with explicit inputs over hidden global coupling. Validate untrusted/provider-derived state at boundaries and fail closed when identity or intent is ambiguous.

Comments should explain **why** a non-obvious constraint exists, a recovery state is necessary, or an external/provider behavior is surprising. Do not add comments that merely narrate obvious JavaScript. Public APIs and adapter contracts should be named and documented clearly enough that most call sites do not need explanatory comments.

Avoid provider names in the core domain model when a provider-neutral concept is sufficient. Provider-specific behavior belongs behind an adapter or integration boundary.

## Pull requests and review

Keep changes bounded and explain:

- the user/developer problem addressed;
- the implementation approach;
- validation performed;
- privacy/security implications when relevant;
- desktop/mobile implications when relevant; and
- compatibility or migration consequences.

PRs should be reviewable independently. Avoid mixing unrelated cleanup with behavioral changes unless the cleanup is required to make the change safe or understandable.

Do not weaken fail-closed behavior, truthful evidence semantics, immutable task-record behavior, or remote handoff verification merely to make automation appear successful.

AI-assisted implementation and review are welcome, including Codex, but generated work is held to the same test, security, privacy, and review standards as human-written work. AI review is an additional signal, not merge authority.

## Public live testing

Public testers do not need access to private Seedbed infrastructure. Use disposable target repositories and an appropriate private/user-controlled task-record destination when retained evidence is sensitive.

Use the live-test issue template for environment/results. Never post tokens, cookies, private prompt/report plaintext, or other secrets in a public test report.

## Design contributions

Graphic design and UX work should be attached to or linked from public issues. Prefer editable/source assets plus documented usage constraints over flattened exports alone. Designs should account for light/dark contexts, accessibility, responsive layouts, keyboard interaction, and touch targets from the beginning.

## Security reports

Do not open a public issue for an unpatched vulnerability that would put users at risk. Follow [`SECURITY.md`](SECURITY.md) for the current reporting boundary.