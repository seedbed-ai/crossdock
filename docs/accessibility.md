# Accessibility baseline

Crossdock treats accessibility as a release-quality requirement rather than a later visual-polish pass. The current experimental dashboard should remain operable with keyboard-only input, browser zoom/reflow, reduced-motion preferences, screen-reader semantics, and touch-sized controls while authenticated provider compatibility remains separately live-tested.

## Current baseline

For the browser dashboard:

- every interactive control must be keyboard reachable in DOM order;
- keyboard focus must remain visibly distinguishable with `:focus-visible` styling rather than relying only on color or hover state;
- buttons, text inputs, and selects use at least a 44 CSS-pixel minimum target height, increasing to 48 pixels in the narrowest layout;
- form controls have programmatic labels through their containing `label` elements;
- status changes use a polite live region (`role="status"`, `aria-live="polite"`);
- grouped navigation/actions have accessible labels;
- the layout must reflow to one-column task controls and progressively simpler action grids instead of requiring horizontal scrolling at narrow widths;
- reduced-motion preferences disable Crossdock animation/transition behavior;
- light/dark rendering uses system colors rather than assuming one fixed color scheme.

These repository checks are guardrails, not proof of conformance. Browser/assistive-technology testing is still required before claiming a supported accessibility level.

## Manual acceptance checks

Before a supported release, exercise the current UI at minimum with:

1. keyboard-only navigation, including visible focus and logical order;
2. a desktop screen reader on the supported browser/platform combinations;
3. browser zoom through 200% and narrow-window reflow without loss of controls or required information;
4. OS/browser reduced-motion preference;
5. light and dark system themes;
6. touch/pointer operation at the smallest supported viewport;
7. error and status transitions to confirm important state changes are announced without excessive repetition.

Record environment-specific results through the normal compatibility/testing process rather than converting a single successful run into a universal support claim.

## Contribution rule

New reusable UI controls must preserve keyboard access, a visible focus state, an accessible name, sufficient target size, and responsive/reflow behavior. If a change introduces animation, it must respect `prefers-reduced-motion`. Changes that cannot be exercised automatically should include the relevant manual accessibility check in the PR validation notes.

Issue #14 tracks the remaining live/manual accessibility validation and broader desktop/mobile baseline work.
