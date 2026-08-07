# Design: `decorations` field for `graphic_dictation` + 7 new dictation cards

## Problem

The user supplied 7 reference images (standard "графический диктант" worksheets:
a printed arrow+count command table above a grid-drawn figure) to add as new
`taskKind: "dictation"` cards to `tools/symmetry_draw/topic.json`
("Рисуем по клеткам" topic, `graphic_dictation` mode):

- `Pig.png` — свинья
- `Trex.png` — динозавр (бегущий тероподовый силуэт)
- `Airplane.png` — самолёт
- `Helicopter.png` — вертолёт
- `Car.png` — машина
- `HornedDino.png` — рогатый динозавр (two-panel source: filled reference +
  blank practice panel, same convention as existing composite dictation refs)
- `Stegosaurus.png` — стегозавр (two-panel source, same as above)

All 7 files live in `GraphNarrative/` alongside the existing `Dog.jpg` /
`Mouse.jpg` used for `dictation_dog` / `dictation_mouse`.

Five of the seven figures (`Pig`, `Airplane`, `Helicopter`, `HornedDino`,
`Stegosaurus`) have a mark that is not part of the drawn outline: an eye dot,
or a row of window squares. The existing `graphic_dictation` mode has no way
to represent this — `DictationTask` in `tools/symmetry_draw/renderer.js`
renders exactly one continuous polyline built by walking `start` through
`commands` in sequence; there is no concept of a second, statically-drawn
element. The user explicitly wants these elements to appear already drawn
from the start of the card, not something the child traces.

## Schema change

Add an optional `decorations` array to the `taskKind: "dictation"` card
shape in `tools/symmetry_draw/topic.json`:

```json
"decorations": [
  { "type": "dot",  "col": 3, "row": 4 },
  { "type": "rect", "col": 5, "row": 2, "width": 1, "height": 1 }
]
```

- `dot` — small filled circle (an eye). `col`/`row` is the dot's center,
  grid-vertex coordinates (same coordinate space as `start`/`commands`
  endpoints), `.5` fractional values allowed if that's where it actually
  sits, matching existing fractional-coordinate precedent in the topic's
  `mirror` cards (`symmetry_heart`, `symmetry_eye`).
- `rect` — unfilled outline rectangle (a window, or any other disconnected
  detail). `col`/`row` is the top-left grid vertex; `width`/`height` are in
  cells (default `1`/`1` for a plain window square). `width`/`height` beyond
  1×1 exist specifically to cover a detail wider than a single window, such
  as a helicopter's rotor blade, if tracing shows it's genuinely disconnected
  from the main outline (see `Helicopter.png` open question below).

Omit the field entirely on cards that don't need it (`Trex`, `Car`, and all
existing dictation cards) — no migration needed, purely additive.

## Renderer change

