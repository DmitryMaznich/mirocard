# Column Subtraction Crossout Gesture Design

## Problem

The borrow-teaching flow shipped earlier today (`docs/superpowers/specs/2026-07-15-column-borrow-teaching-design.md`) crosses out the borrow-source digit (`.col-digit--top-borrowed`) **automatically**, the instant the child fills the borrow-count square. That's a passive consequence of typing "1" — the child never performs the physical "cross it out" action themselves, even though every other mark in the flow (comparison sign, borrow count, reduced digit, result digits) is explicitly required to be the child's own input.

This spec makes crossing out the digit its own explicit, child-performed step: the child drags a finger across the digit, left to right, to draw the strike-through line themselves — matching how a child physically crosses out a digit on paper.

## Scope

Enhance the existing **"Столбик" mode** (`column_arithmetic` renderer, `src/topics/renderers/column_addition/`). No new mode, no new param — this changes the *mechanics* of a step already gated by the existing `Сравнение` param and `taskNeedsBorrowTeaching` check; it does not add a new toggle.

## Step model change (`engine.js`)

`buildSubSteps` currently produces, per borrow: `borrow(receiving column) → adjust(source column) → result(...)`.

Insert a new `crossout` step between `borrow` and `adjust`, at the source column's position (same position `adjust` already uses):

```
borrow(units) → crossout(tens) → adjust(tens) → result(units) → result(tens)
```

While `crossout` is the active step, the keyboard and comparison strip stay hidden (same pattern already used while `borrow`/`adjust` are active) — the screen waits specifically for the gesture on the tens digit. Completing the gesture fills `filledCells["crossout:tens"]` and advances `stepIdx`, exactly like a normal tap-driven step advances today.

The crossed-out visual (previously derived automatically from the *borrow* cell being filled) now derives from this *crossout* cell being filled instead — the source digit is only ever shown as crossed out once the child has actually drawn the line.

Generalizes per-column like every other step in this model: a 3-digit example with two borrows gets two independent `crossout` steps, no special-casing.

## Visual integration: no separate container

The digit being crossed out stays a completely ordinary `.col-digit` cell — same size, same font, same position in the grid, no border, no background, no visual hint that it's interactive. A transparent, borderless `<svg>` overlay is positioned exactly over that cell (matching its grid cell dimensions) to capture the pointer gesture; nothing about the cell's appearance changes until the child actually starts drawing. This matters pedagogically: the child should recognize the column exactly as always and act on the digit itself, not hunt for a highlighted button.

## Gesture component (`CrossoutGesture.jsx`, new file)

New file alongside the other per-mode task files already in `src/topics/renderers/column_addition/` (`RegroupTenTask.jsx`, `BuildNumberTask.jsx`, etc.) — self-contained pointer/SVG-geometry logic, kept out of the already-large `index.jsx`.

- Transparent `<svg>`, sized to the digit cell, rendered on top of the digit text (digit renders normally underneath).
- `onPointerDown`: starts a fresh path, discarding any previous incomplete attempt.
- `onPointerMove`: appends points to the path (freehand — follows the actual finger position, same DOM→SVG coordinate conversion pattern as `LetterTraceView.jsx`), redraws the growing line, and checks the completion condition on every move (so success can fire mid-gesture, not just on release).
- `onPointerUp`: if the completion condition was never met, the in-progress path is discarded — the line disappears and the child can try again immediately. No shake, no penalty; this is a motor action, not a quiz answer.

**Completion condition** (checked continuously during the drag): the path's horizontal spread (max tracked x − min tracked x) reaches at least ~70% of the cell's width, **and** the most recent point is to the right of the first point (net left-to-right direction). The moment both hold, the gesture is accepted immediately.

**Result:** on success, the child's own drawn path (not a synthetic straight line) is kept permanently over the digit — red (`#ef4444`, matching the existing `.col-digit--top-borrowed` line color), ~4px stroke, rounded caps, matching the crossed-out digit's existing dimmed text color (`#9ca3af`). The hand-drawn irregularity is the point — it reads as the child's own mark, not a stamped/automatic one.

## Explicitly out of scope for this change

- Only the crossing-out mechanic changes. The comparison strip, borrow-count input, adjust-digit input, and result-digit input are unchanged.
- No mouse-vs-touch distinction — Pointer Events unify both, same as `LetterTraceView.jsx` already does.
- No new mode param; this is a mechanics change to an already-gated flow (`Сравнение` on/off still only controls the comparison strip, unrelated to this).
