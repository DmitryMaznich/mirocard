# Session header & in-session plan/settings drawer

## Context

The lesson-plan feature (`docs/superpowers/specs/2026-07-16-lesson-plan-design.md`) shipped a floating checklist badge (`LessonPlanPanel`, mounted globally in `App.jsx`) — a "clipboard tab" pull-tab docked to the right edge of every screen. In real use this turned out badly on two counts:

1. It collides with renderer-specific floating controls that already claim screen-edge real estate — most concretely `.worksheet-close-button--floating` in `addition_subtraction`/`column_addition` worksheets (`src/styles.css:5785`), which sits at almost the same coordinates.
2. The peeking sliver is too small/insensitive as a touch target on a real phone, and it's present on *every* screen (not just during a session), which reads as clutter rather than a soft reminder.

Separately, `SessionScreen.jsx` already has a `.session-topbar` (progress stars, task counter, sound toggle, adult-confirm lock, close button) — but it's conditionally rendered and skipped entirely for two renderers: `reading` (story/poem modes) and `print_materials` (`SessionScreen.jsx:210-215`). Those two instead get renderer-specific floating chrome (`reading`'s own `ReadingCloseButton`) or, in `print_materials`'s case, no close/header UI at all.

This spec reworks how the lesson-plan checklist (and, newly, mid-session mode-settings access) is *presented and triggered* — not the underlying data layer. `LessonPlanContext`, `lessonPlanApi.js`, the `LessonPlanTab` hub, `PeriodPlanScreen`, `PeriodCarryOverSheet`, `SessionPlanBuilderSheet`, `AddPlanItemSheet`, and `LessonPlanHistoryScreen` are all unaffected.

## Scope

Covers:
- A universal `SessionHeader`, shown for **every** renderer (including `reading` and `print_materials`, which get a header for the first time), replacing the conditional `.session-topbar`.
- A `SessionPlanDrawer` bottom sheet, triggered from the header, with two tabs: **План занятия** (the existing checklist, relocated) and **Настройки режима** (a shortcut into the existing `ParamsScreen`).
- Deleting `LessonPlanPanel`'s floating badge/peek-tab entirely — its checklist-rendering logic moves into `SessionPlanDrawer`.
- Deleting the `reading` renderer's own `ReadingCloseButton` (redundant with the universal header's close button).
- A non-floating plan entry point on the pre-session topic/mode picker (`HomeScreen`'s `SessionTab`), since there's no `SessionScreen` header to hang it on before a session starts.

Explicitly out of scope:
- **Preserving progress when settings change mid-session.** Changing a mode's settings via the drawer restarts the session fresh (same effective behavior as the existing `handleRestartDeck`) — no new "regenerate only the remaining tasks" engine. The user is separately reworking how progress/scoring works, so investing in progress-preserving regeneration now isn't worthwhile; simple restart is enough.
- Any change to `ParamsScreen`'s fields, per-mode param schemas, or its own save/confirm behavior — reused exactly as it exists today.
- `GlobalTimer` — stays an independent floating overlay, untouched, no interaction with the new header/drawer.
- Any change to the lesson-plan data layer (`LessonPlanContext`, `lessonPlanApi.js`) or the other lesson-plan screens listed above.

## Design

### `SessionHeader` — universal session header

New component, `src/features/session/SessionHeader.jsx`, extracted and generalized from the current inline `.session-topbar` block in `SessionScreen.jsx:215-269`. Rendered unconditionally for every renderer — the existing `isReadingRenderer`/`isPrintMaterialsRenderer` booleans (`SessionScreen.jsx:210-211`) stop gating *whether* the header renders and instead only gate which **left slot** variant it shows:

- **Left slot** — for renderers with a discrete task/card concept (everything except `reading` story/poem and `print_materials`): the existing `StarBar` progress + "X из N ✓c ✗w" counter, unchanged. For the two exceptions: just the subtitle text ("тема · режим/текст"), matching the current `.session-subtitle` content (`SessionScreen.jsx:268`) but promoted into the left slot since there's no counter to anchor it below.
- **Right cluster** (identical everywhere): 🔊 sound toggle (existing `soundEnabled`/`toggleSound` wiring, unchanged), 🔒 adult-confirm lock (existing hold-to-toggle behavior, hidden when `isStudentPortal`, unchanged), a new 📋 icon button that opens `SessionPlanDrawer`, and ✕ close (existing `openSessionExitPrompt`, unchanged). Where the counter is present, tapping it *also* opens the drawer — a convenience shortcut, not a second mechanism.
- 📋 shows a small dot when the active session plan (if any) has undone items, and no dot when it's empty/absent/fully done — a lightweight presence cue, not a full progress ring (there's no room for one in an icon-sized button).

### `SessionPlanDrawer` — the plan/settings bottom sheet

