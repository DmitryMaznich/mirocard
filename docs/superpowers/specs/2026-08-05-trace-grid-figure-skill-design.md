# Design: `trace-grid-figure` skill for the `symmetry_draw` topic

## Problem

The `symmetry_draw` topic ("Рисуем по клеткам") has three modes —
`mirror_draw`, `repeat_draw`, `graphic_dictation` — each keyed off
grid-vertex data in `tools/symmetry_draw/topic.json`: `sourcePaths` (arrays of
`{col,row}` points) for the first two, `start` + `commands`
(`{direction,cells}`) for the third. Every existing card was hand-authored by
counting grid intersections on a reference image. That process has no
repeatable procedure and no verification step, and it already produced a
wrong result once: two draft `graphic_dictation` cards
(`dictation_dog`, `dictation_mouse`, currently uncommitted in `topic.json`)
were built by eyeballing the drawn contour in `GraphNarrative/Dog.jpg` and
`GraphNarrative/Mouse.jpg`, even though both images print an authoritative
command table (arrow + cell count, e.g. `4→ 1↘ 1↑ …`) above the figure. The
draft `commands` arrays do not match that table.

The user wants a skill that turns a raster reference image into precise
`topic.json`-ready vector data for this topic, plus the two draft cards fixed
using it.

## Skill design

New project-scoped skill: `.claude/skills/trace-grid-figure/SKILL.md` (inside
the Mirocard2 repo — takes precedence over the unrelated global skill of the
same name, which targets a different project's Python/ReportLab pipeline and
is not reused here).

The skill covers two input cases, chosen by inspecting the image:

### Mode A — printed command table present (graphic_dictation cards)

Used when the reference image already prints a table of arrow+number cells
above the figure (the standard "графический диктант" worksheet format, as in
`Dog.jpg`/`Mouse.jpg`).

1. Read the image. Transcribe the table left-to-right, top-to-bottom into an
   ordered list of `{direction, cells}`. The 8 arrows map 1:1 onto the
   direction tokens already defined in `renderer.js`'s `DIRECTION` map
   (`↑ up, ↓ down, ← left, → right, ↗ up_right, ↘ down_right, ↖ up_left,
   ↙ down_left`) — no interpretation needed, this is a literal transcription.
2. Locate the marked start point (colored dot) on the grid figure and count
   its `{col,row}` from the printed grid's own ruled lines.
3. Choose `columns`/`rows` for the card: tight bounding box of the traced
   path plus the same margin convention already used by existing cards
   (roughly 1–2 cells).
4. Emit the full card object matching the existing `taskKind: "dictation"`
   shape (`id`, `conceptId`, `primary`, `label`, `taskKind`, `columns`,
   `rows`, `start`, `commands`).
5. **Verify**: simulate the commands from `start` in a small Node script,
   render the resulting polyline as an SVG/canvas overlay scaled to the
   image's measured px-per-cell, and visually compare against the original
   drawn figure. Iterate on step 1–3 until they match.

### Mode B — contour only, no table (mirror_draw / repeat_draw cards, or a
dictation source with no printed table)

Used when the image is just a figure drawn on grid paper, no command table.

1. Read the image, measure cell size in pixels and the figure's pixel origin.
2. Trace every vertex of every disjoint stroke (a card may need >1
   `sourcePaths` entry — e.g. a body plus a separate window, matching
   existing composite cards like `symmetry_house_window`), snapping to grid
   intersections; `.5` fractional coordinates are allowed for curves/circles,
   matching precedent (`symmetry_heart`, `symmetry_eye`).
3. For `mirror_draw` cards: only the half up to the axis is traced (the
   engine mirrors it at runtime via `mirrorPaths`); `axisCol` is the column
   at the drawn axis line. For `repeat_draw` cards: the *whole* figure is
   traced (the engine only translates it via `translatePaths`, it does not
   mirror), and `axisCol` marks where the student's blank half begins.
4. Emit the card object (`taskKind: "mirror"` or `"repeat"`,
   `sourcePaths`, `axisCol`, `columns`, `rows`).
5. **Verify** with the same overlay technique as Mode A, reused from a
   shared script rather than duplicated.

### Shared verification tooling

One Node script under `tools/symmetry_draw/` (not Python — the project is
Node/Vite throughout) that takes a source image, a px-per-cell + origin
measurement, and a set of `{col,row}` paths (or `start`+`commands`, converted
to a path first), and writes an overlay JPG with the computed lines drawn in
a contrasting color atop the original. Both modes call into this one script.

### Schema knowledge

The skill does not duplicate the full `topic.json` card schema inline —
schema drift risk is higher than the cost of re-reading it. Instead it
points at `tools/symmetry_draw/topic.json`'s existing cards as the source of
truth for field shapes and naming conventions (`dictation_*` /
`symmetry_*` / `repeat_*` id prefixes, `conceptId` mirroring `id`, `primary`
flag usage) and at `docs/superpowers/specs/2026-08-02-symmetry-draw-repeat-mode-design.md`
for the `mirror` vs `repeat` semantic distinction (reflect vs translate).

## Immediate application: fix `dictation_dog` / `dictation_mouse`

Using Mode A on `GraphNarrative/Dog.jpg` and `GraphNarrative/Mouse.jpg`:

- Transcribe each printed command table.
- Locate each figure's start dot and count its `{col,row}`.
- Replace the current (incorrect, contour-traced) `commands`/`start` values
  for both cards in `tools/symmetry_draw/topic.json` with the transcribed,
  verified ones. Keep `id`/`conceptId`/`label`/`taskKind`/`primary` as they
  already are — only the geometry is wrong.
- Verify each with the overlay script before considering the card done.

No other cards in `topic.json` are touched by this pass.

## Versioning and rollout

This is a content fix to cards already sitting uncommitted in a `1.3.0`
working copy (mode + prior dictation cards not yet released). Per the
project's `feedback_deploy_versioning` convention, packaging/version-bump/ZIP
rebuild happens at deploy time, not as part of this fix — this spec only
covers producing correct card data and the reusable skill. Whether to commit
the skill and the corrected cards separately, or together, is left to the
implementation plan.

## Testing / verification plan

- For each of the two fixed cards: run the overlay script, visually confirm
  the simulated path matches the source image's drawn figure exactly (every
  vertex, correct start point).
- Manual read-through comparing the transcribed `commands` array against the
  printed table cell-by-cell (catches transcription typos the overlay
  wouldn't visually reveal, e.g. an `up_right` vs `down_right` swap that
  happens to still look plausible at a glance).
- No automated test changes — this is content data, not logic; existing
  `flashcards/engine.test.js` / topic loader tests are unaffected.

## Out of scope

- Not rebuilding or re-verifying any of the other existing `symmetry_draw`
  cards — only the two draft dictation cards are known to be wrong.
- Not changing `renderer.js`, `engine.js`, or the card schema itself.
- Not packaging a new ZIP / bumping `topic.json`'s version / touching
  `catalog.json` — deferred to whenever this content is actually deployed.
- The skill is scoped to this topic's three task kinds; it is not a
  general-purpose image-tracing tool for other Mirocard topics.
