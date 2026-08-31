# Adapters

Crossdock's workflow semantics should not require ChatGPT, Codex, or GitHub by name even though those are the initial integrations.

Adapter boundaries are expected for:

- prompt/conversation capture;
- coding-agent task creation and status/report retrieval;
- source-control/review operations;
- durable task-record storage; and
- platform-specific navigation/deep linking.

An adapter translates provider state into Crossdock task state. It must not silently invent success when provider state cannot be resolved. UI adapters in particular should prefer semantic state and supported APIs over brittle coordinate or presentation-only automation.

Additional providers are future compatibility work, not currently supported promises.
