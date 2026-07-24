# Mironium Landing "Темы" Carousel — Design

## Goal

Replace the static 5-card grid in the `#topics` section of `mironium-prototype/index.html` with an auto-advancing spotlight carousel, using the new premium lifestyle photos (`gallery-*` prefix) instead of the current plain in-app screenshots (`app-*.jpg`).

## Content

Six topics, in this order (unchanged from current order, with one new topic appended):

| # | Image file | Caption |
|---|---|---|
| 1 | `gallery-crocodile-v1.png` | ⚖️ Сравнение чисел |
| 2 | `gallery-stone-house-v1.png` | 📖 Словообразование |
| 3 | `gallery-column-addition-v1.png` | 🔢 Сложение в столбик |
| 4 | `gallery-emotion-shame-v1.png` | 🎭 Эмоции |
| 5 | `gallery-poem-v1.png` | 📚 Чтение — стихи |
| 6 | `gallery-abacus-v1.png` | 🧮 Плюс и минус |

The old `app-*.jpg` files are no longer referenced from this section. They are not deleted from disk (out of scope — no other usage was audited).

## Behavior

- **Autoplay:** advances to the next topic every ~4 seconds, in a continuous loop (after the last topic, wraps to the first).
- **Transition:** crossfade only (no directional slide) — outgoing photo fades out with a slight scale-down, incoming photo fades in, ~500ms ease.
- **Pause on interaction:** autoplay pauses on `pointerenter`/`focuswithin` (desktop hover) and on `touchstart` (mobile touch-and-hold), resumes after the pointer/touch leaves.
- **Manual navigation, two ways:**
  1. **Swipe on the main photo** (left/right) — advances/returns one topic. Available on touch devices; this is the primary mobile interaction surface, not just the thumbnail row.
  2. **Tap/click a thumbnail** — jumps directly to that topic.
  - Either manual action resets the autoplay timer (next auto-advance is ~4s after the manual action, not on the original schedule).
- **Progress indicator:** a thin progress bar under the currently-active thumbnail fills over the ~4s interval, giving a visual countdown to the next auto-advance (Stories-style). Resets on every advance (auto or manual).
- **Keyboard:** when the carousel (or a thumbnail) has focus, `ArrowLeft`/`ArrowRight` move to the previous/next topic (same reset-timer behavior as manual navigation).

## Visual structure

- One large photo on top, in the same card language as the current `.topic-card` (rounded corners, soft shadow, `--line` border), just larger — caption rendered below the photo in the same style as the existing `.topic-card__label` (emoji + bold label).
- A row of 6 small thumbnails below the main photo. The active thumbnail is visually distinguished (border highlight) and carries the progress-bar fill described above.
- Colors, radii, and shadows reuse existing CSS custom properties already defined in `mironium-prototype/styles.css` (`--cream`, `--ink`, `--line`, etc.) — no new palette introduced.

## Accessibility & responsiveness

- **`prefers-reduced-motion: reduce`:** autoplay is disabled entirely (no timer runs) and the crossfade transition is replaced by an instant swap, consistent with how `.reveal` already degrades elsewhere on this page. Manual navigation (swipe, thumbnail tap, arrow keys) still works.
- **Screen readers:** the caption region is `aria-live="polite"` so the active topic name is announced on every change (auto or manual).
- **Keyboard:** carousel and thumbnails are reachable via `Tab`; arrow-key navigation as described above; visible `:focus-visible` outline on thumbnails, matching the existing focus-ring pattern used elsewhere on this page.
- **iOS safe-area:** not applicable — this is an in-flow page section, not a fixed/sticky/absolute screen-edge element (see CLAUDE.md safe-area rule, which only applies to screen-edge-pinned elements).
- **Layout:** the carousel is a single central column at all viewport widths (unlike the old grid, there is no separate mobile column-count breakpoint to maintain); thumbnail row wraps or scales down proportionally on narrow viewports so all 6 thumbnails stay visible without horizontal scrolling.

## Files touched

- `mironium-prototype/index.html` — replace the `#topics` section markup (`.topics__grid` / `.topic-card` structure) with the new carousel markup.
- `mironium-prototype/styles.css` — replace `.topics__grid`/`.topic-card` rules with new carousel styles (main photo, caption, thumbnail row, active/progress states, reduced-motion override).
- `mironium-prototype/script.js` — add a small self-contained carousel controller (timer, crossfade class toggling, swipe gesture handling, thumbnail click, arrow-key handling, progress-bar reset). No new dependencies.

## Out of scope

- No changes to any other section of the landing page.
- No changes to `landing/` (the separate, currently-inactive redesign exploration) or `design/` (scratch assets).
- No deletion of the now-unused `app-*.jpg` files.
- No build step or framework — stays plain HTML/CSS/vanilla JS, consistent with the rest of `mironium-prototype/`.
