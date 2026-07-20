# Remove Duplicate Close Button (Recipe Cooking Screen) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the second, unconfirmed "Закрыть" button on the recipe-cooking screen, leaving only the confirm-gated one in the session header, and let the recipe progress bar fill the freed width.

**Architecture:** Single-file JSX edit — delete one `<button>` element from `InstructionTask` in `src/topics/renderers/reading/index.jsx`. No new components, no state changes, no CSS changes (the sibling `.instruction-progressbar-wrap` is already `flex: 1` in the same flex row, so it expands automatically once the button is gone).

**Tech Stack:** React (existing component), no new dependencies.

## Global Constraints

- Do not remove or rename `exitInstruction` — it's still wired to Escape and Backspace-at-first-step keyboard navigation (`src/topics/renderers/reading/index.jsx`, the `onKey` effect).
- Do not touch `src/features/instructions/InstructionRunnerScreen.jsx` — out of scope per the spec (separate, single-close-button screen).
- Do not touch `SessionHeader.jsx` / `openSessionExitPrompt` behavior.

---

### Task 1: Remove the duplicate close button from the recipe-cooking header row

**Files:**
- Modify: `src/topics/renderers/reading/index.jsx:743-755` (the `.instruction-header` block inside `InstructionTask`'s return)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this is a pure deletion. `exitInstruction` (defined earlier in `InstructionTask`, `src/topics/renderers/reading/index.jsx:683-686`) remains defined and used by the existing keyboard-nav effect.

- [ ] **Step 1: Confirm current markup**

  Read `src/topics/renderers/reading/index.jsx:743-755`. It currently reads:

  ```jsx
          <div className="instruction-header">
            <div className="instruction-header-row">
              <InstructionProgressBar segments={segments} stepIndex={stepIndex} />
              <button
                type="button"
                className="instruction-close-btn"
                onClick={exitInstruction}
                aria-label="Закрыть рецепт"
              >
                ✕
              </button>
            </div>
          </div>
  ```

- [ ] **Step 2: Delete the button, keep the progress bar**

  Replace the block above with:

  ```jsx
          <div className="instruction-header">
            <div className="instruction-header-row">
              <InstructionProgressBar segments={segments} stepIndex={stepIndex} />
            </div>
          </div>
  ```

- [ ] **Step 3: Run the existing test suite for this renderer**

  Run: `npx vitest run src/topics/renderers/reading --exclude "**/.worktrees/**"`
  Expected: all existing tests still PASS (this is a pure markup deletion — no test currently asserts on `.instruction-close-btn`, so none should need updating; if one does, that's a signal this task's scope assumption was wrong — stop and re-check the spec before editing the test).

- [ ] **Step 4: Visual check in a headed browser**

  Since this screen requires an authenticated session to reach through the normal app flow, verify via a standalone render harness (same approach used earlier in this session for `PlannerActionBar`): a temporary root-level `scratch_*.html` + `.jsx` pair that imports `InstructionTask` (or, if that pulls in too much store/session context, imports and renders just `InstructionProgressBar` plus the surrounding `.instruction-header`/`.instruction-header-row` markup with mock props) alongside the real CSS, screenshotted at both a wide (420px) and narrow (320px) viewport. Confirm:
  - Only one close button is visible anywhere in the screenshot (none inside the recipe header row).
  - The progress bar now spans the full width of `.instruction-header-row` with no leftover empty gap where the button used to be.

  Delete the scratch files afterward.

- [ ] **Step 5: Commit**

  ```bash
  git add src/topics/renderers/reading/index.jsx
  git commit -m "$(cat <<'EOF'
  fix(reading): remove the duplicate unconfirmed Закрыть button on the recipe screen

  The recipe-cooking screen had two close buttons: the session header's
  (confirm-gated) and one next to the recipe's own progress bar that exited
  immediately with no confirmation. Keep only the confirm-gated one; the
  progress bar (already flex:1) fills the freed width automatically.

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```
