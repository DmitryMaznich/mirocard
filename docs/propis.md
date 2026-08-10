# Прописи (propis) topic

Handwriting-practice topic. Fully independent from `letter_writing` ("Написание
букв") — no shared code or data with it, by explicit design decision. Don't touch
`letter_writing` while working on this.

## Status

- **Mode 1 "Учим буквы" (practice) — shipped, live on `main`.** Portrait-locked,
  fullscreen: custom on-screen keyboard (not the system keyboard) at the bottom,
  a large looping handwriting-animation card in the middle.
- **Mode "Написание слов" (write_words) — shipped, live on `main` (deck v1.22.0,
  app v1.0.1806 as of 2026-08-10).** Auto-assembles and animates a full cursive
  *word* from individually hand-captured letters + hand-drawn connector strokes
  between them. See the dedicated section below — this is the actively evolving
  part of the topic; read it before touching anything letter/connector-related.
- **Mode 2 (PDF export for print) — not started.** `PropisShowView.jsx` (see below)
  is a dormant starting point for it, not wired to any active mode.

## File map

- `src/topics/renderers/propis/`
  - `propisRuling.js` — single source of truth for the ruling geometry (row zones,
    baseline position, letter scale factor). Read this first before changing
    anything visual; both views import from it.
  - `LoopingLetterCell.jsx` — renders one letter/element, animated, looping
    forever until unmounted. Shared by both views.
  - `PropisPracticeView.jsx` — the **active** mode ("Учим буквы").
  - `PropisShowView.jsx` — **dormant**, not routed to by any mode in
    `tools/propis/topic.json`. Full-page multi-row layout, kept as the starting
    point for the PDF-export mode.
  - `index.jsx` — routes `task.type` to the right view.
  - `engine.js` — `generateTasks(mode, cards)`; trivial, just passes filtered
    cards through as `items`.
  - `propis.css` — paper/ink colors are intentionally NOT tied to any theme
    toggle (this app has no dark mode anyway, but even so: paper is always
    light/white, never reversible).
- `tools/propis/topic.json` — source manifest (meta/modes/cards). Edit this,
  then rebuild the zip (see below) and bump `public/decks/catalog.json`'s
  `propis` entry (`version` + `url`) to match.
- `public/decks/propis_vX.Y.Z.zip` — just `topic.json` zipped alone, no media
  folder. This topic's renderer is code-owned (compiled into the app itself,
  registered in `src/topics/registry.js` / `engineRegistry.js`), not a dynamic
  plugin, so the deck doesn't need to ship renderer code the way e.g.
  `tools/comparison`/`tools/symmetry_draw` do.
- `tools/letter_capture/handwriting_capture.html` — standalone, offline tool for
  capturing new letters/elements by hand (phone or desktop), plus connectors
  (see the write_words section below). Exports a JSON array
  (`type/label/viewBox/strokes`, or `type/label/fromLine/toLine/strokes` for a
  connector) that gets merged into `topic.json`'s `cards` by hand (no UI for
  merging — always a one-off ingestion script, see write_words section).
  Permanently hosted at `https://mirocard.kaplieva.help/letter_capture.html`
  (synced from this source file on every build via
  `scripts/sync-capture-tool.mjs`, wired as `package.json`'s `prebuild` — edit
  the source here, never the `public/` copy, which is gitignored). Has its own
  fullscreen forced-landscape drawing mode.
- Current letter/connector/variant inventory: see "Data state as of the last
  session" in the write_words section below — it goes stale fast, don't trust
  a remembered count, regenerate it (one-liner given there).

## Key design decisions (why, not just what)

- **Row ruling**: one row = 4 lines / 3 gaps, top to bottom: line, 10mm, line,
  5mm ("узкая строка"), line **(= baseline, bold)**, 10mm, line. Total 25mm, no
  margin before the first line or after the last.
