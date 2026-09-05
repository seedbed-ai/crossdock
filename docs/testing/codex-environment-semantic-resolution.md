# Codex environment semantic resolution

## Observed provider behavior

Codex's environment chooser is a human-facing control with separate **Environments** and **Repositories** sections. After a repository receives an environment, the repository may disappear from **Repositories** and instead appear under **Environments** using its repository basename. For example, target `seedbed-ai/crossdock-live-target` is represented by the unique environment `crossdock-live-target` while the stale selected environment is `sb`.

## Resolution rule

Crossdock should interpret the visible chooser semantically rather than require a persisted machine-readable environment-to-repository mapping.

For configured target `owner/repository`:

1. If the selected provider context already visibly identifies the exact target, accept it.
2. Otherwise open the environment chooser and prefer an exact visible `owner/repository` repository choice when one exists.
3. If no exact repository choice exists, derive the repository basename (`repository`) and accept a unique visible environment choice with that exact basename.
4. If either resolution path is ambiguous, fail closed before writing the prompt or submitting the task.
5. After selection, require the chooser to close and the selected context to visibly identify either the exact target or the uniquely resolved environment.
6. Select and verify the intended base branch before prompt mutation.
7. Keep downstream task/PR repository integrity checks. Human-style chooser interpretation does not weaken mutation-boundary verification.

Persisted environment mappings are not required for this ordinary path. They may be used only as fallback evidence where the visible provider UI is genuinely ambiguous, and must not override contradictory live UI evidence.

## Non-goals

- Do not infer choices by DOM order or screen coordinates.
- Do not require opening **Manage environments** for an unambiguous chooser.
- Do not treat environment display names as globally machine-readable repository identifiers.
- Do not weaken wrong-repository detection or pre-PR integrity checks.

## Regression case

Given target `seedbed-ai/crossdock-live-target`, selected context `sb`, and a chooser containing a unique environment `crossdock-live-target` but no repository row `seedbed-ai/crossdock-live-target`, Crossdock selects `crossdock-live-target`, verifies the resulting visible selection, selects/verifies the intended branch, and only then writes/submits the prompt.
