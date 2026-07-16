# Lesson plan (План занятия)

## Context

Mirocard is used by a parent (speech therapist for their own child) to run flashcard/topic sessions with their kid. Today the "Занятие" tab is a linear, single-topic wizard: pick student → pick topic → pick mode/params → `SessionScreen` → `SessionSummary`. There is no way to plan ahead what should be covered across a session or a stretch of time — the parent currently has to hold it all in their head, and reports repeatedly forgetting things they meant to work on until after the session ended.

Separately, the word "Планировщик" is already used in the app for an unrelated feature: the meal/shopping planner (`src/features/planner/`, tab in `HomeScreen.jsx`, screens `PlannerMenuScreen`/`PlannerShoppingScreen`/`PlannerPutawayScreen`). That word needs to be freed up before it can mean "lesson plan" anywhere in the UI.

This spec covers a new **"План занятия"** section: a two-level planner (period backlog → per-occasion checklist) with a persistent in-session reminder panel and a history/recap view, plus the rename of the existing meal planner's tab label.

## Scope

Covers:
- Renaming the existing meal/shopping planner tab from "Планировщик" to "Меню и магазин" (tab label + stray code comments referencing "Планировщик"/"planner" as a synonym for the meal flow). Screen titles inside that flow ("Меню", "Магазин", "Разложить") are already correct and untouched.
- A new 4th tab "План занятия" in `HomeScreen`'s bottom tab bar, per-student.
- Period plan: a backlog of goals with a fixed duration, no formal per-item frequency, a done-count + notes per item, and an end-of-period carry-over flow.
- Session plan: one active checklist per student, built from period-plan items and/or one-off items, not tied 1:1 to a calendar day.
- A persistent, collapsible floating panel showing the active session-plan checklist, visible both on the topic/mode selection screens and as an overlay on top of `SessionScreen` during actual gameplay — parent-facing only.
- Quick-start from a checklist item that's linked to an app topic (launches `SessionScreen` directly with saved topic/mode/params), with auto-check-on-completion.
- History: list of past (and current) periods with an aggregated recap per item (count + notes) and a timeline of the individual session-plan occasions that happened within that period.

Explicitly out of scope for this spec:
- Any change to the meal-planner's own screens, data model, or KV keys (`planner:*` stays as-is — it's an internal key, not user-visible text).
- Formal per-item frequency/scheduling ("every day", "every other day") — deliberately not modeled; the parent manually decides what goes into each session's checklist.
- Push notifications or reminders outside the app before a session starts.
- Multi-child shared plans — every period plan and session plan belongs to exactly one student.

## Design

### Data model

Stored via the existing `groupStore.js` KV pattern (same mechanism as `plannerApi.js`: namespaced string keys, synced through `pushOp`/pull), under a new namespace so there's no collision with the meal planner's `planner:*` keys.

**`PlanItem`** (shared shape used inside both period and session plans):
```
{
  id: string,
  kind: 'topic' | 'freeform',
  // kind === 'topic'
  topicId?: string,
  mode?: string,
  params?: object,
  label?: string,          // denormalized display name (topic/mode title), so the
                            // item still reads correctly if the topic is later removed
  // kind === 'freeform'
  text?: string,
  createdAt: number
}
```

**`LessonPeriodPlan`** — KV key `lessonplan:periods:${studentId}`, value is an array (history + at most one `active`):
```
{
  id: string,
  studentId: string,
  startedAt: number,
  durationDays: number,           // e.g. 7
  status: 'active' | 'closed',
  closedAt: number | null,
  carriedFromPeriodId: string | null,
  items: PlanItem[],
  progress: {
    [itemId]: { count: number, notes: [{ text: string, at: number }] }
  }
}
```

**`LessonSessionPlan`** — KV key `lessonplan:sessions:${studentId}`, value is an array (history + at most one `active`):
```
{
  id: string,
  studentId: string,
  periodPlanId: string | null,    // which active period it was built against, if any
  createdAt: number,
  closedAt: number | null,
  status: 'active' | 'closed',
  items: [{
    ...PlanItem,
    origin: 'period' | 'adhoc',
    periodItemId?: string,        // present when origin === 'period'; links back to
                                   // the PlanItem.id inside that period, for counter increments
    done: boolean,
    doneAt: number | null
  }]
}
```

