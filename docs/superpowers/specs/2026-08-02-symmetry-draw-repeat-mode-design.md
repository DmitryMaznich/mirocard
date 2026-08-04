# Design: "Повтори рисунок" — second mode for the symmetry_draw topic

## Problem

`symmetry_draw` currently has one mode, "Симметричный рисунок" (mirror): the
child draws the reflection of a figure across a vertical axis. The user wants
a second, related mode in the same topic — "Повтори рисунок" (repeat): the
left half already shows a *complete* figure, and the child reproduces it
*identically* (not mirrored) on the right half.

Target audience note: this exercise is for an 11-year-old boy with autism
spectrum disorder, not a young child. The content and difficulty must read as
age-appropriate — plain/simple figures or a "toddler" visual style would miss
the mark. This shapes both the figure complexity (§ Content) and the
instruction to avoid a childish grid/theme.

## Architecture

### Card/mode association (the actual constraint that shapes this design)

Investigated how flashcards topics currently scope which cards a mode shows:
concept selection (`selectedConceptIds`) is persisted per **(student, topic)**
via `persistStudentTopicLink`, not per (student, topic, mode) — see
`ParamsScreen.jsx:916` and `useSessionEngine.js:54`. Task generation itself
(`generateIntroTasks`, in `flashcards/engine.js`) does not filter by any
per-card field either. That means if the 8 new "repeat" cards were simply
appended to `symmetry_draw`'s existing `cards` array, both modes would show
all 31 cards mixed together — wrong in both directions.

**Fix:** give every card a new `taskKind: "mirror" | "repeat"` field. Add a
dedicated task-type per mode, each with its own generator function in
`flashcards/engine.js` that filters `concepts` by `taskKind` before building
one task per card (same shape as today's `generateIntroTasks`):

- Existing mode: `mode.type` renamed from the shared `"intro"` to a new
  `"mirror_draw"`, with `generateMirrorDrawTasks(concepts)` (filters
  `taskKind === "mirror"`).
- New mode: `mode.type: "repeat_draw"`, with
  `generateRepeatDrawTasks(concepts)` (filters `taskKind === "repeat"`).

Confirmed via grep that no code anywhere hardcodes `mode.type === "intro"`
for symmetry_draw specifically (only the generic dispatch `switch` in
`engine.js` and one unrelated flashcards test) — the rename is safe and
doesn't affect any other flashcards topic, since `"intro"` remains untouched
for everyone else.

All 23 existing cards get `taskKind: "mirror"` added (their current
behavior is unchanged). All 8 new cards get `taskKind: "repeat"`.

### Renderer (`tools/symmetry_draw/renderer.js`)

Single shared file — a topic package has exactly one `renderer.js`, so both
modes must render through the same `GridTask` component. `GridTask` reads
`shape.taskKind`:

- `mirrorPaths(paths, axisCol)` (existing, reflects around the axis) is used
  when `taskKind !== "repeat"`.
- New `translatePaths(paths, axisCol)` (shifts every point by `+axisCol`,
  same orientation, no reflection) is used when `taskKind === "repeat"`.

Everything else is reused unchanged: raw-coordinate coverage evaluation,
pen-lift bridging between strokes, the hint overlay (numbered dots), the
large percent result banner (red while incomplete, green at 100%), and the
hint-disqualifies-star rule (`hintUsed` skips `onCorrect`, calls `onAdvance`
instead after a delay) — all apply identically to both modes.

### Visual difference

Confirmed via a working mockup (screenshot reviewed and approved): the axis
between the two halves changes from the mirror's dashed line + inward
chevrons + "↔ зеркало" chip (orange, `--sd-mirror: #e8664f`) to a **solid**
line + a single right-pointing arrow + "→ повтори" chip, in a new distinct
teal accent (`--sd-repeat: #0d9488`) so the two axis styles never look
interchangeable at a glance. No other layout changes.

## Content — 8 new figures

Reusing the existing 23 mirror-mode shapes was explicitly ruled out — this
mode gets its own set. Themes are at the implementer's discretion (transport,
buildings, geometric patterns — the same general vocabulary already used by
the 23 mirror cards), but every figure must be **bigger and more composite**
than anything in the existing library to read as age-appropriate rather than
a step down in difficulty (repeat/copy is mechanically simpler than
mirroring, so complexity must compensate). Reference ceiling from the
existing set: `symmetry_car` at 20×10 cells with 3 separate `sourcePaths`.
Target for the new 8: grids up to roughly 20–24 columns, 2–4 separate
`sourcePaths` per figure where a composite subject calls for it (matching the
existing rule that composite detail sub-paths use ≥2-cell segments to survive
the pen-lift-bridging coverage logic).

Each new figure needs precise `(col, row)` coordinates traced/authored the
same way as the existing 23 (grid-aligned vertices, verified visually before
shipping) — this is real design work, not a content stub, and belongs in the
implementation plan as its own set of steps (one per figure or batched).

## Versioning and rollout

- `tools/symmetry_draw/topic.json`: bump to `1.1.0` (minor — new mode, not a
  patch), add the 8 new cards with `taskKind: "repeat"`, add
  `taskKind: "mirror"` to all 23 existing cards, add the new
  `repeat_draw` mode entry to `modes`, change the existing mode's `type` to
  `"mirror_draw"`.
- Rebuild the ZIP via `tools/symmetry_draw/build.mjs`, copy to
  `public/decks/symmetry_draw_v1.1.0.zip` (never overwrite an existing
  versioned ZIP), update `public/decks/catalog.json`.
- `src/topics/renderers/flashcards/engine.js`: add
  `generateMirrorDrawTasks`/`generateRepeatDrawTasks`, register both in the
  `generateTasks` dispatch switch.
- Commit code (`renderer.js`/`renderer.css`/`engine.js`) separately from the
  content/version bump (`topic.json`/ZIP/`catalog.json`), matching the
  pattern used for every prior symmetry_draw change this project.

## Testing / verification plan

Live browser verification (temporary React-mount harness, deleted after use,
same method used for every previous symmetry_draw change):

1. A `taskKind: "mirror"` card produces a task only under the
   `mirror_draw`-mode task list; a `taskKind: "repeat"` card only under
   `repeat_draw` — confirms the two pools never leak into each other.
2. `translatePaths` produces the correct non-mirrored copy for a known
   figure (spot-check coordinates).
3. A correct trace against the translated target reads 100%/green and fires
   `onCorrect`; the same pen-lift-bridging and hint-dot-tapping behavior
   already verified for mirror mode also works for repeat mode (shared
   coverage code, but must be re-confirmed against the new transform).
4. Hint-disqualifies-star: identical to the existing verified behavior,
   spot-checked once for `repeat_draw`.
5. Existing `mirror_draw` (renamed from `intro`) still produces exactly the
   23 existing cards and nothing else — regression check for the rename.
6. `npx vitest run --dir src` for `flashcards/engine.test.js` and
   `topicLoader.test.js` (scoped to `src/` to avoid the known stray-directory
   test-discovery pollution).

## Out of scope

- No changes to how concept selection / `selectedConceptIds` is persisted
  (still per topic+student, not per mode) — the `taskKind` filter works
  around this without needing that architectural change.
- No new evaluation tolerance tuning — reusing `COVERAGE_TOLERANCE = 0.7`
  as-is; revisit only if live testing on the new, larger figures shows it
  needs adjustment.
- Figure themes are not personalized to specific interests of the child (the
  user deferred theme choice to implementer discretion).
