# Crossdock Documentation

Crossdock is in early public development. These documents describe the intended workflow and the currently implemented boundaries without claiming unsupported UI or provider compatibility.

## Start here

- [`getting-started.md`](getting-started.md) — current development setup and project status.
- [`testing/README.md`](testing/README.md) — automated vs live validation and reporting guidance.
- [`testing/public-live-test.md`](testing/public-live-test.md) — provider-neutral desktop live-test steps for public testers.
- [`testing/compatibility.md`](testing/compatibility.md) — dated public evidence for tested browser/OS/workflow combinations.
- [`releases.md`](releases.md) — pre-1.0 versioning, compatibility levels, migration/deprecation rules, and release-note expectations.
- [`accessibility.md`](accessibility.md) — current dashboard accessibility guardrails and manual acceptance checks.

## Concepts

- [`concepts/workflow.md`](concepts/workflow.md) — task lifecycle from prompt through PR handoff.
- [`concepts/task-records.md`](concepts/task-records.md) — durable task metadata and configurable evidence retention.
- [`concepts/adapters.md`](concepts/adapters.md) — provider boundary model.
- [`concepts/agent-capabilities.md`](concepts/agent-capabilities.md) — provider-neutral work-item intents, first-class code review, persistence, and capability-advertising model.

## Configuration

- [`configuration/model.md`](configuration/model.md) — shared configuration schema, scopes, precedence, validation, and user-agency semantics.
- [`configuration/handoff-mode.md`](configuration/handoff-mode.md) — automatic vs review-before-handoff behavior.
- [`configuration/task-record-storage.md`](configuration/task-record-storage.md) — storage adapter, privacy, and configuration semantics.

## Architecture

- [`architecture/overview.md`](architecture/overview.md) — evolving technical architecture.
- [`architecture/security-boundaries.md`](architecture/security-boundaries.md) — public source, browser sessions, credentials, and task data.
- [`architecture/browser-integration.md`](architecture/browser-integration.md) — browser-control strategy and fail-closed requirements.
- [`architecture/live-testing.md`](architecture/live-testing.md) — authenticated-provider validation checklist and failure cases.

## Development and reference

- [`development/repository-layout.md`](development/repository-layout.md) — source/test/docs organization and ownership boundaries.
- [`reference/work-item-request.md`](reference/work-item-request.md) — implemented provider-neutral pre-delegation request and review preflight contract.
- [`reference/task-record-schema.md`](reference/task-record-schema.md) — current production task-record v2 schema.
- [`reference/task-record-v3-proposal.md`](reference/task-record-v3-proposal.md) — accepted v3 design and experimental codec contract for review, remediation, verification, scheduling, families, publication policy, and typed durable artifacts; production writers still emit v2.
- [`reference/codex-capabilities.md`](reference/codex-capabilities.md) — dated mapping from current Codex features to Crossdock's provider-neutral capability model.
- [`roadmap.md`](roadmap.md) — public development sequence.

For contribution workflow and code-quality expectations, see [`../CONTRIBUTING.md`](../CONTRIBUTING.md).
