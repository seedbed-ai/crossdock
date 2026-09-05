# Codex task monitoring

Crossdock must monitor the concrete submitted Codex task, not the generic Codex landing page.

## Required behavior

- Before submission, snapshot currently visible Codex task URLs.
- After the provider accepts the prompt, resolve the concrete task URL either from navigation to a task page or from exactly one newly visible task link on the Codex landing page.
- Persist that concrete task URL in task state.
- Monitoring must inspect that exact task. If the single Codex tab is still on the landing page, Crossdock may navigate it to the persisted task URL without requiring the user to open the task manually.
- Task URL discovery and navigation remain fail-closed on ambiguity.
- Do not submit a duplicate task just because task URL discovery is delayed.

This behavior is required for review-before-handoff to transition from `running` to `ready` after the task completes without manual task navigation.
