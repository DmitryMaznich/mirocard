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
- **Element "02" split into three — 2026-09-17.** User caught it during review:
  `02_naklonnaya_vertikalnaya` (the entry named right above, in the previous
  entry's own verification screenshot) actually bundled three distinct drills
  from the source book page under one slug — "наклонная длинная" (long
  diagonal), "наклонная короткая" (short diagonal), and "вертикальная"
  (vertical), confirmed by the user explicitly ("да, три разных"). Fixed at
  the registry level: `scripts/propis_ingest_elements.mjs`'s `REGISTRY` and
  `handwriting_capture.html`'s `#elementSelect` both had the single
  `02_naklonnaya_vertikalnaya` entry replaced with three —
  `02a_naklonnaya_dlinnaya`, `02b_naklonnaya_korotkaya`, `02c_vertikalnaya`
  (same `02a`/`02b` lettered-suffix convention `07a`/`07b` already
  established for "two drills, one page") — kept in sync by hand between the
  two files per the existing comment there, total inventory now 23 (was 21).
  **No capture data existed yet for this slug** (`tools/propis/elements.json`
  doesn't exist at all as of this fix — 0/21 was still true when the bug was
  reported), so this is a pure registry correction with nothing to migrate or
  re-ingest.
  - **Still unresolved**: exactly where "вертикальная" sits on the source
    page relative to the two diagonal strokes was never pinned down —  an
    earlier attempt at pixel-level angle measurement on the original crop
    (bold stroke ≈9°, dashed stroke ≈11° from vertical) couldn't confidently
    place a third, separate mark, and the user's confirmation named the three
    drills without giving their exact position. That's not a code problem —
    it's "which pixels in the physical book page for `02c_vertikalnaya`", a
    call only whoever operates `handwriting_capture.html` next (matching the
    tracing to the actual book page in front of them) can make. The fixed
    dropdown now offers the correct 3 separate options either way, so
    whichever page region turns out to be "вертикальная", it gets captured
    under its own correct slug instead of silently merged into a diagonal.
  - **Resolved 2026-09-17, same day, once the user re-uploaded the source
    PDF** (`Propis_Pervaya.pdf` — the original upload from the digitization
    phase doesn't persist across sessions, had to be asked for again).
    Rendered printed page 5 (PDF page 6) at 300dpi via `pdftoppm` and
    zoomed into the "Соедини две точки наклонной линией, потом
    вертикальной" block pixel-by-pixel rather than eyeballing the earlier
    low-res preview — the block turns out to have **three rows, each at a
    different rule-line spacing** (a "wide → narrow → narrowest" ruling
    progression genuinely unique to this one block — see the correction
    entry below: `01`'s own two rows were wrongly assumed to follow the
    same pattern and don't): row 1 (widest spacing) is a long diagonal stroke leaning ~10-15°
    off vertical; row 2 (narrower spacing) is the same lean but visibly
    shorter, height set by the tighter ruling; row 3 (narrowest, double-
    ruled) is perfectly vertical, no lean at all — confirmed by direct
    pixel comparison of the three rows' stroke angles side by side, not
    just a visual impression. This maps exactly onto the three slugs
    already in place: row 1 → `02a_naklonnaya_dlinnaya`, row 2 →
    `02b_naklonnaya_korotkaya`, row 3 → `02c_vertikalnaya` — no renaming
    needed, the earlier fix had already guessed the right order.
  - **Re-extracted the full 23-element reference set** while the PDF was
    available (all crops regenerated from scratch via `pdftoppm -r 300` +
    Pillow crops per element, not reused from any earlier session's output
    — none persisted), verified via a 23-cell contact-sheet montage before
    delivery so every crop could be checked for cut-off text/strokes in one
    pass instead of 23 separate round-trips; caught and fixed 3 crops that
    were initially too tight (`02a`, `14_petelka_s_kruzhochkom`,
    `20_kryuchok_s_petelkoy`) by re-checking their source page regions at
    full width before re-cropping. Delivered as a zip directly to the user
    — these are reference/source material for manual tracing in
    `handwriting_capture.html`, not app code, so nothing from this step is
    committed to the repo.
- **User asked, correctly, whether every element with 2 example rows is
  actually two elements (wide-ruled vs narrow-ruled), same as "02" —
  checked by direct pixel measurement instead of assuming either way,
  same day.** Measured rule-line-to-rule-line height for both rows on
  every multi-row element checked (`01`, `03`, `04`, `05`, `07a`, `09`,
  `12`, `16`, `18` — a representative spread across all 7 source pages,
  not just page 5): **every one of them has row 1 and row 2 at identical
  rule height**, confirmed by cropping both rows at the same pixel scale
  side by side (not eyeballed separately, where a subtle height
  difference is easy to imagine). `02` remains the one genuine exception
  — its three rows really do shrink in height row to row, unlike any
  other block checked. Sent the user a direct side-by-side proof image
  (`01` row1 vs row2, identical height; `02` row1 vs row3, visibly
  different) rather than just asserting this. Net effect: the other 19
  non-`02` elements are correctly single elements shown twice for
  practice, not two elements each — did **not** blanket-split them, since
  the evidence doesn't support it; asked the user to name a specific
  element if they still see a real difference somewhere, rather than
  guess-splitting 19 elements into 38 on a hunch.
- **Fixed `#elementSelect` dropdown replaced with a free-text `#elementInput`
  + `<datalist>`, 2026-09-17 — user request: "список недостаточен, не
  будем усложнять".** The forced-choice `<select>` (added earlier this
  session specifically to avoid mistyping the long slugs) turned out to
  cut the other way once the registry needs to grow past its original 23
  entries during real capture work — a fixed list can't offer an element
  that isn't in it yet. Swapped to `<input list="elementDatalist">`: the
  same 23 options now act as autocomplete suggestions (still fast to pick
  a known slug, still typo-resistant for those), but any text can be
  typed and submitted — the ingestion script's existing REGISTRY
  warn-and-skip on an unrecognized id is still the actual safety net, now
  doing the job the `<select>` used to do by brute force. Renamed the
  element throughout (`elementSelect` → `elementInput`) rather than
  keeping the old name on a different tag, updated the type-switch hint
  text (was "Выберите элемент из списка", now "Впишите слаг элемента"),
  and replaced the old "auto-advance the select to the next option after
  capture" behavior with a plain clear-and-refocus — the exact same
  pattern `labelInput` (the letter/connector case) already used, not a
  new one. Verified with a real headless-browser run: switching to
  "Элемент" shows the text input with its placeholder, typing an
  arbitrary slug not in the datalist (`21_novy_element_ne_v_spiske`) is
  accepted as-is, and a full draw-stroke → "Добавить в набор" click
  correctly saves it and clears the field for the next capture, with zero
  console errors.
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
  - **Explicitly not started (as of the entry above)**: `engine.js`'s `dictation` branch,
    the session view, the end-of-session comparison screen, the PIN-confirm-to-unlock-video
    flow, the `isPropis` mode-awareness fix, and all dictation audio. All still true except
    the first — see the follow-up entry directly below for the engine work.
- **"Диктант" task generation — `engine.js` + word bank + audio-key scheme, 2026-09-17.**
  Follow-up to the topic.json/options entry above. Still no session view/audio/reward
  flow — this is purely "given the options, produce the right task object".
  - **`tools/propis/topic.json` gained a top-level `"words"` array** (249 entries,
    `{id: "w001".."w249", word, block: "A"|"B"}`) — ported from
    `scripts/propis_worksheets/words.py`'s `BLOCK_A`/`BLOCK_B` (45 + 204 words, counted by
    parsing the file with Python's `ast`, not by eyeballing it), the same "existing bank"
    `texts.py`'s `TEXTS` already gets manually mirrored into `topic.json`'s `texts[]` for
    (confirmed by diffing the two — `texts.py` and `topic.json`'s `texts` are verbatim
    identical, no generation script bridges them; this is the established, if manual,
    precedent, not a new pattern). **Learned the hard way while doing this**: don't
    round-trip the whole file through `json.load`/`json.dump` to add one key — Python's
    dump reformats every line (confirmed: 1343 insertions / 24 deletions for what should
    have been ~250 lines added), even though the JSON content is equivalent, because its
    default formatting differs from the file's actual hand-formatting conventions (compact
    single-line objects). Reverted and instead generated just the new block as text in the
    exact same single-line style as the neighboring `texts[]` entries, and spliced it in
    with a plain string replace — 251 insertions, 0 deletions, real diff. Bumped
    `meta.version` `1.28.0` → `1.29.0` and rebuilt the deck zip for this alone (word bank is
    part of `topic.json`, which the zip bundles whole).
  - **`useSessionEngine.js` gained a dedicated `renderer === "propis"` branch** passing the
    *whole* `topicRecord` through to `generateTasks`, not just `topicRecord.cards` like
    every other propis mode has received until now (the generic path around line 165-172).
    Necessary because "Диктант" draws randomly from the full word/text banks
    (`topicRecord.words`/`.texts`), not a parent-picked subset the way `read_text`'s own
    `texts` param works. Confirmed safe for the other 4 modes before relying on it:
    `propis/engine.js`'s own `Array.isArray(cards) ? cards : (cards?.cards ?? [])` already
    tolerated either a raw array or a wrapper object, so passing the richer object through
    changes nothing for `write_text`/`read_text`/`read_lines`/`browse` — verified with a
    real (temporary, not committed) vitest file exercising all four dictation-param
    combinations *and* a `write_words` call through the new pathway, all 6 assertions
    green, alongside the existing 101 propis/session-engine tests still passing unmodified.
  - **`src/topics/renderers/propis/dictationAudio.js`** (new) — the audio-key scheme.
    Letters: `up_<lowercase letter>` / `lo_<lowercase letter>` (e.g. `up_а`, `lo_а`) rather
    than the bare letter as the key — deliberately avoids relying on the Cyrillic
    character's own case at all, because the build machine is Windows (CLAUDE.md) and
    NTFS case-folds Cyrillic the same as Latin, so literal `А.mp3`/`а.mp3` filenames risk
    colliding. Words/texts key on their own topic.json id (`word_w001`, `text_t01`) —
    already ASCII, no such risk. `dictationAudioUrl(key)` resolves to
    `/audio/propis-dictation/<key>.mp3`, a static path shipped with the app itself (like
    `addition_subtraction`'s number words), not bundled into propis's own deck zip — propis's
    renderer is already code-bundled, and this audio has nothing to do with the print PDFs
    `build-propis-deck.mjs` bundles.
  - **`engine.js`'s new `dictation` branch**: picks the pool for `sessionParams.level`
    (letters/words/texts), shuffles it (`@/shared/utils/shuffle`, reused, not
    reimplemented), clamps `itemCount` to the pool's actual size, and returns
    `{type: "dictation", level, items: [{key, display}], repeatLimit, videoRewardEnabled}`
    — `repeatLimit` is `null` when `unlimitedRepeats` is on, matching how the not-yet-built
    view should read "no limit" (a sentinel, not a huge number).
  - **Verification**: `npm run build` clean, full existing propis/session-engine test
    suites (101 tests, 6 files) pass unmodified, a temporary manual-check vitest file (not
    committed) exercised all four `sessionParams` combinations plus the cross-mode safety
    check above, then was deleted. Ran the full repo test suite too — 14 unrelated files
    failed (backend DB tests, `column_addition`/`function_cards`/`reading` engine tests,
    `symmetry_draw` tool tests), none touching propis/session-engine/dictation, consistent
    with pre-existing branch state rather than anything this change introduced.
- **Texts level — resolved to per-sentence pacing, same day.** User's answer to the entry
  above's open question: sentence by sentence, with a pause between sentences — not the
  whole text in one breath.
  - **`dictationAudio.js`** gained `splitIntoSentences(text)` (splits on
    `/(?<=\.)\s+/` — "period, then whitespace") and `textSentenceDictationKey(textEntry, i)`
    → `text_<id>_s<n>` (1-based, so it reads naturally next to the file on disk:
    `text_t01_s1.mp3`..`text_t01_s5.mp3`). The split regex is safe for this specific bank,
    not assumed safe in general: `texts.py`'s own generation rule is "exactly 5 short
    declarative sentences, periods only (no commas, dashes, or quotes)" — confirmed by
    actually running the split against all 24 real texts in `topic.json` (every one
    produces exactly 5 sentences), not trusted from the docstring alone.
  - **`engine.js`'s `dictation` branch, texts level**: still one dictation item per text
    (so the comparison screen and the top-level "Дальше"/repeat-limit machinery keep
    working the same way as letters/words), but each item now also carries `sentences:
    [{key, display}, ...]` — five per text, meant to be stepped through one at a time by
    the (still not-built) session view, with a pause between each. `display` on the item
    itself stays the whole text, unchanged, since the end-of-session comparison screen
    still needs to show the complete thing.
  - **Verified** with a dedicated (temporary, not committed) vitest check: every text
    produces exactly 5 `sentences` entries, keys match `text_t0N_sM`, and `t01`'s five
    sentences match the source text split by hand, word for word — not just "5 items",
    the actual content. Full propis/session-engine suite re-run after (102 tests, 7 files,
    all green — one more than before purely from this check file existing at run time,
    deleted immediately after).
- **"Диктант" session view — `DictationView.jsx`, same day.** Follow-up to the two entries
  above: the actual screen a parent/child sees during a dictation session (steps 2-5 from
  the plan — comparison screen, PIN-gated reward, `isPropis` per-mode fix, real audio —
  are still separate, not built here).
  - **Own full-screen overlay** (`.propis-dictation-stage`, `position:fixed;inset:0;
    z-index:500`), same pattern as `PropisPracticeView`/`WriteTextView`/etc. — checked
    those first rather than guessing: every propis mode except `browse`
    (`PrintMaterialsView`, which deliberately renders inside the normal `SessionScreen`
    header chrome) takes over the whole screen this way, no special dispatch needed in
    `SessionScreen.jsx` for a new one to do the same. Registered in `propis/index.jsx`'s
    `task.type` switch (`"dictation"` → `DictationView`).
  - **Background is cream (`#fdfcf9`), not the practice view's tan `#cabfa9`** — that tan is
    specifically the "paper desk" metaphor for on-screen writing, which this mode has none
    of (the child writes on real paper, off-screen). Cream matches the
    designing-mirocard-screens skill's literacy-family default instead.
  - **`useDictationPlayer.js`** (new) — a small, propis-only audio sequencer, not a reuse of
    `addition_subtraction`'s `useAudioSequence` (per this project's per-family
    "duplicated, not shared" convention for topic-specific logic, and that hook has no
    notion of a pause between clips anyway, which this needs for texts). Plays
    `[{url, pauseAfterMs?}]` one at a time via plain `<audio>` + `"ended"`, advances on
    `"error"` too so a missing/not-yet-recorded audio file can't hang the sequence.
  - **Diktor circle**: teal gradient + 3-ring ripple + 4-bar bounce, the exact same visual
    formula as `addition_subtraction`'s `.operation-audio-diktor` family in `styles.css`
    (own copy in `propis.css` as `.propis-dictation-diktor*`/`.propis-dictation-ripple`,
    not a cross-topic import — same convention as above) — reused because it's already the
    established "this circle plays a voice" language in this app, not reinvented.
  - **UI never shows `item.display` during the session** — only the progress counter
    ("N из total"), the diktor circle, and the two action buttons. This is deliberate, not
    an oversight: showing the letter/word/text on screen while dictating it would defeat
    the entire point of a dictation test.
  - **State machine**: `index` (current item), `repeatsUsed` (resets on every advance),
    `done` (past the last item). Auto-plays the new item on every `index` change (matches
    `AudioOperationTask`'s existing precedent in `addition_subtraction`). "Повторить"
    disabled once `repeatsUsed` reaches `task.repeatLimit` (never disabled when
    `repeatLimit` is `null`, i.e. unlimited). Both action buttons disabled while
    `isPlaying`, to stop overlapping playback. Texts play their `sentences[]` one after
    another with a 2.5s pause between each (`SENTENCE_PAUSE_MS`), as one "Повторить"/one
    "Дальше →" unit — repeating a text replays all its sentences from the start, not just
    the current one; picking a per-sentence repeat granularity instead wasn't asked for.
  - **Past the last item**: originally a plain "Диктант окончен!" placeholder — replaced
    the same day by the real comparison screen, see the entry directly below.
  - **Verified visually, not just from source** — the mandatory step per
    designing-mirocard-screens: real React dev-preview harness (createRoot, both
    `styles.css` and `propis.css` imported — first attempt without `styles.css` rendered
    the done-screen title in a serif fallback font instead of Nunito, caught by comparing
    the screenshot against the global-tokens section rather than assuming an isolated
    harness matches the real app), headless-Chromium screenshots of: initial state (1 из 3,
    both buttons, ripple/bar markup present), after 2 repeats (button correctly disabled at
    the `repeatLimit=2` boundary), after advancing to item 2 (repeat count resets), the
    end state after the last item, and the iOS safe-area check from
    CLAUDE.md (`app-ios-standalone` + 59px/34px insets) — close button clears the
    simulated Dynamic Island, bottom buttons clear the simulated home indicator. All via
    real click events driving the actual component state (`page.click`), not just
    reading the DOM once.
- **"Диктант" comparison ("сверки") screen — `DictationReviewScreen.jsx`, same day.**
  Replaces the "Диктант окончен!" placeholder from the entry above. Shown once every item
  has been dictated; this is the FIRST point the answer appears on screen at all — there's
  no automatic checking possible (child writes on paper, app never sees it), so an adult
  compares this list against the notebook by eye.
  - **Layout differs from the session view's `.propis-dictation-frame`** on purpose — that
    one is sized for exactly one diktor circle + two buttons; this one holds an arbitrary
    list (up to `itemCount`'s max of 40) and needs to scroll. Standard shape: fixed header
    (title + hint) → `flex:1; overflow-y:auto` list → fixed footer button, all inside
    `.propis-dictation-review` (own class, not a `.propis-dictation-frame` modifier).
  - **Two list layouts, picked by `task.level`**: letters/words render as a wrapping row of
    chips (`.propis-dictation-review-chip`, large bold text — legible at a glance while
    comparing against handwriting); texts render as numbered full-paragraph blocks
    (`.propis-dictation-review-text`, index badge + the item's whole `display` text, not
    split back into its dictated sentences — the notebook page reads as continuous prose,
    the sentence split was only ever a playback-pacing detail, not a display one).
  - **Item order is exactly dictation order, not re-sorted** — `items.map` over the same
    array the session view stepped through, since that's the order the child actually
    wrote them in.
  - **"Всё верно" vs "Готово"**: only shown when `task.videoRewardEnabled` — otherwise a
    plain "Готово" that just calls `onClose`, no reward UI at all for a session that never
    asked for one. Clicking "Всё верно" does **not** fake the PIN flow — it swaps in a
    visible stub note ("PIN-подтверждение видео-награды будет добавлено отдельным шагом")
    so the incompleteness is honest and visible rather than a silently-dead button or a
    faked success state. The real PIN-gated `RewardVideoModal` unlock is still its own
    separate step (see the plan).
  - **Verified visually** for all three levels with the same dev-preview-harness approach
    (not just letters): letters (3 chips, dictation order "А б В" preserved, "Всё верно"
    shown), words (3 chips, plain "Готово" since that task's `videoRewardEnabled: false`),
    texts (one numbered full-text block, "Всё верно" shown) — plus the reward-stub note
    after clicking "Всё верно", and the safe-area check again on this screen specifically
    (close button and footer button both clear simulated Dynamic Island/home-indicator
    insets). One real snag hit and fixed during this: the first texts-level screenshot
    attempt landed mid-playback (still on item 1 of 1, "Дальше" a no-op because
    `isPlaying` was still true) — not a component bug, the test script's own wait time was
    shorter than 2 sentences × the 2.5s inter-sentence pause; fixed by waiting long enough
    before clicking, re-verified reaching the review screen correctly.
- **"Всё верно" now opens a real PIN-gated video reward, 2026-09-17 —
  replaces the stub note from the entry above.** `DictationReviewScreen.jsx`
  gained a `stage` state (`"idle" | "pin" | "reward"`): clicking "Всё верно"
  goes to `"pin"`, which renders the shared `PinGateModal` (the same
  component/PIN as `ParamsScreen.jsx`'s own session-start gate — not a new,
  separate PIN); success goes to `"reward"`, which renders the shared
  `RewardVideoModal`; cancel returns to `"idle"`. Not a new architecture —
  this is `column_addition`'s "Контрольная работа" pattern (`ColumnCopyView`
  renders `RewardVideoModal` directly and self-contained, bypassing the
  automatic `rewardPending`/threshold machinery), applied here because
  Диктант has the same shape: no correctness-checking, so the standard
  `mode.evaluation`-gated reward pipeline structurally doesn't fit.
  - **Student/PIN come straight from `useAppStore`**, not threaded down as
    new props through `PropisRenderer` → `DictationView` → here: every other
    propis view is already self-contained this way, and `ParamsScreen.jsx`
    reads `settings.adultPinHash` the same direct way. `activeStudent` is
    `students.find(s => s.id === activeStudentId)`, same lookup
    `SessionScreen.jsx` itself uses.
  - **`pinHash === null` triggers `PinGateModal`'s own "set up a new PIN"
    flow** (enter, then confirm) instead of "enter existing PIN" — this is
    `PinGateModal`'s existing behavior, not new logic here. `onSetPin`
    persists the new hash through the exact three-step pattern
    `ParamsScreen.jsx`'s own `handleSetPin` uses: `patchSettings` (in-memory
    store) → `kv.set(db, "settings", ...)` (IndexedDB) → fire-and-forget
    `api.patch("/account/settings", ...)` (backend sync, `.catch(() => {})`
    since a sync failure shouldn't block the PIN from working locally).
  - **`RewardVideoModal` gets `activeStudent.rewardVideos ?? []`** — if the
    active student has no configured reward videos, the modal still opens
    (its own "⭐ Диктант готов" card with "Смотреть видео"/"Продолжать
    занятие" buttons) and `handleWatch` no-ops to `onDismiss` if
    `pickStoredRewardVideoId` finds nothing — same graceful-empty behavior
    every other caller of this shared component already relies on, not
    something added here.
  - **Removed the now-orphaned `.propis-dictation-review-stub-note` CSS**
    (the placeholder note's styling) — nothing references it anymore.
  - **Verified**: `npx vite build` clean, full propis + `useSessionEngine`
    vitest suite green (101 tests), and a dev-preview harness (`useAppStore
    .setState` seeded with one fake student + one fake reward video, real
    PIN unset so the setup flow exercises) screenshotted through all four
    stages — idle review list → "Придумайте PIN-код" → "Повторите PIN-код"
    → the real `RewardVideoModal` card, confirming `title="Диктант готов —
    молодец!"` renders and the flow reaches the actual shared component
    rather than the old placeholder. Did not separately re-screenshot the
    cancel-back-to-idle path or the `videoRewardEnabled: false` "Готово"
    path — both are unchanged code from the prior (already-verified) entry,
    only the "Всё верно" branch changed here.
  - **Still not done (as of this entry)**: `videoRewardEnabled` couldn't
    actually be turned on for Диктант from the real options screen yet —
    only hardcoded via a dev-preview task object as done here. Real Gemini
    TTS audio generation for dictation items also hasn't been started.
- **The `isPropis` "known follow-up" above turned out to be a non-issue —
  corrected 2026-09-17, no code change needed.** Went to actually build the
  mode-aware `isPropis` fix and first live-rendered `ParamsScreen` for the
  Диктант mode via a dev-preview harness (`useAppStore.setState` seeded with
  a fake `topicRecord` built straight from `tools/propis/topic.json`, wrapped
  in `TimerProvider` since `ParamsScreen` calls `useTimer()` unconditionally)
  to confirm the toggle was actually hidden before touching anything.
  It wasn't: `isPropis` only gates two things —
  the standalone "Видео-награда" toggle rendered separately around line
  ~2036 (tied to the *topic-wide*, threshold-based `link.videoRewardEnabled`
  / `buildRewardProgress` pipeline that's genuinely dead for propis) and
  `bypassPin` for the pre-session PIN gate. Диктант's own `videoRewardEnabled`
  is a completely different thing: a normal **mode-scoped param**
  (`mode.params.videoRewardEnabled`, `type: "boolean"`) rendered through
  `renderParam()`'s generic per-mode-param loop (`paramsContent`'s
  non-`isReading` branch) — a code path that was never gated by `isPropis` in
  the first place. Screenshotted it live: the "Видео-награда за диктант"
  toggle renders under "Сколько раз можно повторить", flips on/off on click,
  and its value flows into `params` → `sessionParams.videoRewardEnabled` in
  `engine.js` exactly as designed. The original doc entry above was written
  before this was actually tested and turned out to be wrong; leaving it in
  place rather than deleting it, since this repo's convention is to record
  what was believed at the time, not silently rewrite history. Only a
  clarifying comment updated in `ParamsScreen.jsx` next to `isPropis` — no
  logic changed.
- **`scripts/generate-propis-dictation-audio.mjs` — written 2026-09-17, not
  yet run.** Same pipeline as `generate-word-agreement-audio.mjs`: Gemini
  native TTS (`gemini-2.5-flash-preview-tts`, voice `Kore`), raw PCM encoded
  to MP3 via `@breezystack/lamejs`, `GEMINI_API_KEY` via
  `scripts/lib/gemini-key.mjs`, resumable (skips files that already exist
  unless `--force`), same daily-CreateVoice-quota detection that stops
  cleanly instead of retrying into a wall that won't move until tomorrow.
  Output: `public/audio/propis-dictation/<key>.mp3` — a static path shipped
  with the app itself, matching `dictationAudioUrl()` in `dictationAudio.js`
  exactly, **not** routed through `build-propis-deck.mjs`'s zip (this mode's
  audio has nothing to do with the print-PDF assets that zip bundles).
  - **Content read straight from `tools/propis/topic.json`**, not a separate
    hardcoded list: letters (`cards[]` filtered to `type: "letter"` with
    captured strokes), words (`words[]`), text sentences (`texts[]` run
    through `dictationAudio.js`'s own `splitIntoSentences` — the exact same
    function `engine.js`'s dictation branch uses for playback, so the audio
    keys this script writes are guaranteed to match the keys the app looks
    up at runtime rather than a second, driftable copy of the splitting
    logic). Reuses `letterDictationKey`/`wordDictationKey`/
    `textSentenceDictationKey` from `dictationAudio.js` directly for the
    same reason.
  - **Verified without spending any TTS quota**: imports resolve and the
    script fails cleanly and immediately on the expected "GEMINI_API_KEY not
    found" error (no key is configured in this environment — the summary
    from an earlier session already flagged this as blocking real
    generation, still true here). Separately re-derived `buildEntries()`'s
    counts inline (bypassing the API-key gate) to confirm the real numbers
    before trusting the script: 73 letters + 249 words + 120 text-sentences
    = **442 unique keys, zero collisions**.
  - **Not run — no `GEMINI_API_KEY` available in this environment.** Per
    `generate-word-agreement-audio.mjs`'s own comments, the free/Tier-1 key
    is hard-capped at 100 CreateVoice requests/day, so even with a key this
    would take ~5 daily runs to cover all 442 clips (re-running without
    `--force` picks up exactly where the previous run stopped). Whoever runs
    this needs a `.env`/`.env.local` with `GEMINI_API_KEY` set, per
    `scripts/lib/gemini-key.mjs`. `--only=letters|words|texts` is supported
    for running one bank at a time if that's more convenient than the full
    442-item pass.
- **Real bug caught by the user running it, fixed 2026-09-17: letters were
  sending bare `card.label` to Gemini TTS, not "заглавная А"/"строчная а".**
  User ran a real letters batch and reported "в промпте на генерацию полная
  фигня, по крайней мере на буквы" — the spoken text for a letter entry was
  literally just the character itself (e.g. `"а"` or `"А"`), no case word.
  A single Cyrillic character with nothing else around it isn't something
  Gemini TTS reads cleanly as a letter name — it produces garbage, exactly
  what got reported. This directly contradicted the design this script's own
  header comment already claimed ("заглавная А"/"строчная а" get their own
  clips) — the comment was right about the intent, the code just never
  actually built that phrase; `buildEntries()`'s letters branch pushed
  `text: card.label` instead of the case-prefixed phrase. Fixed by importing
  `isUpperCaseLetterCard` from `dictationAudio.js` and building
  `` `${caseWord} ${card.label}` `` (`caseWord` = "заглавная"/"строчная")
  as the actual spoken text — words and texts were unaffected, they were
  already spoken as-is. Also reworded both this script's header comment and
  `dictationAudio.js`'s own comment above `letterDictationKey` — the
  original phrasing ("not one clip with a spoken case prefix") read as
  ambiguous enough to plausibly cause exactly this mistake; reworded to say
  outright that the SPOKEN TEXT must include the case word, never the bare
  character.
  - **Verified the fix without spending TTS quota** (same constraint as the
    entry above — no `GEMINI_API_KEY` in this environment): re-derived
    `buildEntries()`'s letters branch inline against the real
    `tools/propis/topic.json` data and printed the first 6 resulting
    `{key, text}` pairs — `up_б → "заглавная Б"`, `lo_б → "строчная б"`,
    `up_а → "заглавная А"`, `lo_а → "строчная а"`, etc. — confirming the
    actual phrase Gemini will receive now, not just that the code compiles.
    Full propis test suite (100 tests) and `npm run build` still clean.
- **First real captures ingested into `tools/propis/elements.json`, 2026-09-17
  — two rounds, now 12/27.** Round 1 (3 elements): `02a_naklonnaya_dlinnaya`,
  `02b_naklonnaya_korotkaya`, `03_zaborchik_ploskie` — verified by measuring
  each stroke's angle from vertical against the real scan (02a/02b/03's
  diagonal side all landed at ~25°, the book's own standard slant; 02a's
  span was ~2× 02b's, matching long/short) before trusting the labels.
  Deliberately did NOT ingest that round's own `01_pryamaya_liniya` capture
  — one of its 3 strokes was a stray/out-of-bounds scribble (y up to 228 in
  a declared 150-tall viewBox, nowhere near the other two strokes'
  coordinates) — flagged it to the user instead of baking in bad data.
  - **Round 2 (10 elements, once the free-text element field above was
    live)**: a clean recapture of `01_pryamaya_liniya` (2 strokes this
    time, no stray artifact — verified), a recapture of
    `03_zaborchik_ploskie` (the ingestion script's own id-based upsert
    handles this as an update, not a duplicate), plus `02c_vertikalnaya`,
    `04_zaborchik_ostrye`, `05_kryuchok_vlevo`, `06_kryuchok_vpravo` (all
    already in `REGISTRY`) — **and four more the user captured under
    their own ad-hoc labels** (`Заборчик мал.`, `Заборчик_остр.мал`,
    `05_kryuchok_vlevo.мал`, `06_kryuchok_vpravo.мал`) that weren't in
    `REGISTRY` at all.
  - **Those four are deliberately NOT in the source book** — the book only
    ever shows one height for 01/03/04/05/06's drills (see the pixel
    measurement two entries above: 01's two printed rows are identical
    height, not wide/narrow). The user captured a second, independently
    hand-drawn half-height trace of 03/04/05/06 anyway, on their own
    initiative once free typing was possible, for use in the app at a
    narrower ruling than the book itself uses. Checked this wasn't
    accidental noise before accepting it: computed each pair's bounding-box
    y-span (`03`: 52.6 → `Заборчик мал.`: 27.2; `04`: 50.0 → 24.3; `05`:
    50.0 → 24.3; `06`: 49.2 → 24.0) — every "мал." capture lands at ~48-54%
    of its full-size sibling's height, matching 02a→02b's own ~46% ratio
    closely enough to be a real, deliberate half-scale trace, not a
    duplicate or a mis-click.
  - **Renamed to canonical slugs before ingesting**, rather than keeping
    the user's ad-hoc labels as permanent ids: `03_zaborchik_ploskie_uzkaya`,
    `04_zaborchik_ostrye_uzkaya`, `05_kryuchok_vlevo_uzkaya`,
    `06_kryuchok_vpravo_uzkaya` — `_uzkaya` ("узкая", narrow) rather than
    a literal translation of "мал." ("small"), matching
    `propisRuling.js`'s own established "узкая строка" terminology for a
    tighter ruling, not inventing new vocabulary. Added all four to
    `REGISTRY` (`scripts/propis_ingest_elements.mjs`) and to
    `handwriting_capture.html`'s `#elementDatalist` (kept in sync by hand,
    same convention as every other entry there) — inventory is now 27,
    not 23. The registry's own header comment now explains these four are
    an app-side addition, not book content, so a later reader doesn't go
    hunting for a "narrow" row on page 5/6 that was never there.
  - **Verified visually**: rendered all 12 ingested elements together on
    the real `propisRuling.js` ruling geometry (same dev-preview approach
    as the earlier mockup) and screenshotted them as one grid — every
    shape matches its label (hook direction, fence tooth shape, diagonal
    vs. vertical), and every `_uzkaya` sibling reads as a visibly smaller
    version of its full-size counterpart at a glance, not just by the
    measured numbers. `npm run build` and the full propis test suite
    (100 tests) still clean after both the registry and data changes.
- **The verification above used the wrong coordinate transform — caught by
  the user, fixed same day.** Reported (correctly) that full-size elements
  didn't reach the height of the wide ruling zone in the screenshot, that
  `02b_naklonnaya_korotkaya` looked short despite being drawn precisely,
  and that `02c_vertikalnaya` looked identical to the short diagonal.
  - **Root cause, first two reports**: the dev-preview mockup scaled
    captured native coordinates by `LINE_MM / UNIT_H` (25/150) with no
    offset — treating the NATIVE_L1..L7 capture grid
    (`handwriting_capture.html`'s `drawRuling()`, what elements are
    actually drawn against) as if it were the same system as this file's
    own `L1`-`L4` mm ruling. `propisRuling.js`'s own comment on
    `NATIVE_L1` says outright these are different systems that "can never
    be accidentally interchanged" — missed that warning when building the
    mockup. The correct mapping is affine, not a bare scale: subtract the
    `NATIVE_L1` offset (row top in native units = 10) first, then scale by
    `LINE_MM / (NATIVE_L4 - NATIVE_L1)` (25/130 ≈ 0.1923, not 25/150 ≈
    0.1667). Verified this lands the native guide lines exactly on their
    mm counterparts: `NATIVE_L2`(62) → 10mm (= this file's own `L2`),
    `NATIVE_L3`(88) → 15mm (= `L3`, the bold baseline) — confirming
    `02b`'s own capture (native y 63.12–86.19) really does span almost
    exactly the real ruling's узкая строка (10–15mm) once converted
    correctly, exactly as the user said they'd drawn it. Re-rendered all
    11 elements with the corrected transform and re-screenshotted:
    full-size elements now visibly fill the wide-ruling zone, `_uzkaya`
    siblings land inside the узкая строка band instead of floating short
    of it. This was a mockup-only bug — nothing shipped depends on it,
    since propis doesn't have a Mode-2 element-practice screen yet.
  - **Third report was a real data problem, not a rendering one**:
    `02c_vertikalnaya`'s captured stroke measured at ~24° from vertical —
    matching `02a`/`02b`'s own diagonal slant almost exactly, not a
    vertical line at all. The user confirmed they hadn't actually drawn
    the vertical yet. Removed the `02c_vertikalnaya` entry from
    `tools/propis/elements.json` entirely rather than keep bad data
    around — inventory is back to 11/27 until a real vertical capture
    comes in. `02c_vertikalnaya` stays in `REGISTRY`/the datalist, just
    uncaptured.
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

### "Элементы букв" option: rows of repeated pre-writing elements instead of text

2026-09-17. User request: "в режиме тетрадный лист нужно добавить опцию
Элементы букв которая переключает строки на выставление элементов вместо
букв" — a per-mode toggle (`useElements`, `topic.json`'s `read_lines.params`)
that switches every row in the session from free-typed cursive text to a
single picked pre-writing element (крючки, петли, заборчики...) repeated
across the row, matching how these elements are drilled in the physical
copybook. Confirmed scope via 2 follow-up questions: **one element per row,
auto-repeated to fill it** (not a mix of several elements in one row), and
**the whole session is text-only or elements-only** (a mode-wide toggle, not
per-row mixing) — "Один элемент повторяется на всю строку, как в книге. В
одной строке только элементы."

**Data pipeline**: elements live in `tools/propis/elements.json` (grown
incrementally via `scripts/propis_ingest_elements.mjs`, see the ingestion
sections above), kept separate from `topic.json` to avoid diff churn on every
single capture. `scripts/build-propis-deck.mjs` now merges it into the
*shipped* `topic.json` at build time only, as a new top-level `elements` key
(the same pattern the script already uses for binary `ASSET_DIRS`) — so the
source files stay small and independently-diffable, but the deck the app
actually downloads carries everything this feature needs.
`useSessionEngine.js` already passed the *full* `topicRecord` object (not
just `.cards`) into `generateTasks` for the "Диктант" word/text banks, so
`engine.js` just destructures one more bank the same way:
`const elementBank = Array.isArray(cards) ? [] : (cards?.elements ?? []);`
— defaults to `[]` for plain-array test fixtures, since no other propis mode
had this bank before.

**Picker UI**: `ParamsScreen.jsx`'s existing `LineListParam` (the free-text
line editor added earlier this session, see above) grew a `useElements`/
`elements` prop pair. When `useElements` is true, each row renders as a
button showing the picked element's `labelRu` (or a "Строка N — выбрать
элемент" placeholder) instead of a text `<input>`; tapping it opens
`ElementPickerModal`, a grid of `ElementPreviewSvg` cards — each one a real
miniature ruled-line card (built from `propisRuling.js`'s own
`buildRowGuideLines`/`buildDiagonalLines`, not a hand-rolled approximation)
with the element's actual captured strokes drawn on it at true relative
scale, so the picker doubles as a legend of what each element looks like on
paper. Tapping a card writes the element's `id` into that row (reusing
`updateLine`) and closes the picker.

