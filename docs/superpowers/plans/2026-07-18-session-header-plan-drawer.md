# Session Header & Plan/Settings Accordion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `SessionScreen`'s conditionally-hidden `.session-topbar` with a universal `SessionHeader` shown for every renderer/mode, and add a "tongue" accordion trigger under it that opens an overlay panel (`SessionPlanDrawer`) covering the lesson-plan checklist and a mid-session mode-settings shortcut.

**Architecture:** Extract the existing inline topbar JSX from `SessionScreen.jsx` into a props-driven `SessionHeader` component that always renders (no more `reading`/`print_materials` exclusion). Add a full-width "tongue" button as a third header row; tapping it opens `SessionPlanDrawer`, a new component that reuses `LessonPlanPanel`'s existing checklist markup/logic (moved, not rewritten) plus a new "Настройки режима" tab that hands off to the existing `ParamsScreen`. The old floating `LessonPlanPanel` badge and `reading`'s own floating `ReadingCloseButton` are deleted once the universal header covers what they used to provide.

**Tech Stack:** React 19 (JSX, no TypeScript), Zustand store (`useAppStore`), Vitest for unit tests, headed Playwright via the `run` skill for manual verification (this project's established convention for UI features — see both design specs' Testing sections).

## Global Constraints

- No new color introduced for the tongue/panel — reuse the existing teal accent (`#2f5b57`, `#4a9b8f`) and the dark-teal shadow/scrim tone already used by `.home-header` (`rgba(20, 42, 40, ...)`), per `docs/superpowers/specs/2026-07-18-session-header-accordion-trigger-design.md`.
- Panel is an overlay (never pushes/resizes the task renderer beneath it) — per the same spec, "Overlay vs push" decision.
- `SessionPlanDrawer`'s checklist tab content is moved from `LessonPlanPanel.jsx`, not rewritten — same class names (`lesson-plan-sheet__*`), same handlers.
- `ParamsScreen.jsx`'s own fields, param schemas, and save/confirm behavior are NOT touched — only a one-line stale-flag fix in `launchSession()` (Task 3, done).
- iOS safe-area rule from `c:\Users\dmazn\CLAUDE.md` applies: any new screen-edge-reaching fixed/absolute element must use the existing `--app-safe-*` CSS variables — already accounted for in the CSS (panel padding, scrim needs none since it carries no interactive edge content).
- **Out of scope for this plan:** the `docs/superpowers/specs/2026-07-17-session-header-plan-drawer-design.md` "Pre-session entry point" section (a `JourneyStep` row on `HomeScreen`'s `SessionTab` that opens `SessionPlanDrawer` in plan-only mode before a session starts). That's a separate, smaller follow-up against a different screen with no header to anchor under — plan it separately when needed.
- **Known environment hazard:** this repo's working tree is shared with a concurrent session that runs `npm run deploy:prod` periodically, which does `git reset --hard` as part of its flow and has twice wiped uncommitted work during this plan's execution. Commit every file the moment it's finished — do not batch multiple files across a verification pause.

## Status (as of this write-up)

- [x] Task 1: `formatPlanTongueLabel` helper — committed `227e0814`.
- [x] Task 2: Extract `SessionHeader`, make it universal — committed `8a8d53ce`.
- [x] Task 3: Tongue trigger + `SessionPlanDrawer` overlay — committed across `5c73c4d2`, `bcfde779`, `bf8b46dd`, `4242ee1f` (reconstructed once after a concurrent `git reset --hard` wiped the first attempt).
- [x] Task 4: Delete `LessonPlanPanel` and its now-dead code — committed `d34ae47c`.
- [x] Task 5: Delete `reading`'s own `ReadingCloseButton` — committed `d943d9ed` (also dropped the now-unused `onClose` param from the 3 task components that lost their only reference to it).
- [x] Task 6: Full regression pass — unit tests green (160/161; the 1 failure, `activeSession.test.js`, is a pre-existing baseline issue in code untouched for 10+ days, reproduces in isolation independent of this plan). Manual pass via headed Playwright confirmed: header renders (progress variant and subtitle-only variant) for every renderer including previously-broken `print_materials`; tongue opens/closes the panel identically everywhere; both drawer tabs work (checklist empty-state + "Настройки режима" → real `ParamsScreen`); exactly one close button remains per screen (no `ReadingCloseButton` duplicate); no floating peek-tab badge anywhere. Not independently re-verified after the fact: the settings-tab save round-trip and the iOS safe-area simulated check — both rely on code paths exercised/read during Tasks 2–3 (existing `ParamsScreen` save flow, existing `--app-safe-*` CSS pattern) rather than a fresh end-to-end click-through.

---

## File Structure

New files:
- `src/features/session/SessionHeader.jsx` — presentational header (progress/subtitle + icon cluster + tongue trigger). Done.
- `src/features/lessonPlan/SessionPlanDrawer.jsx` — the overlay panel (checklist tab + settings tab), replaces `LessonPlanPanel.jsx`. Done.

Modified files:
- `src/features/session/SessionScreen.jsx` — mount `SessionHeader` + `SessionPlanDrawer`, drop the `reading`-only exclusion, own the drawer's open/closed state. Done.
- `src/features/lessonPlan/lessonPlanUtils.js` — `formatPlanTongueLabel`. Done.
- `src/features/lessonPlan/lessonPlanUtils.test.js` — tests it. Done.
- `src/features/lessonPlan/LessonPlanContext.jsx` — drop the now-unused `isOpen`/`setIsOpen`. **Pending (Task 4).**
- `src/features/session/ParamsScreen.jsx` — clear `sessionReturnScreen` after a successful mid-session settings save. Done.
- `src/App.jsx` — remove the `LessonPlanPanel` mount + import. **Pending (Task 4).**
- `src/topics/renderers/reading/index.jsx` — remove `ReadingCloseButton` and its 4 call sites. **Pending (Task 5).**
- `src/styles.css` — tongue CSS added; `.reading-close-btn` removal **pending (Task 5).**
- `src/features/lessonPlan/lessonPlan.css` — panel/scrim CSS added; old badge + bottom-sheet-shell CSS removal **pending (Task 4).**

Deleted files (pending):
- `src/features/lessonPlan/LessonPlanPanel.jsx`

---

### Task 4: Delete `LessonPlanPanel` and its now-dead code

**Files:**
- Delete: `src/features/lessonPlan/LessonPlanPanel.jsx`
- Modify: `src/App.jsx`
- Modify: `src/features/lessonPlan/LessonPlanContext.jsx`
- Modify: `src/features/lessonPlan/lessonPlan.css`

**Interfaces:**
- Consumes: nothing new.
- Produces: `useLessonPlan()` now returns `{ activeSessionPlan, refresh, markItemDone }` (drops `isOpen`, `setIsOpen`) — `LessonPlanTab.jsx` (the only other consumer) only used `refresh`, confirmed unaffected.

- [ ] **Step 1: Delete the file**

```bash
git rm src/features/lessonPlan/LessonPlanPanel.jsx
```

- [ ] **Step 2: Remove its mount from `App.jsx`**

In `src/App.jsx`, remove this import line:

```jsx
import LessonPlanPanel from "@/features/lessonPlan/LessonPlanPanel";
```

And remove this line from the render:

```jsx
      <LessonPlanPanel />
```

(It sits directly above `<ErrorBoundary key={screen}>` — leave `{timerEnabled && <GlobalTimer .../>}` above and `<ErrorBoundary>` below untouched.)

- [ ] **Step 3: Drop the dead `isOpen`/`setIsOpen` from `LessonPlanContext`**

Replace the full contents of `src/features/lessonPlan/LessonPlanContext.jsx` with:

```jsx
import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { getActiveSessionPlan, setSessionItemDone } from "./lessonPlanApi";

const LessonPlanContext = createContext(null);

export function LessonPlanProvider({ children }) {
  const [activeSessionPlan, setActiveSessionPlan] = useState(null);
  const activeStudentId = useAppStore((s) => s.activeStudentId);

  const refresh = useCallback(async (studentId) => {
    const sid = studentId ?? activeStudentId;
    if (!sid) { setActiveSessionPlan(null); return; }
    const plan = await getActiveSessionPlan(sid);
    setActiveSessionPlan(plan);
  }, [activeStudentId]);

  useEffect(() => {
    if (!activeStudentId) { setActiveSessionPlan(null); return; }
    refresh(activeStudentId);
  }, [activeStudentId, refresh]);

  const markItemDone = useCallback(async (itemId, done = true, note = null) => {
    if (!activeStudentId) return;
    const updated = await setSessionItemDone(activeStudentId, itemId, done, note);
    if (updated) setActiveSessionPlan(updated);
  }, [activeStudentId]);

  const value = { activeSessionPlan, refresh, markItemDone };
  return <LessonPlanContext.Provider value={value}>{children}</LessonPlanContext.Provider>;
}

export function useLessonPlan() {
  return useContext(LessonPlanContext);
}
```

- [ ] **Step 4: Remove the obsolete badge + bottom-sheet-shell CSS**

In `src/features/lessonPlan/lessonPlan.css`, delete this entire block from the top of the file (everything from the file's first line through the closing `}` of `.lesson-plan-sheet__header button`, i.e. up to but not including `.lesson-plan-sheet__list { ... }`):

```css
/* ── Floating checklist badge — a quiet "clipboard tab" peeking off the
   right edge, with a thin progress ring that fills in as items get
   checked off. Deliberately tucked to the edge rather than a free-floating
   circle: this is meant to read as a soft reminder, not a notification.
   Sits at the vertical middle of the right edge (not the top corner,
   which is already claimed by session-level floating controls like
   .worksheet-close-button--floating) and stays mostly off-canvas —
   only a small pull-tab sliver shows until it's tapped open. ── */
.lesson-plan-badge {
  position: fixed;
  top: 50%;
  right: var(--app-safe-right, 0px);
  z-index: 250;
  display: flex;
  align-items: center;
  gap: 8px;
  /* Extra left padding when peeking gives the pull-tab a real touch
     target (44px+) instead of a sliver of the ring icon — the ring
     itself isn't a reliable thing to aim a thumb at when 90% of it
     is off-canvas. */
  min-height: 44px;
  background: #fff;
  border: 1.5px solid #e0d4c3;
  border-right: none;
  border-radius: 16px 0 0 16px;
  padding: 7px 14px 7px 14px;
  box-shadow: -4px 4px 14px rgba(38, 49, 49, 0.12);
  cursor: pointer;
  font-family: inherit;
  transform: translateY(-50%) translateX(calc(100% - 46px));
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}
.lesson-plan-badge--peeled {
  transform: translateY(-50%) translateX(0);
}
/* Grip nub — always at the badge's leading edge, so it's the first
   thing visible (and grabbable) while peeking, rather than relying on
   a half-cropped ring icon to read as "pull me". */
.lesson-plan-badge::before {
  content: "";
  position: absolute;
  left: 5px;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 26px;
  border-radius: 3px;
  background: #cbb99e;
}

.lesson-plan-badge__ring-wrap { position: relative; width: 30px; height: 30px; flex-shrink: 0; }
.lesson-plan-badge__ring-wrap svg { position: absolute; inset: 0; transform: rotate(-90deg); }
.lesson-plan-badge__ring-track { stroke: #e6dcc9; }
.lesson-plan-badge__ring-fill {
  stroke: #4a9b8f;
  transition: stroke-dashoffset 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.lesson-plan-badge__icon {
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  background: #eef6f4;
  color: #4a9b8f;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
}
.lesson-plan-badge--complete .lesson-plan-badge__icon { background: #4a9b8f; color: #fff; }

.lesson-plan-badge__count { font-weight: 900; font-size: 14px; color: #263131; line-height: 1.1; }
.lesson-plan-badge__count small {
  display: block; font-weight: 800; color: #8c9895; font-size: 9px; letter-spacing: 0.04em;
}

/* ── Expanded sheet — same warm card language as journey-step ── */
.lesson-plan-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 250;
  max-height: 62vh;
  overflow-y: auto;
  background: #fff;
  border-radius: 20px 20px 0 0;
  border: 1.5px solid #e0d4c3;
  border-bottom: none;
  padding: 16px calc(18px + var(--app-safe-right, 0px)) calc(18px + var(--app-safe-bottom, 0px)) calc(18px + var(--app-safe-left, 0px));
  box-shadow: 0 -8px 28px rgba(38, 49, 49, 0.16);
  animation: lesson-plan-sheet-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}
@keyframes lesson-plan-sheet-in {
  from { transform: translateY(12px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}

.lesson-plan-sheet__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 6px;
}
.lesson-plan-sheet__title {
  font-family: var(--font-serif);
  font-size: 18px;
  color: #263131;
}
.lesson-plan-sheet__header button {
  background: none;
  border: none;
  color: #8c9895;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  cursor: pointer;
}
```

The file should now start directly with `.lesson-plan-sheet__list { list-style: none; margin: 0; padding: 0; }` — those content classes (`__list`, `__item`, `__row`, `__check`, `__check--done`, `__label`, `__label--done`, `__play`, `__note-link`, `__note-row`, `__note-input`) stay untouched; `SessionPlanDrawer` (Task 3) already reuses them as-is.

- [ ] **Step 5: Manual verification**

Reload the app. Confirm no floating badge appears anywhere on any screen (previously visible at the vertical-middle of the right edge whenever a student had an active session plan). Confirm the session-header tongue from Task 3 still works unaffected — it never depended on `LessonPlanPanel`.

- [ ] **Step 6: Commit**

```bash
git add -A src/features/lessonPlan/LessonPlanPanel.jsx src/App.jsx src/features/lessonPlan/LessonPlanContext.jsx src/features/lessonPlan/lessonPlan.css
git commit -m "refactor(lesson-plan): delete floating LessonPlanPanel badge, superseded by SessionPlanDrawer"
```

---

### Task 5: Delete `reading`'s own `ReadingCloseButton`

**Files:**
- Modify: `src/topics/renderers/reading/index.jsx`
- Modify: `src/styles.css`

**Interfaces:** none — purely removes now-redundant UI now that `SessionHeader` (Task 2) always provides a ✕ for every renderer including `reading`.

- [ ] **Step 1: Remove the component definition**

In `src/topics/renderers/reading/index.jsx`, delete:

```jsx
function ReadingCloseButton({ onClose }) {
  if (!onClose) return null;
  return (
    <button type="button" className="reading-close-btn" onClick={onClose} aria-label="Закрыть">
      ✕
    </button>
  );
}

```

- [ ] **Step 2: Remove the 4 call sites**

First occurrence, inside `ReadTextTask`'s `layout === "line"` branch — find:

```jsx
        {showCloseButton && <ReadingCloseButton onClose={onClose} />}
        <div className="reading-poem-wrap">
          {!isPool && <div className="reading-title">{getTopicTitle(task.text.title)}</div>}
```

Replace with:

```jsx
        <div className="reading-poem-wrap">
          {!isPool && <div className="reading-title">{getTopicTitle(task.text.title)}</div>}
```

Second occurrence, `ReadTextTask`'s other layout branch — find:

```jsx
      {showCloseButton && <ReadingCloseButton onClose={onClose} />}
      <div className="reading-poem-wrap" ref={fit.wrapRef}>
```

Replace with:

```jsx
      <div className="reading-poem-wrap" ref={fit.wrapRef}>
```

Third occurrence, `ReadPoemBookTask` — find:

```jsx
    <div className="session-body reading-body" ref={fit.bodyRef}>
      <ReadingCloseButton onClose={onClose} />
      <div className="reading-poem-wrap" ref={fit.wrapRef}>
        <div className="reading-title">{getTopicTitle(page.title)}</div>
```

Replace with:

```jsx
    <div className="session-body reading-body" ref={fit.bodyRef}>
      <div className="reading-poem-wrap" ref={fit.wrapRef}>
        <div className="reading-title">{getTopicTitle(page.title)}</div>
```

Fourth occurrence, `SafeCodeTask` — find:

```jsx
    <div className="session-body reading-body safe-code-body">
      <ReadingCloseButton onClose={onClose} />
      <div className="safe-code-header">
```

Replace with:

```jsx
    <div className="session-body reading-body safe-code-body">
      <div className="safe-code-header">
```

Note: `showCloseButton` stays — it's also used elsewhere in `ReadTextTask` (`noWrap={showCloseButton}`, `illustrationRef={showCloseButton ? fit.illustrationRef : undefined}`, and gating `useFitReadingText`). Only the `ReadingCloseButton` JSX itself is removed, not the flag.

- [ ] **Step 3: Remove the CSS rule**

In `src/styles.css`, delete:

```css
.reading-close-btn {
  position: fixed;
  top: calc(12px + var(--app-safe-top, 0px));
  right: calc(12px + var(--app-safe-right, 0px));
  z-index: 20;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.92);
  color: #1c3634;
  font-size: 1.1rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.14);
  cursor: pointer;
}
```

- [ ] **Step 4: Manual verification**

Open a story/poem reading task and a safe-code session. Confirm there's exactly one close control (the header's ✕, top-right of the icon cluster) — no second floating crest button.

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/reading/index.jsx src/styles.css
git commit -m "refactor(reading): drop ReadingCloseButton, superseded by universal SessionHeader"
```

---

### Task 6: Full regression pass

**Files:** none (verification only).

- [ ] **Step 1: Run the unit test suite**

Run: `npx vitest run src/features/lessonPlan/ src/features/session/`
Expected: PASS, no failures.

- [ ] **Step 2: Manual pass — combined checklist from both design specs, via `run` skill headed Playwright**

1. Card-based renderer (e.g. "5 из 5"): header shows progress+counter+sound+lock+tongue+close; no ReadingCloseButton anywhere (n/a here, sanity only).
2. `reading` story/poem task: header shows subtitle-only variant + tongue + close; exactly one close control.
3. `print_materials`: header shows subtitle-only variant + tongue + close (previously had nothing at all).
4. Tap the tongue on each of the above 3: panel opens identically every time (same shell, same tabs).
5. Toggle a freeform item done/undone from the drawer: confirm it's reversible.
6. "Настройки режима" → "Изменить →" → change a value → save: session restarts with the new value. Then repeat and back out without saving: confirm it returns to `session`, not `texts`.
7. Complete a normal (non-drawer-triggered) `follow_instruction`/recipe session end-to-end: confirm it still routes to `"texts"` on completion, not back to `"session"` — this is the specific regression Task 3's `setSessionReturnScreen(null)` fix guards against.
8. No floating peek-tab badge appears anywhere in the app (Task 4).
9. iOS safe-area override check (per `CLAUDE.md`) on both the header (top edge) and the panel (bottom/left/right in simulated landscape).

- [ ] **Step 3: Report results**

If every check passes, the feature is complete. If any check fails, fix it within the task whose step introduced the regression and re-run this checklist before considering the plan done.
