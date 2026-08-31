# Testing Crossdock

Crossdock uses two complementary validation layers.

## Deterministic repository validation

Run on Node.js 22+:

```text
npm test
npm run check
```

These commands cover the provider-independent handoff/configuration/storage core, HTTP/service behavior, and JavaScript syntax. New deterministic behavior should normally receive an automated test.

GitHub Actions runs the same validation for pull requests.

## Authenticated live provider testing

The current browser adapter depends on authenticated provider UI behavior that cannot be proven by repository tests alone. Follow [`public-live-test.md`](public-live-test.md) for the provider-neutral public test procedure.

Live tests should use disposable target changes and must never publish credentials or private task content in public reports. When a live integration fails, record the exact non-secret state before manually changing tabs, clicking provider controls, or repairing GitHub state; the failure state is the compatibility evidence.

## What a useful report contains

Use the public live-test issue template and include the Crossdock ref, operating system, browser/version, Node version, handoff/evidence settings, failing task phase, expected outcome, actual durable GitHub outcome, and redacted screenshots/logs when useful.

Both successes and failures matter. Successful environment reports help establish a compatibility matrix; failures drive adapter hardening.