- **Letter scale**: letters are scaled so their own x-height body (units 62–88,
  i.e. 26 units, in the original font-formation "2:1:2" system every captured
  letter's path data was extracted against) matches the ruling's узкая строка
  (5mm) exactly — not the letter's whole 150-unit box against the whole row,
  which would underscale the body (ascenders/descenders eat into that 150
  units too).
- **Baseline anchor**: letters are re-*positioned* (never re-drawn/re-scaled
  per-glyph) so their baked-in baseline (unit 88) lands exactly on the
  ruling's bold baseline line. Pure translate, letter geometry itself is
  never touched.
- **Diagonal slant**: 65°-from-horizontal, matches
  `make_lined_paper_landscape_standard.py`. Must lean "/" (bottom-left to
  top-right — right-leaning cursive). That PDF script computes it in
  bottom-up PDF coordinates; SVG is top-down, so reusing its `(x, x+dx)` pair
  unmodified mirrors the slant. See the swap in `buildDiagonalLines`.
- **Ruling line thickness on the practice card**: the card is a stylised
  zoomed-in crop (`CARD_W_MM`), not real page scale — its stroke-widths are
  computed proportionally to its own `CARD_W_MM` (`STROKE_SCALE` in
  `PropisPracticeView.jsx`), not hardcoded absolute mm. If `LINE_MM` changes
  again, this auto-adjusts. Don't hand-tune stroke-width numbers directly —
  changing crop width silently doubles/halves on-screen thickness even when
  the mm value in the CSS doesn't change (this caused several rounds of "still
  too thick" bugs — see git history on `propisRuling.js`/`propis.css` for the
  full story if you need the reasoning).
- **Capture tool export quirk**: a letter exported from
  `handwriting_capture.html` is not guaranteed to start at x=0 in its 3-slot
  canvas (`viewBox="0 0 300 150"`) — "а" was found at x≈197–220 (slot 2/3),
  not slot 1. Always check/normalize each new letter's stroke bounding box
  (shift so it starts at x=0) before adding it as a card — see the git commit
  "Add captured letters А, а, Г, г" for the normalization approach. Root cause
  in the capture tool itself not yet found.

## Mode: Написание слов (write_words)

Auto-assembles a full cursive **word** at runtime from individually
hand-captured single letters plus hand-drawn connector strokes, and animates
it as one continuous pen path. This is the actively evolving part of the
topic (as of 2026-08-10) — read this whole section before adding letters,
connectors, or touching `wordEngine.js`.

### File map (write_words-specific, on top of the shared files above)

- `src/topics/renderers/propis/wordEngine.js` — all the logic: line
  classification, connector/variant selection, trajectory assembly
  (`buildWordTrajectory`, the main export). No React in this file, pure data
  in/out — that's why it's unit-tested directly rather than through the view.
- `src/topics/renderers/propis/wordEngine.test.js` — the spec, in practice.
  274 tests as of the last session; when in doubt about intended behavior for
  an edge case, check here before asking or re-deriving it from scratch.
- `src/topics/renderers/propis/pathGeometry.js` — generic SVG path helpers
  used by wordEngine.js: `getPathEndpoints`, `samplePath`, `transformPathD`,
  `findClosestApproach`. No propis-specific knowledge lives here.
- `src/topics/renderers/propis/WriteWordsView.jsx` — the view: on-screen
  keyboard + word buffer, builds `lettersByLabel`/`connectorsByKey` from
  `task.letters`/`task.connectors` and calls `buildWordTrajectory`.
- `src/topics/renderers/propis/WordAnimatedCard.jsx` +
  `useLoopingStrokes.js` — plays the assembled trajectory as one looping
  animation, respecting each stroke's `continuous` flag (no pen-lift pause
  for connector pieces or a letter's first stroke when it continues an
  incoming connector).
- `tools/propis/topic.json` — same manifest as the practice mode; letter
  cards are shared between modes, connector/variant cards are write_words-only
  (practice mode's `engine.js` just doesn't filter them in, so no explicit
  exclusion was needed).

### Architecture: exact-snap, no bridge

Every junction — connector→connector, connector→letter, or letter→letter
with no captured connector on either side — is a direct **translation** so
one piece's own endpoint becomes the next piece's own startpoint exactly,
both axes. There is no bridge stroke and no fixed gap ever inserted. Letters
themselves ARE allowed to shift vertically (not just horizontally) to make
this work.

This was a deliberate choice over an earlier "letter never moves vertically,
a residual bridge absorbs the mismatch" design, made explicitly with the
user after showing the geometry doesn't allow both "letter never drifts" and
"no bridge" and "exact match everywhere" simultaneously, given translate-only
connector pieces. Consequence accepted knowingly: any mismatch between two
independently hand-drawn connector pieces is now a **capture-quality
problem**, not something code papers over — if two letters chained through
both an exit and an entry connector visibly drift apart or together, the fix
is recapturing one of the two connector pieces more carefully, not adding
smoothing code back.