New component, `src/features/lessonPlan/SessionPlanDrawer.jsx`. A bottom sheet whose open/closed state is local to `SessionScreen` (plain `useState`, toggled by the header's 📋/counter). Two tabs:

1. **План занятия** — the checklist markup and logic currently in `LessonPlanPanel.jsx`: reversible check circles, "Играть это" quick-start (`handlePlayItem`, unchanged — still writes `activeLessonPlanItemId` and quick-starts via `computeDefaultParams`), the "+заметка" note flow. Only the outer chrome changes (sheet instead of floating badge-triggered panel); a plain "N из M" text replaces the old ring/badge summary since there's no floating ring anymore.
2. **Настройки режима** — one row: the current mode's display name + an "Изменить →" button. On tap: `setSessionReturnScreen('session')` then `setScreen('params')`. This reuses `ParamsScreen` exactly as it exists — no new settings UI, no duplicated param schema. `ParamsScreen` already calls `setScreen("session")` on save (`ParamsScreen.jsx:60,781`), which remounts `SessionScreen` and regenerates its task list against the just-saved params — this *is* the "restart" mentioned in Scope, and requires no engine changes. Setting `sessionReturnScreen` only matters for the *cancel* path (`ParamsScreen`'s back button falls back to `"texts"` otherwise, which would be wrong when we navigated here from mid-session).

Rendering: mounted once inside `SessionScreen`, reading `useLessonPlan()` exactly as `LessonPlanPanel` did. Unlike the old badge (which rendered nothing at all when there was no active session plan, `LessonPlanPanel.jsx:17`), the drawer itself is now always reachable via the header's 📋 button regardless of plan state, since "Настройки режима" is useful with or without an active plan. When there's no active session plan, the "План занятия" tab shows a short message ("Плана на сегодня пока нет") plus a button that opens the existing `SessionPlanBuilderSheet` right there, so a parent who didn't plan ahead can still build one mid-session instead of needing to back out to the hub tab.

### What gets deleted

- `LessonPlanPanel.jsx` and its floating-badge/peek-tab CSS in `lessonPlan.css` (`.lesson-plan-badge*`) — removed entirely. The checklist-rendering JSX (item rows, check circles, note flow, quick-start handler) is *moved* into `SessionPlanDrawer`, not rewritten from scratch.
- `<LessonPlanPanel />`'s mount in `App.jsx` — removed (it was global, independent of the current screen; the new drawer is owned by `SessionScreen` instead).
- `reading`'s `ReadingCloseButton` (floating crest, `position: fixed`) — removed; the universal header's ✕ replaces it for `story`/`poem` modes. `print_materials` gains a working close button for the first time (previously had none).
- `LessonPlanProvider` in `main.jsx` **stays** — `SessionPlanDrawer` and the pre-session entry point (below) both still consume `useLessonPlan()`.

### Pre-session entry point

`SessionScreen` doesn't exist yet before a session starts, so the drawer's trigger can't live there. On `HomeScreen`'s `SessionTab` (the `JourneyStep`-based "Собери занятие" flow), add one more `JourneyStep` row — same component, same visual language, no new styling — showing "План занятия · N из M" when the active student has an active session plan. Tapping it opens `SessionPlanDrawer` rendered locally in that screen's context, **plan tab only** (no "Настройки режима" tab — there's no in-progress mode session to configure yet; that's what the normal topic → mode → params wizard already covers). When there's no active session plan, this row is omitted — the full builder experience already lives in the "План занятий" hub tab, no need to duplicate an empty-state card here.

## Testing

Manual, via the `run` skill (headed Playwright, per project convention):
- Confirm the header renders for a card-based renderer (progress+counter+sound+lock+📋+close) and for `reading`/`print_materials` (subtitle+sound+📋+close, no progress/counter) — including verifying `print_materials` now has a working close button where it previously had none.
- Tap the counter and tap 📋 separately — both open the same drawer.
- On the "План занятия" tab: toggle a freeform item done/undone (reversibility), quick-start a topic-linked item via "Играть это" and confirm it auto-completes on `SessionSummary`, same as before.
- On "Настройки режима": tap "Изменить →", confirm it lands on the real `ParamsScreen` for the current mode with real fields (not a placeholder), change a value, save, confirm the session restarts with the new value in effect. Tap "Изменить →" then back out without saving — confirm it returns to `session`, not `texts`.
- Confirm the 📋 dot indicator appears when the active plan has undone items and disappears when it doesn't (or there's no active plan).
- On `HomeScreen`'s topic/mode picker: confirm the "План занятия" row appears only when there's an active session plan, and opens the drawer without a settings tab.
- Confirm the old floating peek-tab badge no longer appears anywhere, and `reading`'s old floating crest is gone (only the header's ✕ remains).
- iOS safe-area check (per `CLAUDE.md`'s mandatory rule) on the new header (top edge) and drawer (bottom + left/right in simulated landscape) using the `app-ios-standalone` + `--app-safe-*` devtools override already used for the previous iteration.
