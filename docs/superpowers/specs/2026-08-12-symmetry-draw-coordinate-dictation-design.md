# Design: `coordinate` mode — "Точки по координатам" in `symmetry_draw`

## Context

This is the first of a small roadmap of new graphic tasks brainstormed for
ages 7-12, chosen to reinforce concentration/sustained attention, spatial
reasoning, and fine-motor/visual-motor coordination — the same qualities that
already make `graphic_dictation` land well with the target user's child.
Two follow-on ideas (starting with a "точки по номерам" connect-the-dots
mode) are planned as a separate new topic later; they are out of scope here.

## Problem

`tools/symmetry_draw/topic.json` ("Рисуем по клеткам") currently has three
modes: `mirror_draw`, `repeat_draw`, `graphic_dictation`. All three teach
different things about the same grid. `graphic_dictation` walks the
child through a figure via relative move commands ("3 клетки вправо"). There
is no mode that exercises reading an absolute coordinate off a labeled grid —
a distinct spatial skill (map/battleship-style coordinate reading) that
doesn't overlap with direction-following.

## New mode: `coordinate` ("Точки по координатам")

Same drawing mechanic as `graphic_dictation` — an active point pulses, the
child drags/taps a line from it to the next target, one segment at a time,
until the figure is complete — but the target for each step is given as an
absolute grid coordinate in Battleship notation (letter for column, number
for row, e.g. "Е3") instead of a direction+distance command. The child must
locate the point on the grid themselves before drawing to it; the line-draw
gesture preserves the fine-motor practice that direction-based dictation
already provides.

## Schema change

New card shape, `"taskKind": "coordinate"`, in `tools/symmetry_draw/topic.json`:

```json
{
  "id": "coordinate_house",
  "conceptId": "coordinate_house",
  "primary": true,
  "label": "Дом",
  "taskKind": "coordinate",
  "columns": 11,
  "rows": 9,
  "start": { "col": 2, "row": 7 },
  "points": [
    { "col": 2, "row": 3 },
    { "col": 5, "row": 3 },
    { "col": 7, "row": 5 },
    { "col": 5, "row": 7 },
    { "col": 5, "row": 9 }
  ]
}
```

- `start` — same meaning as the `dictation` card shape: the first active point.
- `points` — ordered list of **absolute** target endpoints (unlike `dictation`'s
  `commands`, which are relative direction+cells offsets). Step *i*'s segment
  runs from `points[i-1]` (or `start` for the first step) to `points[i]`.

New mode entry in `topic.json`'s `modes` array:

```json
{
  "id": "coordinate_dictation",
  "type": "coordinate_dictation",
  "evaluation": "auto",
  "ui": {
    "title": "Точки по координатам",
    "instruction": "Найди точку по координатам и веди линию от активной точки",
    "icon": "media/dictation_avatar.svg"
  }
}
```

(Reuses the existing dictation icon for launch; a dedicated icon is a
follow-up, not a blocker.)

## Content plan — no new tracing needed

All 16 existing `dictation_*` cards already encode their figure as
`start` + relative `commands`. Their absolute vertex coordinates are fully
determined by walking `commands` cumulatively from `start` (the same
`commandEnd` logic `renderer.js` already has). A one-off script converts
every existing dictation card into a `coordinate_*` twin: same `id` prefix
swapped, same `label`/`columns`/`rows`/`start`, `commands` replaced by the
computed `points` array. No new source artwork, no new
`trace-grid-figure`/`verify_trace.mjs` pass — this is pure data
transformation of content already verified once for the dictation cards.

Each `coordinate_*` card is added as `primary: true`, `taskKind: "coordinate"`,
independent of its `dictation_*` sibling (both can coexist; they're different
modes, not variants of the same card).

## Renderer change (`tools/symmetry_draw/renderer.js`)

**Unify step representation.** Both `dictation` and `coordinate` cards reduce,
via `useMemo`, to the same internal shape: an ordered array of
`{ end: {col,row}, instructionText, speechText }` steps, computed once from
either `commands` (walking `commandEnd` cumulatively) or `points` (already
absolute, paired with a computed label). `DictationTask`'s gesture handling,
`isCorrectMove`, hint, and completion logic then operate on `step.end`
directly instead of re-deriving it from `activePoint` + `command` — this
removes the direction-command assumption from the shared interaction code
instead of branching it.

**Column labels.** New `columnLabel(col)` helper mapping a 0-based column
index to a Battleship-style Cyrillic letter, skipping `Ё` and `Й`
(pronunciation/visual ambiguity): `А Б В Г Д Е Ж З И К Л ... `. Used only when
`shape.taskKind === "coordinate"` for the grid's column header `<text>`
elements (currently `col + 1`); row headers stay numeric in every mode,
including this one.

**Instruction copy.** `instructionText` for a coordinate step reads
`"Найди точку " + columnLabel(col) + row`, e.g. "Найди точку Е3".
`speechText` reads out the letter's Russian name and the digit separately
(e.g. "Точка Е, три") so `speechSynthesis` doesn't mangle a bare "Е3" token —
mirrors the existing `commandText`/`speakInstruction` split, just with a
different text generator selected by `taskKind`.

Everything else — active-point pulse, drag/tap gesture capture, "Показать
точку" hint circle, `completed` fixed lines, finish state and copy ("Получился
рисунок: …") — is unchanged, since it now operates on the unified step shape
regardless of which taskKind produced it.

## Explicitly out of scope

- **Print/PDF export** (`SymmetryDrawPrintParams`, `symmetryDrawPrintHtml.js`)
  is not extended to the `coordinate` taskKind. `ParamsScreen.jsx`'s existing
  `mode?.type === "graphic_dictation"` check for the "Стрелка в подсказке"
  toggle simply won't match the new mode's `type`, which is correct (that
  param doesn't apply here — there's no arrow icon). The print card-picker
  filters by taskKind already known to it; `coordinate` cards are not wired
  into it, so no "Скачать PDF" affordance appears for this mode in v1.
- A dedicated mode icon (`media/coordinate_avatar.svg`) — launches reusing
  the dictation icon.
- The other three brainstormed freehand task types (штриховка, обводка одной
  линией, точки по номерам, спрятанные фигуры) — separate new topic, separate
  design(s), starting with "точки по номерам" per the agreed roadmap.
- Any change to `mirror_draw`/`repeat_draw` cards or the `GridTask` component.

## Testing / verification plan

- Unit test for `columnLabel(col)`: sequential letters, `Ё`/`Й` skipped,
  correct behavior at the boundary where the skip lands (index math off-by-one
  is the likely bug).
- Unit test (or extend existing renderer test coverage if any exists) that a
  `dictation` card and its `coordinate` twin, generated by the conversion
  script, resolve to the same sequence of absolute `end` points — this is the
  regression guard that the content-conversion script did its job correctly.
- Manual, headed Playwright pass: open `symmetry_draw` → "Точки по
  координатам", confirm column headers show letters, complete one full card
  by dragging from the active point to a coordinate found by reading the
  header labels, confirm the "Показать точку" hint and speech both work, and
  confirm the finish state matches the dictation mode's.
- No changes expected to `flashcards`/`topicLoader` tests — this is additive
  content plus a taskKind-gated renderer branch.