**Exception, 2026-08-10 (`placeExitConnector` in `wordEngine.js`):** an exit
connector's far end is now Y-rescaled (not just translated) to land exactly
on its own canonical `toLine`, instead of wherever its captured shape happens
to reach. Reached after б/в/о/`conn_5_4` were recaptured twice and the
EMA-smoothing bug in the capture tool was fixed (see its section below) and
the drift *still* didn't close — every letter after an exit-override letter
kept landing ~2 native units above line 4. Root cause turned out not to be
capture quality at all: the reference font path itself for "в" only reaches
y=86.23, never the nominal 88, so no amount of recapturing could have hit
the old implicit target. The near end (anchored to the previous letter's
real baseline-contact point) is untouched — only the connector's own
internal Y-reach is corrected, via an affine scale, so its curve gets gently
steeper/shallower rather than just landing wrong. Every *other* junction in
`buildWordTrajectory` is still a pure exact-snap with zero correction — this
exception is scoped specifically to exit connectors, because they're the
only piece whose far endpoint becomes an anchor for whatever comes next
without anything downstream to correct it.

**Second exception, same day (`placeEntryConnectorLocal`):** entry
connectors got the mirror-image bug and the mirror-image fix. Their END is
correctly anchored to the next letter's own real entry point already (no
change needed there), but their START previously landed wherever the
connector's own captured shape put it — not on the connector's own
canonical `fromLine`. Repeating the same entry-connector letter (e.g.
"аааааа") silently carried a small per-repetition mismatch into every next
junction: rebuilding the trajectory letter-by-letter showed each "а" landing
exactly 1.01 native units higher than the last (69.89, 68.88, 67.87, …) —
a clean, deterministic drift, not noise. Fixed the same way: START is now
Y-rescaled to land exactly on the connector's own `fromLine`, END stays
exactly on the letter's real entry point. Verified in a live dev-server
render (not just the standalone script) that repeated "а" now lands at the
same Y every time with zero drift.

**Known remaining gap, not yet fixed:** plain letter-to-letter junctions
with *no* connector on either side (e.g. "д", which isn't in
`EXIT_LINE_OVERRIDES`/`ENTRY_LINE_OVERRIDES`) still have zero correction —
`"дадада"` still drifts (68.67 → 69.89 → 75.00 → 76.22 → 81.33 → 82.55,
downward this time) because that letter's own raw entry and exit points
genuinely differ, and nothing re-anchors it to any canonical line the way a
connector now does. Whether that's a real capture issue (recapture so
entry/exit heights match) or something code should also correct is an open
question — flagged, not decided.

### Data model

**Plain letter card**: `{ type: "letter", id, label, category, viewBox: "0 0
100 150", strokes: [{ d }] }`. `label` (not `id`) is what the engine keys
letters by — must be the literal lowercase Cyrillic character. Multi-stroke
letters (к, х, ё, Б with crossbar) are supported; strokes stay separate
pen-lifts unless explicitly marked `continuous`.

**Variant letter card** (dual-nature letters only — see below): adds
`variantOf` (base letter this is a variant of, e.g. `"о"`), `position`
(`"first" | "middle" | "last"`), and `entryType`/`exitType`
(`"lower" | "upper" | "dual"`, only the ones relevant to that `position` — see
resolution algorithm below).

**Connector card**: `{ type: "connector", id, label, fromLine, toLine,
viewBox, strokes, forLetters? }`. `fromLine`/`toLine` are the numbered guide
lines (see `propisRuling.js`'s `GUIDE_LINES` / the capture tool's on-canvas
numbers 1–7, plus non-integer "3½"/"4½" quarter-lines) the connector visually
runs between — this is a lookup key, **not** a promise the connector's own
endpoints land exactly on those Y coordinates (see "translate-only, never
rescaled" note in `placeExitConnector`/`placeEntryConnectorLocal`). Optional
`forLetters: [label, ...]` restricts this card to those destination letters
only — see "Multiple connectors per line pair" below.

### Classification tables (all in `wordEngine.js`, top of file)

Two **independent** classification systems, easy to conflate — don't:

1. **`EXIT_LINE_OVERRIDES` / `ENTRY_LINE_OVERRIDES`** — which numbered line a
   letter's own connecting stroke is treated as attaching to, overriding the
   raw geometric guess (`classifyLine` on the letter's own captured
   endpoint). Exists because real hand captures vary where the pen happens to
   lift/land even for letters that take the same connector by methodology
   (е.g. б and в's actual sample strokes end at different raw Y, but both
   need the same exit connector). Currently: `EXIT_LINE_OVERRIDES = {б,в,ф,о,
   э,ю,ь,ъ: 5}`, `ENTRY_LINE_OVERRIDES = {б,а,о,ф: 3}`.
2. **`UPPER_ENTRY_LETTERS` / `MIDDLE_ENTRY_LETTERS` / `LOWER_ENTRY_LETTERS` /
   `DUAL_NATURE_LETTERS`** — real Russian cursive methodology's
   classification of where a letter's **own first stroke** begins (used only
   to resolve what shape a dual-nature letter's own entry/exit should take,
   never for anything else). Sources: studfile.net/preview/9752060,
   poznayka.org/s52463t1, runninglines.ru/verhnee-soedinenie (cross-referenced
   during the session that added this — see commit history on `wordEngine.js`
   around 2026-08-09 if the "why" needs re-deriving). о and ю are the two
   letters with **no fixed group** — they adapt their own shape to whichever
   neighbor requires, which is why they're the only letters with multiple
   captured connection variants.

