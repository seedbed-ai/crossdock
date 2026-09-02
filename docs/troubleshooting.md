# Troubleshooting the experimental browser workflow

Crossdock's current desktop browser integration is experimental. Repository tests can validate Crossdock's state machine, privacy boundaries, and GitHub handoff logic, but they cannot prove the current authenticated ChatGPT/Codex UI. When a live run fails, preserve the observed state and diagnose the boundary before manually repairing the PR or task.

Use [`testing/public-live-test.md`](testing/public-live-test.md) for the supported live-test procedure and [`testing/compatibility.md`](testing/compatibility.md) for dated compatibility evidence.

## First checks

Before starting a disposable live test:

1. use Node.js 22 or newer;
2. start the local service from the same Crossdock ref as the unpacked extension;
3. confirm the configured service endpoint is an explicit `http://127.0.0.1:<port>` URL;
4. reload the unpacked extension after changing Crossdock source;
5. keep authenticated ChatGPT/Codex and GitHub sessions open in normal browser tabs;
6. use repositories and evidence destinations you are authorized to access;
7. start with **Review before handoff** and the `implement` work intent;
8. choose prompt/report evidence, crash-recovery, and publication settings deliberately before submission.

Do not paste browser cookies, session tokens, GitHub credentials, or private provider state into Crossdock configuration.

## The dashboard cannot reach the local service

Check that the service process is running and that the dashboard's configured endpoint matches its port exactly. Crossdock accepts loopback `127.0.0.1` HTTP endpoints only; `localhost`, non-loopback hosts, HTTPS, paths, query strings, and credentials are rejected intentionally.

An active task freezes its service endpoint. Editing the visible endpoint after submission does not redirect that task. Finish or deliberately abandon the active task before expecting a new endpoint preference to apply.

## A work intent is unavailable

The current Codex browser adapter advertises only **Implementation**, and that capability remains experimental until authenticated live testing verifies it. Review, investigation, triage, remediation, and verification are modeled by Crossdock but are not executable through this browser adapter yet.

Do not work around a disabled intent by editing the DOM or stored state. Unsupported intent-capability combinations must fail before provider delegation.

## Codex controls are missing or changed

Stop the run and record the exact non-secret Crossdock status plus what provider control/state was visible. Do not click a guessed replacement control just to continue the test. The browser adapter is required to fail closed when provider UI semantics are no longer recognized.

Report the browser/version, Crossdock ref, provider/account variant when safe, and a redacted screenshot if it materially explains the UI change.

## The provider completed but Crossdock did not continue

Do not immediately create or update a PR manually. Crossdock has recovery states for uncertain provider completion, PR discovery, and branch-head changes. A manual repair can destroy the evidence needed to distinguish a recovery bug from a provider/UI change and can create duplicates on retry.

Record the Active task phase, whether a PR already exists, whether its head changed, and whether a task record or provenance publication already exists. Then follow the recovery behavior shown by Crossdock. If it cannot proceed, file a live-test report before repairing the disposable repository.

## A restart cannot recover prompt or report content

Crash recovery and durable evidence are independent policies.

With memory-only prompt or report recovery, Crossdock intentionally does not persist those plaintext bytes in browser-local active-task state. If a restart occurs after the bytes are needed for durable `full` or `hash` evidence, recovery can correctly fail rather than reconstructing, recapturing, or silently downgrading the evidence policy.

An `omit` evidence policy may permit continuation without the discarded content. Do not interpret an intentional memory-only recovery failure as data loss beyond the policy the user selected.

## Publication did not appear where expected

Check the active task's frozen publication policy rather than the current dashboard preference controls.

PR-body provenance, update-comment provenance, and committed-file provenance are separate publication surfaces. A disabled/`none` surface should produce no publication there while the configured durable task record can still exist elsewhere.

Committed-file provenance requires an explicit destination repository, branch, and path template. Crossdock does not infer that destination from the target repository or task-record repository. If publication is enabled, verify the exact configured destination before retrying.

## A retry appears to have partially succeeded

Do not delete the first artifact and blindly retry. Crossdock's handoff/storage operations are designed to be idempotent and to fail closed on conflicting remote state.

Check, without exposing private content:

- whether the intended PR exists exactly once;
- whether the expected branch head changed;
- whether the immutable task record exists;
- whether configured PR/comment/file publication already exists;
- whether Crossdock reports an uncertain or conflicting state.

A retry that cannot prove whether a remote mutation happened should stop rather than create a second mutation.

## What to include in a report

Use the repository's **Live test report** issue template. Include the Crossdock ref, OS, browser/version, Node version, work intent, capability status, handoff mode, evidence/recovery policies, publication surfaces, Active task phase, expected outcome, actual durable GitHub outcome, and repeatability.

Never include tokens, cookies, credentials, private prompts/reports, private source, customer data, or unredacted sensitive screenshots.

## What not to treat as a Crossdock fix

Avoid these during diagnosis:

- manually creating the PR Crossdock was trying to discover;
- manually editing the target branch to make a head-change wait succeed;
- changing evidence from `full`/`hash` to `omit` merely to bypass lost memory-only bytes;
- copying private evidence into a public repository;
- changing an active task's stored policy to match new visible preferences;
- clicking provider controls Crossdock did not recognize;
- retrying an ambiguous remote mutation until one appears to work.

For provider-boundary defects, see [`architecture/browser-integration.md`](architecture/browser-integration.md). For data-handling boundaries, see [`architecture/security-boundaries.md`](architecture/security-boundaries.md).