Business rule (not structurally enforced): at most one `active` period plan and at most one `active` session plan per student at a time. "Start a new one" while one is active resumes/opens the existing active one instead of creating a duplicate.

A period's history/timeline view is `sessions.filter(s => s.periodPlanId === periodId)`, sorted by `createdAt`.

### Navigation: 4th tab + rename

- `HomeScreen.jsx`'s bottom tab bar (`HomeTabs`) gets a 4th entry, `"lessonPlan"`, alongside `session`/`planner`/`instructions`. Label: **"План занятия"**. Follows the same gating pattern as the existing `showPlanner`/`showInstructions` flags.
- The existing `"Планировщик"` tab label (`HomeScreen.jsx:138`) becomes **"Меню и магазин"**. No change to `planner_menu`/`planner_shopping`/`planner_putaway` screen ids or their own titles.
- Stray code comments that use "Планировщик" as shorthand for the meal flow (`store.js:9`, `groupStore.js:30`, `OptionsPicker.jsx:3`, `StoveHeatModal.jsx:15`) get reworded to "meal planner" / "Меню и магазин" so future readers don't confuse them with the new section.
- New screen ids added to `App.jsx`'s `SCREENS` map: `lesson_plan_period` (period backlog), `lesson_plan_history` (history list + detail), plus sheets for building the session checklist and the period carry-over flow (can be modal/sheet components rather than full screens — implementation plan decides).

### Hub screen ("План занятия" tab landing)

Two cards, mirroring the pattern already used by the meal-planner hub (`PlannerTab` in `HomeScreen.jsx`) and the session tab's `JourneyStep` rows:
- **Period card**: if an active period exists, shows days elapsed / total and item count; tapping opens the period backlog screen. If none exists, shows a "start a period" CTA (optional — see below).
- **Active checklist card**: if an active session plan exists, shows item count / done count; tapping resumes it (opens the builder/checklist view). If none exists, a primary "Собрать план на сегодня" button starts the session-plan builder.
- A "История" entry below both cards opens the history list.

Starting a period is **optional** — the session-plan builder works standalone (one-off items only) with no active period present.

### Period plan screen

- Backlog list of `PlanItem`s, each showing its `progress.count` (times done so far this period).
- "+ Добавить цель" opens an add-item sheet with two entry modes: pick an app topic (reusing the existing topic-catalog browsing pattern from `RecipeCatalogSheet`/`TopicLibraryScreen`, optionally picking a mode) or type free text.
- "Завершить период досрочно" available at any time; the period also auto-shows an end-of-period nudge once `now > startedAt + durationDays` — it does not auto-close silently, closing always goes through the carry-over flow below.

### Period carry-over flow

