# Architecture Overview

Crossdock is being shaped around one workflow core with form-factor and provider adapters around it.

The intended layers are:

1. **Task/workflow core** — task identity, lifecycle, provenance, initial/update semantics, retry/recovery state.
2. **Provider adapters** — conversation capture, coding-agent execution, GitHub/review operations, storage.
3. **Local orchestration service** — coordinates authenticated adapters without exporting browser session material.
4. **Browser integration** — controlled navigation/state observation where supported APIs do not cover the required workflow.
5. **Responsive application UI** — desktop and mobile presentations of the same task state.

The current public code is only the deterministic GitHub handoff/task-record portion of layer 1 plus a small GitHub client. The remaining layers are roadmap work and should not be inferred from directory names or documentation alone.