**Engine/render wiring**: `engine.js`'s `read_lines` branch adds
`useElements` and the full `elements` bank to the `print_page` task (lines
still get trimmed/blank-filtered as before — an element row's "text" is just
its `id` string). `wordEngine.js` gets a new `layoutElementLinesIntoRows`
sibling to the existing `layoutTextIntoRows`, producing the same
`{placed, rowCount}` shape so `paginateRows` needs no changes: for each line
(one element id), it repeats `{type: "element", xOffset, strokes, width}`
segments left-to-right until the next copy would overflow
`CONTENT_W_UNITS`, mirroring the physical book's "fill the row" layout.
`PrintPageView.jsx`'s per-segment render switch gets a matching `"element"`
branch — `<AnimatedStrokes trajectory={{strokes: seg.strokes}} tipSize="large" />`
when active, static `<path>` outlines otherwise — copied from the existing
`"cursive"` branch since a captured element's `strokes` array already has
the exact shape `AnimatedStrokes` expects.

**Bug found and fixed during visual verification (self-caught, before
presenting to the user)**: the first implementation reused
`layoutTextIntoRows`'s row pitch (`TEXT_ROW_PITCH` = 72 native units = 12mm,
tuned for flowing cursive text, whose ink rarely spans the full
ascender-to-descender range) for element rows too. Screenshotting it showed
large elements (whose captured height can reach the full
`NATIVE_L4 - NATIVE_L1` = 130 native units) visibly overlapping the row
above. Root cause: the *card* geometry elements are captured against (a full
single notebook line, ascender gap to descender gap) is much taller than the
*tight* pitch text rows use — the two were never meant to share a spacing
constant. Fix: a new `ELEMENT_ROW_PHYSICAL_SLOTS = 2` constant in
`wordEngine.js` — each logical element row now consumes **two** of
`PrintPageView`'s physical row slots (`rowIndex = i * 2`, so row 0, 2, 4, ...
instead of 0, 1, 2, ...), giving 144 native units of headroom per element
row (comfortably over the 130-unit worst case) at the cost of roughly half
as many element-rows fitting per printed page versus text-rows; the unused
odd slot between element-rows doubles as natural breathing room. Verified
via a second dev-preview screenshot round showing 6 cleanly-separated
element rows with no overlap.

