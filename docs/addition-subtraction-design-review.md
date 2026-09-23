# "Плюс и минус" (addition_subtraction) — design review backlog

Started 2026-09-22/23: going through the topic's teaching-ladder modes one by
one, in order, reviewing mechanics and visuals as a speech therapist +
didactic-materials designer would, fixing what's safe to fix immediately and
flagging what needs a real decision or an asset that isn't available in this
sandbox. This file is the handoff — read it first if you're picking this back
up in a new session/account.

## Status by mode

Mode ids are `task.type` in `engine.js` / `topicLoader.js`'s
`DEFAULT_MODES.addition_subtraction`; titles are what the picker shows today.

- **`operation_observe` ("1. Что изменилось?") — reviewed, fixed, deployed.**
  Added an up/down triangle icon to Больше/Меньше (they were text-only, and
  this is the first rung — aimed at kids who may not read fluently yet).
  Strengthened the barely-visible dot enter/leave animation with an amber
  glow ring. Made the ↻ repeat button bigger/filled (was a pale 42px outline
  button for something used every round). Mechanic change: a wrong tap no
  longer auto-restarts the sequence 850ms later — it marks the tapped button
  red (shake) and waits for a tap on the now-pulsing ↻, so the child isn't
  swept into a replay they didn't ask for.
- **`operation_name_action` ("2. Назови действие") — reviewed, fixed,
  deployed.** Same tap-to-retry mechanic fix as mode 1 (was auto-restarting
  the whole hand-carry animation 1.1s after a wrong tap — worse than mode 1
  since it's a multi-step animation, not one dot). Reworded the "Скажи
  вслух" adult-facing hint from "ребёнок сказал: «Прибавили»" (past tense,
  reads as if speech was already recognized — there's no speech recognition
  here) to "ребёнок должен сказать:". **Visual still bad: the hand is a
  hand-coded inline SVG and looks rough.** Don't try to redraw it by hand
  again or pull a stock asset — see backlog item 1 below, the fix already
  exists in the repo, it just needs an API key this sandbox doesn't have.
- **`operation_do_action` ("3. Сделай действие") — reviewed, no change.**
  The counting-stick/rod manipulative (`LiveBeadTool`, `stickModel.js`).
  Measured (via a real Playwright screenshot, not guesswork) bead size at
  ≈29×29px on a 390px phone — under the app's own ~48px tap-target
  guideline, and this is the *minimum* case (`getStickBeadCount()` always
  rounds up to at least 10 beads, so it's not an edge case, every child sees
  this). Measured again at 1024px tablet landscape: ≈72×72px, comfortably
  fine. **User's call: this mode is primarily used on tablet, so the phone
  sizing was explicitly left alone — not a bug to fix, a scope decision.**
  If that changes, the real blocker to a phone fix is `touch-action: none`
  on `.operation-stick__wrap` (required for the drag gesture) which also
  blocks any CSS scroll-based fix; a real fix would need either a 2-row
  wrap layout on narrow screens or dynamically toggling `touch-action` only
  while a bead is actively gripped.
- **`operation_action_from_sign` ("4. Знак ↔ Действие") — reviewed, fixed,
  deployed.** Found and fixed a real bug (not a design opinion): in the
  "Слово → Знак" direction, `ChoiceGrid` never applied the
  `operation-choice--subtract` modifier, so the `−N` option rendered in the
  same teal/green as `+N` — every other spot in this topic (worksheet
  signs, name-action signs, the expression itself) colors minus red. Fixed
  by keying the modifier off `option.value === "-"`, plus a small background
  override so the enlarged-glyph variant doesn't get an asymmetric tinted
  box behind only the minus glyph.
- **`operation_worksheet` ("8. Контрольная работа") — redesigned earlier in
  this same session** (before the mode-by-mode pass started): turned a
  static printed list into an actual interactive test (digit keypad,
  answer-only input), then a full visual redesign from a 6-tiny-cards grid
  to one continuous numbered sheet with soft group dividers, then follow-up
  polish (no line numbers, answer right after "=", even token spacing, no
  concept picker, digit-only compact group/count buttons). Considered done
  unless new feedback comes in.
