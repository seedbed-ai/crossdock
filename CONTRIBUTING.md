# Contributing to Crossdock

Crossdock is in early public development. Contributions are welcome across implementation, browser integration, desktop/mobile UX, accessibility, documentation, graphic design, testing, packaging, and provider adapters.

## Before starting

- Search the public issues for existing work.
- For a substantial new direction, open or join an issue before investing heavily so requirements and boundaries can be aligned publicly.
- Never include private prompts, execution reports, credentials, access tokens, customer data, or Seedbed-private records in issues, fixtures, screenshots, commits, or PRs.

## Development

The migrated handoff core currently requires Node.js 22 or newer.

```text
npm test
npm run check
```

As additional application surfaces land, their validation commands will be documented here and in the relevant package or directory.

## Pull requests

Keep changes bounded and explain:

- the user/developer problem addressed;
- the implementation approach;
- validation performed;
- privacy/security implications when relevant;
- desktop/mobile implications when relevant; and
- compatibility or migration consequences.

Do not weaken fail-closed behavior, task-record integrity, or remote handoff verification merely to make automation appear successful.

## Design contributions

Graphic design and UX work should be attached to or linked from public issues. Prefer editable/source assets plus documented usage constraints over flattened exports alone. Designs should account for light/dark contexts, accessibility, responsive layouts, and small touch targets from the beginning.
