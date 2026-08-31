# Getting Started

Crossdock does not yet have an end-user release. This guide currently covers contributor setup for the migrated handoff core.

## Requirements

- Node.js 22 or newer
- Git

## Development

Clone the repository, then run:

```text
npm test
npm run check
```

The current code has no third-party runtime dependencies.

## What works today

The migrated core can deterministically render task records, reject several known secret-like patterns before GitHub persistence, construct initial PR/update-comment provenance, use an explicitly configured GitHub task-record repository, and verify the durable remote state through its GitHub client abstraction.

## What does not exist yet

A supported desktop/mobile UI, installation package, authenticated end-user setup flow, production storage configuration UI, and hardened live ChatGPT/Codex browser adapter are still under development. Track those items in the public issue backlog rather than treating this bootstrap as a release.
