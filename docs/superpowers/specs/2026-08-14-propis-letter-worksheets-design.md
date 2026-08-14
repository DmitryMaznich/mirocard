# Propis Letter Worksheets (Printable, Phase 1) — Design

## Goal

Add printable A5 worksheets for individual letter formation practice — the
first phase of a larger printed-materials arc (letters → syllables → short
words → short texts, per the user's own roadmap; only the letters phase is
in scope here). Each worksheet lets a child trace and copy one letter,
lowercase alone, uppercase alone, then the lowercase+uppercase pair together
on a line — using the SAME hand-captured cursive strokes the propis app
itself uses (`tools/propis/topic.json` / `wordEngine.js`), not a stand-in
font, so the printed page matches exactly what the child sees animated on
screen.

Delivered as new items in the existing `print_materials` topic's
`worksheets` category (currently empty), alongside the existing `notebooks`
category — same download-a-PDF browse UI, no new app UI needed.

## Letter order (graphomotor grouping, confirmed with the user)

Based on standard Russian school "Пропись" methodology (Илюхина/Горецкий-
style): letters grouped by shared graphic construction element, simplest
first — not alphabetical order, not sound-articulation order. Uppercase
follows its lowercase counterpart into the same group (introduced as a
pair, not independently re-ordered by its own complexity).

1. **Крючок** (repeated hook, no loops/ovals): и, л, м, ш
2. **Крючок + доп. штрих** (hook + crossbar/tail): п, т, ц, щ
3. **Овал** (round bowl): а, е, ё, о, с, э
4. **Петля** (loop above/below baseline): б, в, д, з, у, ф
5. **Составные формы** (crossings, extra elements): г, ж, к, н, х, ч, ю, я
6. **Особые/редкие формы**: й, р, ъ, ы, ь

Full alphabet (33 letters), no gaps, no duplicates — verified against the
Russian alphabet during brainstorming.

Ъ and Ь have technical uppercase forms (Ъ, Ь) but essentially never appear
capitalized in real Russian text (no word starts with a hard/soft sign) —
group 6 only builds the lowercase+uppercase **pair** exercise for Й, Р, Ы;
Ъ and Ь get lowercase-only practice.

As of this writing, every letter needed for this phase is already
captured: 31/33 uppercase exist, and the only two missing (Ъ, Ь) are
exactly the two that don't need an uppercase/paired exercise per the rule
above — so no letter in this phase's worksheets depends on a capture that
doesn't exist yet. If that ever changes for a future letter, the fallback
is the same system-font glyph `WriteTextView.jsx` already uses for
uncaptured characters — not a blocker, just a visible stopgap.

## Rendering: real captured strokes, not a font

`print_materials`' existing notebook cover already draws letters via a
`ClassRoomCursive.ttf` font (visually very close to our own captured style,
confirmed by a side-by-side render during brainstorming) — but the user
chose NOT to reuse that font here, specifically so the printed page is
pixel-consistent with what the app itself animates. This means the PDF
generator needs its own SVG-path → PDF-path conversion, not text rendering.

Confirmed low-risk: every captured stroke's `d` attribute only ever uses
`M`/`L`/`C` (move / line / cubic bezier) — verified by scanning all of
`tools/propis/topic.json`. Reportlab's `Canvas.beginPath()` supports
`moveTo`/`lineTo`/`curveTo` directly, so the parser is a straightforward
1:1 token translation, not a novel algorithm.

## Page geometry

The existing print_materials notebook family prints A4 landscape, folded
down the vertical center and stapled — each physical A4 sheet becomes two
A5 portrait page-faces (confirmed with the user: "я скрепляю листы
посередине"). Worksheets follow the same physical format for consistency
with the rest of the print_materials product line:

- One **A5 portrait page per letter** (148×210mm halves of an A4 landscape
  sheet), reusing `propisRuling.js`'s own row geometry (10mm/5mm/10mm =
  25mm per row, 65° diagonal, 20mm diagonal spacing) — the SAME ruling the
  app itself uses on screen, not `make_lined_paper_landscape_standard.py`'s
  different 4mm/8mm notebook ruling (confirmed with the user).
- Per-page content: header (group name + letter, e.g. "Группа 1 · Л, л"),
  then 5 practice rows — 2× lowercase alone, 1× uppercase alone, 2× the
  lowercase+uppercase pair repeated together. ~7 rows fit the usable page
  height (15mm margins, matching the existing script's own margin
  constant), leaving breathing room below the 5 content rows.
- Each row is filled edge-to-edge with repetitions of the letter (no
  artificial gap-then-nothing) — the model instance is full opacity/dark,
  next few repetitions fade toward mid-gray (trace-me), and the final
  ~third of the row is left as a clean, letter-free ruled tail for
  independent writing. Confirmed via a rough proof-of-concept render built
  from real captured strokes during brainstorming (fade pattern, not exact
  final opacities/counts — those get tuned against the real printed-page
  render during implementation).

## Booklet imposition — new engineering, not reused

`make_notebook.py`'s existing page-assembly (`build()` in that file)
duplicates ONE blank ruled page N times — completely order-invariant,
because every page in a blank notebook is identical. Our worksheets have
distinct content per page (a different letter each), so simply
concatenating letter pages 1,2,3,4... and folding down the middle would NOT
read in the right order after folding — this needs real saddle-stitch
imposition (the standard "page N pairs with page 1 on the same sheet, page
2 with page N-1", etc. layout every commercial booklet printer uses).
Confirmed with the user this is worth doing correctly for the first
version rather than shipping loose unbound sheets.

This is a well-understood, standard algorithm (not a novel design problem)
— pad the letter-page count to a multiple of 4, then for sheet `i` of `N/4`
sheets: front-left = page `N-1-2i`, front-right = page `2i`, back-left =
page `2i+1`, back-right = page `N-2-2i` (0-indexed; exact left/right
assignment needs to match whichever short-edge/long-edge fold convention
`make_notebook.py`'s existing print instructions already specify, so this
new worksheet output prints with the same physical assembly steps parents
already know from the existing notebooks). Implementation detail for the
plan, not further specified here.

## Document / catalog structure

One PDF per letter-group (6 files for this phase), each a multi-page
booklet (imposed per above) covering every letter in that group. Registered
as new items under `print_materials/topic.json`'s existing (currently
empty) `worksheets` category, following the exact same item shape the
`notebooks` category already uses (`id`, `category`, `title`, `description`,
`thumbnail`, `files: [{label, path, filename, hint}]`, `assembly`) — no new
UI code needed, the existing `print_materials` renderer already knows how
to list/download these.

## Out of scope for this spec

Explicitly deferred to their own future specs, per the user's own phased
roadmap:

- Syllable worksheets
- Short word (3-4 letter) worksheets
- Short text copy-out worksheets

Also out of scope: recapturing the letters that still have a data gap
(uppercase Ъ/Ь don't practically exist; any letter not yet captured as
uppercase falls back to the same system-font stopgap `write_text` already
uses) — not blocking, not part of this phase's work.

## Testing / verification approach

Following this project's established practice for propis work: no
automated visual-regression test is meaningful for PDF page layout — verify
by actually generating a real PDF for at least one full group and visually
inspecting the rendered pages (screenshot or direct PDF view) before calling
any implementation task done, the same way every wordEngine.js change this
session was checked against a live render before being considered fixed.
Any bezier-path-parsing logic (SVG `d` → reportlab path commands) should
still get real unit tests, mirroring `pathGeometry.test.js`'s coverage of
the equivalent JS parser.
