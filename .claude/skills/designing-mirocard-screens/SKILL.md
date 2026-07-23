---
name: designing-mirocard-screens
description: Use when building, redesigning, or restyling any screen, mode, or component inside the Mirocard2 app (src/topics/renderers/*, src/features/session/*) — picking colors, fonts, spacing, buttons, drop-zones, keypads, or feedback states for it.
---

# Designing Mirocard2 screens

## Overview

Mirocard2 is a children's practice app (math/reading/vocabulary "cards"). Every topic family (`src/topics/renderers/<family>/`) has its own scoped CSS file with its own background/accent colors — by deliberate convention, **not shared classes** (see "Why duplicated, not shared" below). A new family should get its own new CSS file this same way; a couple of older families (`math_houses`, `flashcards`) instead have their styles living directly in the giant shared `src/styles.css` — that's legacy, not a model to copy for new work. A new screen should reuse this established visual language instead of re-deriving colors/spacing from scratch, which is slow and produces inconsistent results.

This is a reference, not a rulebook: match the family it belongs to, reuse the patterns below, and only invent something new when the task genuinely needs it.

## Where a new screen lives

Every renderer mounts **inside shared session chrome** it never restyles: `SessionHeader`/`.session-topbar` (progress stars, task counter, finish button) sits above; the renderer fills `.session-body`/`.session-stage` below it (flex column, `overflow: hidden`). Don't rebuild a header/progress bar — it already exists.

## Global tokens (`src/styles.css`, always loaded)

```css
:root {
  font-family: "Nunito", sans-serif;   /* base UI font everywhere */
  --app-safe-top/right/bottom/left: env(safe-area-inset-*, 0px);
  --font-serif: "DM Serif Display", Georgia, serif;  /* chrome/brand only, not gameplay */
}
```
- **Nunito** (400/600/700/800/900): default body/UI text everywhere.
- **Primo** (`@font-face`, local `/fonts/primo.ttf`): reserved for big handwritten-style digits/letters a child reads as "the number/letter itself" — column-addition digit cells, fingers-count numbers, written-letters handwriting. Don't use it for ordinary UI text.
- **DM Serif Display**: splash/brand tagline only. Never inside a topic renderer.
- iOS safe-area rule (mandatory for any new fixed/sticky/absolute screen-edge element): see `CLAUDE.md` → "iOS Safe Area" section. Bake `var(--app-safe-top/bottom, 0px)` into the offset in the same diff that adds the element.

## Per-family palette (pick the closest match, don't invent a new hue family)

| Family group | Background | Accent | Example files |
|---|---|---|---|
| Math / logic | `#f0f6ff` / `#f0f4f8` (pale blue) | blue `#3b82f6`/`#2563eb` for anything interactive/active (the two shades are used interchangeably, not a primary/secondary split); amber `#f59e0b` is reserved specifically for a "carry"/place-value highlight, not a general secondary accent | `column_addition/*.css`, `math_houses` (in styles.css) |
| Literacy / handwriting | `#fdfcf9`/`#fefef6`/`#fffef5` (warm cream/paper) | teal `#4a9b8f`, vowel red `#dc2626`/`#ef4444`, consonant blue `#1d4ed8`/`#3b82f6` | `magnetic_alphabet.css`, `written_letters.css`, `letter_write.css` |
| Puzzle / utility | `#f8f9fa`/`#f5f6fa` (neutral grey) | teal `#4a9b8f` | `sentence_puzzle.css` |
| Generic card-based | white card, inherits global cream gradient | — | `flashcards` (styles.css only, no bespoke file) |
| Distinct one-offs | seasons palette `#C85C00`/`#C06A20` (word_formation), dynamic `--zone-color`/`--house-color` via `color-mix()` (vowel_consonant, math_houses) | | |

**Universal correct/wrong colors — do not deviate:**
- Correct: `#22c55e` or `#16a34a` (border/text), tint `#dcfce7`/`#d1fae5`/`#f0fdf4`.
- Wrong: `#ef4444` (border/text/shake trigger), tint `#fef2f2`/`#ffebee`/`#fee2e2`.

## Component patterns

**Buttons** — use `src/shared/components/Button.jsx` (`variant`: primary/secondary/danger). Underlying formula (`styles.css` `.btn*`, reused informally by every per-topic button): flat color, bold white text, a "3D" bottom shadow that collapses on `:active` (`translateY(3px)` + shadow removed). Primary teal `#4a9b8f`/shadow `#2a6b60`; keep this press-feedback shape for any custom in-topic button (numpad keys, tap keyboards) even if you don't reuse the component itself.