### Dual-nature letter (о, ю) variant resolution

`buildVariantIndex(lettersByLabel)` scans every letter card for a
`variantOf` field and groups them by `{ first: {exitType: card}, last:
{entryType: card}, middle: {"entryType_exitType": card} }`.

`resolveVariant(variantIndex, label, position, prevLabel, nextLabel)`:
- `entryType` = `"upper"` if `prevLabel` is one of `EXIT_LINE_OVERRIDES`'s
  keys, else `"lower"`.
- `exitType` = height group of `nextLabel` simplified to upper/lower
  (`"lower"` stays `"lower"`, everything else — including `"middle"` group
  letters and unclassified letters — defaults to `"upper"`, since no
  middle-height exit variant has been captured for any dual-nature letter
  yet).
- **Exception**: if `nextLabel` is itself dual-nature (о followed by о/ю), a
  dedicated `"dual"` exitType bucket is tried FIRST, falling back to the
  ordinary upper/lower bucket if no dedicated capture exists for that
  entryType. Rationale: handing off into another dual-nature letter draws
  differently than handing off into a genuine fixed upper-entry letter, even
  though both currently classify the same way.
- Returns `null` (→ caller falls back to the plain isolated card + ordinary
  connector system) whenever the needed variant hasn't been captured, so
  missing combinations degrade gracefully instead of crashing or looking
  wrong in an obvious way — always safe to add letters/words without having
  captured every variant first.

**To regenerate the exact current resolution matrix** (don't trust a
remembered table — it drifts every time a variant is added/removed):
temporarily `export` `buildVariantIndex`/`resolveVariant` from
`wordEngine.js`, write a throwaway script that calls them with representative
neighbor labels for each bucket, run it, then `git checkout --` the file to
drop the temporary exports. (This is genuinely the fastest reliable way —
done repeatedly during the 2026-08-09/10 session.)

### Multiple connectors per line pair (`forLetters`)

`connectorsByKey` (built in `WriteWordsView.jsx`) is keyed by
`` `${fromLine}_${toLine}` `` and stores an **array** of candidate cards per
key, not a single card — because more than one connector can legitimately
share a line pair. Real case: о/а/б/ф's looping entry connector and a
straight-diagonal-first-stroke letters' entry connector (и, п, р, к, у, ю,
ь, ы, ш, щ, н, ц, й) both go line4→line3, but need visibly different shapes.

