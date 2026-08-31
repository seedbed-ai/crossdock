# Handoff Mode

Crossdock is designed to support two user-selectable handoff modes.

## Review before handoff

Crossdock prepares the durable handoff and waits for explicit user approval before mutating the target GitHub review surface. This is the safer conceptual baseline while browser/provider integration is young.

## Automatic

After a supported coding-agent task completes and required preflight checks pass, Crossdock performs the configured durable handoff without another manual transport step.

Automatic mode does not weaken validation, privacy checks, target resolution, or remote verification. Ambiguity must stop the handoff rather than trigger a guessed mutation.

The end-user configuration surface and final default are not implemented yet.
