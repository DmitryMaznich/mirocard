# Column Subtraction Borrow Teaching Design

## Problem

The existing "Разменяй десяток" mode teaches an isolated fact — "1 десяток = 10 единиц, число не меняется" — with no connection to why a child would ever need to know this. A parent watching a child play through it has nothing to point to when the child later hits `52 − 27` in the "Столбик" (column_arithmetic, `operation: subtract`, `carryMode: carry`) mode and freezes on the ones column: `2 − 7`.

"Столбик" itself doesn't teach the borrow — it lets the child drag/type digits into cells, assuming the child already knows the algorithm. There's no scaffolding for the specific moment where the top ones digit is smaller than the bottom one.

This spec closes that gap by teaching the borrow **inside** "Столбик", at the exact column where it's needed, using the column's own real notation — not a separate demo. It does not touch "Разменяй десяток" (place-value regrouping) or the earlier "counting sticks" introductory-mode idea; those remain separate, unstarted threads.

## Scope

Enhance the existing **"Столбик" mode** (`column_arithmetic` renderer, `src/topics/renderers/column_addition/index.jsx`). No new mode, no new topic entry.

**Gate — applies per task, not per session setting:** the new behavior activates only when the *current task* is `operation === "subtract"` **and** at least one of its columns has `borrowOut === 1` (the existing `buildSubColumns` output already computes this per column). This means it correctly covers every session-setting combination:

- `Операция: Только −` or `Микс` (subtraction alternating with addition) — either way, when the *current task* happens to be a borrow-needing subtraction, the new UI applies.
- `Перенос/заём: С переносом/займом` or `Микс` — either way, same per-task check.
- Addition tasks, and subtraction tasks that don't need a borrow, are completely unaffected — they render exactly as today.

This keeps the change's blast radius minimal: every code path that isn't "subtraction, this column needs a borrow" is untouched, so the pixel-tuned digit/cell alignment already in place for addition-carry and plain subtraction cannot regress.

## New setting

Add `Сравнение` (comparison), a boolean mode param, default `true`, on the existing "Столбик" params screen (same family as `Операция`, `Перенос/заём`, `Разрядность`, `Помощник (палка)`). Not an in-session toggle — set once before starting, like every other param in this mode.

- **On (default):** before the borrow, the child does a small comparison exercise (see below).
- **Off:** skip straight to the borrow-count input square — for a child who no longer needs the comparison scaffold.

## Visual language: reuse, don't invent

Everything renders using the **real, already-shipped** CSS from `column_addition.css` — no new visual style:

- `.col-screen` background (light blue grid, 44px cells)
- `.col-digit` (44px cell, Primo cursive font, 45px digits)
- `.col-digit--top-borrowed` (line-through, gray) — already exists, already used for this exact purpose
- `.col-carry-cell` (28×26px dashed amber box in the interlinear row above the digits, with `--active` pulse and `--filled` solid states) — already exists for addition-carry; reused as-is for both new borrow inputs
- `.col-tap-kb` / `.col-tap-btn` (the real digit keyboard already used to build/solve the column)

No dark theme, no custom fonts, no new component family. The only genuinely new widget is the small comparison strip (see below), styled to match (white rounded buttons, `#dbeafe`/`#c7d2fe` accents).

## Algorithm (runs at each column, in the existing right-to-left solving order)

For the column currently being solved:

1. **If `Сравнение` is on:** show a compact strip directly **under the column** (not above, not beside it) — `<top-digit> ? <bottom-digit>` with three small buttons `< > =`, matching the existing `ComparePutSign`/`CompareVisual` interaction family from the "Сравнение чисел" topic (tap the correct one; wrong tap shakes gently, no penalty, try again).
   - **`<` (not enough) selected:** the strip settles, then step 2 begins.
   - **`>` or `=` (enough) selected:** the strip disappears; the column is solved with the existing plain digit-entry flow (no borrow UI). This branch matters for multi-digit examples where an earlier borrow can make a *later* column's comparison come out either way — for a single 2-digit example under the gate above, it will always resolve to `<`, but the branch is part of the general per-column algorithm, not a special case to special-case.
   - **If `Сравнение` is off:** skip straight to step 2.

2. **Borrow-count input:** an empty `.col-carry-cell` (dashed amber) appears in the interlinear row **directly above the current column's top digit**. The child taps it and types the number of tens/hundreds being borrowed (always `1` for a single borrow) via the real column keyboard.

3. **Consequence of entering the count (automatic, no separate tap):** the digit **one place to the left** (the source of the borrow) gets `.col-digit--top-borrowed` (crossed out), **and** a second empty `.col-carry-cell` appears above *that* digit.

4. **Reduced-digit input:** the child computes the source digit minus the borrowed count themselves and types it into that second carry-cell. Nothing is computed or written for them.

5. Once both cells are filled, the column proceeds with the **existing** subtraction-entry mechanic (type/confirm the result digit for this column, then the next), unchanged from today.

Every mark on screen — the sign, the borrow count, the reduced digit, the result — is placed by the child's own input, never animated in automatically. This was validated live in the mockup across ~14 iterations, converging from an early version that auto-computed the borrow on a single tap.

## Explicitly out of scope for this change

- The "Разменяй десяток" place-value mode is untouched.
- The "counting sticks" introductory teaching-mode idea (discussed and partially mocked up earlier in the same session) is a separate, unstarted thread — not part of this spec.
- 3-digit chained-borrow examples are not separately re-validated in the mockup; the algorithm above is written to generalize to them (it's a per-column loop), but the mockup only exercised the 2-digit case (`52 − 27`).
- The existing `Помощник (палка)` bead-string helper is unrelated and unaffected.

## Reference mockups

Built and iterated live via the brainstorming visual companion; final validated version:
`.superpowers/brainstorm/1461-1784087477/content/borrow-column-v14-both-carry.html` (uses real production CSS values, both borrow-input squares as matching amber carry-cells, comparison strip under the column, per-task gating confirmed in discussion).
