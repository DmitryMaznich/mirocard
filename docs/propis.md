# Прописи (propis) topic

Handwriting-practice topic. Fully independent from `letter_writing` ("Написание
букв") — no shared code or data with it, by explicit design decision. Don't touch
`letter_writing` while working on this.

## Status

- **Mode 1 "Учим буквы" (practice) — shipped, live on `main`.** Portrait-locked,
  fullscreen: custom on-screen keyboard (not the system keyboard) at the bottom,
  a large looping handwriting-animation card in the middle.
- **Mode "Написание слов" (write_words) — shipped, live on `main` (deck v1.23.0,
  app v1.0.1841 as of 2026-08-13).** Auto-assembles and animates a full cursive
  *word* from individually hand-captured letters + hand-drawn connector strokes
  between them. See the dedicated section below — this is the actively evolving
  part of the topic; read it before touching anything letter/connector-related.
- **Mode "Пишем текст" (write_text) — shipped, live on `main` (deck v1.23.0, app
  v1.0.1841 as of 2026-08-13).** Free-text multi-line copybook: colored keyboard
  (magnetic_alphabet style) + a wrapping notebook grid that lays words out
  row-by-row, no animation. See its own section below.
- **Mode 2 (in-app PDF export) — not started.** `PropisShowView.jsx` (see below)
  is a dormant starting point for it, not wired to any active mode.
- **Printed letter worksheets (Phase 1) — shipped, live on `main`
  (`print_materials` deck v1.0.12 as of 2026-08-15).** A completely separate
  system from the in-app modes above: standalone Python
  (`scripts/propis_worksheets/`), reusing propis's own captured strokes and
  ruling geometry but generating real print-ready PDFs (not an in-app view),
  registered as new items in the *other* `print_materials` topic
  (`src/print_materials/topic.json`), not this topic's own `topic.json`. See
  its own section below.

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
    point for the PDF-export mode. Its `buildRowGuideLines`-based multi-row
    stacking pattern is what `WriteTextView.jsx` (below) reused for its grid.
  - `WriteTextView.jsx` — the **active** "Пишем текст" (write_text) mode. See
    its own section below.
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
topic (as of 2026-08-13) — read this whole section before adding letters,
connectors, or touching `wordEngine.js`.

### File map (write_words-specific, on top of the shared files above)

- `src/topics/renderers/propis/wordEngine.js` — all the logic: line
  classification, connector/variant selection, trajectory assembly
  (`buildWordTrajectory`, the main export). No React in this file, pure data
  in/out — that's why it's unit-tested directly rather than through the view.
- `src/topics/renderers/propis/wordEngine.test.js` — the spec, in practice.
  298 tests as of the last session (2026-08-13); when in doubt about intended behavior for
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

**Follow-up, same day:** "д"'s drift (above) turned out to have a real fix,
not just a flag. "д" is in `LOWER_ENTRY_LETTERS` (real methodology: same
looping entry as а/б/ф) but wasn't in `ENTRY_LINE_OVERRIDES` — its own raw
capture (entry ~68.67) sits only 0.34 units closer to line 4 than line 3,
so `classifyLine`'s geometric guess missed it and it fell through to a
plain no-connector snap. Added `"д": 3` to `ENTRY_LINE_OVERRIDES`; combined
with the entry-connector rescale above, `"дадада"` now alternates cleanly
between д's and а's own real entry heights (68.67/69.89) with zero
cumulative drift.

**Deliberately not extended to л/м**, despite both also being in
`LOWER_ENTRY_LETTERS`: their own captures already sit almost exactly on
line 4 (75.68, 75.64) — forcing `conn_4_3` onto them would rescale the
connector down to a near-flat sliver instead of an actual loop, since
there'd be almost no vertical distance for it to span. If л/м are ever
recaptured with a real loop entry (i.e. their own raw entry point moves
meaningfully away from line 4), *then* add them to `ENTRY_LINE_OVERRIDES`
to match — don't add the override to a capture that doesn't have a loop to
correct.

**"я" not yet captured** — when it is, check its own raw entry point the
same way before deciding whether it needs the override (it's also in
`LOWER_ENTRY_LETTERS`, but that alone isn't sufficient, as л/м showed).

**Known remaining gap, still not fixed:** any OTHER plain letter that
should methodologically get an entry connector but isn't yet in
`ENTRY_LINE_OVERRIDES` and doesn't happen to classify there by raw geometry
either — the same class of bug "д" was, just not yet found. `MIDDLE_ENTRY_LETTERS`
letters (е,з,ж,г,х,ш,ч,э,в) are NOT expected to need this — их entry
genuinely sits at line 4 already (confirmed for е,з,ж,х: raw entry ≈75).

**Third exception, 2026-08-13 (`f37c8feb`, no-connector direct adjacency):**
the same class of drift also hit the plain **no-connector** junction (two
letters chained by pure translation, no connector piece between them at
all — e.g. "костёр"'s к→о→с→т→ё→р). It previously anchored the next letter
to wherever the previous letter's own raw captured stroke happened to end,
not to the canonical guide line — so a fraction-of-a-unit capture error at
each junction accumulated across the whole word (traced in "костёр":
dy 0 → 0.62 → 1.59 → 1.59 → 2.87 → 2.87 by the time it reached "ё"). Fixed
the same way as the two exceptions above: when there's no connector, the new
letter now snaps to its canonical line (line 4) instead of the previous
letter's raw exit point. This is the general case (far more words hit it
than hit the connector-rescale exceptions above), verified against 100+
words in batches with zero regressions. If a word looks like it's sinking
toward its own end and nothing else changed, this is the first thing to
re-check — trace per-letter `dy` (temporary debug log naming each
letter/connector plus its accumulated dy) before guessing visually.

**"э" loop-exit fix, 2026-08-13 (`149fca39`):** "э" has a real lower loop in
its main body almost like "б"'s, but `getBaselineContacts` was reusing the
same `mainStrokeIndex` as the exit-point lookup, so it only ever searched for
a baseline contact inside "э"'s crossbar stroke — never finding the actual
loop in the body. Letters that continue straight after "э" (т, м, х, ж) rode
up onto the crossbar instead of flowing out of the loop. Fixed by having
`getBaselineContacts` search all of the letter's strokes for the true
baseline approach, not just the one stroke `mainStrokeIndex` points to.

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
   э,ю,ь,ъ: 5}`, `ENTRY_LINE_OVERRIDES = {б,а,о,ф,д: 3}` (see "д" fix below).
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

**Rewritten 2026-08-11** — replaced an earlier `exitType` upper/lower/`"dual"`
height-group model (checked against real captures and found not to hold: the
real letter sets per variant are irregular, e.g. `о_first_l` only takes
л/м/я, not a whole "lower" group). If you find an older description of a
`"dual"` exitType bucket anywhere (design docs, old comments), it's stale —
this is the current behavior:

`buildVariantIndex(lettersByLabel)` scans every letter card for a
`variantOf` field and groups them into `{ first: [], last: {entryType:
card}, middle: { lower: [], upper: [] }, any: [] }`. A middle-position card
with no `entryType` of its own goes into `any` (entryType-agnostic — see
`о_middle_uu`). Each of `first`/`middle.lower`/`middle.upper`/`any` is an
**array**, sorted so a card with a shorter (more specific) `nextLetters`
list is tried first. A middle+`entryType:"upper"` card with `alsoFirst:
true` is pushed into `first` too (see `о_middle_um`).

`resolveVariant(variantIndex, label, position, prevLabel, nextLabel)`:
- `entryType` = `"upper"` **only** when `prevLabel` is itself dual-nature
  (о or ю) — not for б/в/ф/э/ь/ъ or any other letter with its own upper
  `EXIT_LINE_OVERRIDES` entry; confirmed against real captures that none of
  those force an upper entry into о the way an earlier model assumed. Else
  `"lower"` (or `null` if there's no `prevLabel` at all, i.e. this is a
  word-initial dual-nature letter).
- Each card carries its own explicit `nextLetters` list (`topic.json`) —
  there's no shared exitType classification of the *next* letter at all;
  `matchesNext(card)` just checks `card.nextLetters?.includes(nextLabel)`.
- `position === "first"`: `variants.first.find(matchesNext) ||
  variants.any.find(matchesNext) || null`.
- `position === "middle"`: `null` if no `entryType` (word-initial can't
  happen here by definition, but guards it anyway); else
  `variants.middle[entryType].find(matchesNext) ||
  variants.any.find(matchesNext) || null`.
- `position === "last"`: `variants.last[entryType] || variants.last.lower
  || null`. The `|| variants.last.lower` fallback was added **2026-08-13**
  (see the drift/mess bug below) — before that it was just
  `variants.last[entryType] || null`.

**Bug found and partially fixed, 2026-08-13: "ооо"/"оо" rendered as a
garbled, wrongly-placed mess.** Root cause: only `о_last_l` (`entryType:
"lower"`) has ever been captured — there is no `о_last_u`. A word ending in
о preceded by another dual-nature letter (so `entryType` resolves to
`"upper"`) used to get `null` from `resolveVariant`, falling all the way
through to the **plain** о card. That's the dangerous case: the plain
card's own entry point is designed to be reached via the ordinary
`conn_4_3` entry connector (see `ENTRY_LINE_OVERRIDES["о"] = 3`), but
`buildWordTrajectory`'s connector lookup unconditionally skips both the
exit AND entry connector whenever the *previous* letter used a variant
(`prev.usedVariant`, since a variant's own tail is supposed to already
reach the hand-off point) — so the plain о card ended up raw-snapped onto
whatever line the *previous variant's own raw geometry* happened to
classify to (e.g. `о_middle_uu`'s own exit classifies to line 3, y≈62 —
nowhere near the plain card's own baseline-ish expectations), landing the
letter far off-position. Confirmed by instrumenting `buildWordTrajectory`
with a temporary per-letter trace (dx/dy/world-exit) — the standard
technique for this file, see the "костёр" drift investigation above.

**Fix applied**: `variants.last[entryType] || variants.last.lower` — when
no upper-entry last variant exists, reuse the captured `о_last_l` (a real,
coherent о shape with its own proper entry motion) instead of falling all
the way to the un-connectable plain card. Verified live: `"оо"` now renders
cleanly (two well-spaced о's); `"ооо"` is dramatically better (on the
baseline, continuously connected) but still shows mild visual overlap
between the 2nd and 3rd о, because `о_middle_uu`'s own hand-off point was
captured/verified for its declared `nextLetters` (plain letters like
т/к/etc.), not specifically for connecting into `о_last_l`. **Capturing a
real `о_last_u`** is still the correct full fix, and now matters more than
before this was found — it's not just "one gap in a matrix" but the thing
that makes any dual-nature-letter-then-word-final-о sequence look merely
imperfect instead of broken.

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

### Data state as of the last session (2026-08-14, deck v1.23.2)

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

As of v1.23.4:
- **64 plain letters captured — the full lowercase alphabet (all 33) is
  done**, plus 31 of 33 uppercase (missing: Ъ, Ь). Ingested 2026-08-14 across
  two batches (26 new + a re-capture of А, then З separately), normalized
  the same way as every other batch (see "Ingesting new captures" above) —
  `minX` shift per card, `viewBox` set to `0 0 100 150`, no `meta` kept. Й
  and Ё got `mainStrokeIndex: 0` (their last stroke is a decorative mark —
  breve/two dots — not the hand-off point), same reasoning as the existing
  lowercase й/ё cards.
- **Uppercase→next-letter chaining — fixed 2026-08-14 for one methodology
  group, one letter pair still open.** An uppercase letter's own raw
  pen-lift point isn't guaranteed to land near line 4 (y=75, the universal
  hand-off height every lowercase letter's methodology is built around) the
  way lowercase letters do — capital cursive flourishes often end back up
  near the letter's own top or middle, not extending rightward toward the
  next letter. First found via raw `classifyLine` measurement (9 letters
  looked "BAD": Б,Г,Д,О,П,Т,Ф,Э,Ю), but the user corrected this to the real
  methodology grouping: **Б,В,Г,Д,З,О,Р,У,Ф,Э,Ю take the same line5→line4
  hook-back exit** regardless of where this particular capture sample's raw
  stroke happens to end (same reasoning as the existing lowercase
  б/в/ф/о/ю/ь/ъ/э entries above — a capture-quality artifact, not a
  methodology difference). Added to `EXIT_LINE_OVERRIDES` as separate
  (case-sensitive) uppercase keys, then the user captured and sent a
  **dedicated uppercase-scoped connector, `conn_5_4_upper`** (own shape,
  `forLetters` restricted to that exact 11-letter group — explicitly NOT a
  replacement for the existing default `conn_5_4`, which lowercase letters
  and any other uppercase letter still use unchanged). Confirmed live:
  "Дом"/"Юля"/"Ваня"/"Гена"/"Забор"/"Рома" all chain cleanly now with the
  real capital-shaped connector.

  **П and Т — fixed differently, same day, no new connector needed** (user
  correction: these two don't belong in the 5→4 group at all — after them,
  just the ordinary 4→3 connectors already used for lowercase, long/looping
  and short/straight versions). Root cause turned out to be the same class
  of bug as Й/Ё (see above): both are 3/4-stroke letters whose LAST-drawn
  stroke is the decorative top crossbar, not the real hand-off point — its
  own endpoint sits high in the ascender zone (y≈39, classifying to line 2,
  same symptom as the original "BAD" measurement), while an EARLIER stroke
  (the actual leg the pen lifts off from) already lands right on line 4
  (П: stroke 1 at y=74.8; Т: stroke 2 at y=74.5) with zero correction
  needed. Set `mainStrokeIndex: 1` (П) / `mainStrokeIndex: 2` (Т) — once
  their exit classifies to line 4 like most other letters, the existing
  entry-connector lookup for whatever comes next (`conn_4_3` vs
  `conn_4_3_straight`, chosen by the NEXT letter same as always) just
  works, no new data needed. Confirmed live: "Паша"/"Тоня" now chain
  cleanly.
- **о has 9 variant cards**: `о_first_l`, `о_first_u`, `о_middle_ll`,
  `о_middle_lu`, `о_middle_uu`, `о_middle_ul`, `о_middle_um`, `о_middle_lm`,
  `о_last_l`. **Still not captured**: an upper-entry `о_last` variant (the
  last remaining gap in о's own matrix — see the "Dual-nature letter variant
  resolution" section above for the real bug this caused and the 2026-08-13
  code-level mitigation; capturing `о_last_u` is still the full fix).
  `isolated` position never has a variant by design (falls back to plain
  "о" always).
- **ю has zero variant cards** — every position/neighbor combination
  currently falls back to the plain "ю" card. Same variant system already
  supports it the moment cards are captured (`DUAL_NATURE_LETTERS` already
  includes it) — no code changes needed, only capturing + ingesting.
- **4 connectors**: `conn_5_4` (universal exit, line5→line4, no
  `forLetters`), `conn_4_3` (looping entry for о/а/б/ф family, line4→line3,
  no `forLetters`), `conn_4_3_straight` (straight-diagonal entry, line4→line3,
  `forLetters`: и,п,р,к,у,ю,ь,ы,ш,щ,н,ц,й,т,э), `conn_5_4_upper` (uppercase
  hook-back exit, line5→line4, `forLetters`: Б,В,Г,Д,З,О,Р,У,Ф,Э,Ю — added
  2026-08-14, does NOT replace `conn_5_4`, which every other letter still
  uses).

### Natural next steps (not yet requested, just visible gaps)

- Capture the last 2 uppercase letters — Ъ, Ь — to close the alphabet
  (31/33 done as of 2026-08-14). Each still falls back to a system-font
  glyph in write_text until captured. **The uppercase→next-letter chaining
  gap is now fully resolved** (5→4 group + П/Т's mainStrokeIndex fix, both
  2026-08-14) — no remaining known chaining issue for any captured
  uppercase letter.
- Capture `ю`'s variants (same shape work as `о`, just for a different
  letter) — or decide `ю` is rare enough in practice that the fallback is
  fine indefinitely.
- Capture an upper-entry `о_last` variant to close the one remaining gap in
  о's own matrix — no longer just cosmetic: this is what makes a word ending
  in о preceded by another dual-nature letter (е.g. "ооо", "юо") render with
  a real captured shape instead of the current `о_last_l`-reused-as-a-
  fallback mitigation (fine for 2 consecutive о's, still visibly overlapping
  for 3+ — see the resolveVariant section above).
- `WriteWordsView.jsx`'s `try/catch` around `buildWordTrajectory` silently
  shows nothing on error (missing letter) — no user-facing message. Minor
  polish item, not a correctness bug, low priority unless it confuses
  testers. (`WriteTextView.jsx`'s per-word/per-segment handling degrades
  more gracefully — see below — so this gap is now specific to write_words.)

## Mode: Пишем текст (write_text)

Free-text multi-line copybook. No animation — words appear immediately,
laid out row-by-row on a notebook grid, wrapping to the next row when a
word wouldn't fit on the current one. Built 2026-08-13, reusing
`buildWordTrajectory` (word geometry) from write_words and
`buildRowGuideLines` (multi-row ruling) from the dormant `PropisShowView.jsx`
— the missing piece, written from scratch, is the row-packing/wrap logic.

### File map (write_text-specific)

- `src/topics/renderers/propis/WriteTextView.jsx` — the view: colored
  on-screen keyboard (magnetic_alphabet-style rows/coloring, QWERTY/ЙЦУКЕН
  layout + a single Shift key instead of separate case buttons, digit row,
  `! ? . ,`), text buffer, calls the row-layout function per keystroke.
- `layoutTextIntoRows` (in `wordEngine.js`, alongside `buildWordTrajectory`)
  — given the current text and a row-width budget, buckets words into rows
  and computes each word's `(rowIndex, xOffset)`. Unit-tested directly.

### Honest ink width, not nominal glyph-box width

Word spacing and line-wrapping both depend on measuring word width. The
first version measured each letter's nominal 100-unit `viewBox` width, but
real ink typically only occupies 15–55 of those 100 units — the rest is
blank canvas margin baked into every captured glyph. Using the nominal
width made inter-word gaps huge (an invisible "tail" accumulated after
every word) and made the wrap point land a full word too early. Fixed by
computing each letter's real `inkWidthUnits` from its actual stroke
geometry; the inter-word gap is now the median ink width across all
letters (≈33 units, roughly "one letter"), which reads as a normal space.

### Characters without captured cursive strokes

Digits (0–9) and punctuation (`! ? . ,`) have no hand-captured cursive
strokes at all — by design, this stays a system-font fallback glyph
rendered at the baseline, not a data-capture backlog item (confirmed with
the user; unlike missing letters, this isn't "not captured yet"). The same
fallback also covers any uppercase letter beyond А/Б/В/Г (a real capture
gap, see "Natural next steps" above) so a single missing/uncaptured
character degrades to one system-font glyph inline instead of dropping the
whole word/segment, unlike `WriteWordsView.jsx`'s all-or-nothing
`try/catch`.

## Printed letter worksheets (Phase 1)

Standalone print pipeline, not part of the in-app renderer at all — no
React, no `topics/renderers/propis/` code involved. Design spec:
`docs/superpowers/specs/2026-08-14-propis-letter-worksheets-design.md`;
implementation plan (task-by-task, including the exact code):
`docs/superpowers/plans/2026-08-14-propis-letter-worksheets.md`.

**What it is:** one A5 tracing page per letter — 2 rows of the lowercase
alone, 1 row of the uppercase alone, 2 rows of the lowercase+uppercase pair
together — each row filled edge-to-edge with fading repetitions (dark
model → mid-gray → light-gray) and a clean blank tail for independent
writing. Pages are grouped by graphomotor complexity (shared stroke
element), not alphabetical or sound order, confirmed with the user:

1. Крючок — и, л, м, ш
2. Крючок + доп. штрих — п, т, ц, щ
3. Овал — а, е, ё, о, с, э
4. Петля — б, в, д, з, у, ф
5. Составные формы — г, ж, к, н, х, ч, ю, я
6. Особые формы — й, р, ъ, ы, ь (Ъ/Ь: lowercase-only, no real capitalized
   form in practical use)

Every group is its own imposed, fold-and-staple A4-landscape booklet PDF
(same physical assembly as `print_materials`'s existing notebooks), and
registered as a `worksheets`-category item in the *separate*
`src/print_materials/topic.json` (not this topic's own).

### File map

- `scripts/propis_worksheets/svg_path.py` — parses a captured stroke's `d`
  string (M/L/C, including the SVG implicit-lineto-after-moveto shorthand)
  into reportlab draw commands + bounding boxes. Pure logic, real pytest
  unit tests (`test_svg_path.py`).
- `scripts/propis_worksheets/letter_groups.py` — the 6 groups above, as
  data.
- `scripts/propis_worksheets/render.py` — draws one letter instance onto a
  reportlab canvas, scaled from the app's native coordinate system
  (`propisRuling.js`'s own `UNIT_H`/baseline) into real mm. No
  connector-chaining at all — every instance is an isolated single letter
  (even the "paired" row is two independent letters placed side by side,
  never joined by a connecting stroke).
- `scripts/propis_worksheets/page.py` — one A5 page's ruling + header +
  practice rows. Registers a Cyrillic-capable font (reportlab's built-in
  Helvetica has no Cyrillic glyphs — headers rendered as solid boxes
  without this, same fallback chain as `scripts/cover_tetrad.py`).
- `scripts/propis_worksheets/booklet.py` — saddle-stitch imposition
  (`_imposition_order`, unit-tested against hand-verified n=4/n=8 cases).
- `scripts/propis_worksheets/build.py` — CLI: `python build.py` (all
  groups) or `python build.py N` (just group N) → `output/propis_worksheets_groupN.pdf`.

### Gotchas hit building this (2026-08-15)

- **`canvas.showPage()` resets any transform set outside a
  `saveState`/`restoreState` pair** — a `canvas.scale(mm, mm)` call before
  the page loop only affects the FIRST page; every later page silently
  draws in points instead of mm. `booklet.py`'s `draw_slot` re-applies
  `scale(mm, mm)` inside its own `saveState`/`restoreState` for every A5
  slot specifically because of this — don't hoist it back out.
- **The SVG path parser needs to handle implicit lineto repetition.** A
  real captured stroke like `"M 14.15 57.05 14.16 56.66"` is a moveto
  followed by an IMPLICIT lineto (a coordinate pair with no command
  letter) — legal per the SVG spec, and real data uses it. The original
  "every M/L/C has exactly its own arity, nothing left over" parser
  crashed on this generating group 2. While fixing it, also found the
  tokenizer regex only matched `[MLC]` and silently DROPPED any other
  letter (e.g. a hypothetical arc command `A`) instead of raising —
  previously masked by the strict-arity parser choking on the orphaned
  numbers anyway, by accident rather than by design. Both fixed together;
  see `svg_path.py`'s own comments.
- **`ClassRoomCursive.ttf`** (used by `scripts/cover_tetrad.py`'s notebook
  covers) turned out to be visually very close to propis's own captured
  cursive style — confirmed with a side-by-side render during
  brainstorming — but the user deliberately chose to render from the real
  captured strokes anyway (SVG→PDF), specifically for pixel-consistency
  with what the app itself animates, accepting the extra parser/imposition
  work that requires.
- **`src/print_materials/print/` and `thumbnails/` are gitignored**
  (matched by the repo's blanket `*.png` rule and never explicitly
  tracked) — only `topic.json`, `public/decks/catalog.json`, and the
  packaged `public/decks/print_materials_vX.Y.Z.zip` itself get committed;
  regenerate the rest via `python make_print_zip.py` rather than trying to
  hand-edit or commit source PDFs/PNGs directly.

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
