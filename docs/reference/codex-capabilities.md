# Codex Capability Mapping

This document records the current Codex surface that is relevant to Crossdock's adapter design. It is a compatibility/reference document, not the Crossdock domain model.

Last reviewed: 2026-08-31.

Provider capabilities change independently of Crossdock. Live adapter claims still require current compatibility evidence.

## Current relevant capabilities

| Crossdock intent/capability | Current Codex surface | Crossdock direction |
| --- | --- | --- |
| `implement` | Cloud/software-engineering tasks can write code, run tests, and propose pull requests. | Already the first live adapter path. Keep task execution provider-neutral. |
| `review` | GitHub PR review can run automatically for ready PRs or via `@codex review`; review guidance can narrow focus. | Make review a first-class work item with reviewed SHA and durable review evidence. |
| `remediate` | Codex review threads can be followed by instructions to implement suggested changes. | Preserve review → finding → remediation lineage rather than treating the fix as an unrelated task. |
| `investigate` | Codex can answer repository questions, debug issues, run commands/tests, and analyze code. | Persist bounded investigations when durable findings/provenance add value. |
| parallel work | Codex supports multiple agents/tasks in parallel; the app supports isolated worktrees. | Model related executions as a task family only when Crossdock needs coordination/history. |
| reusable workflows | Codex Skills provide reusable instructions/workflows. | Prefer referencing/using provider capability rather than cloning a second Crossdock skill system. |
| local execution | Codex is available through CLI/editor/app surfaces in addition to cloud execution. | Add adapters when local execution materially improves privacy, recovery, or workflow portability. |
| security analysis | Codex Security can identify/validate findings and propose patches for human review. | Treat security analysis/remediation as explicit capabilities with stronger evidence/authority boundaries. |
| delegated conversation | Codex can be invoked from surfaces such as Slack in supported configurations. | Integrate only where Crossdock adds durable cross-surface state/provenance; do not mirror every delegation UI. |

## Code review details

Codex PR review is particularly relevant because it already has durable GitHub artifacts. Crossdock should be able to initiate or observe a review, persist the review execution record, identify the reviewed commit, and link the resulting GitHub review/comments without claiming that an AI review is a human approval.

Review guidance should remain data, not a new intent for every focus. Examples include correctness, security, compatibility, tests, performance, accessibility, architecture, or dependency freshness.

When a review produces findings and a later Codex execution fixes them, Crossdock should preserve the causal chain and then permit a re-review against the new head SHA.

## What Crossdock should not duplicate

Crossdock should generally leave these provider-native concerns to Codex unless cross-surface coordination requires otherwise:

- model selection and internal reasoning controls;
- worktree implementation details;
- provider-native task/thread UI;
- provider-native Skills authoring/execution mechanics;
- provider account/workspace administration;
- security scanner internals;
- every provider-specific button or command as a core Crossdock concept.

The Crossdock value is durable orchestration: intent, state, target identity, evidence policy, provenance, retries, cross-surface linkage, verification, and recovery.

## Sources

Official references used for this mapping:

- OpenAI, “Introducing upgrades to Codex” — PR review, review guidance, and follow-up fixes.
- OpenAI, “Introducing the Codex app” — parallel agents, worktrees, and Skills.
- OpenAI, “Codex” — CLI/editor/ChatGPT surfaces and code-review positioning.
- OpenAI Help Center, “Codex Security” — validated security findings and proposed patches for human review.
- OpenAI, “Codex is now generally available” — Slack delegation and broader workflow surface.

Because provider behavior changes, these references do not replace Crossdock's dated live compatibility matrix.
