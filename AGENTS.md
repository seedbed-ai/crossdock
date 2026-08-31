# Crossdock Agent Guide

Crossdock is a public implementation and contribution repository. It owns Crossdock application code, public technical documentation, tests, releases, and implementation-level schemas/adapters. Private Seedbed Product requirements and Company governance remain upstream authorities and must not be copied here as private content.

## Working rules

1. Read this file, the root README, and the relevant docs/source/tests before consequential changes.
2. Keep provider-specific behavior behind explicit boundaries where practical; ChatGPT, Codex, and GitHub are initial integrations rather than Crossdock's domain model.
3. Do not put private prompts, execution reports, credentials, tokens, customer data, or Seedbed-private task logs in this public repository.
4. Fail closed when a target repository, branch, PR, browser control, or task-record destination is ambiguous.
5. Preserve immutable task-record and remote-verification semantics when changing handoff behavior.
6. Treat desktop and mobile as first-class experiences sharing one workflow model, not as separate products.
7. Work through public issues/PRs for actionable design, documentation, implementation, and compatibility work.

## Validation

For the migrated Node handoff core, run:

```text
npm test
npm run check
```

Expand validation as UI, extension, service, and packaging surfaces are added.

## Authority and privacy

Public documentation may explain Crossdock behavior and implementation. Do not reproduce private Product planning or Company policy merely for convenience. Local implementation should state the technical consequence needed to operate safely.