**Drag-and-drop drop-zones**: name the zone `.{prefix}-zone` with state modifiers `.{prefix}-zone--drag-over` / `.{prefix}-zone--correct` (e.g. `place_value.css`'s `.pv-zone`/`.pv-zone--drag-over`/`.pv-zone--correct`). Border goes from dashed to SOLID once it's no longer idle, at both the drag-over and correct stages — only the idle state is dashed. Sequence: idle = dashed border (`2`–`2.5px dashed`, gray `#94a3b8`/`#cbd5e1`/`#e2e8f0`) → drag-over = solid blue (`#3b82f6` border, `#eff6ff` bg, glow `rgba(59,130,246,.35)`) → confirmed-correct = solid green (see universal correct color above; the glow doesn't carry over to this stage). Transition all three color/background/shadow properties over `0.15s` (`place_value.css`'s `.pv-zone` uses `transition: border-color 0.15s, background 0.15s, box-shadow 0.15s`) — snappier than the 0.35–0.45s shake, since this is a state change, not an error flash. Floating drag-ghost: `position:fixed; pointer-events:none; transform: translate(-50%,-50%) scale(1.06–1.12); z-index:1000`.

**Checklist / step-confirmation** (tap-the-instruction-to-confirm, completed rows stay visible, frozen, struck-through): established in `fingers.css` (`fng-checklist*`) and `place_value.css` (`pv-checklist*`). Copy the pattern into a new `{prefix}-checklist-*` set rather than importing either file — each family keeps its own copy on purpose (see below). Shared shape: white row → `.is-done` green bg/border + strikethrough → `.is-wrong` red border + shake → `.is-pending` (ticked by something other than a tap, e.g. a keypad) gets no pointer cursor.

**Numpad/keypad**: `column_addition/DigitKeypad.jsx` + `useTapButtonSize.js` is the reusable tap-keyboard sizing hook; `place_value.css`'s `.pv-numpad`/`.pv-numkey` (5-col grid) is the simplest reference CSS. Same 3D-shadow button formula as above.

**Shake feedback**: every family defines its own `@keyframes {prefix}-shake` (horizontal translateX oscillation, 0.35–0.45s ease) rather than sharing one — same reasoning as the checklist duplication. Trigger it via a `.{prefix}-*--error`/`.is-wrong` modifier class alongside the red wrong-color, not as a standalone animation.

**Why duplicated, not shared**: per-family CSS files say this explicitly in comments — keeps retouching one family's visuals from ever silently touching another's. Follow this: copy-and-rename a pattern into the new family's own file, don't cross-import between `topics/renderers/*` folders.

## Sizing & responsiveness

- **`clamp(min, Nvw, max)`** is the default fluid-sizing tool (500+ uses across the app). Typical shape: `clamp(16px, 2.4vw, 26px)`.
- **`container-type: inline-size`** + `cqw`/`cqi` units: for a component whose OWN box can vary in size independent of the viewport (one hand, one jar, one card) — give the wrapper `container-type: inline-size`, size children in `cqi`/`cqw`. See `fingers.css` `.fng-sub-hand-inner`, `place_value.css` `.pv-zone-body`.
- **`--{prefix}-scale` custom-property-as-length** (see `coins.css` `.cb-screen`): `clamp(1px, calc(100vw / 400), 2px)` kept as a length (not a bare number) so every size is `calc(N * var(--x-scale))` — never `calc(Npx * var(--x-scale))` (px² silently drops). Reach for this specifically when a dnd-kit draggable child needs to scale without its own drag-transform getting multiplied by an ancestor `transform: scale()`.
- Touch targets: pair `touch-action: manipulation` + `-webkit-tap-highlight-color: transparent` on tappable elements; `touch-action: none` instead on drag surfaces (so native scroll/zoom doesn't fight the drag). Minimum practical tap size ~48px.

## Spoken feedback (`useSpeech`)

`src/shared/hooks/useSpeech.js` → `speak(text)`. Established pattern (currently only in `column_addition`, worth extending elsewhere): narrate the CONCEPT at the exact instant a manipulative action completes it (e.g. "Десять единиц — это один десяток!" the moment 10 units group into a ten), and say "Верно!" (optionally restating the full answer) on a correct response. Not used for wrong answers.

## Fastest way to design a new screen

1. Identify the closest family group above; reuse its background/accent, not a new hue.
2. Reuse a component pattern (checklist, drop-zone, numpad, button) by copying its CSS shape into the new family's own file.
3. Size with `clamp()` by default; reach for `container-type: inline-size` only when a component's own box (not the viewport) should drive its scale.
4. If it's screen-edge-fixed (header/footer/floating button), bake in the safe-area vars in the same diff.
5. Verify visually before calling it done — don't judge from source alone. Build a static HTML file that `@import`s or inlines the real CSS file(s) for the family (read them with Node's `fs`, don't retype colors/values by hand), reproduce the actual DOM structure/class names, then screenshot it:
   ```bash
   chrome.exe --headless=new --disable-gpu --no-sandbox \
     --user-data-dir=<scratch>/chrome-profile \
     --screenshot=<scratch>/shot.png --window-size=390,700 \
     --virtual-time-budget=2000 "file:///<path-to-mockup.html>"
   ```
   For anything measured at runtime (a `useLayoutEffect` fit-to-width hook, a JS-driven size calc), replicate that exact same JS logic inline in the mockup's own `<script>` rather than guessing the resulting size — otherwise the screenshot doesn't prove what the real component will render.