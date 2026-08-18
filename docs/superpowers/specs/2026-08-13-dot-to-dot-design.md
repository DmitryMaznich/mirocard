# Design: "Точки по номерам" (`dot_to_dot`) — new topic, first mode

## Problem

The graphic-dictation family of exercises (`symmetry_draw`: mirror, repeat,
dictation, and the just-discovered already-shipped coordinate dictation)
works well for this child — grid-based, precisely checkable, step-by-step
line drawing. The user wants to expand into freehand (non-grid) graphic
exercises for ages 7-12, prioritizing concentration/sustained attention,
spatial reasoning, and fine-motor/visual-motor coordination.

Brainstormed five candidate exercise types (coordinate dictation, hatching,
one-line tracing, connect-the-dots-by-number, hidden figures). Coordinate
dictation turned out to already be shipped as a `symmetry_draw` mode
(v1.7.0, commits `d9039548`/`1875de11`/`77bc5652`/`92f350af`). Of the
remaining four freehand ideas, "connect the dots by number" is the closest
in spirit to graphic dictation (same "step-by-step reveal → finished
picture" payoff) and the simplest to validate programmatically, so it's the
first mode of a new topic. The other three (hatching, one-line tracing,
hidden figures) are out of scope here — separate future design docs, once
this first mode ships and this topic's infrastructure exists to build on.

## Concept

A new topic, `dot_to_dot` ("Точки по номерам"), independent from
`symmetry_draw` — no grid, no cletted paper. Each card is a figure defined
as an ordered list of points in the card's own local coordinate space
(arbitrary numbers chosen directly by whoever authors the figure — no
grid-snapping, no image tracing required).

Unlike `graphic_dictation` (which reveals one command at a time), **all
numbered points are visible from the start** — matching the classic paper
dot-to-dot worksheet: the child sees the whole "constellation" of numbers
before drawing anything. The child must still connect them strictly in
order (1→2→3→…→N); the engine only accepts a line from the current active
point to the immediate next number. This keeps the exercise a sustained-
attention/sequencing task (can't skip ahead) rather than pure copying.

## Data schema

```json
{
  "id": "dots_star",
  "conceptId": "dots_star",
  "primary": true,
  "label": "Звезда",
  "taskKind": "dots",
  "width": 100,
  "height": 100,
  "points": [
    { "x": 50, "y": 5 },
    { "x": 61, "y": 35 },
    { "x": 95, "y": 38 }
  ]
}
```

- `width`/`height`: the card's local canvas size (arbitrary units chosen by
  whoever authors the figure — not millimeters, not grid cells). Point
  coordinates are authored directly in this space; no tracing pipeline, no
  external reference image.
- `points`: ordered array, index+1 is the point's displayed number. Point 1
  is both the start and the first numbered dot (no separate `start` field,
  unlike `dictation`/`coordinate` cards — every point here is a numbered
  target, including the first).
- No `decorations` field for the MVP (unlike `dictation`) — out of scope;
  revisit if a figure genuinely needs a static already-drawn detail.

## Rendering and interaction

New self-contained `tools/dot_to_dot/renderer.js` (topics ship as raw
browser scripts with no bundler/shared imports across topic ZIPs — the
existing `symmetry_draw`/`propis` renderers already duplicate small math
helpers for this reason, so `dot_to_dot` gets its own copy of the
distance/segment-tolerance helpers rather than a shared dependency).

State machine mirrors `DictationTask`'s proven shape (active point, step
index, completed segments, pointer-drag gesture capture, hint), with two
differences:

1. **All points render immediately** as numbered circles, not one at a
   time. Points already connected (index < active) render as small filled
   dots; the active point pulses (reusing the existing pulse-animation
   pattern); points not yet reached render as quieter outlined circles with
   their number.
2. **No grid** — blank paper background, no ruled lines, no coordinate
   axis labels.

Validation reuses the existing tolerance approach (`isCorrectMove`-style: a
drawn/tapped gesture counts if it starts near the active point, ends near
the next point, and stays close to the straight line between them) with a
tolerance value scaled to the card's own `width`/`height` rather than grid
cells, so figures with different point spacing all feel equally forgiving.
Both continuous dragging and point-to-point tapping are accepted (same
gap-bridging behavior already proven in `symmetry_draw`).

Hint button: since every point's location is already visible, showing "the
target point" (as `dictation`'s hint does) would be redundant. Instead the
hint reveals a faint dashed preview line from the active point to the next
one, i.e. "trace over this" rather than "here's where it is". **Using the
hint skips the star for that card** (matches `symmetry_draw`'s
mirror/repeat hint behavior, which is stricter than `dictation`'s — where
hint use currently doesn't affect the star; not touching that existing
inconsistency here, out of scope).

On completing the last point: same "Получился рисунок: {label}" message
and pause-then-advance pattern as the other modes.

## Topic structure

New `tools/dot_to_dot/` directory, mirroring `tools/symmetry_draw/`'s
layout:

- `topic.json` — one mode (`id`/`type`: `dots`, title "Точки по номерам"),
  5-6 cards for the MVP release.
- `renderer.js` / `renderer.css` — new, as described above.
- `build.mjs` — ZIP packaging script, same pattern as
  `tools/symmetry_draw/build.mjs`.
- `media/avatar.svg` — topic icon.
- A small authoring/preview script (name TBD during planning, e.g.
  `preview_dots.mjs`) that renders a card's `points` to an SVG file on
  disk, so each hand-authored figure can be visually sanity-checked (does
  it actually look like a star/butterfly/etc., do the numbered segments
  cross awkwardly) before it ships — the equivalent of `verify_trace.mjs`'s
  role for traced dictation figures, but for direct-authored coordinates
  instead of traced ones.

Registration: add to `public/decks/catalog.json` and deploy through the
normal deck-release process, same as any other topic.

## Testing / verification plan

- If a reusable tolerance/distance helper emerges, factor it into its own
  module with a unit test, following the existing precedent
  (`tools/symmetry_draw/column_label.mjs` +
  `column_label.test.mjs`).
- No end-to-end automated tests — this is content + a rendering/interaction
  layer, verified manually in the browser before release (open the topic,
  play each of the 5-6 cards, confirm strict-order enforcement, hint
  behavior, and the finish state).
- Content QA: run the preview script over every authored card and visually
  confirm each figure reads as its label before packaging.

## Out of scope

- The other three freehand exercise types from the original brainstorm
  (hatching, one-line tracing, hidden figures) — future modes added to
  this same topic later, each its own design doc, following the same
  incremental-mode-growth pattern `symmetry_draw` used.
- Print/PDF export — `symmetry_draw` got this as a separate later addition;
  same expected here, not part of this MVP.
- Any change to `symmetry_draw`, `graphic_dictation`, or the already-shipped
  `coordinate` mode's hint/star behavior.
- Reward/fill animation on completion (e.g. a colored fill revealing under
  the finished outline) — nice-to-have, not required for MVP; the plain
  "Получился рисунок" message is enough to start.