Test coverage: `wordEngine.test.js` gained a
`layoutElementLinesIntoRows` describe block (repeat-to-fill-row including
the "one more copy would overflow" boundary, the `rowIndex` 0/2/4 physical-
slot sequence + resulting `rowCount`, and an unknown-element-id row falling
back to an empty `segments: []` rather than throwing).
`engine.test.js` gained a `read_lines` describe block covering both the
plain-array-cards default (`useElements: false`, `elements: []`) and the
full topicRecord pass-through (`useElements: true` plus the `elements`
bank arriving unchanged in the task).

Shipped with 11/27 captured elements (per the user's explicit "Делаем
сейчас" — don't wait for full digitization); the remaining elements keep
being captured independently via the free-text-enabled
`handwriting_capture.html` and ingested the same way as before, with no
further code changes needed as the bank grows.

**Post-deploy bug: picker showed an empty list in production (2026-09-17).**
The deployed deck ZIP had `elements` (11 entries, verified via `unzip -p ...
topic.json`) and `engine.js`/`ParamsScreen.jsx` correctly read
`topicRecord.elements` — but `topicLoader.js`'s `importTopic()`, which
installs a downloaded deck ZIP into IndexedDB, builds its persisted
`record` object by **explicitly whitelisting fields** (`meta`, `modes`,
`cards`, `texts`, `categories`, `items`, ...) rather than spreading the
parsed manifest — a pattern every earlier normalizer in this file (
`normalizeProcedural`/`normalizeReading`, both `{ ...manifest, ... }`)
does NOT follow, which is exactly why this one field silently vanished
between "in the ZIP" and "in the app". `elements` was never added to
that whitelist when this feature was built, so the freshly-fetched
manifest's `elements` bank was dropped at the exact point it got saved to
IndexedDB — invisible in a dev-preview harness (which builds/reads
`topicRecord` directly, bypassing `importTopic` entirely) and only
reachable by testing the real app against a real downloaded deck, which
is how the user caught it. Fixed by adding `elements: manifest.elements ??
undefined` next to `categories`/`items` in that same `record` object.

**Also had to bump the deck version** (`1.30.0` -> `1.30.1`, no other
manifest change): `catalogService.js`'s `silentUpdateOutdatedTopics`
only re-downloads+re-imports a deck when `installed.meta.version !==
catalog.version`, so shipping the code fix alone would have left
anyone who'd already installed `1.30.0` (with the bug) stuck on that
broken cached IndexedDB record forever, with no re-fetch ever triggered
by the version check.

**Revised to a single start-of-row element with a start dot (2026-09-17,
same day, right after the picker-empty fix).** The first shipped version
matched the user's original "Один элемент повторяется на всю строку, как
в книге" instruction literally: `layoutElementLinesIntoRows` repeated the
element left-to-right until the next copy would overflow
`CONTENT_W_UNITS`. Once actually looking at the printed result, the user
asked for the opposite of "fill the row" — just the single drill
instance at the row's start, with a dot marking where the trajectory
begins (a physical worksheet landmark: this mode's whole point is
printing a page to trace by hand, so "where do I put my pen" matters as
much as "what shape do I draw"). Changed
`layoutElementLinesIntoRows(lines, elementsByLabel)` (dropped the now-
unused `rowWidthUnits` param and the `ELEMENT_REPEAT_GAP_UNITS` constant)
to emit exactly one `{type: "element", xOffset: 0, ...}` segment per row,
plus a new `startPoint` field: `getPathEndpoints(element.strokes[0].d)
.start` — the same `pathGeometry.js` helper `wordEngine.js` already uses
for connector-chaining, so no new geometry code, just a new call site.
`PrintPageView.jsx`'s `"element"` render branch draws a small `<circle>`
(`ELEMENT_START_DOT_R = 6` native units ≈ 1mm radius) at that point,
inside the same `<g transform="translate(xOffset 0)">` the strokes
themselves render in — no separate coordinate transform needed, since
`startPoint` is already in the element's own native path-coordinate
space (the exact space the earlier `NATIVE_L1..L4` vs. this file's own
`L1-L4` mixup bit us in, so this was checked by rendering a real
dev-preview page rather than trusting the math by eye — the dot landed
exactly on each stroke's own starting pixel for all 3 test elements).
Kept visible during the tap-to-animate state too (drawn last, on top) —
it's a static print/reference landmark, not part of the pen-tracing
animation itself.

**Row ruling didn't match the element's own captured height (2026-09-17,
same day, right after the start-dot revision).** User: "Высота элементов
тоже не соответствует высоте строк, исправь." Root cause: an "Элементы
букв" row still drew the same ruling `layoutTextIntoRows`' rows use —
just a thin auxiliary line (`TEXT_ROW_THIN_OFFSET`=24 units above
baseline) plus the bold baseline itself, a 24-unit-tall band sized for
flowing CURSIVE TEXT (whose own ink rarely reaches far past that,
per `TEXT_ROW_PITCH`'s own measured-ascender/descender comment). An
element's strokes are captured against the FULL `NATIVE_L1`(row
top)..`NATIVE_L4`(row bottom) span on purpose — a 130-unit range — so
next to that skinny 24-unit guide, the element visually blew straight
past both ends with nothing marking where "the row" it belongs to
actually starts or stops.

Fix: `PrintPageView.jsx` now draws one of two DIFFERENT row rulings
depending on `task.useElements` — the existing thin+bold pair for text
rows (unchanged), or a new 4-line `ELEMENT_ROW_GUIDES` set
(`NATIVE_L1`/`NATIVE_L2`/`NATIVE_L3`-bold/`NATIVE_L4`, i.e. the same
ascender-top/x-height-top/baseline/descender-bottom shape
`GUIDE_LINES`/`buildRowGuideLines` already use elsewhere) for element
rows — drawn only at `ELEMENT_ROW_INDICES` (every
`ELEMENT_ROW_PHYSICAL_SLOTS`-th physical slot, now exported from
`wordEngine.js` instead of a locally re-guessed "2" — the "spare"
breathing-room slot between two element rows gets no ruling of its own).

**First attempt at this shipped with an off-by-one-baseline bug**, caught
before committing by checking actual rendered `<line>`/stroke coordinates
via a Playwright `page.evaluate()` (not by eyeballing a screenshot — the
same lesson as the earlier `NATIVE_L1..L4` vs. this file's own `L1-L4`
mixup: trust computed numbers over a glance). The new guide lines were
positioned at `rowOriginY(row) + g.u - NATIVE_L3`, mirroring the OLD
text-row bold-baseline line's formula (`rowOriginY(row) + NATIVE_L3`)
too literally — that formula's `+ NATIVE_L3` term exists ONLY because
the text ruling's own reference point (`g.u`) was always exactly
`NATIVE_L3` (the baseline itself, no separate variable needed); once
`g.u` became a genuinely varying per-line value (`NATIVE_L1`/`L2`/`L3`/
`L4`), subtracting `NATIVE_L3` a second time shifted every element-row
guide line up by a full 88 units — while the strokes themselves (placed
via the unrelated `translate(x, rowOriginY(row))` on their own `<g>`,
never touched by this bug) stayed exactly where they were captured.
`page.evaluate()` on a live page showed row 0's guide `y1`s as
`-94, -42, -16, 36` against the first element's own stroke bounding box
sitting at local y≈9.8 (i.e. absolute y≈-6, nowhere near any of those
four numbers) — confirming the mismatch numerically before it was
"fixed" a second time. Corrected formula: `rowOriginY(row) + g.u` (no
subtraction at all — `g.u` already IS the absolute-native-space value to
place). Re-verified the same way: row 0's guides landed at
`-6, 46, 72, 124`, and 01_pryamaya_liniya's own two strokes (native
y≈9.8 and y≈61.6) landed within 0.2-0.4 units of the `NATIVE_L1`(-6) and
`NATIVE_L2`(46) guides respectively — as close as real captured ink
(never drawn exactly ON a guide line) should get.

Also widened the tap-to-animate hit-rect for element rows
(`ELEMENT_ROW_PHYSICAL_SLOTS * TEXT_ROW_PITCH` tall instead of just
`TEXT_ROW_PITCH`) — a secondary consequence of the same height gap: the
old hit-rect only covered the narrow text-row band, so tapping near the
top or bottom of a tall element (outside that band) wouldn't register.

**That height fix's own regression: the "spare" slot went completely
unruled (2026-09-18).** The height fix above didn't just ADD the 4-line
`ELEMENT_ROW_GUIDES` set — it REPLACED the base thin+bold ruling
entirely, drawing it only at the primary (`ELEMENT_ROW_INDICES`, every
`ELEMENT_ROW_PHYSICAL_SLOTS`-th) row and nothing at all at the spare
row in between. Reported the same way `TEXT_ROW_PITCH`'s own comment
already warns about for the narrow/text case ("the original 'extra
blank ruled line between every text line' bug, 2026-08-19") — just now
for the wide/element case instead: "Пропускаются широкие строки, как
раньше были с узкими" (a screenshot showed real blank, unruled gaps of
paper between elements, not just extra breathing room). Fix: keep the
base thin+bold ruling drawn on EVERY row unconditionally (exactly as
text mode always did — the `useElements` branch was removed from that
part entirely), and layer two EXTRA lines (`ELEMENT_EXTRA_GUIDES`:
ascender-top `NATIVE_L1`, descender-bottom `NATIVE_L4`) on top, only at
the primary row of each element pair. Nothing is ever left unruled
again; the tall element rows just get 2 additional marks over the
normal continuous ruling instead of a wholesale replacement.

**A second, latent bug found and fixed in the same pass: element
rows drift out of alignment on every page after the first.**
`PRINT_ROWS_PER_PAGE` (17, the real print page's own physical row
count) is ODD, but element rows always advance in pairs
(`ELEMENT_ROW_PHYSICAL_SLOTS`=2). `paginateRows`' own pagination wraps
each row's GLOBAL index via `rowIndex % rowsPerPage` — since 17 is odd,
crossing into page 1 (global row 17+) flips which local rows are even:
page 0's elements land at local rows 0,2,4,...,16 (matching
`ELEMENT_ROW_INDICES`' own even-only guide lines, correct by luck), but
page 1's would land at local 1,3,5,...,15 — ALL ODD, a full
`TEXT_ROW_PITCH` off from any guide line at all, drifting to a
different, still-wrong parity on every subsequent page. Not visible in
a same-page screenshot (the reported bug above only needed ≤8 elements
to reproduce), but confirmed by rendering 12 elements — the DOM's own
`transform` on page 1's first element read `translate(24 -16)` BEFORE
this fix, where `-16` is `rowOriginY(0)`, the exact value a CORRECT
local row 0 should have, but page 1's actual local rowIndex was 1
(`rowOriginY(1)`), not 0. Fix: for element mode, round
`PRINT_ROWS_PER_PAGE` DOWN to the nearest multiple of
`ELEMENT_ROW_PHYSICAL_SLOTS` (17 -> 16) before calling `paginateRows`,
so every page's own local slot 0 is always primary regardless of how
many pages came before — at the cost of the very last physical row (16)
on each page never holding an element (extra bottom margin, not a
bug). `ROW_INDICES`/the base ruling itself is unaffected (still all 17
real physical rows) — only the pagination row-count used for CONTENT
placement changes for `useElements`. Verified by rendering 12 elements
across 2 pages and navigating to page 2: the first element there landed
at `translate(24 -16)` (correct primary-row position) after the fix.

**Third redesign: elements shrink to fit ONE ordinary row instead of
widening the row to fit the element (2026-09-18, same day, after
both fixes above shipped and the user still saw a broken page).**
Two separate real bugs turned up in the field, both traced back to
the SAME root design choice (elements kept their full captured scale,
NATIVE_L1..L4 = the whole physical row, and the row itself grew to
fit them):

1. **"Doubled" ruling lines**, found by pixel-diffing the user's own
   photo (`PIL`, cropping+4x-upscaling the suspect band rather than
   trusting a description) against a fresh render: the "spare" row's
   own base thin/bold pair sits only ~4 native units away from the
   *previous* primary row's `ELEMENT_EXTRA_GUIDES` bottom mark
   (`NATIVE_L4`=140, vs. the spare row's own thin line at local
   136) — two DIFFERENT lines, each individually "correct" by its own
   row's math, landing close enough together to read as one doubled
   line. The extra guides were never contained to their own row's
   space; they spilled into the neighbor's.
2. **"Elements skip every other row"** — not actually a bug (verified:
   elements landed exactly on every *primary* row, by design), but
   flagged by the user as unwanted once they could see it clearly
   against the now-fixed base ruling. This was never actually
   user-approved — it was this session's own recommendation, adopted
   under time pressure (see the very first height-mismatch fix's own
   note on a Stop-hook forcing a commit before the user could weigh
   in) — so once explicitly asked, "как в книге" (full scale, sparse)
   lost to "плотно" (dense, one row) via `AskUserQuestion`.

Rather than patch the guide-spillover bug in place a third time, both
problems dissolved by inverting the whole approach: instead of making
the ROW match the element's captured scale, make the ELEMENT match the
row's. `wordEngine.js` gained `ELEMENT_SCALE = TEXT_ROW_PITCH /
(NATIVE_L4 - NATIVE_L1)` (72/130 ≈ 0.554) and `layoutElementLinesIntoRows`
now runs every element's own strokes through the existing
`transformPathD` helper (`pathGeometry.js`, already used elsewhere for
translating connector strokes — no new geometry code) with
`scaleX: scaleY: ELEMENT_SCALE` and `translateY: NATIVE_L3 * (1 -
ELEMENT_SCALE)` — a scale anchored on the baseline itself, so a scaled
element still sits on the exact same baseline every ordinary text row
already uses, instead of drifting off it. `rowIndex` is plain `i` again
(one physical row slot per element, matching `layoutTextIntoRows`
exactly), and `startPoint`/`width` are computed from the *scaled*
stroke data so the start dot and hit-rect land on the shrunk shape, not
the original.

This let `PrintPageView.jsx` drop everything `useElements`-specific
added by the two previous fixes: `ELEMENT_ROW_GUIDES`/
`ELEMENT_EXTRA_GUIDES`, the even-row-only pagination adjustment, and
the widened tap hit-rect — the base ruling, `paginateRows` call, and
hit-rect are now byte-for-byte the same code path text rows use. No
per-mode branching left in the ruling/pagination/hit-rect code at all;
`layoutElementLinesIntoRows` returns the exact `{placed, rowCount}`
shape `layoutTextIntoRows` does, with `rowIndex` in the same single-slot
units.

Re-verified the same way as every fix in this cluster — real rendered
DOM, not eyeballing: ruling lines back to a clean, unbroken thin/bold
pair at every single row (`y1` 48/72, 120/144, 192/216, ... all exactly
72 apart, `sw` alternating 0.4/0.9, no extras); element rows landing at
consecutive `rowIndex` 0,1,2,3,4 (`rowOriginY` -16,56,128,200,272, each
exactly `TEXT_ROW_PITCH` apart) — dense, no gaps, no doubling.

**That redesign's own bug: the scale anchor assumed every element's raw
data already touched the baseline, which it doesn't (2026-09-18, same
day, next report: "элемент стоит не на своём месте").** The dense
layout above scaled around a FIXED `NATIVE_L3` (baseline) anchor,
carrying over the same unstated assumption letters get for free (a
letter's own captured stroke is drawn ending at/near the baseline by
construction). Checking `elements.json` directly (`node -e` dumping
each element's own native y-range) showed that assumption is false for
elements: the captures split into two disjoint bands that never
actually reach `NATIVE_L3`=88 —
```
01_pryamaya_liniya        y 9.8  - 62.1
02a_naklonnaya_dlinnaya    y 10.6 - 61.0
03_zaborchik_ploskie       y 10.3 - 62.9   } "wide-row" family — tops out at NATIVE_L2=62
04_zaborchik_ostrye        y 11.2 - 61.2   } (the wide row's own x-height-top guide),
05_kryuchok_vlevo          y 11.1 - 61.1   } never approaches the baseline at all
06_kryuchok_vpravo         y 11.1 - 60.2
02b_naklonnaya_korotkaya      y 63.1 - 86.2
03_zaborchik_ploskie_uzkaya    y 60.3 - 87.5  } "_uzkaya" (narrow-row) family — captured
04_zaborchik_ostrye_uzkaya     y 62.8 - 87.1  } lower, close to but still short of 88
05_kryuchok_vlevo_uzkaya       y 63.4 - 87.7
06_kryuchok_vpravo_uzkaya      y 62.6 - 86.6
```
This is the same "широкая/узкая строка" split from earlier in this doc
(elements drilled in the physical book's wide vs. narrow ruled row are
genuinely different captures, not a scale difference) — but it also
means the two families were never captured against a shared baseline
convention the way letters are. Anchoring the scale on `NATIVE_L3`
scaled each element AROUND a point its own data never reaches, leaving
it floating in the upper portion of its row instead of sitting on the
baseline the way a real drilled element (pen starts high, comes down to
touch the writing line) or a letter does.

Fix: anchor on each element's OWN lowest captured point instead of a
shared constant. `layoutElementLinesIntoRows` now runs every stroke
through `samplePath` (flattening the Béziers, not just their M/C
endpoints — a curve's deepest point isn't always at an endpoint) to
find `elementMaxY`, then solves for the `translateY` that puts THAT
point exactly on `NATIVE_L3` after scaling: `translateY = NATIVE_L3 -
elementMaxY * ELEMENT_SCALE` (replacing the old fixed `NATIVE_L3 * (1 -
ELEMENT_SCALE)`). Works identically for either capture band — the wide
family's own bottom (~62) and the narrow family's own bottom (~87) each
land on 88 post-transform, without needing to know which band a given
element came from.

Verified via real rendered DOM (not eyeballing, same discipline as
every fix in this cluster) across a 5-element mix of both families:
every row's own content bounding box bottom (`getBBox()`, in the row's
own local coordinate space) came back exactly `88` — i.e. `NATIVE_L3`
— and its absolute position (`rowOriginY + 88`) landed exactly on that
row's own bold baseline line (72, 144, 216, 288, 360 — matching the
ruling's own bold `y1`s one-for-one). A new regression test
(`wordEngine.test.js`) locks this in with a synthetic element shaped
like the real "wide-row" family (data topping out at y≈62, matching
`01_pryamaya_liniya`'s own capture) and asserts its scaled max-Y lands
on `NATIVE_L3`.

**Reverted the same day, later — the per-element anchor above was
itself wrong (2026-09-18, third report): "ты сделал все элементы в
узкой строке… это разные элементы".** Deployed as v1.0.2197, the
per-element `elementMaxY` anchor above made every single element flush
against `NATIVE_L3`, regardless of which capture band it came from.
That reads as "fixed" in isolation (nothing floats), but it erases the
actual reason the two bands exist in the first place: `elements.json`'s
"wide-row" vs. `_uzkaya` split isn't capture noise, it's each element's
real, deliberate line-binding from the source book and the capture tool
— the plain family was drawn in the row's ASCENDER zone (line 1 to line
3), the `_uzkaya` family in the NARROW/x-height zone (line 3 to line 5,
the same zone a letter's own body occupies). The capture tool
(`handwriting_capture.html`) draws the exact same `GUIDE_LINES` ruling
this app's ruling constants already are, so an element's raw native-Y
position already fully encodes which physical line it was drawn against
— that's the "привязка к линиям" the user was asking to preserve, and a
per-element self-anchor silently discards it in favor of "make it touch
the baseline no matter what."

Fix: back to a single FIXED transform, same `scaleX`/`scaleY`/
`translateY` for every element (`translateY = NATIVE_L3 * (1 -
ELEMENT_SCALE)`, the pre-v1.0.2197 formula) — no per-element
renormalization at all. Because it's one uniform affine map over the
shared native coordinate space (the same space `GUIDE_LINES`, letters,
and the capture tool's own ruling all already share), it preserves each
element's *relative* position automatically: the wide-row family's
already-higher native range stays proportionally higher after scaling
(native 9.8–62.9 → row-local ≈44.7–74.1, straddling the row's own thin
guide line at 64 from above), the narrow-row family's already-lower
range stays proportionally lower (native 60.2–87.7 → row-local
≈72.6–87.8, hugging the baseline) — computed directly from real
`elements.json` data, not synthetic. Confirms the two families really
do land in visibly different vertical bands within their own row slot,
which is exactly what "как было в мастерской" means here.

`wordEngine.test.js`'s regression test from the previous fix (asserting
every element's max-Y lands on `NATIVE_L3`) encoded the now-wrong
behavior and was replaced with two tests: one asserting a synthetic
"wide-row" element's transformed max-Y stays well short of the baseline
(`< NATIVE_L3 - 10`), one asserting a synthetic `_uzkaya` element's
stays close to it (`> NATIVE_L3 - 5`) — both driven through the same
unconditional `layoutElementLinesIntoRows` call, no per-family branch in
the code itself.

No deck-zip rebuild needed for this round: propis is the one deck-zip
topic whose ZIP carries no JS at all (`topic.json` + `print/*.pdf` +
`thumbnails/*.png` only — confirmed via `unzip -l`) — its renderer,
including `wordEngine.js`, always ships from the main app bundle
regardless of deck version (see this doc's own file-map note on this).
Only the app's own `package.json` version bump was needed.

**Third round, same day: reverted BACK to widening the row, this time
done right (2026-09-18, "ты даже в мокапе рисовал правильно, почему не
можешь также вывести в тетрадный лист?").** The "uniform fixed
transform" fix above (v1.0.2198) preserved the wide-row vs. `_uzkaya`
distinction correctly — real `elements.json` data confirmed both
families landed in visibly different bands within their shared 72-unit
row slot — but the user rejected the whole premise once shown a
reference: an existing mockup Artifact
(`https://claude.ai/artifact/31EACs4o7eMEGXqzn9skMR`, a standalone
per-element SVG card built earlier this session) renders each element
at its REAL native-to-mm scale (`transform="translate(6.25 0)
scale(0.16666666666666666)"` — exactly `1/6`, the same
`mmToNativeUnits` ratio the whole print page already uses, i.e.
effectively no compression at all, just the native-unit-IS-already-mm
convention every letter's own strokes already render in untouched) —
not `ELEMENT_SCALE` (72/130 ≈ 0.554), a SEPARATE, tighter compression
invented specifically to squeeze an element into an ordinary
`TEXT_ROW_PITCH` (72-unit) slot. The mockup's own ruling guide lines
(y=0/10/15-bold/25 in its 25mm-tall local box) are `propisRuling.js`'s
plain mm-based `L1-L4`, not `NATIVE_L1-L4` — but the element STROKES
inside it use raw, untransformed `NATIVE_*`-system coordinates (e.g.
`02a_naklonnaya_dlinnaya`'s path starts at native y=10.59, exactly
matching its own row in `elements.json`) — i.e. the mockup treats an
element exactly like a letter (`buildWordTrajectory` never scales a
letter's own `d` either), and only its RULING is drawn at a
theoretically-clean mm grid rather than the native capture-tool grid.

Confirmed via `AskUserQuestion`: the user explicitly reversed the
earlier "dense, one element = one ordinary row" choice from the redesign
above, accepting that element rows must be taller than text rows (real
native scale costs real vertical space — this IS what a physically
"wide row" in the source book means, and cramming a real elbow-room
drilling exercise into an ordinary cursive-writing row defeats its whole
purpose).

Fix (this round): elements render completely UNSCALED (`wordEngine.js`'s
`layoutElementLinesIntoRows` no longer applies any `transformPathD` at
all — `seg.strokes = element.strokes` directly, same treatment
`buildWordTrajectory` gives a letter's own `d`), and
`PrintPageView.jsx`'s element rows get their OWN dedicated pitch/ruling
instead of reusing the text row's:

- `propisRuling.js`'s new `ELEMENT_ROW_PITCH = UNIT_H` (150 native
  units = 25mm) — the SAME full capture-canvas height every element
  (and letter) is drawn against, not a second independently-chosen
  number, and not `NATIVE_L4 - NATIVE_L1` (130) either (that would tile
  rows back-to-back with zero breathing room between one row's L4 and
  the next row's L1).
- `ELEMENT_ROW_Y_SHIFT = mmToNativeUnits(PRINT_FIRST_BASELINE_MM) -
  NATIVE_L1` anchors element row 0's own TOP guide line (`NATIVE_L1`)
  where a text row's own BASELINE would sit (`PRINT_FIRST_BASELINE_MM`,
  12mm from the page top) — reuses that already-justified margin
  constant instead of inventing a new one; anchored on `NATIVE_L1`
  rather than `NATIVE_L3` because elements no longer share a single
  "baseline" reference point the way letters do (nothing is scaled
  around it anymore).
- `ELEMENT_ROWS_PER_PAGE = floor((mmToNativeUnits(PRINT_PAGE_H_MM) -
  mmToNativeUnits(PRINT_FIRST_BASELINE_MM)) / ELEMENT_ROW_PITCH)` = 7 —
  same top-margin allowance as text rows, just divided by the taller
  pitch. No real print-PDF ground truth to match here yet (element
  mode's PDF export, CLAUDE.md's "mode 2", isn't built), unlike
  `PRINT_ROWS_PER_PAGE=17`, which mirrors an existing script exactly.
- `PrintPage` (the shared per-page component) now takes a `useElements`
  prop and branches ONLY its ruling/pitch/hit-rect: element rows draw
  the full 4-line ruling (`NATIVE_L1`/`NATIVE_L2` thin, `NATIVE_L3`
  bold, `NATIVE_L4` thin — the real capture-tool ruling, matching
  `handwriting_capture.html`'s own `drawRuling()`), text rows keep the
  existing 2-line thin/bold pair. This is the SAME "widen the row"
  concept as the two approaches tried and reverted earlier the same day
  (see above) — done properly this time: exactly one element's own real
  row per print-page row (no doubled pitch, no spare blank slot), one
  ruling drawn once per row (no layering extra lines onto a
  pre-existing slot, no spillover into the neighbor).

Verified two ways: `wordEngine.test.js`'s regression coverage was
rewritten to assert the real (unscaled) native y-ranges directly instead
of a post-transform value, and a throwaway `dev-elements.jsx` render
(Playwright, 390×844 mobile viewport, 5 real elements spanning both
capture families) confirmed via real DOM inspection — `getPointAtLength`
sampling each row's own `<path>` bbox — that row origins land exactly
`ELEMENT_ROW_PITCH` (150) apart (62, 212, 362, 512, 662), each row's own
4 guide lines land at `origin + NATIVE_L1/L2/L3/L4` exactly, and each
element's own content sits at its real, untouched native y-range inside
its row (e.g. `01_pryamaya_liniya`: 9.84–62.14, matching
`elements.json` exactly) — visually: wide-row elements sit between the
row's own two upper thin lines, `_uzkaya` elements hug the bold
baseline, matching the reference mockup's proportions.

**Fourth round, same day: the combined 4-line block itself was wrong —
split into two real, separately-sized row types (2026-09-18, "широкая
со штрихом- узкаяпустая- широкая пустая- узкая пустая - широкая со
штрихом. то есть одна широкая строка получается пустой").** The
previous fix's `ELEMENT_ROW_PITCH` design gave every element the SAME
combined block (150 native units, all 4 guide lines: `NATIVE_L1`,
`NATIVE_L2`, `NATIVE_L3`-bold, `NATIVE_L4`), regardless of which zone
the element's own data actually used. That preserved the wide-vs-narrow
POSITION distinction correctly (pixel-verified against the user's own
screenshot: three real elements landed on three consecutive
`ELEMENT_ROW_PITCH`-apart rows, each in its own real native y-range, no
literal row skip) — but each element only ever used ONE of the block's
two zones (the wide family used roughly the top third, `_uzkaya` used
roughly the bottom third), leaving the REST of that same combined block
looking like extra empty ruled space the user read as a skipped row.
Confirmed via `AskUserQuestion`: each element needs its OWN row sized to
EXACTLY its real zone, consecutive rows stacked directly against each
other ("вплотную") — no combined block, no per-row filler.

Fix: two real row types instead of one combined block —
`WIDE_ROW_HEIGHT = NATIVE_L2 - NATIVE_L1` (52, the plain family's own
ascender zone) and `NARROW_ROW_HEIGHT = NATIVE_L3 - NATIVE_L2` (26, the
narrow/x-height zone). `layoutElementLinesIntoRows` now classifies each
element and translates its strokes onto a 0-based row-local origin
(`-NATIVE_L1` for a wide element, `-NATIVE_L2` for a narrow one — no
scaling, same real captured size as before), and returns each placed
row's own `rowHeightUnits`. A NEW `paginateElementRows` replaces
`paginateRows` for element mode: since rows now have variable height,
it packs by real cumulative height instead of a fixed rows-per-page
count, stacking rows with ZERO gap (a row's own bottom line doubles as
the next row's own top line, the same way a real ruled notebook page's
lines are shared between adjacent rows) — same even-page-count,
minimum-2 physical-sheet convention `paginateRows` already used.
`PrintPageView.jsx` draws ruling only for the rows actually present on
a page (no fixed row count to fill), each a plain thin-top/bold-bottom
pair sized to that row's own real height.

**Fifth round, same day: the wide/narrow classifier itself was wrong
for one specific element (2026-09-18).** The first cut classified by id
suffix (`elementId.includes("_uzkaya")`) — wrong for
`02b_naklonnaya_korotkaya`: it has no `_uzkaya` suffix at all (named
"korotkaya"/short, not "uzkaya"/narrow), but its own captured native
y-range (~63–86) sits squarely in the narrow/x-height band, not the
wide one. The id-based classifier silently gave it `WIDE_ROW_HEIGHT`
— a row twice as tall as its real content needed, reintroducing the
exact kind of extra-empty-space bug this whole redesign exists to
eliminate, just for one specific card instead of every one. Fix:
classify from the element's OWN captured data instead of its id — the
midpoint between the two bands' own anchor lines
(`(NATIVE_L2 + NATIVE_L3) / 2` = 75) cleanly separates every captured
element's own real max-Y with margin either way. The id-suffix check is
kept only as a last-resort fallback for an id with no captured data at
all (nothing else to classify by in that case). Locked in with a
regression test using `02b_naklonnaya_korotkaya`'s real capture data.

Verified via `wordEngine.test.js` (rewritten: two distinct row heights,
`paginateElementRows`' own zero-gap stacking/page-overflow/even-count
behavior, the `02b` regression) and a throwaway `dev-elements.jsx`
render (Playwright, 6 real elements spanning both families including
`02b`) confirmed via real DOM inspection that row origins land at
exactly the expected cumulative offsets (72, 124, 150, 176, 228, 254 —
diffs 52/26/26/52/26/52, matching each element's own real type with no
gap and no wasted space) and the full 4-page-cycle print-portal view
renders identically. No deck-zip rebuild needed (same reasoning as
every prior round this session — propis's ZIP carries no JS).

**Sixth round, same day: the per-row ruling itself was the wrong idea —
reuse the ordinary text grid, unmodified (2026-09-18, "ты не догоняешь
что узкие строки это не пустые промежутки, это именно узкие строки
разлиновки для прописей! эта разлиновка должна оставаться в любом
случае есть на ней символ или нет").** The fifth round's two-row-type
design (`WIDE_ROW_HEIGHT`/`NARROW_ROW_HEIGHT`, `paginateElementRows`)
drew ruling ONLY for the rows actually present on the page, sized to
exactly that row's own content — which is precisely what the user was
objecting to, even though it looked "fixed": a real ruled notebook page
prints its lines (both wide AND narrow bands) as a permanent feature of
the page, regardless of what's written where — the ruling can't
legitimately depend on content at all, any more than graph paper's grid
disappears where nothing's drawn. Every element-row ruling design tried
this session (the combined 4-line block, the two variable-height row
types) kept reintroducing some version of "ruling exists only where
there's something to rule," just shaped differently. The user pointed
directly at the fix: `layoutTextIntoRows`/`PrintPageView`'s existing
ordinary-row rendering already does this correctly (fixed
`PRINT_ROWS_PER_PAGE` rows, `TEXT_ROW_PITCH` apart, always fully ruled)
— "мы должны просто элементы строить на сетке по такому же принципу."

Fix: element mode now reuses that grid completely unmodified — no
`useElements` branch anywhere in `PrintPageView.jsx`'s ruling,
pagination, or hit-rect code at all (removed `paginateElementRows`,
`ELEMENT_PAGE_TOP_MARGIN`/`ELEMENT_PAGE_CONTENT_HEIGHT`,
`WIDE_ROW_HEIGHT`/`NARROW_ROW_HEIGHT`, the whole per-row-ruling
machinery from the fifth round). `layoutElementLinesIntoRows` goes back
to `rowIndex = i` (dense, one element per ordinary row, same as
`layoutTextIntoRows`) and keeps the element's own real captured scale
(no shrinking) but now anchors it via a plain translate onto whichever
of that row's own TWO ALREADY-EXISTING guide lines matches the
element's real family: the wide family (ascender-zone capture) onto the
row's thin line (`NATIVE_L3 - TEXT_ROW_THIN_OFFSET` = 64, the same line
a tall letter's own ascender reaches toward), the narrow family
(x-height-zone capture, `_uzkaya` and `02b_naklonnaya_korotkaya`) onto
the row's bold baseline (`NATIVE_L3` = 88, where a letter's own body
already sits) — anchored on the element's OWN lowest captured point
(`samplePath`, not raw M/C endpoints), not a fixed per-family constant,
so real per-card capture variance doesn't leave a visible gap.

Verified via `wordEngine.test.js` (rewritten around the two target
lines, an anchor-precision check, the `02b` regression re-expressed
against the new anchor) and a throwaway `dev-elements.jsx` render
(Playwright, the same 6 real elements) confirming via real DOM
inspection that the ruling is now IDENTICAL to text mode — all 17
`PRINT_ROWS_PER_PAGE` rows drawn at their fixed `TEXT_ROW_PITCH`-apart
positions (48/72, 120/144, 192/216, ... 1200/1224) regardless of how
many rows actually carry content — and each element's own lowest point
lands exactly on its target line (64 for wide, 88 for narrow,
confirmed for all 6 elements including `02b`'s 63.8 — real per-card
variance, well within the anchor's own tolerance).

**Seventh round, same day: anchoring the bottom wasn't enough — tall
elements' own TOP overran the row's real headroom (2026-09-18, "разберись
и исправь почему высокие элементы получаются выше чем высота широкой
строки").** The sixth round's fix anchored each element's bottom onto
its target line at full real scale, but never checked whether the
element's own real height actually fit the vertical room a
`TEXT_ROW_PITCH`-apart grid actually offers there. It mostly doesn't,
for the wide family specifically: `TEXT_ROW_PITCH - TEXT_ROW_THIN_OFFSET`
= 48 native units is all the headroom a wide element's top has before
running into the PREVIOUS row's own baseline (72 units above, minus the
24-unit gap already reserved for that row's own narrow-family
headroom) — but every wide-family element's own real captured height is
~49–53 native units (`elements.json`: 01 at 53.1, 02a at 50.4, 03 at
52.6, 04/05 at 50.0, 06 at 49.1), consistently a few units OVER that
48-unit budget. Anchored only at the bottom, the excess spilled upward
past the row's own real boundary into whatever the previous row was
using. A few narrow-family elements run slightly over their own
23–27-unit real height against the exact-same-sized 24-unit
thin-to-bold gap too (`03_zaborchik_ploskie_uzkaya` at 27.2 specifically).

Fix: `layoutElementLinesIntoRows` now samples each element's own real
min/max Y (not just the max used for anchoring) and computes
`scale = Math.min(1, headroom / (maxY - minY))` — `WIDE_HEADROOM` (48)
for the wide family, `NARROW_HEADROOM` (24, `TEXT_ROW_THIN_OFFSET`) for
narrow — applied as a uniform `scaleX`/`scaleY` (keeps proportions,
doesn't just vertically squash) before the same bottom-anchor
translate. `Math.min(1, ...)` guarantees this only ever shrinks an
element that doesn't already fit — an element whose real size is
already within budget (most `_uzkaya` cards, `02b`) renders completely
untouched, at its exact real captured size, same as before this fix.

Verified via `wordEngine.test.js` (two new tests: a real too-tall wide
element — mirroring `01_pryamaya_liniya`'s own ~52.2-unit span — gets
shrunk so its height no longer exceeds 48 while staying close to its
real size, not over-shrunk; an already-fitting wide element's output
`d` string is byte-identical to the unscaled anchor-only transform) and
a throwaway `dev-elements.jsx`/Playwright render across 7 real elements
(both families, including the borderline `02b` and
`03_zaborchik_ploskie_uzkaya`): every wide row's own content now spans
EXACTLY 48 units (local y 16–64) with its top landing exactly on the
previous row's own baseline (zero overlap, zero gap), and every
already-fitting narrow row's own real height (23.1–23.8) is unchanged.

**Start dots: halved, one per stroke (2026-09-18).** Two small,
unrelated polish requests on the same feature: `ELEMENT_START_DOT_R`
(the "put the pen here" landmark circle) halved from 6 to 3 native
units; and — since a multi-stroke element like `01_pryamaya_liniya`
(two separate horizontal lines) or `03_zaborchik_ploskie` (four
strokes) is really several disconnected pen-lifts, not one continuous
line — every stroke now gets its own start dot, not just the first.
`layoutElementLinesIntoRows`'s segment carries `startPoints` (an array,
one entry per stroke, each `getPathEndpoints(stroke.d).start`) instead
of the old singular `startPoint`; `PrintPageView.jsx` maps over it to
draw one `<circle>` per stroke. Verified via `wordEngine.test.js` (a
`01_pryamaya_liniya`-shaped fixture asserts exactly 2 start points, one
per stroke, each matching that stroke's own endpoint) and a throwaway
Playwright render confirming real DOM circle counts match each
element's own stroke count (`01_pryamaya_liniya`: 2,
`03_zaborchik_ploskie`: 4, a single-stroke `_uzkaya` card: 1), all at
`r=3`.

**Direction arrows: one small red arrow per stroke, at its midpoint
(2026-09-18, "маленькие красные стрелочки по направлению написания").**
New `pathGeometry.js` helper, `getMidpointTangent(d)`: finds the point
at the middle of a stroke BY ARC LENGTH (not by sample index) and the
tangent direction there. Real bug found building this: `samplePath`
only subdivides `C` (bezier) segments — a straight `M`-only polyline
like `01_pryamaya_liniya`'s own `"M 5.1 9.9 34.1 9.8"` samples to just
its 2 raw endpoints, so indexing into the sample array at the midpoint
lands on an ENDPOINT, not a real midpoint. Fixed by walking the sampled
points' cumulative segment lengths and linearly interpolating within
whichever segment crosses the half-length mark — correct for both a
sparse straight polyline and a densely-sampled bezier curve. Placed at
the midpoint (not either endpoint) specifically so it never collides
with a stroke's own start dot.

`layoutElementLinesIntoRows` computes one `directionArrows` entry per
stroke (`getMidpointTangent` applied to the already-anchored/scaled
stroke, so its point/angle already account for whatever
shrink-to-fit scale that stroke got — see the seventh round above).
`PrintPageView.jsx` renders each as a small filled red (`#dc2626`)
triangle, tip pointing along local +x, wrapped in a `<g transform=
"translate(...) rotate(...)">` using the arrow's own point/angle —
`rotate()`'s degree convention matches `Math.atan2(dy,dx)*180/PI`
directly, no extra conversion needed. Sized relative to
`ELEMENT_START_DOT_R` (comparably small, `ARROW_LEN=5`,
`ARROW_HALF_W=2.4`).

Verified via `pathGeometry.test.js` (horizontal/vertical/reversed
line fixtures confirm the midpoint and angle sign; a degenerate
single-point stroke returns `null`) and `wordEngine.test.js` (a
`01_pryamaya_liniya`-shaped two-stroke fixture asserts exactly 2
`directionArrows`, each matching `getMidpointTangent` applied to that
same already-transformed stroke) plus a throwaway Playwright render
(4x zoom crop) confirming small red arrowheads visible on every stroke
of `01_pryamaya_liniya` (2), `03_zaborchik_ploskie` (4, one per zigzag
segment, each pointing along its own real direction), and a
single-stroke `_uzkaya` card (1) — 7 arrows total, matching the 7
strokes across those 3 elements.

**Offset to the side, not sitting on the line (2026-09-18, "нужна
стрелочка рядом со штрихом, слева или снизу").** The first version
placed each arrow directly ON the stroke's own midpoint — correct
direction, but visually merged with the ink and could read as PART of
the letter shape rather than an annotation beside it. Fixed by shifting
the arrow's anchor point perpendicular to its own travel direction by
`ARROW_SIDE_OFFSET` (6 native units, `wordEngine.js`) — a deterministic
function of the angle (`sin`/`cos` of the same `angleDeg`
`getMidpointTangent` already returns), so every arrow lands on the SAME
relative side of its own stroke (not left-or-right at random depending
on which happens to have more room) — a consistent, learnable
convention across every element instead of an arbitrary per-stroke
choice. The arrow itself keeps the same rotation (still points along
the real travel direction); only its position moved.

Verified via `wordEngine.test.js` (asserts each `directionArrows` point
sits exactly `ARROW_SIDE_OFFSET` away from `getMidpointTangent`'s own
raw midpoint, perpendicular offset, not equal to it) and a throwaway
Playwright render confirming every arrow across the same 7 strokes
(`01_pryamaya_liniya`, `03_zaborchik_ploskie`, an `_uzkaya` card) sits
exactly 6 units from its own stroke's real midpoint, visibly clear of
the ink.

**Removed entirely the same day (2026-09-18, "стрелочки, честно говоря,
полная ерунда... это избыток визуальной информации").** After seeing
the offset version live, the user reconsidered the whole feature, not
just its positioning: the animation (tap-to-play) already shows
direction, the start dot already marks where to begin — a third
always-visible marker was one signal too many for what this screen
needs. Reverted completely: `layoutElementLinesIntoRows` no longer
builds `directionArrows` at all (just `startPoints`, same as before the
arrows existed), `PrintPageView.jsx` dropped the arrow `<path>`/
`ARROW_*` constants and their render block, and
`pathGeometry.js`'s `getMidpointTangent` — unused everywhere once the
arrows were gone — was deleted outright along with its own tests,
rather than left as dead code on the theory it might be reused later.

**Repeat copy: one dashed second instance per row, "joined" or "spaced"
depending on the element (2026-09-18, same day, replacing the arrows with
what the user actually asked for instead).** The arrows' own removal
message immediately continued with a different, concrete request: show
each element's own repeat pattern — some elements (заборчики) chain into
one continuous unbroken line when written in a row, others (крючки,
прямая/наклонные lines) repeat with a visible gap between instances. Design
confirmed via two rounds of `AskUserQuestion` before implementing:
- Exactly ONE extra repeat per row (not a full tiled row) — enough to show
  the pattern without turning every row into a dense repeated strip.
- Classification is per-element, stored as a new `"repeatMode":
  "joined" | "spaced"` field on each of the 11 objects in
  `tools/propis/elements.json` (not derived from id/prefix — same
  reasoning as `isNarrowElement`'s own data-based classifier, see above):
  `03_zaborchik_ploskie(_uzkaya)` and `04_zaborchik_ostrye(_uzkaya)` are
  `"joined"`; every other element (`01_pryamaya_liniya`,
  `02a_naklonnaya_dlinnaya`, `02b_naklonnaya_korotkaya`,
  `05_kryuchok_vlevo(_uzkaya)`, `06_kryuchok_vpravo(_uzkaya)`) is
  `"spaced"`.
- `"joined"`: `wordEngine.js`'s new `buildRepeatStrokes` snaps the repeat
  copy's own FIRST-stroke start point exactly onto the primary's own
  LAST-stroke end point (both axes, zero gap) — the same "exact snap"
  pattern `buildWordTrajectory` already uses for letter-to-letter joins.
  Verified against all 4 заборчик variants' real captured stroke data
  before implementing: the Y-mismatch between one copy's own end and the
  next copy's own start is under 1 native unit for every one of them, so
  the chain-snap produces a genuinely continuous line with no visible
  seam — matching "заборчик высокий... должен дать на выходе сплошную
  ломаную кривую по строке, без пропусков" instead of drawing a second,
  disconnected copy next to the first.
- `"spaced"`: the repeat is offset sideways only, by the primary's own
  real ink width (`samplePath`-measured, not the nominal viewBox box)
  plus a fixed `REPEAT_GAP_SPACED = 20` native-unit gap, keeping the same
  vertical anchor (`translateY`) the primary already has — a plain
  "draw it again over there," not a chain. 20 was picked by inspection
  against the spaced family's own real ink widths (roughly 10–31 native
  units across the 7 spaced elements) rather than derived from any one of
  them, then confirmed visually (see below) to read as a clear, evenly
  spaced gap rather than crowding the row.
- `PrintPageView.jsx` renders `seg.repeatStrokes`/`seg.repeatStartPoints`
  with the same ink color, `strokeDasharray="4 3"` and `opacity={0.5}` —
  dashed and faded so the repeat reads as "the element again," not a
  second equally weighted stroke to trace. Like the primary's own start
  dots, the repeat stays static even while the primary is animating
  (tap-to-play) — it's a print-page landmark, not part of the pen-motion
  demo.
- `seg.width` (used only for the row's own tap-hit-rect) switched from the
  primary's nominal viewBox-box width to the real ink extent of BOTH
  copies together (`Math.max` over every sampled X across primary +
  repeat strokes) — the old box-based width left the repeat poking out
  past its own row's tap target.
- Verified geometrically (not just visually) via a throwaway Playwright
  dev harness rendering `PrintPageView` with all 4 element types (a wide
  and a narrow заборчик, a крючок, прямая линия) and inspecting the
  rendered SVG's own `<path d>`/`<circle>` DOM directly: confirmed the
  "joined" repeat's own first point matches the primary's own last point
  exactly (both coordinates, to the pixel), confirmed the "spaced" repeat
  keeps the same Y as the primary and offsets X by ink-width + 20,
  confirmed dashed paths carry `stroke-dasharray` and dots carry
  `opacity="0.5"`. Screenshots additionally confirmed no visual seam on
  the joined pairs and a clear, legible gap on the spaced pairs. Dev
  harness (`src/dev-elements.jsx` + `dev-elements.html`) and the
  Playwright scripts were deleted before committing, per this doc's own
  "Verifying visual changes locally" section below.
- Because this touches `elements.json` DATA (not just code), any already-
  installed user only sees `repeatMode` after the propis deck ZIP itself
  is rebuilt (`tools/propis/build-propis-deck.mjs` merges `elements.json`
  into the ZIP's own `topic.json` copy) and republished under a bumped
  `tools/propis/topic.json` version — unlike the arrow-removal fix just
  above, which was code-only and needed no rebuild (see CLAUDE.md's own
  "Deck-zip topics load from their downloaded ZIP" section for why).

**Scope correction, same day: this whole page is a print-only worksheet target, not an
on-screen interactive demo — arrows come back, the animation/tap layer goes away
entirely.** After the repeat-copy feature above shipped, the user reconsidered a further
"tap an element to animate the whole row" idea (dashed row fills in sequentially as a pen
animates, settling into solid ink) and rejected it as unneeded complexity for a screen
interaction — then went a step further: "элементы на экране... это перебор... проще и
привычнее это делать в тетради" (elements on screen are overkill; simpler and more
familiar to do this in a physical notebook), i.e. the real product here isn't an on-screen
lesson at all, it's a **PDF worksheet generator** — "мне нужны нормальные тренировочные
тетради в пдф формате". Confirmed via two-question `AskUserQuestion` round: (1) the repeat
copy should fill the ENTIRE row edge to edge, not just one sample copy, and (2) tap-to-
animate should be removed from element rows completely, not merely made optional.

- **Direction arrows are back**, restored essentially verbatim from the same-day commits
  that had added then removed them (`e707a11`, `13e73e0`, reverted by `a53efb6`) —
  `pathGeometry.js`'s `getMidpointTangent` (arc-length midpoint + tangent angle, handles an
  `M`-only polyline correctly, see its own comment for why `samplePath`-index alone doesn't)
  and `PrintPageView.jsx`'s `ARROW_COLOR`/`ARROW_LEN`/`ARROW_HALF_W`/`ARROW_PATH` +
  `ARROW_SIDE_OFFSET` render/position them, one per stroke, offset to the side of the ink.
  The earlier removal reasoning ("оставляем анимацию... стрелочки просто ненужная инфа")
  only ever applied to a SCREEN demo where the animation already shows direction — on a
  printed page, with no animation at all, an arrow is the only way left to indicate stroke
  direction, so it's no longer redundant.
- **The single repeat copy became a whole-row chain.** `wordEngine.js`'s
  `buildRepeatStrokes` (unchanged core: one "joined" exact-snap or "spaced" fixed-gap step)
  is now wrapped by `buildRepeatChain(strokes, repeatMode, rowWidthUnits)`, which keeps
  chaining off the PREVIOUS copy (not always the primary) until the next candidate copy's
  own rightmost ink point would exceed `rowWidthUnits` — filling the row edge to edge with
  trace-guide copies the same way a real prописи workbook's practice row does, instead of
  showing just one sample. A `MAX_REPEAT_CHAIN = 200` hard cap guards against a
  pathological future element whose captured data has near-zero net horizontal advance.
  `layoutElementLinesIntoRows` now takes a required third `rowWidthUnits` argument (same
  convention as `layoutTextIntoRows`'s own required row-width parameter) —
  `PrintPageView.jsx` passes its existing `CONTENT_W_UNITS`. A segment's `repeatChain` is
  now `[{ strokes, startPoints }, ...]` (one entry per copy), replacing the flat
  `repeatStrokes`/`repeatStartPoints` pair from the single-repeat design.
- **Tap-to-animate is gone from element rows, not merely hidden.** `PrintPage` now computes
  `isElementRow = p.segments.some((seg) => seg.type === "element")` per row and skips BOTH
  the tap hit-rect (`onToggleActive && !isElementRow`) and the `isActive`/`AnimatedStrokes`
  branch for that row entirely — an element row always renders static ink (primary solid +
  arrows + dots, repeat chain dashed + faded), regardless of `activeIndex`. Cursive/text
  rows are completely unaffected (`isElementRow` is only ever true for `useElements` tasks,
  which never mix element and cursive segments on the same page). `AnimatedStrokes` is still
  imported and used for cursive rows; nothing about that mode changed.
- Verified: 121/121 propis vitest tests (multi-copy chain geometry for both joined/spaced,
  arrow angle+offset, empty-chain-when-row-too-narrow), `npm run build` clean, and a
  throwaway Playwright render (DOM-inspected, not just eyeballed: dashed-path count and
  circle count per row matched the expected `repeatChain.length`, `hasHitRect: false` on
  every element row) confirming a wide заборчик row produced 14 chained copies and a narrow
  one 22, both edge-to-edge with no clipped/overflowing tail copy, before cleanup.
- This round touches only code (arrow restoration reused existing element data,
  `elements.json` itself unchanged) — no deck-zip rebuild needed, unlike the `repeatMode`
  round just above.

**Regression, same day: "joined" chains drifted vertically across a full row — fixed by not
snapping Y at each join.** The user spotted it directly from a rendered page screenshot: both
заборчик rows visibly sagged downward toward their right edge. Root cause — the "joined"
step in `buildRepeatStrokes` snapped BOTH axes at every join (matching the next copy's own
start exactly to the previous copy's own end), and while a single joint's own Y mismatch is
under 1 native unit for every captured заборчик variant (confirmed earlier when the joined
design was first built), that per-joint tilt is the SAME sign and magnitude every step, so it
compounds linearly once `buildRepeatChain` started generating many copies to fill a whole
row instead of just one. Measured against real elements.json data at a realistic row width
(~711 units): `03_zaborchik_ploskie` −7.3 units over ~14 copies, `03_zaborchik_ploskie_uzkaya`
+9.5 over ~22, `04_zaborchik_ostrye` **−12.2 over ~29** (a quarter to a third of the row's own
24–48 unit headroom), `04_zaborchik_ostrye_uzkaya` −5.3 over ~44.

Fix: `buildRepeatStrokes`'s "joined" branch now only computes `dx` (X still snaps exactly, so
the chain stays gap-free) and drops the `dy` snap entirely — every copy is a pure horizontal
translate of the one before it, so the whole chain shares EXACTLY the primary's own Y
positions, however many copies deep. Trade-off: the same sub-1-unit Y mismatch at every
single joint that was always there and already judged imperceptible on its own — it just no
longer compounds. This matches the feature's own governing rule (content anchors to the
row's fixed ruling, never drifts with it) better than the original "exact snap on both axes"
design did.

Verified: updated the "joined" test to assert zero Y drift across the whole chain (using a
fixture with a deliberately large, exaggerated per-joint Y mismatch so a regression would
fail loudly rather than by under a unit) — 121/121 propis tests pass, `npm run build` clean.
Also re-verified via a throwaway Playwright render + direct DOM measurement of every repeat
copy's own first-stroke-start Y across both `04_zaborchik_ostrye` (29 copies) and
`03_zaborchik_ploskie_uzkaya` (22 copies): `maxDeviationFromPrimary: 0` for both, and the
screenshot confirms both rows now hold level right to the row's own edge. No `elements.json`
change, so no deck-zip rebuild needed for this fix either.

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
