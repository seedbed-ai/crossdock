# Handoff Mode

Crossdock currently implements two user-selectable handoff modes in the experimental desktop dashboard and shared `crossdock.config/v1` model.

## Review before handoff

`review` is the current compatibility default. Crossdock monitors the delegated task until the provider action is ready, then waits for the user to choose the appropriate finalize action before Crossdock performs the durable GitHub handoff.

The approval is a workflow transition, not permission to weaken any other rule. Repository identity, evidence policy, storage policy, secret/classification preflight, recovery state, and remote verification still apply.

## Automatic

`automatic` removes the extra finalize click after the supported provider action becomes ready. Crossdock proceeds through the same durable handoff path only after the same preflight and target checks succeed.

Automatic mode does not weaken validation, privacy checks, target resolution, idempotency, recovery, or remote verification. Ambiguity must stop or enter a recoverable state rather than trigger a guessed mutation.

## Configuration and recovery

The shared configuration model exposes `handoff_mode` with values `review` and `automatic`. More-specific configuration scopes may override less-specific ones according to the documented configuration precedence.

When a browser task is submitted, its selected handoff mode is frozen into the active task state. Changing the dashboard preference afterward must not silently change the behavior of that already-submitted task.

The current browser adapter remains experimental until authenticated live compatibility evidence exists. Implementation of these modes does not by itself establish provider compatibility.

See [`model.md`](model.md) for configuration semantics and [`../testing/public-live-test.md`](../testing/public-live-test.md) for live validation.