- **Not yet reviewed:** `operation_find_sign` ("5. Найди знак"),
  `operation_result` ("6. Сколько стало?"), `operation_chain` ("7.
  Цепочка"), `operation_missing_term` ("Найди неизвестное"),
  `operation_audio` ("Слушай и посчитай" — note its numbers are already
  pre-recorded, see backlog item 2). **Pick up here next.**

## Backlog blocked on GEMINI_API_KEY (no key in this cloud sandbox)

Both items below need `GEMINI_API_KEY` (see `scripts/lib/gemini-key.mjs` —
reads `.env`/`.env.local`, neither exists in this container). Only available
on whichever machine actually has that key (the user's local machine, per
this session). Run these there, then push the generated files.

1. **Generate the "Назови действие" hand illustrations.**
   `node scripts/generate-name-action-hands.mjs` (optionally `--only=open` /
   `--only=grip`). It already exists, fully written, matching the *style* of
   the fingers-counting hand kids already know (`public/hands/hand_right_5.webp`)
   via a Gemini image model — this was clearly built for exactly this purpose
   and never run (`public/name-action/` doesn't exist yet). After it produces
   `public/name-action/hand_open.webp` + `hand_grip.webp` (delete the
   `*.raw.png` siblings before committing, per the script's own reminder),
   replace the inline `<HandShapes>` SVG in
   `src/topics/renderers/addition_subtraction/NameActionTask.jsx` with
   `<img>` tags pointing at these — keep everything else (positioning,
   `grip`/`carrying` state, animation timing) exactly as-is, only the visual
   markup changes.

2. **Replace browser TTS with recorded Gemini voice audio for this topic's
   spoken phrases.** Right now `useSpeech()` (Web Speech API,
   `window.speechSynthesis`) reads out mode 1/2's instructions and feedback
   live on-device — this is literally what sounds like "an Android
   synthesizer" to the user, varies by device, and is the reason this item
   exists. Other topics (`spatial_prepositions`, `people_names`, `propis`,
   `word_agreement`) already solved this the same way: a `generate-*-audio.mjs`
   script that calls Gemini TTS (voice `"Kore"`, see
   `scripts/generate-spatial-prepositions-audio.mjs` for the exact pattern —
   model, retry/backoff, mp3 encoding) and ships static mp3s under
   `public/audio/<topic>/`, played back like `useAudioSequence.js` already
   does for addition_subtraction's numbers instead of calling `speak()`.
   To do:
   - Collect every fixed phrase currently passed to `speak()` across this
     topic's modes (`grep -n "speak(" src/topics/renderers/addition_subtraction/*.jsx`)
     — mode 1: "Было N.", "Стало больше или меньше?", "Правильно. Стало
     больше/меньше.", "Неправильно. Посмотри ещё раз."; mode 2: "Что
     сделали?", "Что сделали? Скажи.", "Сколько прибавили/убрали?",
     "Правильно. Прибавили/убрали N. Было X, стало Y.", "Посмотри ещё
     раз.", "Посчитай ещё раз."; check the remaining modes once reviewed.
   - Numbers (0-100ish) that appear inside these phrases can reuse the
     *existing* per-number audio files (`audioNumbers.js`,
     `public/audio/addition-subtraction/n*.mp3`) by sequencing clips
     (`useAudioSequence.js` already plays a queue) instead of baking every
     N into its own phrase recording — much fewer files to generate.
   - Open question worth deciding before generating anything: the existing
     number clips were recorded with **Google Cloud TTS `ru-RU-Wavenet-D`**
     (old pipeline, `scripts/generate-addition-subtraction-audio.mjs`,
     credentials path no longer valid), a different voice than the Gemini
     `"Kore"` voice everything else in the app now uses. Mixing both in the
     same sentence (a Kore phrase clip + a Wavenet-D number clip) would
     sound inconsistent. Decide whether to regenerate the 31 number clips
     with Kore too (cheap — reuses the same script pattern, one more
     `generate-*-audio.mjs`) before wiring phrase audio in.

## Working method for the remaining modes (so you don't re-derive it)

- Read the actual component + CSS before touching anything — don't guess
  from memory of "similar" modes.
- **Verify visually with a real render, not source review.** Build a static
  HTML file that reproduces the actual DOM structure/class names, pull the
  *real* CSS in (see the pitfall below), then screenshot it.
- **Screenshot via Playwright, not the raw `chrome` CLI.** In this sandbox,
  `chrome --headless --window-size=W,H --screenshot=...` silently ignores
  `--window-size` and renders at some fixed default width regardless of what
  you pass (bit me twice this session — cost a false "critical bug" report
  that turned out to be a testing artifact). Use `playwright-core` instead
  (`npm install playwright-core` in a scratch dir, `chromium.launch({
  executablePath: '/opt/pw-browsers/chromium' })`, `browser.newPage({
  viewport: { width, height } })` — this actually respects the width) for
  anything where the rendered size matters, which for this app is almost
  everything.
- **Pitfall when hand-extracting CSS blocks by substring search:** a naive
  "find the first occurrence of `.some-class {`" can land on a media-query
  override of the same selector instead of the base rule, if that override
  happens to appear earlier in the stylesheet (also bit me once this
  session — grabbed a `@media (max-width: 520px)` override instead of the
  base `.operation-stick__track` rule, and separately once forgot to wrap
  a copied override block in its own `@media` at all). Prefer reading exact
  line ranges with the Read tool over blind substring search when a
  selector has more than one declaration in the file, and sanity-check any
  suspicious render (e.g. via `getBoundingClientRect()` in-page) before
  reporting a finding as real.
- Review both **mechanics** (retry/replay flow, auto-advance vs. waiting
  for the child, pacing, what a non-reader can do without text) and
  **visuals** (icon vs. text-only, color-coding consistency — plus is
  always `#1f7a6f` teal and minus is always `#c04040` red *everywhere* in
  this topic, animation legibility).
- Small, clearly-safe fixes → just make them (update tests if any assert
  the old behavior, `npm run build`, run
  `npx vitest run src/topics/renderers/addition_subtraction/ src/topics/topicLoader.test.js`).
  Bigger or genuinely open tradeoffs (no safe one-line fix, real scope
  decision) → present the finding and options, let the call be made
  explicitly rather than picking a direction unilaterally.
- Before committing: `git status --short`, then
  `git checkout -- tools/figure_capture/figures_gallery.html` — `npm run
  build`'s prebuild step touches this every time regardless of what you
  changed, it's not a real diff.
- `git fetch origin main` and merge before pushing — other sessions have
  been shipping an unrelated `daily_orientation` topic concurrently this
  same day; merges have been clean fast-forwards so far, but check.
- Bump `package.json` (`npm version patch --no-git-tag-version`) before any
  push that changes app behavior (this file/docs-only changes don't need
  it, per `CLAUDE.md`'s own version rule), commit, push to `main` — this
  deploys to Railway immediately, no review gate.
- After pushing, poll `mcp__Railway__get-status` (Railway MCP tool,
  `projectId` `6e0d74c4-09dd-4f99-976a-c28d9a468869`) until
  `mirocard-backend`'s `latestDeployment.status` is `SUCCESS` before telling
  the user it's live.
- `addition_subtraction`'s own deck zip
  (`public/decks/addition_subtraction_v*.zip`) only ever contains
  `tools/addition_subtraction/topic.json` (verified — no compiled renderer
  code in it). Only rebuild+republish it (bump `meta.version`, re-zip,
  update `public/decks/catalog.json`) when a change touches *that json
  file's* mode text/params/`evaluation`/`hideConceptPicker` etc. Pure
  `.jsx`/`.css` changes ship straight through the app bundle — no zip
  rebuild needed.
