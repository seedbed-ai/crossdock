---
name: Live test report
about: Report a Crossdock provider-integration live test
labels: help wanted
---

## Result

- [ ] Initial task → PR completed
- [ ] Existing PR → branch update completed
- [ ] Automatic handoff completed
- [ ] No-PR-visible provenance completed
- [ ] Prompt memory-only recovery exercised
- [ ] Report memory-only recovery exercised
- [ ] Committed-file provenance exercised
- [ ] A failure occurred

Compatibility assessment for the exact environment below:

- [ ] Verified
- [ ] Partial
- [ ] Failed
- [ ] Not enough evidence to classify

## Environment

- Crossdock commit/ref:
- OS + version:
- Browser + version:
- Node version:
- Provider surface/account/workspace type (only if non-sensitive and relevant):
- Crossdock service URL/port (loopback only; do not include credentials):

## Test target

Use disposable/test repositories where possible.

- Target repository visibility: `public` / `private`
- Existing PR number, if testing an update:
- Task-record destination type/visibility:
- Committed-file destination visibility, if enabled:

Do not include private repository names or links unless they are safe to disclose publicly.

## Test configuration

- Work intent: `implement` (current browser path is experimental)
- Handoff mode: `review` / `automatic`
- Prompt evidence: `full` / `hash` / `omit`
- Report evidence: `full` / `hash` / `omit`
- Prompt crash recovery: `persist` / `memory`
- Report crash recovery: `persist` / `memory`
- Initial PR provenance: `link` / `none`
- Update provenance: `link` / `none`
- Committed-file provenance: `disabled` / `link` / `reference`
- Task-record storage adapter/type:

If committed-file provenance was enabled:

- Explicit repository supplied: yes / no
- Explicit branch supplied: yes / no
- Path template used (redact repository-identifying text if needed):

## Observed state

If successful, identify which paths completed. If unsuccessful, copy the exact non-secret Crossdock status and describe what was visible in the provider and GitHub at the moment of failure.

Include the phase shown in the **Active task** panel when relevant.

## Expected state

What should Crossdock have done next?

## Durable outcome

Check every statement that you independently verified:

- [ ] Intended PR was created or updated exactly once
- [ ] Expected PR head changed for an update
- [ ] Immutable task record exists at the configured destination
- [ ] Task-record evidence matches the selected `full` / `hash` / `omit` policy
- [ ] PR-body publication matches the selected `link` / `none` policy
- [ ] Update-comment publication matches the selected `link` / `none` policy
- [ ] Committed provenance file exists at the exact configured repository/branch/path
- [ ] Committed provenance file contains no prompt/report evidence
- [ ] Retry/recovery did not overwrite a conflicting committed provenance file
- [ ] Changing visible preferences after submission did not redirect the active task

Note identifiers or public/disposable links only when safe to share.

## Recovery / privacy observations

If you exercised memory-only recovery, state whether the restart happened before or after the relevant provider content was captured.

- Prompt memory-only plaintext observed in persisted dashboard/task state: yes / no / not inspected
- Report memory-only plaintext observed in persisted active-task state after capture: yes / no / not inspected
- Full/hash evidence after intentionally discarded bytes failed clearly rather than silently widening retention: yes / no / not exercised
- `omit` recovery continued without discarded bytes when expected: yes / no / not exercised

Do not inspect or publish browser/provider state you do not own or have permission to inspect.

## Evidence

Attach redacted screenshots or logs when useful. Prefer the smallest evidence needed to reproduce or classify the result.

**Do not include tokens, cookies, credentials, private prompts/reports, private source, customer data, private repository names when sensitive, or other secrets.**

## Reproduction / repeatability

- Number of attempts:
- Reproduced consistently: yes / no / not retried
- Did a reload/restart change the outcome?:
- Did manual intervention occur after the failure?: yes / no

For compatibility failures, avoid manually rescuing the first failed run before recording the state; the unmodified failure is useful evidence.

## Notes

Browser/provider UI variations, timing, selector changes, recovery behavior, accessibility observations, and differences between review/automatic modes are particularly useful.
