# Session header accordion trigger (revision of the plan/settings drawer)

## Context

`docs/superpowers/specs/2026-07-17-session-header-plan-drawer-design.md` (committed same week) specifies a universal `SessionHeader` shown for every renderer, with a `SessionPlanDrawer` bottom sheet triggered by a 📋 icon in the header's right cluster (or by tapping the task counter). That spec is still correct on:
- The universal header applying to **every** renderer, including `reading` and `print_materials` — `reading`'s own `ReadingCloseButton` is still deleted, no exception.
- The `SessionPlanDrawer` content and logic: two tabs, "План занятия" (checklist, reversible, "Играть это", "+заметка") and "Настройки режима" (shortcut into `ParamsScreen`).
- The pre-session entry point on `HomeScreen`'s `SessionTab` (`JourneyStep` row) — unchanged, out of scope here.

This revision changes only **how the drawer is triggered and presented**: instead of an icon button opening a bottom sheet that slides up from the screen edge, it's a labeled "tongue" row built into the header itself, which drops an overlay panel down from directly beneath the header. Reason for the change: a bottom-sheet-from-edge pattern is one more edge-anchored control in an app that already had one rejected for exactly that reason (the original `LessonPlanPanel` peek-tab, see the 07-17 spec's Context section) — anchoring the trigger *inside* the header instead keeps it on-screen, not edge-anchored, and reuses the header's already-reserved safe-area handling.

## Scope

Amends the 07-17 spec's `SessionHeader` right cluster and `SessionPlanDrawer` trigger/shell only. Unaffected, reused as-is:
- `SessionPlanDrawer`'s internal content, tabs, and all data wiring (`useLessonPlan()`, `handlePlayItem`, `ParamsScreen` handoff via `sessionReturnScreen`).
- The `HomeScreen` pre-session entry point.
- Deletion of `LessonPlanPanel` and `ReadingCloseButton` — still happens per the 07-17 spec.

## Design

### The tongue trigger

A third row in `SessionHeader`, full-width, centered, directly below the existing subtitle row ("Тема · Режим" / left-slot content). One `<button>` spanning the full row — the entire row is the tap target, not just a chevron, which is the specific thing that made the original peek-tab hard to hit on a real phone.

Label states:
- Active plan with undone items: `⌄ План занятия · 3 из 5`
- Active plan, all items done: `⌄ План занятия · готово ✓`
- No active plan: `⌄ План занятия` (no count) — tapping still opens the drawer; the "План занятия" tab shows its existing empty state (message + button to open `SessionPlanBuilderSheet`, per the 07-17 spec) rather than the tongue being hidden. A always-reachable "Настройки режима" tab is the other reason it can't just disappear when there's no plan.

Visual treatment (ties into the existing teal accent instead of introducing a new color):
- Label text: 0.8rem / 700 weight / `#2f5b57` (same teal already used in `.reading-text-kind`).
- Thin fading rule on each side of the label (`linear-gradient(to right, transparent, #e5e7eb, transparent)` mirrored), giving it a bookmark-tab read rather than a plain button row.
- Chevron rotates 180° over 180ms on open/close — standard disclosure affordance.
- Pressed/open state: `background: rgba(74, 155, 143, 0.06)` (teal-tinted, not grey).

### Right cluster simplification

The 07-17 spec's right cluster was 🔊 🔒 📋 ✕, with the counter also opening the drawer as a shortcut. Both the 📋 icon and the counter-tap shortcut are removed — the tongue is the single entry point. Right cluster reverts to 🔊 🔒 ✕ (sound toggle, adult-confirm lock, close), matching the original pre-lesson-plan header exactly. One obvious affordance beats three redundant ones.

### Panel presentation

Overlay, not push — the task card underneath never moves or resizes while the panel is open:
- Panel is anchored directly under the header (`position: absolute; top: 100%`, with `SessionHeader`'s root as the `position: relative` containing block, spanning the header's width), so it reads as an extension of the header rather than a separate floating surface.
- A scrim covers the renderer area beneath: `rgba(20, 42, 40, 0.35)` — the same dark-teal tint already used for `.home-header`'s shadow, not a generic black scrim. Tapping the scrim, tapping the tongue again (now showing ⌃), or Escape closes the panel.
- Panel card: white background, bottom corners only rounded (`border-radius: 0 0 20px 20px` — flush against the header on top, so it reads as continuous with it), shadow `0 12px 32px rgba(20, 42, 40, 0.18)` (same warm-shadow formula as `.home-header`).
- Open animation: not a plain slide — `scaleY(0.92) translateY(-6px)` + `opacity: 0` → identity, `220ms cubic-bezier(.16, 1, .3, 1)`, transform-origin top. Reads as the panel unfurling from the tongue rather than a generic dropdown snapping into place. Scrim fades independently (`opacity` transition, 180ms).
- `max-height: 70vh` with internal scroll on the checklist — on short/landscape viewports the panel must never cover the entire screen.
- Content inside (tab switcher, checklist rows, "Настройки режима" row) is exactly `SessionPlanDrawer`'s existing content from the 07-17 spec, unstyled changes beyond fitting the new shell's white background (was already assumed white/card-styled in that spec).

### Applies uniformly

Every renderer gets the same tongue in the same position, including `reading`/`print_materials` where the left slot shows only a subtitle (no star/counter) — the tongue row sits below that subtitle exactly as it does below the counter row for card-based renderers. No renderer-specific exception.

## Testing

Extends the 07-17 spec's manual test plan (`run` skill, headed Playwright) with:
- Confirm the tongue's full row is tappable (not just the chevron), on both a counter-having renderer and a subtitle-only one (`reading`/`print_materials`).
- Confirm the label text matches plan state: no plan / partial / all-done.
- Confirm tapping the scrim, re-tapping the tongue, and Escape all close the panel; confirm the task card underneath never shifts position while open.
- Confirm the right cluster shows exactly 🔊 🔒 ✕ (no 📋 icon), and that the removed counter-tap shortcut no longer opens anything.
- Confirm `max-height`/scroll behavior with a long checklist in landscape on a short viewport.
- iOS safe-area check per `CLAUDE.md`'s mandatory rule stays required for the header itself (top edge) — the panel, anchored below the already-safe-padded header, only needs left/right/bottom edge checks in simulated landscape.
