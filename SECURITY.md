# Security

Crossdock coordinates authenticated developer surfaces and may handle prompts and execution reports containing private development context. Treat the public source repository and user/deployment data as separate security boundaries.

## Reporting vulnerabilities

Do not disclose credentials, exploitable private data, or active secrets in a public issue. Until a dedicated private vulnerability-reporting channel is published, use GitHub's private vulnerability reporting feature for this repository when available.

## Data-handling principles

- The public Crossdock repository is not a task-log destination by default.
- Task-record storage must be explicitly configured and appropriate for the record's confidentiality.
- Known credentials, secrets, tokens, payment data, sensitive PII, production customer data, and equivalent forbidden material must fail closed before GitHub-backed persistence.
- Crossdock must not extract or persist ChatGPT/Codex/GitHub session cookies as an application authentication mechanism.
- Browser automation must fail closed when expected controls or task identity are ambiguous.
- A handoff is not complete merely because a local action succeeded; required durable remote state must be re-read and verified.

See [`docs/architecture/security-boundaries.md`](docs/architecture/security-boundaries.md) for the evolving implementation model.
