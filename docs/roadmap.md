# Roadmap

Crossdock is pre-release. The public sequence is capability-based rather than date-promised, and the issue tracker is the executable work queue. This page distinguishes foundations already on `main` from the current frontier so contributors do not have to infer status from old setup tasks.

## Landed foundations

The public repository now has:

- a migrated/de-Seedbed deterministic handoff and task-record core;
- AGPL-3.0-or-later licensing plus public contribution, conduct, support, security, testing, and architecture documentation;
- protected-branch CI and contributor issue/PR infrastructure;
- an explicit shared configuration model with scoped precedence;
- a task-record storage adapter boundary with GitHub as the first implementation;
- automatic and review-before-handoff modes;
- configurable loopback service endpoint handling;
- independently configurable durable prompt/report evidence (`full`, `hash`, `omit`);
- configurable `link`/`none` provenance presentation on the currently implemented PR-body/update-comment surfaces;
- prompt recovery persistence controls plus provider-report recovery state semantics and shared report-recovery configuration;
- provider-neutral work-item intents and capability discovery/preflight;
- accepted v3 durable-record semantics plus an isolated experimental codec for review, investigation, remediation, verification, publication, and lineage; and
- an explicit pre-1.0 release/compatibility policy distinguishing experimental, verified, and supported behavior.

These foundations are not a claim that the authenticated browser path is supported. External-provider behavior still requires dated live evidence.

## Current workflow frontier

- complete browser execution wiring for report recovery policy ([#54](https://github.com/seedbed-ai/crossdock/issues/54));
- collect independent ChatGPT → Codex → GitHub live-test evidence and compatibility results ([#28](https://github.com/seedbed-ai/crossdock/issues/28));
- harden browser/provider recovery after live failures and UI changes ([#11](https://github.com/seedbed-ai/crossdock/issues/11));
- continue transient-data lifecycle controls beyond prompt/report active-task recovery ([#19](https://github.com/seedbed-ai/crossdock/issues/19));
- expand task-record storage beyond the first GitHub-backed adapter ([#7](https://github.com/seedbed-ai/crossdock/issues/7)); and
- complete configurable publication destinations beyond current PR `link`/`none` behavior ([#44](https://github.com/seedbed-ai/crossdock/issues/44)).

## Agent workflows

- first-class persisted code-review work items ([#29](https://github.com/seedbed-ai/crossdock/issues/29));
- review focus/guidance, reviewed-commit identity, and durable review/comment/thread linkage;
- review finding → remediation → re-review lineage;
- investigation/CI-diagnosis and remediation workflows;
- parallel task families where providers support independent concurrent work;
- scheduled/repeatable agent work where Crossdock contributes durable state and provenance;
- image/screenshot-assisted and security-specific workflows only through explicit advertised adapter capabilities; and
- capability discovery/unsupported-workflow checks at every provider execution boundary ([#38](https://github.com/seedbed-ai/crossdock/issues/38)).

## User experience

- responsive desktop workspace ([#3](https://github.com/seedbed-ai/crossdock/issues/3));
- phone-first mobile workflow ([#4](https://github.com/seedbed-ai/crossdock/issues/4));
- accessibility baseline ([#14](https://github.com/seedbed-ai/crossdock/issues/14));
- status/error/recovery and task-history UX ([#15](https://github.com/seedbed-ai/crossdock/issues/15)); and
- installation/onboarding flow once distribution architecture is selected.

## Integration hardening

- live validation and hardening of the browser extension/service boundary;
- ChatGPT/Codex adapter compatibility evidence;
- GitHub authentication and least-privilege setup;
- compatibility fixtures and provider-change recovery; and
- preference for supported provider APIs/SDKs where available while retaining isolated fail-closed browser adapters for unsupported boundaries.

## Distribution

- desktop packaging decision and supported platforms ([#12](https://github.com/seedbed-ai/crossdock/issues/12));
- mobile/PWA/native-shell decision ([#13](https://github.com/seedbed-ai/crossdock/issues/13)); and
- first contributor-facing release once the intended experimental boundary and live-test evidence are sufficient to make that release useful rather than misleading.

The roadmap is intentionally not a promise of dates. Dependencies, provider capabilities, live-test evidence, contributor interest, and user priorities may change ordering without changing the underlying product direction.
