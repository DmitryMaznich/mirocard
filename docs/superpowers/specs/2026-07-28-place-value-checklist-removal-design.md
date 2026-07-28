# Design: Remove the checklist UI from build_number/regroup_ten, standard font everywhere

## Problem

`identify_number` ("Какое это число?") already shows its per-phase instruction
as a single centered line that swaps in place (`.pv-question` in
`place_value.css`, driven by `IdentifyNumberTask.jsx`'s `questionText`) — no
checklist, no history. `build_number` ("Собери число") and `regroup_ten`
("Разменяй десяток") still use an older checklist idiom instead: each
instruction is a row with a checkbox, done rows stay visible (struck-through,
green), and — in `build_number`'s case — a vertical timeline connector threads
the rows together. The user wants that checklist gone from both, replaced with
the same plain sequential centered display `identify_number` already uses, in
the app's standard body font (`Nunito`) instead of the checklist family's
current handwritten `Neucha` cursive font (`.pv-question` itself is also
currently set to Neucha, despite already having no checklist — that's in
scope too).

## Resolution

Both `BuildNumberTask.jsx` and `RegroupTenTask.jsx` render their current
instruction as the SAME shared `.pv-question` element `IdentifyNumberTask.jsx`
already uses (not a new, third, parallel class) — one line, centered, current
phase's text only, swapping directly to the next with no fade-out history and
no completion checkmark. `.pv-question`'s `font-family` changes from
`'Neucha', cursive` to `"Nunito", sans-serif` (the app's default body font,
already declared on `body` in `src/styles.css:8` — dropping the explicit
override lets it inherit, per this app's DRY convention elsewhere).

## build_number (BuildNumberTask.jsx)

Current 4-row checklist (`collect` → `group` → `answerTens` → `answerOnes`,
each a `ChecklistItem` with checkbox) becomes ONE `.pv-question` div whose
text is computed from `phase`:

- `collect`: `Собери N монет` (the target-count highlight — currently
  `.pv-checklist-number`, a blue color-only span, no size change, so it
  doesn't throw off `useFitOneLine`'s width measurement — carries over
  unchanged, renamed `.pv-question-number`)
- `group`: `Сложи десятки`
- `answerTens`: `Сколько десятков?`
- `answerOnes`: `Сколько единиц?`
- `done`: `Правильно!` (new — `build_number` currently shows nothing here,
  it just auto-advances 900ms after the last correct digit; this brings it in
  line with `identify_number`'s own "Правильно!" moment, styled via the
  already-existing `.pv-question--correct` green/bold modifier)

`collect` and `group` stay tappable — the confirm interaction the checklist
row's `onClick` (`confirmCollect`/`confirmGroup`) provided moves onto the
`.pv-question` div itself (`role="button"`, `tabIndex={0}`, `onClick`) when
the current phase is one of those two; `answerTens`/`answerOnes`/`done` render
the same div with no click handler (confirmed via the numpad instead, same as
today). A wrong tap on `collect`/`group` still needs to shake — add
`.pv-question--shake` reusing the existing `pv-shake` keyframe (already used
by `.pv-answer-slot--shake` elsewhere in this file), applied via the same
`rowWrong.collect`/`rowWrong.group` state this component already tracks.

The four separate `useFitOneLine` calls (`collectRef`/`groupRef`/`tensQRef`/
`onesQRef`) plus the shared `checklistFontSize = Math.min(...)` collapse into
ONE `useFitOneLine` call on the current phase's text — that apparatus existed
only to keep multiple SIMULTANEOUSLY VISIBLE checklist rows sized consistently;
with one line visible at a time there's nothing to keep consistent with,
matching `IdentifyNumberTask.jsx`'s own single `useFitOneLine` call. Keep this
component's existing `{max: 45, min: 13}` range (tuned for longer strings like
"Собери 47 монет") rather than switching to `identify_number`'s `{max: 40,
min: 16}` — different text, already correctly tuned, not part of this change.

## regroup_ten (RegroupTenTask.jsx)

Only ever had ONE instruction ("Разменяй десяток в единицы"), so there's no
"sequence" to collapse — just drop the checkbox/strikethrough chrome and
render it as a plain `.pv-question` div, no click handler (confirmed via the
existing ten-stack drag, unchanged), no wrong-shake needed (this mode has no
wrong-answer path today). Keep its own `useFitOneLine({max: 45, min: 13})`
call as-is — same reasoning as build_number, different text length than
identify_number's.

## CSS cleanup (place_value.css)

Once both components stop rendering `ChecklistItem`/`CheckIcon`, these rules
become dead and are deleted outright (not left as unused legacy):
`.pv-checklist`, `.pv-checklist-item` (+ its `:active`/`:not(:last-child)::after`
connector, `is-done`/`is-wrong`/`is-pending` states, `pv-checklist-item-in`
entrance keyframe), `.pv-checklist--focused`, `.pv-checklist-box` (+
`pv-checklist-box-pulse` keyframe, done/wrong border-color), `.pv-check-icon`
(+ `pv-check-pop` keyframe), `.pv-checklist-text` (+ its done/wrong color
rules), `.pv-checklist-number` (renamed to `.pv-question-number` and kept,
not deleted — still needed for the coin-count highlight inside `.pv-question`
text). The `@media (prefers-reduced-motion: reduce)` block's three
checklist-animation overrides are deleted along with the rules they target.

`fingers_count`'s own separate `fng-checklist` family (a different renderer,
explicitly called out in this file's own comment as "kept as its own pv-*
rule set rather than a shared class so retouching one family's checklist
visuals never touches the other's") is NOT touched — out of scope, unrelated
mode.

## Out of scope

- No change to the coin workspace, drag-and-drop, numpad, or answer-slot
  mechanics in either component — only the top instruction display and its
  CSS.
- No change to `identify_number`'s own phase logic — only its shared
  `.pv-question` font-family changes (which it inherits automatically, no
  `IdentifyNumberTask.jsx` edit needed).
- No change to `fingers_count`'s checklist.
