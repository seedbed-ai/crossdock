# Crossdock support and participation

Crossdock is in early public development. The best place to ask depends on whether you have a question, an idea, a reproducible defect, a compatibility result, or a security concern.

## Questions and workflow discussion

Use [GitHub Discussions](https://github.com/seedbed-ai/crossdock/discussions) for setup questions, workflow ideas, design conversation, provider/integration questions, and testing or compatibility discussion that is not yet a reproducible bug.

Questions from prospective contributors and testers are welcome. You do not need access to any private Seedbed repository or infrastructure.

## Bugs and live-test results

Use the public issue templates for reproducible defects and live compatibility results. For the experimental authenticated workflow, start with [`docs/testing/public-live-test.md`](docs/testing/public-live-test.md) and [testing issue #28](https://github.com/seedbed-ai/crossdock/issues/28).

A failed live test is useful evidence. Record the failing state before manually repairing it, and keep private prompts, reports, repository contents, tokens, cookies, and credentials out of public reports.

## Feature and design ideas

Search existing issues and Discussions first. Small ideas and open-ended exploration fit Discussions; a concrete, bounded contribution or accepted problem belongs in an issue.

Current public contribution areas include browser/provider adapters, code review workflows, desktop/mobile UX, accessibility, configuration, privacy, storage, documentation, testing, packaging, and visual identity.

## Security

Do not disclose an unpatched vulnerability publicly if doing so could put users at risk. Follow [`SECURITY.md`](SECURITY.md) for the current reporting boundary.

## Current support level

Crossdock does not yet claim supported end-user desktop/mobile releases or broadly verified authenticated-provider compatibility. The current Chromium extension + loopback service is experimental. Public compatibility evidence is tracked in [`docs/testing/compatibility.md`](docs/testing/compatibility.md).
