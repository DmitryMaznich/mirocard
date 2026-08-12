# Design: "Стрелка в подсказке" toggle for `graphic_dictation`

## Problem

During a live "Графический диктант" session, `DictationTask`
(`tools/symmetry_draw/renderer.js`) shows each command two ways at once: a
large arrow icon (`InstructionGraphic`) and the same instruction spelled out
as text (`commandText`, e.g. "2 клетки вправо"). Some children lean entirely
on the arrow and never read the words. The user wants a settings toggle that
removes the arrow, forcing the child to read the text to know which way to
draw.

Scope, confirmed with the user: only the live session's on-screen instruction
(`DictationTask`). The printed worksheet's compact command list (`2→ 2↗ 2↑`,
added in `symmetryDrawPrintHtml.js`) is a different context — a quick
reference for the adult holding the page, not something the child reads
letter-by-letter — and is out of scope.

## Data flow (already exists, nothing new to build)

`ParamsScreen.jsx`'s `params` state → `persistStudentTopicLink(..., { params,
... })` → `useSessionEngine.js`'s `sessionParams = { ...(link.params ?? {}),
... }` → `<Renderer sessionParams={sessionParams} .../>` in
`SessionScreen.jsx` → `tools/symmetry_draw/renderer.js`'s
`SymmetryDrawRenderer(props)` → `h(DictationTask, props)` (props, including
`sessionParams`, pass straight through via spread).

`DictationTask` already receives `sessionParams` as a prop today — it's
just not in its destructured signature yet. No new plumbing is needed
between the settings screen and the renderer; this is purely: add a param
definition, read it, add a control for it.

## Changes

### 1. `tools/symmetry_draw/topic.json`

Add `params` to the `graphic_dictation` mode entry:

```json
"params": {
  "showArrow": {
    "type": "boolean",
    "default": true,
    "label": { "ru": "Стрелка в подсказке" },
    "hint": { "ru": "Выключите, чтобы ребёнок читал команду текстом, а не смотрел на значок" }
  }
}
```

`mirror_draw` and `repeat_draw` get no `params` entry — the toggle is
specific to `graphic_dictation`.

This alone makes `ParamsScreen.jsx`'s existing `getInitialParams()` pick up
`showArrow: true` as the default and correctly persist toggled values,
since that function reads `mode?.params` unconditionally (it runs before
the topic-specific rendering branch, so it doesn't matter that
`symmetry_draw` uses a custom rendering branch below).

### 2. `tools/symmetry_draw/renderer.js`

`DictationTask({ task, onCorrect })` → `DictationTask({ task, onCorrect,
sessionParams })`. Compute `const showArrow = sessionParams?.showArrow ??
true;` and only render the `dictation__arrow-wrap` block (the
`InstructionGraphic`) when `showArrow` is true:

```js
command && showArrow ? h("div", { className: "dictation__arrow-wrap" }, h(InstructionGraphic, { command })) : null,
```

The text (`dictation__text`, `commandText(command)`) is unconditional —
it's already always rendered today, this change doesn't touch it. No CSS
changes: the flex layout in `.dictation__command` already handles the
arrow-wrap being absent (it's just one flex child fewer).

Voice playback (`speakInstruction`, the "↻" button) is unaffected — it
already reads `commandText(command)` regardless of the arrow setting.

### 3. `src/features/session/ParamsScreen.jsx`

In the `isSymmetryDrawPrint` ternary arm, add a `BooleanParam` (the same
component every other mode's boolean settings already use) above the print
trigger button, shown only for `graphic_dictation`:

```jsx
) : isSymmetryDrawPrint ? (
  <>
    {mode?.type === "graphic_dictation" && (
      <BooleanParam
        label="Стрелка в подсказке"
        hint="Выключите, чтобы ребёнок читал команду текстом, а не смотрел на значок"
        value={params.showArrow ?? true}
        onChange={(v) => setParams((p) => ({ ...p, showArrow: v }))}
      />
    )}
    <SymmetryDrawPrintParams topicRecord={topicRecord} mode={mode} />
  </>
) : (
```

`mirror_draw`/`repeat_draw` params screens are unaffected — they just don't
match the `mode?.type === "graphic_dictation"` check, so only the print
button shows, same as today.

### 4. Deck rebuild

Bump `tools/symmetry_draw/topic.json`'s version (`1.5.0` → `1.6.0`), rebuild
the ZIP via the topic's existing build step, update `public/decks/catalog.json`
to point at the new ZIP — the same release process already used earlier in
this topic's development.

## Testing

- Live browser check: toggle off on the `graphic_dictation` params screen,
  start a session, confirm the arrow icon is gone and only the text
  instruction remains, the grid/drawing interaction still works normally,
  and the "↻ Повторить инструкцию" voice button still speaks the correct
  text.
- Toggle back on, confirm the arrow returns.
- Confirm `mirror_draw`/`repeat_draw` params screens show no new control
  (unaffected).
- Confirm the setting persists across leaving and reopening the params
  screen for the same student (via the existing `persistStudentTopicLink`
  mechanism — no new test needed beyond confirming the existing plumbing
  actually carries this specific key correctly).

## Out of scope

- The printed worksheet's command list stays arrow-only regardless of this
  setting (see Problem section).
- No change to `mirror_draw`/`repeat_draw` — they have no arrow-based hint
  to begin with.
