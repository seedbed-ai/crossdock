# Repository Layout

Crossdock keeps provider-independent workflow code, provider/browser integration, tests, and public documentation in separate boundaries so each surface can evolve without becoming the product's domain model.

```text
crossdock/
├── .github/                 GitHub contribution, CI, and issue/PR surfaces
├── docs/                    Public concepts, architecture, configuration, testing, and development docs
├── extension/               Browser-extension UI and authenticated provider DOM adapter
├── src/                     Provider-independent Node/workflow/configuration/storage modules
├── tests/                   Node tests for `src/` and service boundaries
├── server.js                Current local-service executable entry point
├── package.json             Node package metadata and validation commands
├── README.md                Public project landing page
├── CONTRIBUTING.md          Contributor workflow and quality expectations
├── SECURITY.md              Security/reporting boundary
└── AGENTS.md                Repository-specific agent/contributor operating rules
```

## `src/`

`src/` owns reusable application/workflow logic that should remain useful when provider adapters or application shells change. Current modules include configuration resolution, task-record rendering, immutable storage adapters, GitHub API access, handoff orchestration, the HTTP boundary, and service dispatch.

A provider name should appear in `src/` only when the module actually implements that provider's API boundary (for example `github-client.js`). Generic task/evidence/configuration concepts should not acquire provider names merely because the first implementation uses one provider.

## `extension/`

`extension/` owns the current experimental Manifest V3 browser integration. It may know about concrete provider URLs, semantic DOM selectors, tabs, browser storage, and the dashboard UI. Provider-DOM assumptions should not leak into `src/`.

The extension is not the long-term desktop or mobile architecture by definition. Desktop/mobile wrapper decisions are tracked separately and should reuse the shared workflow/configuration core where practical.

## `tests/`

Tests mirror reusable code and service behavior. Provider-DOM behavior that cannot be exercised deterministically without an authenticated live session belongs in the public live-test procedure until a stable fixture/harness can reproduce it locally.

Regression fixes should add deterministic tests whenever the failure can be represented without a live provider.

## `docs/`

Documentation is organized by intent:

- `concepts/` — provider-neutral mental model and workflow concepts;
- `configuration/` — effective settings, precedence, evidence, storage, and handoff behavior;
- `architecture/` — implementation boundaries, security, browser integration, and compatibility decisions;
- `reference/` — concrete schema/API-level reference;
- `testing/` — public/manual/live test procedures and reporting guidance;
- `development/` — repository structure and contributor-facing implementation guidance.

Do not copy private product/governance source material into the public repository. Public docs should describe the resulting public behavior and implementation boundary.