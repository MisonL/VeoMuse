# UI Studio Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the default deployed VeoMuse editor render as a viewport-locked professional studio UI instead of a beige card dashboard.

**Architecture:** Keep the React component structure stable and apply a focused visual-system correction through theme tokens and final workspace CSS overrides. Use Playwright layout contracts as the control sensor before changing production CSS.

**Tech Stack:** React, Vite, CSS, Playwright, Bun, Docker Compose.

---

### Task 1: Add Failing Studio Layout Contract

**Files:**
- Modify: `tests/e2e/regression/layout-density.spec.ts`

- [ ] **Step 1: Write the failing test**

Add assertions that the edit workspace has no document scroll, uses a real dark graphite palette, keeps the header compact, keeps the center monitor dominant, and preserves timeline height at `1366x768`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run e2e:regression -- tests/e2e/regression/layout-density.spec.ts --workers=1 --retries=0`

Expected: FAIL because the current dark theme still resolves to a light beige workspace.

### Task 2: Restore Real Dark Studio Tokens

**Files:**
- Modify: `apps/frontend/src/theme.css`

- [ ] **Step 1: Implement minimal token correction**

Keep the light palette only for `:root` and `[data-theme='light']`. Add a dedicated `[data-theme='dark']` block after it with graphite studio tokens.

- [ ] **Step 2: Run regression test**

Run: `bun run e2e:regression -- tests/e2e/regression/layout-density.spec.ts --workers=1 --retries=0`

Expected: PASS for the palette check or expose the next layout error.

### Task 3: Flatten Workspace Chrome

**Files:**
- Modify: `apps/frontend/src/App.css`

- [ ] **Step 1: Apply focused final overrides**

Append a dated studio override block that reduces beige/card layering, keeps the main layout locked, flattens panels, compresses header chrome, and makes timeline/monitor surfaces operational.

- [ ] **Step 2: Run regression test**

Run: `bun run e2e:regression -- tests/e2e/regression/layout-density.spec.ts --workers=1 --retries=0`

Expected: PASS.

### Task 4: Verify and Redeploy

**Files:**
- No additional files expected.

- [ ] **Step 1: Run local gates**

Run:

```bash
bun run lint
bun run build
git diff --check
```

- [ ] **Step 2: Rebuild Docker services**

Run:

```bash
bun run docker:up
```

- [ ] **Step 3: Run deployed smoke checks**

Run:

```bash
bun run scripts/docker_smoke_check.ts --keep-up --no-build
bun run docker:ui-smoke -- --workers=1 --retries=0
```

- [ ] **Step 4: Inspect deployed UI**

Open `http://127.0.0.1:18081/?v=20260427-studio-refinement` and verify the edit page, audio page, lab page, channel modal, and monitor page remain visually usable.
