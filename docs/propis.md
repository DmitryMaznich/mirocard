# Прописи (propis) topic

Handwriting-practice topic. Fully independent from `letter_writing` ("Написание
букв") — no shared code or data with it, by explicit design decision. Don't touch
`letter_writing` while working on this.

## Status

- **Mode "Учим буквы" (practice) and "Написание слов" (write_words) — removed
  from the mode picker 2026-09-13 (`tools/propis/topic.json` deck v1.25.0),
  soft removal only.** User request: only `write_text`/`read_text`/`read_lines`
  (the modes where content ends up on a real or on-screen tetrad page — direct
  typing-practice with no page context wasn't wanted anymore) stay selectable.
  Their mode objects were dropped from `topic.json`'s `modes` array; nothing
  else touched — `PropisPracticeView.jsx`, `WriteWordsView.jsx`,
  `LoopingLetterCell.jsx`, `WordAnimatedCard.jsx`, and the `engine.js`/
  `index.jsx` branches for `"practice"`/`"write_words"` are all still in the
  codebase, just unreachable (dormant), mirroring the existing
  `PropisShowView.jsx` precedent below. `wordEngine.js`'s letter/connector/
  dual-nature-variant resolution logic (`buildWordTrajectory` etc.) is
  untouched and still load-bearing — `write_text`/`read_text`/`read_lines`
  all depend on it for rendering handwriting, this only removed
  `write_words`' own UI from the picker. Re-adding either mode later is a
  one-line `topic.json` edit, no code to restore.
- **Mode "Пишем текст" (write_text) — shipped, live on `main` (deck v1.23.0, app
  v1.0.1841 as of 2026-08-13).** Free-text multi-line copybook: colored keyboard
  (magnetic_alphabet style) + a wrapping notebook grid that lays words out
  row-by-row, no animation. See its own section below.
- **Mode "Переписываем текст в тетрадь" (read_text, renamed 2026-09-14 from "Пишем
  текст с экрана" — deck v1.25.1) — shipped, live on `main`, previously
  undocumented here (code comments dated 2026-08-19/20/21).** Read-only sibling
  of `write_text`: full-screen notebook grid with pre-selected text(s) already
  written in cursive (`ReadTextView.jsx`), no keyboard — content is picked in
  the params screen from a preset list (`topic.json`'s `texts[]`) or typed/
  uploaded as a custom multi-line text. Tap a word to toggle its handwriting
  animation on/off. See its own section below.
- **Mode "Тетрадный лист" (read_lines/print_page) — shipped 2026-09-13,
  rewritten same day.** Content is authored via a structured line-by-line
  constructor in the params screen (`LineListParam`) instead of picking a
  whole text — one input per notebook row, each row can be a single letter,
  a syllable, a word, or several words. Own view (`PrintPageView.jsx`), not
  a `read_text` reuse: real print-page geometry (17 rows/page, red margin
  line, A5-proportioned page, mirrored left/right slots) and a working "🖨
  Печать" → `window.print()` PDF export, real print-to-PDF verified
  end-to-end. See its own section below.
  **Fixed 2026-09-13: blank space above/below the page on a narrow (phone
  portrait) screen.** `.propis-print-page-svg`'s CSS was `height:100%;
  width:auto; max-width:100%; aspect-ratio:148.5/210` — correct only when
  the container's height binds first (a wide/short tablet-landscape screen:
  auto width always lands under max-width there, so it never clips). On a
  narrow/tall phone screen `height:100%` instead pins the box to the full
  available height regardless of width, so the aspect-ratio-computed width
  overflows and gets clamped by `max-width` while height stays put — the box
  ends up taller than its correct proportions, and since the SVG's own
  content still preserves the real aspect ratio internally (viewBox +
  default `preserveAspectRatio`), it letterboxes inside that oversized box —
  in the same cream color as the paper background, so it read as unexplained
  blank canvas above/below the ruled lines rather than a visible seam.
  Verified via `getBoundingClientRect()` in headless Chrome: 390×844 phone
  viewport measured the box at 358×735 (ratio 0.49) against a target of
  0.7071. Fix: `width: auto; height: auto; max-width: 100%; max-height:
  100%;` — both axes left auto with both max constraints lets the browser
  pick whichever axis actually binds for the container's own shape, so the
  box (and its border-radius/shadow) always matches the ruled content
  exactly. Re-measured after the fix: 358×506.25 (ratio 0.7072) on phone,
  unchanged 0.7071 on tablet.
- **In-app PDF export — done, for `read_lines` only** (`window.print()`, see
  above). `PropisShowView.jsx` (see below) is a separate, still-dormant
  starting point for a hypothetical print mode of the OTHER text-flow modes
  (`write_text`/`read_text`); not wired to any active mode.
- **Mode "Печатные материалы" (`print_materials`/`browse`) — added 2026-09-15
  (deck v1.26.0), migrated in from the standalone `print_materials` topic.**
  Same ready-made-PDF browse UI (categories/cards/download buttons), now
  reachable from inside this topic instead of as its own separate top-level
  topic — user request, since a separate topic for it "не вижу смысла" once
  it lives here too. Concretely:
  - `topic.json` gained two new top-level keys, `categories` (3 entries) and
    `items` (9 entries: 3 printable notebooks + 6 propis worksheet PDFs) —
    copied verbatim from `src/print_materials/topic.json`'s own content (its
    `items[].files[].path`/`.thumbnail` fields, e.g. `print/прописи_часть1.pdf`,
    are unchanged, since this topic's own deck zip now ships the same files
    under the same relative paths).
  - The 26 binary files those paths point at (17 PDFs + 9 thumbnail PNGs —
    only the ones actually referenced by `items`, not every leftover file
    that happened to still be sitting in `print_materials`'s own zip from an
    earlier content iteration) were extracted from that zip into
    `tools/propis/print/` and `tools/propis/thumbnails/` as the new build
    input, mirroring the *shape* of `tools/comparison/media/` — but unlike
    that folder, **these are NOT tracked in git**: `.gitignore` blanket-
    ignores `*.pdf`/`*.png` repo-wide ("Binary / document assets (not tracked
    in git)"), with no exception carved out for this path (the few existing
    `!tools/<id>/media/*.webp`-style negations only cover `.webp`, not
    `.pdf`/`.png`). This matches how `print_materials`'s own zip already got
    built — its source PDFs never lived in this repo either, only the
    resulting zip did. `scripts/build-propis-deck.mjs` now zips whatever it
    finds under `tools/propis/print/`/`thumbnails/` alongside `topic.json`
    (`ASSET_DIRS`, no-ops if a dir is absent), so a rebuild works whenever
    those local files are present — same one-off, non-fresh-clone-
    reproducible situation as before, not a regression. Deck size: 131 KB →
    6.77 MB (committed as `public/decks/propis_v1.26.0.zip`, a `.zip`, so
    unaffected by the pdf/png ignore rule).
  - New mode `print_materials`/type `browse` in `topic.json`'s `modes` array
    (`hideConceptPicker: true`, no `duration` — it isn't a timed session).
    `engine.js` gets a matching `mode.type === "browse"` branch returning a
    static `{ type: "browse", id: "print_browse" }` task (content comes from
    `topicRecord.categories`/`.items`, not cards, so the task itself carries
    nothing).
  - `PrintMaterialsView.jsx` (+ its `print_materials.css`) is a **copy**, not
    a cross-topic import, of `src/topics/renderers/print_materials/index.jsx`
    — deliberately duplicated so this topic's own deck zip stays
    self-contained and keeps working even if the standalone `print_materials`
    renderer folder is later deleted outright (it's already dormant, see
    below). `index.jsx` routes `task.type === "browse"` to it, passing
    `topicRecord` straight through (added to `PropisRenderer`'s own prop
    list — it already arrives from `SessionScreen` like every renderer gets
    it, just wasn't destructured here before).
  - `SessionScreen.jsx`'s `showProgress` toggle, which already hid the "N of
    total" progress readout for the standalone `print_materials` topic
    (keyed on `topicRecord.meta.renderer === "print_materials"`), gained an
    `|| mode?.type === "browse"` clause — needed because this mode's own
    renderer is `"propis"`, not `"print_materials"`, so the old string check
    alone wouldn't have caught it and a meaningless "1 из 1" would have shown.
  - **Icon added 2026-09-15 (deck v1.26.1).** `media/icons/propis_print_materials.svg`,
    a builtin asset (`src/topics/builtinAssets.js`, resolved by `ModeIcon.jsx`
    when the topic's own deck zip doesn't ship the file — same fallback path
    every other propis mode icon already uses; none of them are bundled in
    the zip). Breaks from the rest of the family's "ruled card + cursive ink
    squiggle" language on purpose — this mode isn't handwriting, it's a
    library of ready PDFs — so the main image is a stack of two offset blank
    ruled cards (no ink stroke) and the corner badge swaps `read_lines`' "+"
    for a small printer glyph. Same palette (`#eaf2fb`/`#bcd8ec`/`#ef6f5e`) as
    its siblings to still read as "part of this topic" at a glance.
  - **Categories reshuffled 2026-09-15 (propis deck v1.27.0, print_materials
    deck v1.0.34) — two lists instead of three, user request.** The original
    3-category split (`notebooks`/`worksheets`/`ready`, the last one always
    empty) bundled each notebook's cover PDFs *inside* its own item's
    `files[]`, alongside its actual ruled pages — so "Обложка (стих)" and
    "Обложка (алфавит)" sat as two of four download buttons on the same card
    as "Страницы". Now `categories` is just `content` ("Рабочие листы и
    тетради") and `covers` ("Обложки"), and every item that used to carry a
    cover file had it split out into its own standalone item under `covers`
    — `cover_standard`/`cover_плотная`/`cover_точки` each bundle their own
    two cover variants ("Со стихотворением"/"С алфавитом") as two files on
    one card (same pattern the punctuation-marks insert already used for
    `notebook_standard`), `cover_тексты` has just the one variant that
    exists. 13 items total now (9 content + 4 covers), same 17 PDFs, nothing
    added or removed — `notebook_standard`/`_плотная`/`_точки` and
    `propis_worksheets_texts` kept their existing ids and thumbnails for
    their now-covers-free content card; the insert stayed with
    `notebook_standard`'s content (it's meant to be printed *into* the
    notebook, not a cover). Cover items have no `thumbnail` field — they
    fall back to `PrintMaterialsView.jsx`'s existing 📄 placeholder rather
    than a new asset being drawn for them.
    En route, found and fixed a real (if dormant) bug in the thumbnail-
    loading `useEffect` in both `PrintMaterialsView.jsx` and the original
    `print_materials/index.jsx`: `if (!item.thumbnail || !live) break;`
    aborted the *entire* loop — skipping every later item's thumbnail too —
    the moment it hit one item without a `thumbnail`, instead of just
    skipping that one item. Harmless today only because the four new
    thumbnail-less cover items happen to sort last in the array; changed to
    `if (!live) break;` / `if (!item.thumbnail) continue;` so it no longer
    depends on item order.
  - **Content-card thumbnails swapped to a real page-1 render 2026-09-15
    (propis deck v1.27.1, print_materials deck v1.0.35), user request.** All
    9 `content`-category thumbnails used to be the notebook's *cover*
    (title/name-line spread) — including on the worksheet cards, which don't
    even have their own cover, so those showed a generic-looking title page
    with no hint of the actual letters/words/text inside. Regenerated all 9
    from page 1 of that item's own content PDF instead
    (`tools/propis/thumbnails/<name>.png`, same filenames/paths — no
    `topic.json` change needed), via `pymupdf`
    (`page.get_pixmap(matrix=Matrix(1.5,1.5))`, chosen so 841.89pt-wide A4-
    landscape page 1 renders at the existing 1263px thumbnail width exactly).
    For the three plain notebooks (`стандарт_pages.pdf`/`плотная_pages.pdf`/
    `точки_pages.pdf`) this shows blank ruled paper — expected, since their
    own content genuinely is blank pages, and it's still informative: the
    three notebooks' ruling patterns differ (20mm косая / 3mm plotnaya /
    dots), so the thumbnail now visually distinguishes them, which the
    identical-looking old cover thumbnails did not. For every worksheet
    (`propis_worksheets_*`) it now shows real captured letters/syllables/
    words/text on ruled paper — informative in a way the old cover thumbnail
    (workaround-reused from `notebook_standard`'s own cover, unrelated to
    that worksheet's content) never was. `cover/*` category items are
    unaffected (still no `thumbnail`, still fall back to the 📄 placeholder
    — this request was about `content` cards only). Verified end-to-end (not
    just the raw PNGs): imported the real rebuilt zip through
    `topicLoader.importTopic` into IndexedDB and screenshotted
    `PrintMaterialsView.jsx` itself rendering both tabs.
  - **"Со стихотворением" cover variant removed entirely 2026-09-15 (propis
    deck v1.27.2, print_materials deck v1.0.36), user request.** Each of
    `cover_standard`/`cover_плотная`/`cover_точки` had two file options
    ("Со стихотворением" / "С алфавитом" — see the reshuffle entry above);
    now just the one remaining file ("С алфавитом"), and the "Два варианта
    оборота — выбирайте один" line dropped from each item's `description`
    since there's no longer a choice to make. `cover_тексты` already only
    ever had the one variant, unaffected. The three now-unreferenced PDFs
    (`cover_стандарт.pdf`/`cover_плотная.pdf`/`cover_точки.pdf`, ~130KB
    each) were deleted outright from `tools/propis/print/` rather than left
    orphaned — `build-propis-deck.mjs` bundles every file it finds in that
    directory regardless of whether `topic.json` references it, so leaving
    them would have kept shipping ~390KB of dead weight in every future
    rebuild. Bundled-asset count: 26 → 23.
  - **Click-to-zoom thumbnail lightbox added 2026-09-15, no version bump,
    no deck-zip rebuild.** User request: the card thumbnail is too small to
    make out ruling detail. `.pm-card__thumb` now gets a
    `pm-card__thumb--zoomable` class (`cursor: zoom-in`) and an `onClick`
    only when that item actually has a loaded thumbnail URL (covers-category
    items still have no `thumbnail` field and stay non-interactive); clicking
    it sets `zoomedItem` state and renders a `.pm-lightbox` overlay —
    `position: fixed; inset: 0; z-index: 1000` (above `.session-header-wrap`'s
    `z-index: 20`, since this view renders inside the normal `SessionScreen`
    chrome, not its own full-screen overlay like other propis views) —
    showing the same thumbnail blob URL at `width: 100%` so it fills the
    current screen's width, `height: auto` with the overlay itself
    `overflow-y: auto` (not `object-fit: contain` capped to viewport height,
    so a tall page stays fully legible by scrolling rather than shrinking to
    fit). Safe-area-aware per the mandatory iOS rule: the fixed `✕` close
    button sits at `top: calc(12px + var(--app-safe-top, 0px)); right:
    calc(12px + var(--app-safe-right, 0px))`, and the overlay's own padding
    reserves `--app-safe-bottom`/`--app-safe-left` too (top padding is a
    flat 56px + safe-top, to clear the close button). Clicking anywhere on
    the overlay (including the image) closes it, same as the explicit
    button. No `topic.json`/thumbnail changes — pure interaction added to
    both `PrintMaterialsView.jsx` and the original `print_materials/index.jsx`
    (kept in sync, JSX and CSS diffed identical after the change) since
    neither reads thumbnails from anywhere new. Verified end-to-end: real
    zip import into IndexedDB, `PrintMaterialsView.jsx` rendered standalone,
    thumbnail clicked and closed programmatically, screenshots pixel-sampled
    to confirm the overlay actually spans the full viewport (dims the tab
    bar and cards underneath rather than just visually appearing to, which a
    first glance at the screenshot can misread) and that closing restores
    the plain grid.
- **Pre-letter элементы (докалиграфический уровень) — capture pipeline scaffolded
  2026-09-16, no data captured yet.** User wants a beginner-level print set below
  the existing letter worksheets, aimed at kids with РАС — isolated pre-writing
  strokes (палочки, крючки, петли, овалы...) before real cursive letters, not
  another calligraphy-school breakdown. Sourced a real, already-published 21-item
  inventory from Н.С. Жукова's «Пропись 1» (стр. 5–11, part of her 3-part
  «Прописи» set) rather than inventing a taxonomy — cropped each instructional
  block out of the user-supplied PDF (`pdftoppm -r 300`, then per-page row-gap
  detection in Python/PIL to find the 3 section boundaries each page reliably
  has) into `01_pryamaya_liniya.png` … `20_kryuchok_s_petelkoy.png` (21 files,
  `07a`/`07b` because Жукова gives "соединение крючков" as two difficulty passes
  on the same page) plus one labeled contact sheet — sent to the user as capture
  reference material, since (unlike letters) the capture tool has no font-backed
  tracing guide for freeform elements.
  - **Capture tool already supports this** — `handwriting_capture.html`'s
    `typeSelect` has had an `"element"` option all along (`TYPE_COPY.element`,
    same 300×150 3-slot canvas, same `{type, label, viewBox, strokes, meta}`
    export shape as letters) — nobody had used it yet. No tool changes needed,
    only a destination for its output.
  - **`scripts/propis_ingest_elements.mjs`** (new) — the one-off ingestion script
    this needed. Reads a capture-tool "Экспорт набора" JSON (the whole collection,
    letters/elements/connectors mixed), keeps only `type==="element"`, validates
    each `label` against a hardcoded 21-entry `REGISTRY` (id → labelRu/category/
    sourcePage — typos get a warning + skip, not a silent bad write), and merges
    into a new `tools/propis/elements.json` by `id` (idempotent re-run: same id
    overwrites, doesn't duplicate). Reuses `pathGeometry.js`'s `samplePath`/
    `transformPathD` directly (pure functions, no DOM dep, importable from a Node
    script as-is) instead of reimplementing bbox/path math.
  - **Normalization**: same x-origin quirk as letters (capture tool's 3-slot
    canvas doesn't guarantee a fresh stroke starts at x=0) — script shifts every
    stroke by `-minX + 4` (4-unit pad) and sets `viewBox` width to the element's
    own actual bbox width + 8, height fixed at 150 (`VB_H`). Deliberately does
    **not** force width to letters' fixed 100 units — some elements (заборчик,
    цепочка овалов) are legitimately wider or narrower than a single letter
    slot, and clamping would either clip or waste space.
  - **Not yet decided**: where `elements.json` actually gets consumed (a new
    propis mode? a standalone print set? categories are stored but no UI reads
    them yet) — that's the next real decision once elements start landing,
    not before.
  - Verified the script itself end-to-end with a synthetic fake export (2 valid
    elements + 1 deliberately-unknown label) before considering it done: correct
    filtering, correct bbox-shift normalization (checked the numbers by hand),
    correct idempotent re-run behavior, correct warn-and-skip on the typo case.
    No real capture data exists yet — 0/21 captured as of this entry.
  - **Fixed-list picker for the "Элемент" type added to `handwriting_capture.html`
    itself, same day** — the 21 REGISTRY slugs from the ingestion script are long
    to type by hand every capture, and a typo there is a silent skip at ingestion
    time, not a caught error at capture time. `#labelInput` (free text) now hides
    and a new `#elementSelect` (the 21 slugs as options, `value` = exact
    ingestion-script id, visible text = "NN · Russian name") shows whenever
    `typeSelect.value === "element"` — toggled in `applyTypeUI()`, read in the
    `addToSetBtn` handler. After each add, the select auto-advances to the next
    option (captures happen in book order, so this saves a reselect on all 21).
    **The 21 `<option>`s and the script's `REGISTRY` are two independent copies,
    kept in sync by hand** — this is a static HTML file with no build step to
    share a single source of truth from; a comment in both places says so.
    Verified with a real headless-browser pointer-drag through the actual canvas
    (not just DOM state): switching type hides the input/shows the select with
    all 21 options, drawing enables "Добавить в набор", and after clicking it the
    collection holds `{type:"element", label:"01_pryamaya_liniya", ...}` and the
    select has already moved to `02_naklonnaya_vertikalnaya`.
- **New mode "Диктант" (`dictation`) — topic.json + options only, 2026-09-17, engine/view
  not started.** User request: a standalone "controlled test" — the app speaks a letter,
  word or short text aloud and the child writes it in their own paper notebook; no
  keyboard, no writing surface on screen at all (unlike every other propis mode).
  - **`tools/propis/topic.json`'s `modes[]`** gained `id`/`type` `"dictation"`,
    `evaluation: "none"` (see reward note below for why this didn't need to change),
    `hideConceptPicker: true`, matching the shape of every other propis mode.
  - **`params`** — all five options render through `ParamsScreen.jsx`'s already-generic
    `enum`/`number`/`boolean` param types (confirmed by reading its render logic, not
    assumed — these are the same code paths `fingers_count`/`graphic_dictation`/etc.
    already exercise, no new UI code needed for the options screen itself):
    `level` (`enum`: буквы/слова/тексты), `itemCount` (`number`, how many items this
    session), `unlimitedRepeats` (`boolean`) + `repeatLimit` (`number`, hidden via
    `showWhen: {unlimitedRepeats: false}` when unlimited is on — `showWhen` was already
    supported by the renderer, just unused by any propis mode until now), and
    `videoRewardEnabled` (`boolean`, no threshold — see below).
  - **Content banks — reused, nothing new authored**: letters from the existing captured
    alphabet (`wordEngine.js` cards, uppercase and lowercase as separate dictation items
    per the user's explicit call — "А" and "а" get their own audio each, not one recording
    with a spoken case prefix), words from `scripts/propis_worksheets/words.py`
    (BLOCK_A + BLOCK_B, 249 words total, confirmed by parsing the file rather than
    guessing), texts from `topic.json`'s own `texts[]` (t01–t24, same list `read_text`
    already uses) — all three drawn in random order at session-generation time (not yet
    implemented — that's `engine.js`, next step, not this one).
  - **Reward is deliberately NOT the shared `buildRewardProgress` percentage/threshold
    system** every other rewarded topic uses — checked `rewardProgress.js` directly:
    that pipeline computes a target from `correctCount`/`total`, and dictation has no
    machine-checkable answer at all (the child's handwriting is on paper, the app never
    sees it). Per the user's own design: a single end-of-session comparison screen shows
    everything that was dictated, an adult visually checks the paper notebook against it,
    then presses "Всё верно" and enters a PIN (a new, separate PIN prompt — not the
    existing pre-session params-screen PIN gate, which propis currently bypasses entirely
    via `ParamsScreen.jsx`'s topic-wide `isPropis` flag) to unlock `RewardVideoModal`
    directly, no percentage involved. Net effect: `mode.evaluation` could stay `"none"`
    after all (earlier assumption in this conversation that it needed to change was
    wrong — corrected once the reward mechanism turned out to bypass the shared pipeline
    entirely rather than reuse it with a 100% threshold).
  - **Known follow-up, not done here**: `isPropis` in `ParamsScreen.jsx` (line ~1548,
    `topicRecord?.meta.renderer === "propis"`) hides the video-reward toggle for the
    *whole topic*; it needs to become mode-aware (e.g. also check `mode?.id ===
    "dictation"`) before `videoRewardEnabled` can actually surface in the options screen
    — the param is declared, but nothing shows it yet.
  - **`media/icons/propis_dictation.svg`** added to `src/topics/builtinAssets.js` (propis
    icons resolve purely through this builtin-fallback map — confirmed no
    `tools/propis/media/` directory exists at all, `build-propis-deck.mjs` only ever
    bundles `print/`+`thumbnails/`). Breaks the family's "ruled card + ink squiggle"
    language on purpose, same reasoning as `print_materials`'s icon: this mode shows no
    handwriting on screen, so the main image is the real audio-mode "diktor" circle
    (`operation-audio-diktor`'s own teal gradient, `styles.css`) with two ring arcs
    standing in for its ripple animation, corner badge is a small pencil instead of the
    usual ink-squiggle card (a ruled card would wrongly imply the answer appears on
    screen).
  - **Version bump + deck rebuild**: `meta.version` `1.27.2` → `1.28.0` (new mode, not a
    fix — minor bump), `node scripts/build-propis-deck.mjs` → `propis_v1.28.0.zip` (81
    cards, 5 modes, 23 bundled assets), `catalog.json` updated to match.
  - **Verification done**: JSON validity, `npm run build` clean, deck zip rebuild
    succeeded. **Not done**: a live screenshot of the options screen — `ParamsScreen`
    takes zero props (pulls everything from app-wide store/routing state internally,
    confirmed by reading its signature), so mounting it standalone the way
    `PrintMaterialsView` was screenshotted earlier this session would need a much
    heavier full-app harness; deferred rather than built for a data-only schema change.
    Structural confidence instead comes from `level`/`itemCount`/`unlimitedRepeats`/
    `repeatLimit`/`videoRewardEnabled` using exactly the same `type` strings and field
    shapes (`label.ru`, `values`+`labels.ru`, `min`/`max`/`default`, `showWhen`) that
    other already-shipped topics' params already exercise in that same renderer.
  - **Explicitly not started**: `engine.js`'s `dictation` branch (currently falls through
    to `return []`, same as any unrecognized `mode.type` — confirmed this doesn't crash
    `SessionScreen`, just yields zero tasks), the session view itself (diktor circle +
    advance-by-tap/button + repeat button), the end-of-session comparison screen, the new
    PIN-confirm-to-unlock-video flow, the `isPropis` mode-awareness fix above, and all
    dictation audio (new `scripts/generate-propis-dictation-audio.mjs`, Gemini
    `gemini-2.5-flash-preview-tts`, voice `Kore` — same pipeline as
    `generate-word-agreement-audio.mjs`).
- **Video-reward toggle — removed from every propis mode 2026-09-15, not just
  hidden.** User request. It was already fully inert here before this
  change: `buildRewardProgress` (`rewardProgress.js`) requires
  `mode.evaluation !== "none"` to ever make a reward video available, and
  every propis mode (`write_text`/`read_text`/`read_lines`/`print_materials`)
  is `evaluation: "none"` — so the "Видео-награда" toggle that
  `ParamsScreen.jsx` shows before every session start was doing nothing for
  this topic, just adding a confusing control with no effect. Fixed at the
  UI-exclusion layer (`ParamsScreen.jsx`), the same place `isAlphabetPairs`/
  `isNavigatorFlashCards` already exclude their own topics/modes from this
  same toggle: a new `isPropis` (`topicRecord?.meta.renderer === "propis"`,
  topic-wide — unlike those two, which are mode-scoped, since the ask was
  "every mode") added to (1) the toggle section's own render condition, and
  (2) `bypassPin`, so a configured admin PIN no longer gates starting a
  propis session either (`shouldRequestSessionStartPin` gates purely on the
  raw `videoRewardEnabled` flag, not on whether a reward could ever actually
  fire — so without this second change the already-inert toggle's default-on
  state would still have prompted for a PIN before every session). Not a
  propis-only file: `src/features/session/ParamsScreen.jsx` is shared app
  code, not part of propis's own deck zip, so no `topic.json` version bump
  or zip rebuild was needed for this half of the change.
- **The bundled PDFs were ~65% heavier than they needed to be — fixed
  2026-09-15 (propis deck v1.26.2, print_materials deck v1.0.33), reported
  as "тема не скачивается".** Investigated after a download-failure report;
  couldn't reproduce the failure directly from this session (no network
  access to production), but found and fixed a real, verified inefficiency
  along the way that's the likely cause. The 17 worksheet/notebook PDFs (see
  the migration entry above) all carry `/Producer (pypdf)` and use **zero**
  stream compression anywhere in the file (`grep -c "/Filter"` → 0) — every
  captured pen-stroke bezier curve is written as literal ASCII floating-point
  text straight in the content stream (e.g. `67.49153 130.155 m`), not
  FlateDecode-compressed the way PDF (and every normal PDF writer, reportlab
  included) supports natively. Likely from `scripts/propis_worksheets/`'s
  `booklet.py` merging step, which uses pypdf and doesn't opt back into
  compression when it recombines already-generated pages. Recompressing with
  `pikepdf` (`compress_streams=True, object_stream_mode=generate`) shrinks
  the 17 files from 16.74 MB to 5.81 MB raw (35% of original) — verified
  **pixel-identical** on every page of every file (`pymupdf` render +
  `Pixmap.samples` byte comparison, not just a visual spot-check), since
  FlateDecode is lossless; only `tools/propis/print/*.pdf`'s bytes changed,
  page count/MediaBox/visible content did not.
  Two caveats worth knowing before assuming this alone "fixes the download":
  - This mainly shrinks what ends up sitting in IndexedDB after import (the
    app stores each zip entry as its own blob via `topics.saveFile`, not the
    zip itself) — i.e. on-device storage footprint, which is exactly where a
    quota error would come from failing mid-import on a phone.
  - It does comparatively little for the **download** size: the deck zip
    itself was already DEFLATE-compressing these same uncompressed streams
    (JSZip, `compression: "DEFLATE"` in `build-propis-deck.mjs`), so most of
    the "fat" was already invisible at the zip level — 6.77 MB → 6.36 MB
    zipped, vs. 16.74 MB → 5.81 MB raw. Compressing already-compressed data
    has little left to gain. So if the topic still won't download after this
    ships, the root cause is something else (worth getting the actual error
    text `getImportErrorMessage` surfaces, or the device/connection) — this
    fix was applied because it's a real, verified, zero-risk improvement
    either way, not because it's confirmed to be the whole story.
  - `tools/propis/print/*.pdf` (the local, gitignored build-input copies) were
    overwritten in place with the compressed versions — same filenames, same
    `topic.json` paths, nothing else to update. `print_materials`'s own zip
    (still hidden, not deleted, see below) got the same treatment for
    consistency, rebuilt by splicing the compressed PDFs into its existing
    zip (its own raw source files were never separately committed either).
- **Standalone `print_materials` topic — hidden 2026-09-15 (deck v1.0.32),
  not deleted.** Now that its content lives inside `propis` too, keeping it
  as its own separately-installable topic was redundant (same ~8.5 MB of
  PDFs shipped twice). Soft-hide, same reversible pattern as the mode
  removals above:
  - `src/print_materials/topic.json` gained `meta.hidden: true` (+ version
    bump) — hides it from a device that already has it installed, via
    `HomeScreen`'s and `TopicLibraryScreen`'s existing `!r.meta.hidden`
    filters on `topicRecords`, once the normal silent-update fetches the new
    version.
  - That alone does NOT stop a device that never installed it from seeing it
    in the topic library's "browse to install" list, though — that list
    (`TopicLibraryScreen.jsx`'s `visibleDecks`) is built straight from
    `catalog.json`'s own entries, which aren't fetched/parsed for
    `meta.hidden` until *after* install. So `catalog.json`'s own
    `print_materials` entry also got a `"hidden": true` field (a new
    convention — first catalog entry to ever need this), and
    `visibleDecks`'s filter now excludes `e.hidden` too. Both flags needed;
    either alone leaves a gap for one of the two user states (already
    installed vs. never installed).
  - No code deleted: `src/topics/renderers/print_materials/`,
    `src/print_materials/topic.json`, and its `engine.js`/registry entries
    are all still there, dormant, same as `PropisPracticeView.jsx` etc.
    above. Re-showing it later is reverting two `hidden` flags, not
    restoring code.
- **Printed letter worksheets (Phase 1) — shipped, live on `main`
  (`print_materials` deck v1.0.12 as of 2026-08-15; superseded content-wise by
  the `propis` migration above, though the standalone topic/scripts are
  untouched).** A completely separate system from the in-app modes above:
  standalone Python (`scripts/propis_worksheets/`), reusing propis's own
  captured strokes and ruling geometry but generating real print-ready PDFs
  (not an in-app view). See its own section below.

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
  Permanently hosted at `https://app.mironium.com/letter_capture.html`
  (synced from this source file on every build via
  `scripts/sync-capture-tool.mjs`, wired as `package.json`'s `prebuild` — edit
  the source here, never the `public/` copy, which is gitignored). Has its own
  fullscreen forced-landscape drawing mode. Was reachable at
  `https://mirocard.kaplieva.help/letter_capture.html` before that host was
  retired (2026-08-23, see `CLAUDE.md`); no code change was needed for the
  move, since `public/` was already served the same way from the new Railway
  host — only this doc's URL was stale.
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
- **"о"→"з" hand-off fixed, 2026-09-12 (deck v1.23.13).** "з" was listed in
  `о_middle_uu`'s `nextLetters` (the generic any-entryType fallback) instead
  of alongside its real methodology siblings г/ж/е/ё/х/ч in
  `о_middle_um`/`о_middle_lm`. `о_middle_uu`'s own captured exit lands near
  y≈63 (line 3, tuned for straight-continuation letters like т/к/н/р), while
  "з"'s own raw entry starts at y=75.00 (line 4, same height as
  г/ж/е/ё/х/ч) — the ~12-unit mismatch forced "з" to shift up on every
  hand-off, visually merging its own entry loop into о's body (confirmed by
  rendering "воз"/"мороз"/"розан"/"заноза" to SVG: о rendered as a
  barely-visible arc with "з"'s loop overlapping it, not a full circle).
  Fix: removed "з" from `о_middle_uu.nextLetters`, added it to both
  `о_middle_um.nextLetters` and `о_middle_lm.nextLetters` (matching
  г/ж/е/ё/х/ч exactly). Re-rendered the same words after the change — clean
  connections, "о" now reads as a proper closed loop. No code change, data
  (`tools/propis/topic.json`) only.
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

## Mode: Пишем текст с экрана (read_text)

Read-only sibling of `write_text` (`ReadTextView.jsx`): same notebook grid,
same `layoutTextIntoRows`-based row layout, same real-handwriting rendering —
but no keyboard, and the child never types anything. The text comes
pre-selected from the params screen (`task.texts`, plural — one task holds
every text the parent picked) instead of being typed live; the child copies
the on-screen model into their own paper notebook.

- **Content picked in the params screen** (`params.texts`, type `text_list`,
  `TextListParam` in `ParamsScreen.jsx`): either preset short texts
  (`topic.json`'s `texts[]`, `t01`…) or a custom text typed into a textarea
  or uploaded as `.txt`. Several can be selected at once — `ReadTextView`
  switches between them with its own internal Prev/Next (self-contained
  state, same pattern `PropisPracticeView` uses for letter/case switching,
  not the session engine's own task-advance machinery).
- **Tap a word to toggle its animation** — `activeIndex` in `ReadTextView`,
  one word at a time; tapping again turns it off. Renders `AnimatedStrokes`
  in place of the static path for whichever word is active.
- **Manual line breaks**: `layoutTextIntoRows` (`wordEngine.js`) already
  treats every `"\n"` in the text as a hard row break (not just an
  auto-wrap-on-width fallback) — typing/pasting text with real line breaks
  (or a custom text with several lines) lays out exactly as typed, one
  configured line per row. `read_lines`'s `PrintPageView.jsx` (below) reuses
  `layoutTextIntoRows` itself the same way, though as its own view rather
  than through this one.
- Undocumented here until 2026-09-13 despite being shipped — code comments
  are dated 2026-08-19 (word tap-to-animate + hit-rect Y fix, see
  `WORD_HIT_Y`'s own comment for the "tap area higher than the word" bug),
  2026-08-20 (tablet 2x text scale), 2026-08-21 (`ReadTextView` itself).

## Mode: Тетрадный лист (read_lines / print_page)

Content is authored via a structured line-by-line constructor in the params
screen instead of picking a whole pre-written text (same as before,
unchanged). **Rewritten 2026-09-13**, same day it shipped: the first cut
reused `read_text`'s task/view as-is (scrolling container, arbitrary row
count). The user's actual goal turned out to be a real print/PDF export
("мы должны получать ровно такой же PDF, только с набранными пользователем
строками") — a scrolling on-screen approximation can't produce that, so this
mode now has its own view (`PrintPageView.jsx`) built on real print-page
geometry, not `read_text`'s flowing layout. `task.type` is `"print_page"`,
routed in `index.jsx` — no longer indistinguishable from a `read_text` task.

### Real print geometry, not an on-screen approximation

Every dimension comes from `scripts/propis_worksheets/propis_ruling.py` (the
actual ruling PDF) and `page.py` (the letter-worksheets content overlay) —
not independently chosen, and not just "similar-looking": one physical A4
sheet (297×210mm) split into two A5-proportioned slots (148.5×210mm), a red
margin line 15mm from each slot's own OUTER edge, a 12mm baseline-to-baseline
cycle → **exactly 17 rows per page** (`floor((210-12)/12)+1`, matching
`page.py`'s `row_baselines()` count verbatim). All exported as `PRINT_*`
constants in `propisRuling.js` (`PRINT_PAGE_W_MM`, `PRINT_ROWS_PER_PAGE`,
etc.) plus `mmToNativeUnits()` for the mm→native-unit conversion every other
constant in that file already uses.

**Bug found and fixed the same day it shipped (row 0 was 6mm from the top,
not 12mm):** `propis_ruling.py` draws in reportlab's bottom-up frame (y=0 at
the page's BOTTOM edge) and its own `SHIFT_MM=-6` is a phase shift in THAT
frame — it does not mean "6mm from the top" the way the first cut of
`PRINT_FIRST_BASELINE_MM` assumed. `page.py`'s `row_baselines()` (the real
ground truth for where print content lands) reverses its own bottom-up
`_thick_line_ys()` list; converting that to a from-top distance gives
baselines at 12, 24, ..., 204mm — row 0 sits 12mm from the top, not 6mm. The
bug swapped the two margins: 6mm top / 12mm bottom on screen instead of the
real 12mm top / 6mm bottom — reported by the user as visible excess empty
space, especially at the bottom, not matching the real printed page. Fixed
by correcting `PRINT_FIRST_BASELINE_MM` to 12 (`propisRuling.js`); re-derive
with `page.py`'s own `_thick_line_ys()` logic before touching this constant
again, not by hand-converting `propis_ruling.py`'s bottom-up `SHIFT_MM` a
second time.

**Left/right slot mirroring** (`PrintPageView.jsx`'s `slotGeometry`,
`pageIndex % 2`): a left-slot page (even index) has its margin line near its
own left edge and its content hugs that same side; a right-slot page (odd
index) has its margin line near its own RIGHT edge instead, and its content
hugs the opposite (center-divider) side — this is `page.py`'s own
`LEFT_INSET_MM`/`CENTER_INSET_MM` split, reused unchanged (see that file's
own comment for why: it's booklet-imposition mechanics, not a stylistic
choice). Confirmed visually 2026-09-13 (dev-preview + headless-Chrome
screenshots): page 1 shows the margin on the left with content flush against
it; page 2 shows the margin on the right with content flush against the
*left* edge instead.

**Diagonal hatching is computed across the FULL sheet, not per slot —
fixed 2026-09-13 after a printed-page photo showed a visible break at the
seam.** The first cut called `buildDiagonalLines` independently per slot
(each its own `x=-dx` start), reasoning it was a purely cosmetic
simplification — wrong: 148.5mm isn't a multiple of the 20mm diagonal
spacing, so each slot's own phase drifted from the other's, and the two
patterns met at visibly different angles right at the seam once actually
printed (the user's photo showed lines "breaking" at the middle instead of
continuing straight through), not merely a subtle phase mismatch. Fixed by
building `SHEET_DIAGONAL_LINES` once, across `PAGE_W_UNITS * 2` (the full
297mm), matching `propis_ruling.py`'s own single continuous pass; the right
slot shifts the same set left by one page width (`x - PAGE_W_UNITS`) so
whatever fell in the right half of the full-sheet computation lands at that
slot's own local origin — the `<svg>`'s default `overflow: hidden` clips
the rest. Verified with a print-media-emulated screenshot cropped exactly
on the seam (`getBoundingClientRect` of both slot `<svg>`s): every diagonal
line now crosses the boundary as one continuous stroke.

### Pagination (`paginateRows`, `wordEngine.js`)

Groups a `layoutTextIntoRows()` result into fixed `PRINT_ROWS_PER_PAGE`-row
pages. **Always an even page count, minimum 2** — confirmed with the user:
pages come from real physical sheets, each printing 2 (a left slot + a right
slot), so a "sheet" is the real unit. Content that doesn't fill even the
first page still gets a second, blank one; content needing a 3rd page always
gets a 4th too, rather than leaving an odd sheet half-used. The constructor
itself has **no line-count cap** — "конструкция должен давать добавлять
больше строк, чем у нас есть на PDF-выводе" (2026-09-13) — as many pages as
needed are generated, always in pairs.

- **`params.lines`** (type `line_list`, `LineListParam` in
  `ParamsScreen.jsx`, unchanged from the first cut): one text input per
  notebook row, "+ Добавить строку"/remove-row controls, starts with one
  empty row.
- **`engine.js`'s `read_lines` branch** trims and drops empty/whitespace-only
  lines, passes the rest through **raw** (`task.lines`, an array — not
  pre-joined into one string the way the first cut did) so
  `PrintPageView.jsx` can paginate them itself.

### PDF export: real, via the browser's own print pipeline

`PrintPageView.jsx`'s "🖨 Печать" button calls `window.print()` — no PDF
library, no server-side rendering. **Pages 0/1 share one physical A4-
landscape sheet, 2/3 the next, etc.** — `propis.css`'s `@media print` block
sizes each SHEET (`.propis-print-all__sheet`, a flex row holding both slots
side by side) to the exact physical `297mm × 210mm` via `@page`, with each
slot's own `<svg>` at `148.5mm × 210mm`, and forces a page break between
sheets (never between the two slots on the same sheet). First cut (same
day) printed each slot as its own separate A5 page — corrected after the
user compared it against the real `propis_worksheets` PDFs, which are one
A4-landscape page per physical sheet. `paginateRows` already guarantees an
even page count (see above), so every sheet is a full pair — never an odd
slot left over. "Save as PDF" in the browser's print dialog is what turns
this into a real file; verified end-to-end with headless Chrome's own
`--print-to-pdf` (`pdf-lib` confirmed sheet count and exact `297×210mm`
page size for both a 3-line and a 40-line test case).

**`position: fixed` breaks multi-page printing — worked around with a
portal, not a CSS override.** `PrintPageView`'s root
(`.propis-practice-stage`, shared by every propis mode) is `position:
fixed`, and Chrome's print engine only ever paints ONE page for content
nested inside a fixed-positioned ancestor — confirmed by testing: the exact
same print-only markup, moved outside that ancestor, printed all pages
correctly. Rather than overriding `position`/`overflow` on every ancestor in
the chain (fragile — anything upstream changing later could silently break
printing again), the print-only "every page stacked" block
(`.propis-print-all`) is rendered via `createPortal(..., document.body)` —
a direct child of `<body>` in the real DOM, completely outside the fixed
stacking context, regardless of what the rest of the screen's layout does.
- **Interactive view vs. print view are two separate renders of the same
  `PrintPage` function** (not one hidden/shown via CSS alone): the on-screen
  view renders only the current page with tap-to-animate
  (`activeIndex`/`onToggleActive`); the portaled print block renders every
  page with static ink only (`onToggleActive` omitted — nothing is tappable
  on paper). `propis.css`'s `@media print` rule hides everything in
  `body *` except `.propis-print-all`'s own subtree (`visibility`, not
  `display`, so hiding the rest doesn't collapse layout ancestors).

### Tap-to-animate pen tip: a real-scale ~2cm pen tip, not the default speck

`AnimatedStrokes.jsx`'s default tap-to-animate pen tip (`TIP_PATHS.normal`,
~24 native units = 4mm) was tuned against the OTHER text views' own
on-screen scale, which isn't physical (their row width just fits whatever
container they're given). `PrintPageView.jsx` renders at true physical mm
scale, though (real print-page geometry), so that same tip read as an
unrecognizable speck next to a real-size page on a tablet (reported
2026-09-13). Added a `tipSize="large"` variant (`TIP_PATHS.large`) instead
of resizing the shared default: 120 native units = 20mm = the front ~2cm of
an actual ballpoint pen (dark metal ball housing → brass/gold cone,
`NIB_COLOR` → a sliver of the plastic barrel it plugs into, `INK_COLOR`),
cut off at the 20mm mark rather than drawing a whole pen — confirmed with
the user this should be "just the tip," not the full length. Only
`PrintPageView.jsx` passes `tipSize="large"`; every other `AnimatedStrokes`
caller (`ReadTextView.jsx`, `WriteTextView.jsx`, `WordAnimatedCard.jsx`)
keeps the untouched default on purpose, since that size was already
confirmed against their own scale (2026-08-13, see `TIP_PATHS.normal`'s own
comment) — resizing it there would undo that. `LoopingLetterCell.jsx` has
its own independent copy of the same small nib (practice mode's single-
letter card) — not touched, out of scope, and not the same real-mm-scale
situation this fix addresses.

### Icon

`media/icons/propis_read_lines.svg` (`builtinAssets.js`) reuses the same
ruled-notebook-card visual language as the other 3 propis mode icons, but
with 3 *different-length* rows (hinting mixed content — a letter/syllable/
word, not uniform prose) and a small "+" badge instead of `read_text`'s
screen-to-paper arrow.

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
