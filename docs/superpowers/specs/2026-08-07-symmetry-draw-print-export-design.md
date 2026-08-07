# Design: Print/PDF export for symmetry_draw ("Рисуем по клеткам")

## Problem

Each of the topic's three modes (`mirror_draw`, `repeat_draw`, `graphic_dictation`) is currently interactive-only. A parent wants to pick a set of cards from the mode they're about to play and print them as physical worksheets — a small answer-key preview, the mode's own visual grammar (mirror axis / repeat arrow / dictation command list), and a blank grid for the child to draw on with a pencil, on paper. This must work for any parent in the production app, not just as a one-off local script.

## Architecture

`ParamsScreen.jsx` is already shown before every session starts (`ModePickerScreen.jsx` routes to `"params"` for all non-`chat_practice` topics), and already supports topic-specific content components plugged in by `topicId`/`renderer` (`RecipeStartParams`, `InstructionParamsContent`, `SafeCodeParamsContent`, …). A new `SymmetryDrawPrintParams` component follows that exact pattern:

- Rendered when the active topic is `symmetry_draw`.
- Shows a checkbox grid of the current mode's cards only (filtered by `card.taskKind` matching the mode being entered — `mirror`, `repeat`, or `dictation`), reusing the `ConceptPickerScreen.jsx` selection pattern (`Set` of selected ids, "select all", a count).
- The existing "start session" action is untouched and still works normally, selection state is independent of it.
- A new **"Скачать PDF"** button, enabled once at least one card is selected, triggers the print flow. Selection is local UI state only (not persisted) — every visit starts with nothing selected.

Print flow: mount an offscreen, print-only React tree containing one page block per selected card (see Layout below), styled entirely through `@media print` + `@page { size: A4 portrait; margin: 15mm 12mm }`, then call `window.print()` — the same technique already used in `PlannerShoppingScreen.jsx`'s `printShoppingList`. No new dependency (no jsPDF/pdf-lib) — the browser's native print dialog already offers "Save as PDF" on every platform this PWA targets (Windows, macOS, iOS, Android). The offscreen tree is unmounted after `afterprint` fires, matching the existing precedent's cleanup.

## Data flow

1. `SymmetryDrawPrintParams` reads the mode's cards from the already-loaded topic record (same `deriveConcepts`/card list used elsewhere), filtered by `taskKind`.
2. User toggles checkboxes → local `Set<cardId>`.
3. "Скачать PDF" → build an array of the selected card objects (already have `sourcePaths`/`axisCol` for mirror/repeat, `start`/`commands`/`decorations` for dictation) → pass to the print-view component.
4. Print-view renders one `<section class="print-page">` per card (page-broken via `break-inside: avoid` / `break-after: page` CSS, not manual pagination math) → `window.print()`.
5. On `afterprint`, unmount the print-view and return focus to `SymmetryDrawPrintParams`.

## Layout

All measurements in **millimeters**, not px/vw — this is what guarantees literally square grid cells on the printed page regardless of browser print scaling. Cell size is fixed at **7mm** (not user-configurable). A card's grid block is exactly `columns × 7mm` wide and `rows × 7mm` tall; nothing stretches it.

**`graphic_dictation` — one card per page:** each dictation card gets `break-after: page` (forced page break), since its blank grid needs the full page regardless of how much room the header leaves.
- Page header: the card's `label` (figure name), e.g. "Свинья".
- Top row: left — a small static SVG preview of the *finished* figure (the full traced outline, plus any `decorations` — dots/rects/polygons — rendered exactly as the answer key); right — the ordered command list rendered compactly as arrow+number pairs (`2→ 1↑ 3→ …`), matching the printed-worksheet convention the source references used.
- Bottom: a large blank grid (just ruled lines + the pulsing-equivalent static start-point marker, no drawn line, no decorations) filling the rest of the page for the child to draw on with a pencil.

**`mirror_draw` / `repeat_draw` — several per page, auto-flowing:**
- Each card is a compact horizontal strip: small finished-figure preview + a grid block showing the source path already drawn, plus either a dashed axis with mirror chevrons (`mirror`) or a solid line with a repeat arrow (`repeat`) — the same visual language `renderer.js`'s `GridTask` already draws on-screen, reused for print. The other half of the grid is blank.
- No manual "N per page" packing logic: each strip is a normal flow block with `break-inside: avoid`; however many fit on a page at the fixed 7mm cell size is however many print there — different cards (different `columns`/`rows`) will naturally have different strip heights.

**Branding, every page:**
- A quiet diagonal repeating watermark, text "Mironium", ~6% opacity, brand dark green (`#1C3634`).
- A footer: the Mironium logotype (`public/brand/mironium-logo.svg` — copied in from the only existing copy, currently living solely in the gitignored `dist/` build output with no source file checked in; this also fixes `mironium-prototype/index.html`'s currently-dangling `../public/brand/mironium-logo.svg` reference) plus the tagline "Ваш ребёнок может больше · mironium.com".

## Decorations on print

`dot`/`rect`/`polygon` decorations (from the `decorations` field added for `graphic_dictation` cards) render only on the small finished-figure preview, using the same primitives already in `renderer.js` (`pathToD` for `polygon`, plain `<circle>`/`<rect>` for `dot`/`rect`). They never appear on the blank practice grid — that's exactly the part the child hasn't drawn yet.

## Testing / verification plan

- Manual: open `ParamsScreen` for `symmetry_draw` in each of the 3 modes, select 1 and then several cards, click "Скачать PDF", confirm the browser print preview shows the expected page(s) with square cells (measure two adjacent grid lines on-screen at 100% zoom and confirm equal spacing), correct preview/instructions/blank-grid placement per mode, watermark, and footer.
- Manual: confirm `afterprint` cleanly unmounts the print-only tree (no leftover offscreen DOM, no broken focus) by cancelling the print dialog and continuing to use `SymmetryDrawPrintParams` normally afterward.
- No new automated tests planned — this is a print-only rendering path with no interactive logic to unit-test; existing `flashcards`/`topicLoader` tests are unaffected since no card schema changes are needed for this feature.

## Out of scope

- No new PDF library (jsPDF/pdf-lib) — deliberately rejected in favor of the browser's native print-to-PDF, per the "no new dependency in a singlefile-inlined build" reasoning discussed.
- No server-side/backend PDF generation.
- No persistence of the print selection across visits — it's local UI state, reset every time `SymmetryDrawPrintParams` mounts.
- No change to any other topic's `ParamsScreen` content component — this is scoped to `symmetry_draw` only.
- Not fixing or touching the `mironium-prototype/` landing page itself beyond making its existing logo `<img>` reference resolve (adding the source file it already points at).
