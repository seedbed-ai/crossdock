# Security

Crossdock coordinates authenticated developer surfaces and may handle prompts and execution reports containing private development context. Treat the public source repository, local application state, provider sessions, and user-selected task-record stores as separate security boundaries.

## Reporting vulnerabilities

Do not disclose credentials, exploitable private data, active secrets, or unpatched vulnerabilities that would put users at risk in a public issue.

Use GitHub private vulnerability reporting for this repository when it is available. If that feature is unavailable, do not substitute a public issue containing sensitive exploit details; open a minimal non-sensitive maintainer-contact issue only if a private reporting route is needed.

## Data-handling principles

- The public Crossdock source repository is not an implicit task-record destination.
- Task-record storage must be explicitly configured and appropriate for the evidence actually retained.
- Prompt/report collection, transient recovery state, durable task-record evidence, history, and diagnostics are distinct data-lifecycle concerns; permission at one layer does not imply permission at another.
- User-selected `hash` or `omit` evidence modes must not silently become plaintext durable retention.
- Common secret-like plaintext must fail closed before Crossdock writes it to a GitHub-backed task-record store, PR body, PR comment, or committed provenance file. This preflight is defense in depth and is not a claim that pattern matching can identify every sensitive value.
- Crossdock must not extract or persist authenticated provider session cookies as an application authentication mechanism.
- Browser automation must fail closed when expected controls, task identity, repository identity, work intent, or resulting PR state is unsupported or ambiguous. A disabled UI option alone is not the safety boundary; unsupported or tampered work intents must be rejected before provider delegation.
- A handoff is not complete merely because a local action succeeded; required durable remote state must be re-read and verified.
- Non-GitHub storage adapters must define and enforce the privacy/classification behavior appropriate to their own persistence boundary rather than inheriting GitHub-specific policy by accident.

## Test and issue data

Public live-test reports should use disposable repositories where practical and contain only non-sensitive environment/result metadata. Redact screenshots and logs before posting them publicly. Never include tokens, cookies, private source, private prompt/report plaintext, customer data, or other secrets in public test evidence.

See [`docs/architecture/security-boundaries.md`](docs/architecture/security-boundaries.md) for the evolving implementation model.
