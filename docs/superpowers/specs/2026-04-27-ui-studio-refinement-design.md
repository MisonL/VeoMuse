# UI Studio Refinement Design

## Context

The current deployed editor at `http://127.0.0.1:18081` still reads as a beige card-based dashboard, not a professional video editing workspace. The main root cause found in code is `apps/frontend/src/theme.css`: the final "Cinematica Light redesign tokens" block applies the same light palette to `:root`, `[data-theme='dark']`, and `[data-theme='light']`, so the visible "dark" mode still resolves to beige surfaces.

Gemini review was used as a companion review and was instructed to follow `superpowers:using-superpowers`. It recommended a viewport-locked, monitor-first editing desk with fewer card layers, tighter chrome, and automated layout contracts before implementation.

## Setpoint

The default deployed UI must behave like a professional video editing desk:

- The document must not scroll at desktop editor viewports.
- The monitor and timeline must be the primary visual surfaces.
- The side panels must stay useful without visually dominating the center.
- Dark mode must render as a real graphite studio palette, not beige.
- Empty states must be compact operational prompts, not hero/marketing blocks.

## Design Direction

Use a "graphite studio" direction:

- Workspace base: dark neutral graphite with subtle warm depth, not pure black.
- Monitor: near-black viewing surface with light grid and restrained controls.
- Timeline: flat rail surface with visible ticks and no oversized empty card.
- Panels: single-plane surfaces separated by 1px borders; remove card-in-card feel where CSS can safely flatten it.
- Accent: teal for active editing controls and amber/red only for import/export or warning actions.

## Layout Contract

The first implementation target is the edit workspace at common desktop sizes:

- `1366x768` and `1440x900` must fit in one viewport with no document scroll.
- Header height should stay below 64px.
- Timeline should keep at least 170px of usable height.
- Preview should remain 16:9 and at least 54 percent of the main workspace width on desktop.
- Side panels must keep minimum useful widths while not exceeding 46 percent combined main width.

## Test Strategy

Use Playwright layout tests because the failure is visual and runtime CSS-dependent:

- Add or update a regression test for the studio layout contract.
- Assert the actual rendered dark theme is not the beige light palette.
- Assert no global document scroll.
- Assert center monitor, timeline, and side panel proportions.
- Reuse existing Docker UI smoke after implementation to cover all subpage entries.

## Scope

Allowed files for this pass:

- `apps/frontend/src/theme.css`
- `apps/frontend/src/App.css`
- `tests/e2e/regression/layout-density.spec.ts`
- `docs/superpowers/specs/2026-04-27-ui-studio-refinement-design.md`
- `docs/superpowers/plans/2026-04-27-ui-studio-refinement-plan.md`

Out of scope:

- Backend behavior changes.
- Data model changes.
- Rewriting comparison lab internals.
- Adding mock success paths.
