# Browser Integration

Crossdock's initial workflow spans web applications that cannot safely be composed as ordinary cross-origin iframes with parent-page DOM control.

The working architecture therefore treats the browser as an adapter surface: an extension or equivalent controlled integration can navigate/open supported pages, observe narrowly scoped state, and perform UI actions only where supported APIs cannot perform the operation reliably.

## Requirements

- Prefer supported provider APIs/SDKs for durable operations.
- Isolate provider-specific selectors and state interpretation.
- Use semantic state where available rather than coordinates or visual timing assumptions.
- Fail closed when a required control, task identity, repository identity, environment identity, or branch identity cannot be resolved uniquely.
- Treat the Crossdock target repository as canonical; never assume it matches stale provider/browser selection.
- Resolve, select, and verify provider repository/environment context before submitting a task.
- Reverify provider context before later mutations such as `Create PR` or `Update branch`.
- Never inherit an arbitrary provider branch as the intended base without explicit resolution and verification.
- Never export authenticated session cookies as application credentials.
- Keep the workflow core testable without a live browser.
- Maintain compatibility tests/fixtures for provider UI changes.

Provider repository/environment mapping and recovery semantics are defined in [`provider-context.md`](provider-context.md).

Live authenticated testing is the authority for claims about current browser-provider compatibility. A selector path that passes static tests remains experimental until the authenticated workflow establishes that it identifies and mutates the intended provider state safely.
