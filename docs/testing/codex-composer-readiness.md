# Codex composer readiness gate

Authenticated live testing showed that Chrome tab load completion is not equivalent to Codex composer readiness. After Crossdock navigated a completed task tab back to `/codex/cloud`, the browser reported the page loaded before React had rendered the semantic repository/environment selector. Crossdock then attempted provider-context resolution too early and failed with zero visible controls.

## Required behavior

Before any provider-context lookup or prompt mutation for a new task, Crossdock must:

1. own/resolve the intended Codex tab;
2. foreground it;
3. navigate it to `/codex/cloud` when necessary;
4. wait for browser load completion when navigation occurred;
5. poll a non-mutating content-script readiness check for the visible semantic control `aria-label="View all code environments"`;
6. proceed only when exactly one such visible, enabled control exists;
7. fail clearly after a bounded timeout if semantic readiness never arrives.

The readiness check must not write the prompt, change repository/branch selection, or submit a task. It exists only to distinguish browser load completion from application-level UI readiness.

## Safety

- Zero controls means not ready yet, not immediate failure while inside the bounded readiness window.
- Multiple matching controls remain an ambiguity error and fail closed.
- The Codex tab remains foregrounded during the readiness wait because authenticated testing previously showed background React transitions can be delayed or starved.
- No arbitrary fixed sleep is used.
- Existing repository, branch, task, and PR integrity checks remain unchanged.
