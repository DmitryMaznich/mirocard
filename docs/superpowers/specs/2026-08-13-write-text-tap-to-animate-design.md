# write_text: tap a word to animate its handwriting

## Context

`propis`'s "Пишем текст" (write_text) mode lays typed words onto a
multi-row notebook grid (`WriteTextView.jsx`), rendering each word's
cursive strokes as plain static `<path>`s — no animation, unlike the
other two propis modes:

- **practice**: tap a letter on the keyboard → the card above shows that
  letter's handwriting looping continuously until a different letter is
  tapped (`PropisPracticeView.jsx` + `LoopingLetterCell.jsx`).
- **write_words**: type a word → `WordAnimatedCard.jsx` plays it as one
  continuous looping pen animation (faint background outline of the whole
  word + a moving pen-tip dot, via the shared `useLoopingStrokes.js` hook).

write_text was built as a *typing/wrapping* exercise and deliberately
skipped animation for simplicity. This spec adds the missing piece: tap
any already-typed word on the grid, and it plays the same looping
handwriting animation write_words uses — reusing the existing hook and
visual language instead of inventing a new one.

## Interaction design (confirmed with the user)

1. **Looping, not one-shot.** Tapping a word starts the animation loop and
   it keeps looping — same as every other animated view in this topic —
   until interrupted by (2) or (3) below.
2. **One active word at a time.** Tapping a *different* word switches the
   animation to it (the previous word reverts to static rendering).
3. **Tap-to-toggle.** Tapping the *currently* active word again clears the
   selection — the grid returns to fully static.
4. **Any text change clears the selection.** Typing, backspace, Enter, or
   Clear all reset the active word to none. No attempt is made to "follow"
   the same logical word across an edit — simplest correct behavior, and
   matches the fact that editing is a different task than reviewing.
5. **Full visual treatment, not a stripped-down version.** The active
   word gets the *same* faint background outline + moving pen-tip dot
   write_words uses — not a simplified "just redraw the strokes" version.

## Architecture

### Extract `AnimatedStrokes` out of `WordAnimatedCard.jsx`

`WordAnimatedCard.jsx` currently inlines the "ghost outline + animated
strokes + pen tip" markup directly inside its own `<svg viewBox=...>`.
write_text needs the exact same markup, but positioned inside its own
shared multi-row `<svg>` (via a `<g transform="translate(...)">`), not
inside a dedicated per-word `<svg>`.

Pull the reusable part into a new component:

```
src/topics/renderers/propis/AnimatedStrokes.jsx
```

```jsx
// Renders one trajectory's looping handwriting animation: a faint static
// background copy of every stroke, the same strokes redrawn as an
// animated dash-offset reveal, and a moving pen-tip dot. No <svg>/viewBox
// of its own — the caller positions it (WordAnimatedCard wraps it in its
// own per-word <svg>; WriteTextView wraps it in a <g transform> inside
// its shared grid <svg>).
export default function AnimatedStrokes({ trajectory, delayMs = 200, loopPauseMs = 1400 }) { ... }
```

`WordAnimatedCard.jsx` shrinks to: its own `<svg viewBox>` + paper +
guide lines + `<AnimatedStrokes trajectory={trajectory} />`. No behavior
change for write_words — pure extraction, covered by the existing
write_words rendering (no new tests needed there beyond "still renders
the same DOM shape").

### `WriteTextView.jsx` changes

- New state: `const [activeIndex, setActiveIndex] = useState(null)` —
  index into `layout.placed`.
- `useEffect(() => setActiveIndex(null), [text])` — any text change
  clears the selection (requirement 4). Safe because `layout.placed`'s
  order/identity is stable across renders that don't change `text` or
  `rowWidthUnits` (pure tap-toggle interactions never touch either).
- Per placed word, add an invisible tap target sized to the *whole row
  height* (not just the word's own ink bounding box — generous target,
  per the topic's existing "keys must be easy to hit" bar) and its
  measured `width`: an `<rect fill="transparent">` spanning
  `x: -4..width+4`, `y: 0..UNIT_H`, with `onClick` toggling `activeIndex`
  (requirements 2/3: click same index → `null`, click a different one →
  that index).
- Per word, per **cursive** segment: if this word's index
  `=== activeIndex`, render `<AnimatedStrokes trajectory={seg.trajectory} />`
  positioned at the segment's existing `xOffset` instead of the current
  plain `<path>` list. Fallback (digit/punctuation) segments never
  animate (nothing to animate) and render exactly as today regardless of
  active state — a word mixing cursive + fallback content (e.g. "стол1")
  animates only its cursive run(s).
- No changes to `wordEngine.js`/`layoutTextIntoRows` — this is purely a
  rendering-layer feature on data that's already computed.

### Not in scope

- No change to how words are typed, wrapped, or spaced.
- No change to `write_words`' own behavior beyond the pure extraction.
- No highlight/background tint distinct from `AnimatedStrokes`' own faint
  ghost outline — the ghost itself is the "this word is selected" signal,
  consistent with how write_words already looks with nothing extra added.
  If this turns out to be too subtle once tested live (e.g. hard to spot
  during the 1400ms pause between loops), that's a follow-up, not part of
  this change.

## Testing

- `AnimatedStrokes` extraction: existing propis test suite must stay
  green unchanged (no behavior change for write_words).
- New behavior is interaction-driven React state (tap toggling, text
  clearing selection) — verify live in the dev browser harness
  (`dev-propis.html`/`dev-propis-preview.jsx`, throwaway, deleted before
  commit) via React fiber state inspection, the same technique used
  earlier this session to verify write_text's row-wrap and backspace
  behavior, since the Browser pane's screenshots aren't visible on the
  user's side this session.
- Manual checklist to verify live: tap a word → it animates on loop; tap
  a different word → first stops, second animates; tap the active word
  again → stops, grid fully static; type a new character anywhere → any
  active animation stops; tap a fallback-only word (e.g. a lone "42") →
  no crash, no visible animation (nothing to animate).
