# Browser Integration

Crossdock's initial workflow spans web applications that cannot safely be composed as ordinary cross-origin iframes with parent-page DOM control.

The working architecture therefore treats the browser as an adapter surface: an extension or equivalent controlled integration can navigate/open supported pages, observe narrowly scoped state, and perform UI actions only where supported APIs cannot perform the operation reliably.

## Requirements

- Prefer supported provider APIs/SDKs for durable operations.
- Isolate provider-specific selectors and state interpretation.
- Use semantic state where available rather than coordinates or visual timing assumptions.
- Fail closed when a required control or task identity cannot be resolved uniquely.
- Never export authenticated session cookies as application credentials.
- Keep the workflow core testable without a live browser.
- Maintain compatibility tests/fixtures for provider UI changes.

Live authenticated testing will resume after the public migration/bootstrap is merged and the browser adapter has been separated from Seedbed-private assumptions.
