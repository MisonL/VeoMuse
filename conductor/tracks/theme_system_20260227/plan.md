# Implementation Plan: Theme System Development

## Phase 1: CSS Architecture & Theme Variables
- [ ] Task: Create `theme.css` with `:root` variables for Light, Dark, and Custom themes.
- [ ] Task: Define Glass Panel variables (background, blur, saturate, shadow).
- [ ] Task: Define Typography variables (primary, dim, accent).
- [ ] Task: Define Interactive UI variables (buttons, inputs, borders).
- [ ] Task: Add CSS transition rules for smooth theme switching.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: CSS Architecture & Theme Variables' (Protocol in workflow.md)

## Phase 2: State Management (Zustand)
- [ ] Task: Create unit tests for theme store logic (default to system, update theme, custom palette).
- [ ] Task: Create `themeStore.ts` using Zustand to manage current theme mode and custom palette state.
- [ ] Task: Implement LocalStorage persistence middleware for `themeStore`.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: State Management (Zustand)' (Protocol in workflow.md)

## Phase 3: React Hooks & System Sync
- [ ] Task: Create unit tests for `useThemeSync` hook.
- [ ] Task: Implement `useThemeSync` hook to listen to `window.matchMedia('(prefers-color-scheme: dark)')`.
- [ ] Task: Implement logic to dynamically update document `data-theme` attribute and CSS custom properties based on active theme state.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: React Hooks & System Sync' (Protocol in workflow.md)

## Phase 4: UI Integration & Controls
- [ ] Task: Create unit tests for Theme Switcher UI component.
- [ ] Task: Build Theme Switcher component (toggle between Light, Dark, System).
- [ ] Task: Integrate Theme Switcher into the main App layout (e.g., header or settings panel).
- [ ] Task: Refactor existing inline colors in `App.tsx` and `Atoms.tsx` to use CSS variables.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: UI Integration & Controls' (Protocol in workflow.md)