`pickConnector(candidates, letterLabel)` in `wordEngine.js` picks the first
candidate whose `forLetters` includes the destination letter, else falls
back to the one candidate with **no** `forLetters` (the default). A card with
`forLetters` is *only* used for those letters — never the default for
anything else. `letterLabel` passed in is the current letter for an entry
connector, or the previous letter for an exit connector (`prev.label`, now
tracked in `buildWordTrajectory`'s `prev` accumulator).

**Before adding a new connector**, check whether its `fromLine`/`toLine`
pair already has a card — if so, decide explicitly whether it should replace
that card (only safe if it's a strict improvement for everyone currently
using it) or needs its own `forLetters` list (safer, always ask which
letters it should own if the split isn't obvious from what's being
captured).

### Ingesting new captures (no UI — always a one-off script)

The capture tool exports raw JSON with `strokes[].d` in absolute canvas
coordinates (`viewBox="0 0 300 150"`, 3 slots wide) — never inserted into
`topic.json` as-is. Every session so far has written a throwaway Node
script (delete after running) that:

1. Loads the uploaded JSON + current `tools/propis/topic.json`.
2. Computes `minX` across **all** coordinates of **all** strokes of the card
   together (not per-stroke — multi-stroke letters like к/х must keep their
   strokes' relative positions to each other), shifts everything by `-minX`
   so the card starts flush at x=0. This is a direct shift, not slot-boundary
   quantization — that approach was tried once and abandoned (a "д" capture
   landed mid-slot, not flush-left, unreliable).
3. Builds the full card object (`id`, `type`, `label`, plus
   `variantOf`/`position`/`entryType`/`exitType` for a variant, or
   `fromLine`/`toLine`/`forLetters` for a connector) and either replaces an
   existing card with the same `id` or pushes a new one.
4. Bumps `topic.meta.version` (patch bump, e.g. `1.21.0` → `1.22.0`).

Then: `node scripts/build-propis-deck.mjs` (rebuilds the zip + updates
`public/decks/catalog.json` to the new version — never hand-edit either),
`npx vitest run src/topics/renderers/propis` (full suite must stay green),
commit, then deploy only after explicit user confirmation (`npm run
deploy:prod` — this bumps the *app's* patch version separately from the
deck's own version and pushes to `origin/main`).

**Ambiguous capture labels/instructions — ask, don't guess.** Several
sessions have hit ad-hoc label schemes (e.g. `онн`/`онв`/`овв` for о's
variants) or a connector reusing an existing line-pair key — always confirm
the intended meaning with the user before writing it into the data model;
guessing wrong here is expensive to unwind later (baked into a versioned
deck + possibly already deployed).

### Data state as of the last session (2026-08-10, deck v1.22.0)

Regenerate this — don't trust it once more captures land:

```bash
node -e "
const t = require('./tools/propis/topic.json');
const letters = t.cards.filter(c => c.type === 'letter' && !c.variantOf).map(c => c.label).sort();
const variants = t.cards.filter(c => c.variantOf);
const connectors = t.cards.filter(c => c.type === 'connector');
console.log('version', t.meta.version, '| plain letters', letters.length, letters.join(' '));
console.log('variants:', variants.map(c => c.id).join(', '));
console.log('connectors:', connectors.map(c => c.id + JSON.stringify(c.forLetters || '')).join(', '));
"
```

As of v1.22.0:
- **25 plain letters captured**: а б в г д е ж з и к л м н о п р с т у х ё,
  plus uppercase А Б В Г. **Missing from the full alphabet: й ф ц ч ш щ ъ ы ь
  э ю я** (12 letters) — words using these fall back to
  `buildWordTrajectory` throwing (uncaught in `WriteWordsView.jsx`, which
  just swallows the error and shows nothing — see its `try/catch`).
- **о has 7 variant cards**: `о_first_l`, `о_first_u`, `о_middle_ll`,
  `о_middle_lu`, `о_middle_uu`, `о_middle_ld` (dual-exit), `о_last_l`.
  **Not yet captured**: `о_middle_ul` (entry upper, exit lower — the 4th
  middle combo) and any `last`-position variant with `entryType: "upper"`.
  `isolated` position never has a variant by design (falls back to plain
  "о" always).
- **ю has zero variant cards** — every position/neighbor combination
  currently falls back to the plain "ю" card. Same variant system already
  supports it the moment cards are captured (`DUAL_NATURE_LETTERS` already
  includes it) — no code changes needed, only capturing + ingesting.
- **3 connectors**: `conn_5_4` (universal exit, line5→line4, no
  `forLetters`), `conn_4_3` (looping entry for о/а/б/ф family, line4→line3,
  no `forLetters`), `conn_4_3_straight` (straight-diagonal entry for
  и/п/р/к/у/ю/ь/ы/ш/щ/н/ц/й, line4→line3, `forLetters` set).

### Natural next steps (not yet requested, just visible gaps)

- Capture the remaining 12 letters so arbitrary words stop throwing.
- Capture `ю`'s variants (same shape work as `о`, just for a different
  letter) — or decide `ю` is rare enough in practice that the fallback is
  fine indefinitely.
- Capture `о_middle_ul` and an upper-entry `о_last` variant to close the
  remaining gaps in о's own matrix.
- `WriteWordsView.jsx`'s `try/catch` around `buildWordTrajectory` silently
  shows nothing on error (missing letter) — no user-facing message. Minor
  polish item, not a correctness bug, low priority unless it confuses
  testers.

## Verifying visual changes locally (no full app flow needed)

Installing the deck through the app's catalog + picking cards + starting a
session is slow for iterating on visuals. Faster loop:

1. Create a throwaway `dev-propis.html` (bare HTML, `<div id="root">` +
   `<script type="module" src="/src/dev-propis-preview.jsx">`).
2. Create a throwaway `src/dev-propis-preview.jsx` that `createRoot`s
   `<PropisRenderer task={{ type: "practice", items: [...] }} onAdvance={...}
   onClose={...} />` directly, with `items` hardcoded from
   `tools/propis/topic.json`'s cards.
3. `npx vite --host 0.0.0.0 --port 8080`, open `/dev-propis.html`, screenshot
   (Playwright works headless for this).
4. **Delete both throwaway files before committing** — never commit them.
