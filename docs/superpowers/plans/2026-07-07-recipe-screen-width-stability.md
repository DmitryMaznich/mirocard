# Recipe Screen Width Stability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the recipe-cooking screen's header/nav width from shrink-wrapping to per-step content width, so the progress bar and bottom buttons use the full screen (portrait) or full column (landscape) width consistently across every step of a recipe run.

**Architecture:** Single scoped CSS override. `.session-body.reading-body.instruction-body` currently inherits `align-items: center` from a later, higher-specificity-by-source-order `.session-body` rule (`src/styles.css:12741`), making its flex column shrink-to-fit its widest child per render. Adding an unconditional `align-items: stretch` for this exact three-class selector fixes it without touching the shared `.session-body` rule other renderers rely on.

**Tech Stack:** Plain CSS (no build/JS changes).

## Global Constraints

- Do not modify the shared base `.session-body` rule (`src/styles.css:12741`) — other task renderers depend on its `align-items: center` centering behavior.
- Do not modify `.instruction-step`'s `max-width: 640px; margin: 0 auto` — the narrow centered reading column is an explicit, approved decision (spec: `docs/superpowers/specs/2026-07-07-recipe-screen-width-stability-design.md`).
- No JavaScript, no new state, no measurement/mount-time logic — pure CSS only.
- Reference spec: `docs/superpowers/specs/2026-07-07-recipe-screen-width-stability-design.md`.

---

## Task 1: Stretch the recipe screen to full width

**Files:**
- Modify: `src/styles.css` (`.instruction-body` rule, currently lines 425-429)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed elsewhere — this is the only task.

**Context:** `InstructionTask`'s root element and its completion-card variant both render `<div className="session-body reading-body instruction-body">` (`src/topics/renderers/reading/index.jsx:562` and `:580`). The existing `@media (orientation: landscape)` block (`src/styles.css:18353`) already sets `align-items: stretch` on this same selector, confirming this shrink-to-fit bug was already found and fixed for landscape but never for the portrait/base case.

- [ ] **Step 1: Add the unconditional stretch override**

Find this block in `src/styles.css` (currently lines 425-429):

```css
/* ── Instruction kind ── */
.instruction-body {
  cursor: default;
  overflow-y: auto;
}
```

Replace it with:

```css
/* ── Instruction kind ── */
.instruction-body {
  cursor: default;
  overflow-y: auto;
}

/* Override the shared .session-body's align-items:center — without this,
   the column shrink-wraps to whichever step's content happens to be
   widest, making the progress bar and nav buttons below change width
   between steps instead of consistently filling the screen. */
.session-body.reading-body.instruction-body {
  align-items: stretch;
}
```

- [ ] **Step 2: Build to confirm no CSS errors**

Run: `npm run build`
Expected: build succeeds (`✓ built in ...`), no errors.

- [ ] **Step 3: Manual verification in the browser**

Run: `npm run dev`

Open the app, go to Planner → "Готовить" on a recipe with varied step content (e.g. `content/recipes/salad.txt` — has a checklist prep step, plain action steps, and a title image). Resize the browser window to a tablet-like width (e.g. ~1000px) and check both orientations:

- **Portrait-like (window taller than wide, or narrow-ish width):** step through every step. The progress bar and the bottom Back/CTA buttons should span the full width of the screen on every step — no narrowing on short-text/checklist steps, no widening only on the title/image step.
- **Landscape-like (window wider than tall):** step through every step again. The progress bar and bottom buttons should span the full width of the right-hand content column (the column next to the chef panel) consistently across all steps.
- On both: the step's own text/image card should stay in its narrow centered column (~640px max), unchanged from before.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "fix(recipes): stop cooking screen header/nav from shrink-wrapping per-step content width"
```

---

## Self-Review Notes

- **Spec coverage:** the spec's entire fix (single scoped `align-items: stretch` override, no change to `.instruction-step`'s width policy, no JS) is implemented in this one task.
- **No placeholders:** the exact CSS to add is shown in full; the manual verification steps name the exact recipe file and exact things to check.
- **Type consistency:** N/A — CSS-only change, no functions/interfaces introduced.
