---
name: trace-grid-figure
description: Use when converting a raster reference image into topic.json-ready vector data for the Mirocard symmetry_draw topic ("Рисуем по клеткам") — mirror_draw/repeat_draw sourcePaths or graphic_dictation start+commands. Handles both a worksheet with a printed command table (graphic dictation) and a bare grid-drawn contour with no table.
---

# Trace Grid Figure (symmetry_draw)

## Overview

Turns a raster reference image into the exact vertex data `tools/symmetry_draw/topic.json` cards need, for all three modes of the topic:

- `taskKind: "dictation"` → `start: {col,row}` + `commands: [{direction,cells}]`
- `taskKind: "mirror"` / `taskKind: "repeat"` → `sourcePaths: [[{col,row}, ...], ...]` + `axisCol`

Every trace must be confirmed with `tools/symmetry_draw/verify_trace.mjs` before it goes into `topic.json` — never ship a hand-counted trace without rendering it back over the source image and comparing.

Schema reference: read a few existing cards in `tools/symmetry_draw/topic.json` for exact field shapes and naming (`dictation_*` / `symmetry_*` / `repeat_*` id prefixes, `conceptId` mirrors `id`, `primary` flag). For the `mirror` vs `repeat` distinction (reflect vs. translate around `axisCol`), read `docs/superpowers/specs/2026-08-02-symmetry-draw-repeat-mode-design.md`.

## Mode A — printed command table present

Use this when the image prints a table of arrow+number cells above the figure (standard "графический диктант" worksheet, e.g. a table like `4→ 1↘ 1↑ 1↗ …`).

1. Read the image with the Read tool. Transcribe the table left-to-right, top-to-bottom into an ordered list of `{direction, cells}`. Map arrows to direction tokens literally — no interpretation:

   | Arrow | direction |
   |---|---|
   | → | right |
   | ← | left |
   | ↑ | up |
   | ↓ | down |
   | ↗ | up_right |
   | ↘ | down_right |
   | ↖ | up_left |
   | ↙ | down_left |

2. Find the marked start point (a colored dot on the drawn figure below the table) and count its `{col,row}` from the figure's own ruled grid lines (count grid intersections from the drawn grid's own top-left, not the page edge).
3. Pick `columns`/`rows` for the card: tight bounding box of the traced path plus ~1-2 cells of margin, matching the existing cards' convention.
4. Write a scratch JSON file (e.g. `tools/symmetry_draw/.trace-scratch/<name>.json`) with `{ "start": {...}, "commands": [...] }`.
5. Measure pixel scale: run
   `node tools/symmetry_draw/verify_trace.mjs ruler <image> --step=50 --out=tools/symmetry_draw/.trace-scratch/<name>-ruler.png`
   and read the output image to find the pixel spacing between the drawn grid's own lines (cell size in px) and the pixel position of one grid intersection (origin). Use a smaller `--step` (e.g. 20-25) if the drawn grid cells are smaller than the default ruler spacing.
6. Render the overlay:
   `node tools/symmetry_draw/verify_trace.mjs overlay <image> <scratch>.json --cell=<px> --originX=<px> --originY=<px> --out=tools/symmetry_draw/.trace-scratch/<name>-overlay.png`
   and read the output image. The red traced line and blue start-point circle must sit exactly on top of the source drawing's line and start dot.
7. If they don't align, re-check step 1-3 (most likely a table transcription slip or a miscounted start point) and re-render. Only write the final `commands`/`start` into `topic.json` once the overlay matches.
8. Also manually re-read the transcribed `commands` array against the printed table cell-by-cell once — the overlay can visually match by coincidence on a symmetric-looking segment even with a swapped direction token; a manual re-check catches that.

## Mode B — bare contour, no table

Use this for `mirror_draw`/`repeat_draw` cards, or a dictation source with no printed table — the image is just a figure drawn on grid paper.

1. Read the image. Measure the grid's cell size in pixels and the pixel origin of one grid intersection, the same way as Mode A step 5 (`ruler` subcommand).
2. Trace every vertex of every disjoint stroke. A card may need more than one `sourcePaths` entry (e.g. a body plus a separate window/detail) — split into separate paths wherever the pen would lift. Snap every vertex to a grid intersection; `.5` fractional coordinates are allowed for curves/circles (existing precedent: `symmetry_heart`, `symmetry_eye`).
3. For a `mirror` card: trace only the half up to the axis (the engine reflects it at runtime); `axisCol` is the column where the drawn axis line sits. For a `repeat` card: trace the *whole* figure (the engine only translates it, it does not mirror); `axisCol` marks where the student's blank half begins.
4. Write a scratch JSON file with `{ "paths": [[...], ...] }` and render it with the same `overlay` command as Mode A step 6. Iterate until every path aligns with the source drawing.
5. Assemble the full card object (`id`, `conceptId`, `label`, `taskKind`, `columns`, `rows`, `axisCol`, `sourcePaths`, and `primary` if it's the first card introducing a new figure set).

## Cleanup

Scratch files under `tools/symmetry_draw/.trace-scratch/` are gitignored — leave them or delete them, they never get committed.