`tools/symmetry_draw/renderer.js`, inside `DictationTask`: render
`shape.decorations` as static SVG elements, unconditionally (not gated by
`stepIndex`/`completed`/`finished`), and untouched by the drawing/coverage
logic (`isCorrectMove`, `commandEnd`, `gestureRef`, etc. don't reference it
at all — the child never draws these, they're just visually present).

```js
(shape.decorations ?? []).map((d, i) =>
  d.type === "rect"
    ? h("rect", { key: `deco-${i}`, className: "dictation__decoration-rect", x: d.col, y: d.row, width: d.width ?? 1, height: d.height ?? 1 })
    : h("circle", { key: `deco-${i}`, className: "dictation__decoration-dot", cx: d.col, cy: d.row, r: "0.12" })
)
```

Placed in the SVG after `dots` (the faint grid-intersection markers) and
before `completed` (the child's fixed lines), so it reads as part of the
paper's fixed background, underneath the interactive layer.

`tools/symmetry_draw/renderer.css` additions, matching the existing
`.dictation__fixed` ink tone so a decoration reads as "already drawn" rather
than as a hint or an active-point marker:

```css
.dictation__decoration-dot { fill: #294e9a; pointer-events: none; }
.dictation__decoration-rect { fill: none; stroke: #294e9a; stroke-width: .07; pointer-events: none; }
```

This is additive only — no existing card gets a `decorations` field, so all
8 current dictation cards render byte-for-byte identical to today.

## Per-figure content plan

Process for every card: `trace-grid-figure` skill, Mode A (printed command
table present) — transcribe the table into `commands`, locate the start dot
in the figure's own ruled grid, then **verify with
`tools/symmetry_draw/verify_trace.mjs`** (`ruler` to measure px-per-cell,
`overlay` to render the traced polyline back over the source image) before
anything is written into `topic.json`. No trace ships on eyeballing alone —
this is the same rule that caught the wrong `dictation_dog`/`dictation_mouse`
traces previously.

| Source | `id` | `label` | Start marker | `decorations` | Notes |
|---|---|---|---|---|---|
| `Pig.png` | `dictation_pig` | Свинья | red dot, snout (left) | 1× `dot` — eye | Curled tail loop is part of the main outline `commands`, not a decoration |
| `Trex.png` | `dictation_trex` | Динозавр | blue dot, front foot (left) | none | Grey squares in the image are Shutterstock watermark artifacts, not drawn content — ignore during tracing |
| `Airplane.png` | `dictation_airplane` | Самолёт | blue dot, nose (left) | 4× `rect` 1×1 — row of windows along the fuselage | |
| `Helicopter.png` | `dictation_helicopter` | Вертолёт | blue dot, nose (left) | 1× `rect` 1×1 — cabin window; **open question**: the two long rectangles on top (rotor blades) may or may not connect to the fuselage outline by a single continuous line | Resolved during tracing by overlay, not guessed: if the blades prove disconnected from the outline, they become additional `rect` decorations (hence `width`/`height` on the schema, not just a fixed 1×1 square); if a thin mast line connects them, they stay part of `commands`. No further user check-in needed — the pixel overlay is the source of truth here |
| `Car.png` | `dictation_car` | Машина | blue dot, front (left) | none expected | Cross-shaped wheels are expected to be part of the single continuous line (standard technique in these worksheets); confirmed by overlay, not assumed |
| `HornedDino.png` | `dictation_horned_dino` | Рогатый динозавр | red dot on outline (two-panel source: filled reference + blank practice panel with the same start dot, matching the existing two-panel convention already used for some dictation references) | 1× `dot` — eye | Back spikes/horn are part of the main outline `commands` |
| `Stegosaurus.png` | `dictation_stegosaurus` | Стегозавр | red dot on outline (two-panel source, same as above) | 1× `dot` — eye | Triangular back plates are part of the main outline `commands` |

All 7 cards: `taskKind: "dictation"`, `primary: true`, `conceptId` mirrors
`id`, `columns`/`rows` set to the traced path's bounding box plus ~1-2 cells
margin (existing convention). None of the 7 new ids collide with the
existing `dictation_dog` / `dictation_mouse` / `dictation_stairs` / etc.
already in `topic.json`.

## Testing / verification plan

- For every new card: run `verify_trace.mjs overlay` and visually confirm
  the simulated path (and any decorations) sit exactly on the source
  drawing's lines and marks.
- Manually re-read each transcribed `commands` array against its printed
  table cell-by-cell once, independent of the overlay (catches a
  direction-token swap that could still look plausible on a symmetric
  segment).
- No automated test changes — this is content data plus one small additive
  renderer branch; existing `flashcards`/topic-loader tests are unaffected.
  If a unit test exists for `renderer.js` helpers, add one case confirming a
  card without `decorations` renders unchanged (regression guard for the
  "additive only" claim above).

## Out of scope

- Not touching `mirror_draw` / `repeat_draw` cards or their `sourcePaths`
  schema — `decorations` is scoped to `taskKind: "dictation"` only.
- Not re-verifying any of the 8 existing dictation cards — only the 7 new
  ones are being added.
- Not packaging a new ZIP / bumping `topic.json`'s version / touching
  `catalog.json` — per project convention (`feedback_deploy_versioning`),
  that happens at deploy time, not as part of content authoring.
- Not deciding the `Helicopter.png` rotor-blade question here — it's
  resolved mechanically during tracing via the overlay tool, per the table
  above.