Triggered by explicit "finish" (early or via the end-of-period nudge). Shows every item from the closing period as a checkbox, **pre-checked for items with low/zero `progress.count`** (i.e., the ones that didn't get enough attention), unchecked for items with high counts. The parent can toggle any of them. Confirming:
- Marks the old period `status: 'closed'`, `closedAt: now`.
- Creates a new `LessonPeriodPlan` with `status: 'active'`, `carriedFromPeriodId` set, seeded with the checked items (fresh `PlanItem.id`s, `progress` reset), same `durationDays` as before.

### Session plan builder

- Opened from the hub's "Собрать план на сегодня" (or by resuming the active one).
- If an active period exists: lists its items as pre-checked toggles (parent can uncheck any) — this becomes the `origin: 'period'` items, linked via `periodItemId`.
- A free-text field to add one-off items for today only (`origin: 'adhoc'`) — these do **not** get written back into the period backlog.
- "Начать занятие" creates/updates the `LessonSessionPlan` with `status: 'active'` and closes the builder.
- The plan can be closed manually at any time (even with unfinished items) from its own screen — unfinished items simply stay `done: false` in that occasion's record; they don't retroactively vanish from the period backlog.

### Persistent checklist panel (parent-facing reminder)

A new `LessonPlanContext` + `LessonPlanOverlay` component, modeled on the existing `TimerContext`/`GlobalTimer` (`src/features/timer/GlobalTimer.jsx`) — mounted once in `App.jsx`, aware of the currently active student and their active `LessonSessionPlan`.

- **Visibility**: only rendered when the active student has an `active` session plan. If the app's active-student context switches to a student with no active plan, the panel disappears.
- **Collapsed state**: small pill/badge (`📋 done/total`) pinned to a screen corner — visible both on the topic/mode selection screens (`SessionTab`/`JourneyStep` flow) and on top of `SessionScreen` during actual gameplay. Must follow the iOS safe-area rule in `CLAUDE.md` (`var(--app-safe-top/right/bottom/left)`) since it's a new fixed/floating screen-edge element.
- **Expanded state**: tapping the badge opens a bottom sheet listing each item — done items show a checkmark/strikethrough; pending topic-linked items show a "Играть это" button (quick start); pending freeform items show a plain checkbox for manual tap.
- **Quick start**: tapping "Играть это" on a topic-linked item calls `setScreen('session')` with the item's saved `topicId`/`mode`/`params` pre-applied — skipping the normal topic/mode picker screens (`TopicLibraryScreen`, `ModePickerScreen`, `ParamsScreen`). The launched session-plan item's `id` is carried along as return-state, the same way `store.js` already tracks a "return screen" for the recipe-session-from-planner flow (`src/topics/renderers/reading/index.jsx` exits back to `planner_menu`) — so completion is matched by that exact `id`, not by re-matching `topicId`/`mode`/`params` (which could collide if two pending items reference the same topic+mode).
- **Auto-check**: `useSessionEngine`'s completion point (reaching `SessionSummary`) notifies `LessonPlanContext` with that carried item `id` when the just-finished session was started via quick-start; the context sets that item's `done: true`, `doneAt: now`. If the item has `origin: 'period'`, the linked period item's `progress.count` is incremented by 1 and `progress.notes` stays untouched (notes are added separately, optionally, by the parent — see below).
- Marking a freeform item, or manually toggling any item, is a plain tap on its checkbox in the expanded sheet — no auto-completion path for those.
- After marking any item done (auto or manual), an optional lightweight prompt lets the parent add a short note (e.g. "хорошо получалось", "уставала") that's appended to `progress.notes` for period-linked items — skippable.

### History screen

- List of the student's periods (`lessonplan:periods:${studentId}`), newest first, current one visually marked. Each row: date range, count of session-plan occasions within it, "N of M goals touched" summary.
- Detail view for one period:
  - **Recap**: each `PlanItem` with its final `progress.count` and the notes collected for it; items with 0 count are flagged and show whether they were carried into the next period.
  - **Timeline**: every `LessonSessionPlan` with `periodPlanId === this period`, sorted by date, showing what was on the checklist and how many were done that occasion.

## Testing

Manual verification via the `run` skill (headed Playwright, per project convention):
- No period, no session plan → hub shows both "start" CTAs; session-plan builder works with only one-off items; nothing crashes with `periodPlanId: null`.
- Start a period, add a topic-linked and a freeform goal → backlog shows both with count 0.
- Build a session-plan pulling both period items in, add a one-off item, start the session.
- On the "Занятие" tab and inside `SessionScreen`, confirm the collapsed badge appears, respects iOS safe-area insets (simulate via the `app-ios-standalone` class + safe-area CSS vars per `CLAUDE.md`), and expands to the correct checklist.
- Quick-start a topic-linked item, play through to `SessionSummary`, confirm auto-check-off and the period item's `progress.count` increments by 1; add a note and confirm it lands in `progress.notes`.
- Manually check off the freeform item.
- Close the session plan with one item still undone; confirm it stays undone in that occasion's record and doesn't affect the period backlog beyond what was actually completed.
- Finish the period early: confirm the carry-over sheet pre-checks the zero/low-count item(s), confirm the resulting new period has the right seeded items and reset counts.
- Open History: confirm the closed period shows the correct recap (counts + notes) and a timeline with the one session-plan occasion, dated correctly.
- Switch the active student to one without an active session plan → confirm the floating panel disappears.
- Rename check: "Планировщик" no longer appears anywhere in the tab bar or as a user-visible label for the meal flow; "Меню и магазин" appears instead; the new "План занятия" tab is visually consistent with the other three tabs.
