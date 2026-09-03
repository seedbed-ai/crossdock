# Roadmap

Crossdock is pre-release. The public sequence is capability-based rather than date-promised, and the issue tracker is the executable work queue. This page distinguishes foundations already on `main` from the current frontier so contributors do not have to infer status from old setup tasks.

## Landed foundations

The public repository now has:

- a migrated/de-Seedbed deterministic handoff and task-record core;
- AGPL-3.0-or-later licensing plus public contribution, conduct, support, security, testing, troubleshooting, and architecture documentation;
- protected-branch CI, dependency-free Markdown link validation, and contributor issue/PR infrastructure;
- an explicit shared configuration model with scoped precedence;
- a task-record storage adapter boundary with GitHub as the first implementation;
- automatic and review-before-handoff modes;
- configurable loopback service endpoint handling;
- independently configurable durable prompt/report evidence (`full`, `hash`, `omit`);
- independently configurable prompt/report crash recovery (`persist`, `memory`) in the browser, frozen per active task;
- configurable `link`/`none` provenance presentation on PR-body/update-comment surfaces;
- explicit GitHub committed-file provenance publication (`link`, `reference`) in core/service and browser UI, with create-or-identical/no-overwrite verification and no inferred destination;
- a privacy-safe Active task view for operational recovery state;
- provider-neutral work-item intents and capability preflight;
- browser work-intent validation/frozen state that fails closed for unsupported or tampered intents;
- provider-neutral review request and terminal result contracts pinned to exact source/change/version identity;
- accepted v3 durable-record semantics plus an isolated experimental codec for review, investigation, remediation, verification, publication, and lineage; and
- an explicit pre-1.0 release/compatibility policy distinguishing experimental, verified, and supported behavior.

These foundations are not a claim that the authenticated browser path is supported. The current Codex browser adapter advertises only experimental `implement`; external-provider behavior still requires dated live evidence.

## Current workflow frontier

- collect independent ChatGPT → Codex → GitHub implementation-path live-test evidence and compatibility results ([#28](https://github.com/seedbed-ai/crossdock/issues/28));
- harden browser/provider recovery after live failures and UI changes ([#11](https://github.com/seedbed-ai/crossdock/issues/11));
- continue transient-data lifecycle controls beyond active-task prompt/report recovery ([#19](https://github.com/seedbed-ai/crossdock/issues/19));
- expand task-record storage beyond the first GitHub-backed adapter ([#7](https://github.com/seedbed-ai/crossdock/issues/7));
- complete publication semantics beyond implemented PR `link`/`none` and committed-file `link`/`reference`, especially PR-body/comment `summary` and v3 publication/artifact integration ([#44](https://github.com/seedbed-ai/crossdock/issues/44)); and
- keep configuration/import-export, secret placement, packaging presentation, and broader lifecycle settings explicit rather than expanding them opportunistically during the live-test candidate window ([#8](https://github.com/seedbed-ai/crossdock/issues/8)).

## Agent workflows

- first-class executable code-review work items ([#29](https://github.com/seedbed-ai/crossdock/issues/29));
- implement a real provider adapter path for `review` using the landed provider-neutral request/result contracts without falling back to implementation semantics;
- review focus/guidance, reviewed-version identity, and durable review/comment/thread linkage;
- review finding → remediation → re-review lineage;
- runtime/provider capability discovery where supported and durable recording of the capability path actually used ([#38](https://github.com/seedbed-ai/crossdock/issues/38));
- investigation/CI-diagnosis and remediation workflows;
- parallel task families where providers support independent concurrent work;
- scheduled/repeatable agent work where Crossdock contributes durable state and provenance;
- image/screenshot-assisted and security-specific workflows only through explicit advertised adapter capabilities; and
- never treat an AI review result as human approval or merge authority.

## User experience

- responsive desktop workspace ([#3](https://github.com/seedbed-ai/crossdock/issues/3));
- phone-first mobile workflow ([#4](https://github.com/seedbed-ai/crossdock/issues/4));
- complete live/manual accessibility validation on top of the current executable baseline ([#14](https://github.com/seedbed-ai/crossdock/issues/14));
- expand status/error/recovery into deliberate task-history and retention UX without creating an implicit new evidence store ([#15](https://github.com/seedbed-ai/crossdock/issues/15), [#19](https://github.com/seedbed-ai/crossdock/issues/19)); and
- installation/onboarding flow once distribution architecture is selected.

## Integration hardening

- live validation and hardening of the browser extension/service boundary;
- ChatGPT/Codex adapter compatibility evidence tied to exact tested versions and work intent;
- GitHub authentication and least-privilege setup;
- compatibility fixtures and provider-change recovery; and
- preference for supported provider APIs/SDKs where available while retaining isolated fail-closed browser adapters for unsupported boundaries.

## Distribution

- desktop packaging decision and supported platforms ([#12](https://github.com/seedbed-ai/crossdock/issues/12));
- mobile/PWA/native-shell decision ([#13](https://github.com/seedbed-ai/crossdock/issues/13)); and
- first contributor-facing release once the intended experimental boundary and live-test evidence are sufficient to make that release useful rather than misleading.

The roadmap is intentionally not a promise of dates. Dependencies, provider capabilities, live-test evidence, contributor interest, and user priorities may change ordering without changing the underlying product direction.
