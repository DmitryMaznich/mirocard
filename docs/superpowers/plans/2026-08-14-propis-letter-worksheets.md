# Propis Letter Worksheets (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate printable A5 letter-formation worksheets (lowercase alone
→ uppercase alone → lowercase+uppercase pair) using propis's own captured
cursive strokes, imposed into real fold-and-staple A4-landscape booklets,
and register them as new "worksheets" items in the existing
`print_materials` topic.

**Architecture:** A new, self-contained Python package
(`scripts/propis_worksheets/`) reads `tools/propis/topic.json` directly,
converts each letter's captured SVG `d` strokes into reportlab vector paths
(no font, no connector-chaining — every instance on a worksheet is an
isolated single letter), lays out fade-to-blank practice rows on propis's
own 10/5/10mm ruling, and imposes N per-letter A5 pages into standard
saddle-stitch A4-landscape sheets. One PDF per letter group (6 groups).
Registration into `print_materials/topic.json` + deck rebuild reuses the
existing `make_print_zip.py` pipeline with a small, additive extension.

**Tech Stack:** Python 3.14, reportlab 4.4.10 (vector PDF drawing),
PyMuPDF/`fitz` (thumbnail generation, already used by `make_print_zip.py`),
pytest (unit tests for the path parser).

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-08-14-propis-letter-worksheets-design.md` — every task below implements a specific section of it; don't diverge without checking back there first.
- Ruling geometry is propis's OWN (10mm/5mm/10mm = 25mm/row, 65°, 20mm diagonal) — never `make_lined_paper_landscape_standard.py`'s different 4mm/8mm notebook scheme.
- No font rendering for letters — only the real captured strokes from `tools/propis/topic.json`.
- Only `M`/`L`/`C` path commands ever need to be supported (verified against the full captured dataset during brainstorming) — the parser must reject anything else loudly, not silently misread it.
- Scope is Phase 1 (individual letters) only — do not add syllable/word/text generation in this plan.
- This is print/PDF work: there's no meaningful automated visual-regression test for page layout. Every task that produces a PDF ends with a real visual verification step (render a page to PNG via PyMuPDF and view it), not just "the script ran without erroring."
- **Commit after every task's final step, immediately** — this repo has an active, documented risk of a concurrent session running `git reset`/`git clean` on the shared working copy; uncommitted work has already been lost once during this very planning session. Don't batch multiple tasks before committing.

---

## File Structure

- Create: `scripts/propis_worksheets/svg_path.py` — parses a propis stroke's `d` string into draw commands; computes bounding boxes.
- Create: `scripts/propis_worksheets/test_svg_path.py` — pytest unit tests for the above.
- Create: `scripts/propis_worksheets/letter_groups.py` — the 6 confirmed graphomotor letter groups.
- Create: `scripts/propis_worksheets/render.py` — loads letter cards from `topic.json`; draws one letter instance onto a reportlab canvas at a given baseline position, returns its ink width.
- Create: `scripts/propis_worksheets/page.py` — draws one A5 letter-practice page (ruling + header + practice rows) at the canvas's current local origin.
- Create: `scripts/propis_worksheets/booklet.py` — saddle-stitch imposition; assembles one letter group's pages into one printable A4-landscape PDF.
- Create: `scripts/propis_worksheets/build.py` — CLI entry point, generates `output/propis_worksheets_group{N}.pdf` per group.
- Modify: `src/print_materials/topic.json` — register 6 new items under the (currently empty) `worksheets` category.
- Modify: `make_print_zip.py` — extend `copy_pdfs()`'s existing hardcoded mapping with the 6 new worksheet PDFs (same pattern already used for the 9 notebook files, not a rewrite).

---

### Task 1: SVG path parser

**Files:**
- Create: `scripts/propis_worksheets/svg_path.py`
- Create: `scripts/propis_worksheets/test_svg_path.py`

**Interfaces:**
- Produces: `parse_path(d: str) -> list[tuple]` — each tuple is `("M", (x,y))`, `("L", (x,y))`, or `("C", (x1,y1,x2,y2,x,y))`. Raises `ValueError` for any other command letter.
- Produces: `path_bounds(d: str, samples_per_curve: int = 20) -> tuple[float,float,float,float]` — `(minx, maxx, miny, maxy)`, sampling every cubic bezier along its curve (not just its control points).
- Produces: `draw_path(pdf_path, d: str, transform: Callable[[float,float],tuple[float,float]]) -> None` — replays `d` onto `pdf_path` (a reportlab `Path`-like object exposing `moveTo`/`lineTo`/`curveTo`), applying `transform` to every point first. Used by Task 3's `render.py`.

- [ ] **Step 1: Write the failing tests**

Create `scripts/propis_worksheets/test_svg_path.py`:

```python
from svg_path import parse_path, path_bounds, draw_path


def test_parse_simple_move_line():
    assert parse_path("M 10 20 L 30 40") == [("M", (10.0, 20.0)), ("L", (30.0, 40.0))]


def test_parse_cubic_bezier():
    assert parse_path("M 0 0 C 1 2 3 4 5 6") == [
        ("M", (0.0, 0.0)),
        ("C", (1.0, 2.0, 3.0, 4.0, 5.0, 6.0)),
    ]


def test_parse_rejects_unsupported_command():
    try:
        parse_path("M 0 0 A 5 5 0 0 1 10 10")
        assert False, "expected ValueError"
    except ValueError:
        pass


def test_bounds_of_straight_line_are_its_endpoints():
    minx, maxx, miny, maxy = path_bounds("M 0 0 L 10 5")
    assert (minx, maxx, miny, maxy) == (0.0, 10.0, 0.0, 5.0)


def test_bounds_of_bezier_include_the_curve_bulge():
    # A cubic whose control points pull hard to the left of both endpoints
    # (which sit at x=0) must report bounds wider than just the endpoints --
    # this is exactly why bounds need real curve sampling, not endpoint
    # min/max (a captured letter's loops bulge past their own M/end points
    # constantly).
    minx, maxx, miny, maxy = path_bounds("M 0 0 C -10 0 -10 10 0 10")
    assert minx < -1.0


def test_draw_path_applies_transform_and_replays_commands():
    class FakePath:
        def __init__(self):
            self.calls = []

        def moveTo(self, x, y):
            self.calls.append(("moveTo", x, y))

        def lineTo(self, x, y):
            self.calls.append(("lineTo", x, y))

        def curveTo(self, x1, y1, x2, y2, x, y):
            self.calls.append(("curveTo", x1, y1, x2, y2, x, y))

    fake = FakePath()
    draw_path(fake, "M 0 0 L 10 0", transform=lambda x, y: (x * 2, y * 2))
    assert fake.calls == [("moveTo", 0, 0), ("lineTo", 20, 0)]


def test_draw_path_handles_bezier():
    class FakePath:
        def __init__(self):
            self.calls = []

        def moveTo(self, x, y):
            self.calls.append(("moveTo", x, y))

        def curveTo(self, x1, y1, x2, y2, x, y):
            self.calls.append(("curveTo", x1, y1, x2, y2, x, y))

    fake = FakePath()
    draw_path(fake, "M 0 0 C 1 1 2 2 3 3", transform=lambda x, y: (x, y))
    assert fake.calls == [("moveTo", 0, 0), ("curveTo", 1, 1, 2, 2, 3, 3)]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd scripts/propis_worksheets && python -m pytest test_svg_path.py -v`
Expected: `ModuleNotFoundError: No module named 'svg_path'` (the module doesn't exist yet).

- [ ] **Step 3: Implement `svg_path.py`**

```python
"""Minimal SVG path `d`-string parser for propis captured strokes.

Only M (move), L (line), C (cubic bezier) ever appear in
tools/propis/topic.json's stroke data (verified 2026-08-14 by scanning
every captured card) -- this parser intentionally does not support
anything else, and raises loudly if it ever sees something new (a future
capture using an unexpected command should fail the build, not silently
mis-render).
"""

import re

_TOKEN_RE = re.compile(r"([MLC])|(-?\d+\.?\d*)")

_ARITY = {"M": 2, "L": 2, "C": 6}


def parse_path(d):
    """Parse an SVG path `d` string into a list of
    ("M"|"L", (x, y)) / ("C", (x1, y1, x2, y2, x, y)) tuples, in order."""
    tokens = []
    for cmd_match, num_match in _TOKEN_RE.findall(d):
        tokens.append(cmd_match if cmd_match else float(num_match))

    commands = []
    i = 0
    while i < len(tokens):
        cmd = tokens[i]
        if cmd not in _ARITY:
            raise ValueError(f"unsupported path command {cmd!r} in {d!r}")
        arity = _ARITY[cmd]
        args = tuple(tokens[i + 1 : i + 1 + arity])
        commands.append((cmd, args))
        i += 1 + arity
    return commands


def path_bounds(d, samples_per_curve=20):
    """(minx, maxx, miny, maxy) across every command, sampling cubic
    beziers along their actual curve (control points alone can lie
    outside the curve's true bounds, and captured letters' loops
    routinely do)."""
    commands = parse_path(d)
    xs, ys = [], []
    cur = (0.0, 0.0)
    for cmd, args in commands:
        if cmd in ("M", "L"):
            xs.append(args[0])
            ys.append(args[1])
            cur = args
        else:  # "C"
            x1, y1, x2, y2, x, y = args
            x0, y0 = cur
            for s in range(samples_per_curve + 1):
                t = s / samples_per_curve
                mt = 1 - t
                bx = mt**3 * x0 + 3 * mt**2 * t * x1 + 3 * mt * t**2 * x2 + t**3 * x
                by = mt**3 * y0 + 3 * mt**2 * t * y1 + 3 * mt * t**2 * y2 + t**3 * y
                xs.append(bx)
                ys.append(by)
            cur = (x, y)
    return min(xs), max(xs), min(ys), max(ys)


def draw_path(pdf_path, d, transform):
    """Replays `d` onto `pdf_path` (a reportlab Path, or anything exposing
    moveTo/lineTo/curveTo), applying `transform(x, y) -> (x, y)` to every
    point first. Caller still owns canvas.drawPath(...)."""
    for cmd, args in parse_path(d):
        if cmd == "M":
            pdf_path.moveTo(*transform(*args))
        elif cmd == "L":
            pdf_path.lineTo(*transform(*args))
        else:  # "C"
            x1, y1 = transform(args[0], args[1])
            x2, y2 = transform(args[2], args[3])
            x, y = transform(args[4], args[5])
            pdf_path.curveTo(x1, y1, x2, y2, x, y)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd scripts/propis_worksheets && python -m pytest test_svg_path.py -v`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/propis_worksheets/svg_path.py scripts/propis_worksheets/test_svg_path.py
git commit -m "feat(propis-worksheets): SVG path parser for M/L/C captured strokes"
```

---

### Task 2: Letter groups data

**Files:**
- Create: `scripts/propis_worksheets/letter_groups.py`

**Interfaces:**
- Produces: `GROUPS: list[dict]` — each dict is `{"id": int, "label": str, "letters": list[tuple[str, str|None]]}`, lowercase paired with uppercase (or `None` for Ъ/Ь). Consumed by `build.py` (Task 6) and `booklet.py` (Task 5).

- [ ] **Step 1: Write the file**

```python
"""Graphomotor-complexity letter groups for propis worksheets (Phase 1).

Confirmed with the user 2026-08-14 -- see
docs/superpowers/specs/2026-08-14-propis-letter-worksheets-design.md.
Grouped by shared graphic construction element (school "Пропись"
methodology), not alphabetical order, not sound-articulation order.

Every lowercase letter pairs with its own uppercase counterpart, EXCEPT
Ъ/Ь (paired with None) -- both technically have capital forms but neither
practically appears capitalized in real Russian text, so they only get a
lowercase practice page (see page.py's handling of upper=None).
"""

GROUPS = [
    {
        "id": 1,
        "label": "Крючок",
        "letters": [("и", "И"), ("л", "Л"), ("м", "М"), ("ш", "Ш")],
    },
    {
        "id": 2,
        "label": "Крючок + доп. штрих",
        "letters": [("п", "П"), ("т", "Т"), ("ц", "Ц"), ("щ", "Щ")],
    },
    {
        "id": 3,
        "label": "Овал",
        "letters": [("а", "А"), ("е", "Е"), ("ё", "Ё"), ("о", "О"), ("с", "С"), ("э", "Э")],
    },
    {
        "id": 4,
        "label": "Петля",
        "letters": [("б", "Б"), ("в", "В"), ("д", "Д"), ("з", "З"), ("у", "У"), ("ф", "Ф")],
    },
    {
        "id": 5,
        "label": "Составные формы",
        "letters": [
            ("г", "Г"), ("ж", "Ж"), ("к", "К"), ("н", "Н"),
            ("х", "Х"), ("ч", "Ч"), ("ю", "Ю"), ("я", "Я"),
        ],
    },
    {
        "id": 6,
        "label": "Особые формы",
        "letters": [("й", "Й"), ("р", "Р"), ("ъ", None), ("ы", "Ы"), ("ь", None)],
    },
]
```

Sanity check while writing this step: flatten all lowercase letters across
every group and confirm it's exactly the 33-letter Russian alphabet with no
duplicates (`а б в г д е ё ж з и й к л м н о п р с т у ф х ц ч ш щ ъ ы ь э
ю я`) — this was verified during brainstorming but re-check here since a
typo would silently drop or duplicate a letter across all 6 group PDFs.

- [ ] **Step 2: Verify by running a quick inline check**

Run:
```bash
cd scripts/propis_worksheets && python -c "
from letter_groups import GROUPS
lowers = [l for g in GROUPS for l, _ in g['letters']]
alphabet = list('абвгдеёжзийклмнопрстуфхцчшщъыьэюя')
assert sorted(lowers) == sorted(alphabet), (sorted(lowers), sorted(alphabet))
assert len(lowers) == len(set(lowers)) == 33
print('ok, 33 letters, no dupes, no gaps')
"
```
Expected: `ok, 33 letters, no dupes, no gaps`

- [ ] **Step 3: Commit**

```bash
git add scripts/propis_worksheets/letter_groups.py
git commit -m "feat(propis-worksheets): graphomotor letter-group data"
```

---

### Task 3: Letter rendering

**Files:**
- Create: `scripts/propis_worksheets/render.py`

**Interfaces:**
- Consumes: `svg_path.path_bounds`, `svg_path.draw_path` (Task 1).
- Produces: `load_letters() -> dict[str, dict]` — label → letter card (plain letters only, no connectors/variants — Phase 1 never chains through connectors). Consumed by `build.py` (Task 6).
- Produces: `letter_ink_bounds(card: dict) -> tuple[float,float,float,float]` — combined bounds across all of a card's strokes.
- Produces: `draw_letter(c, card, origin_x_mm, baseline_y_mm, opacity, color=(0.11,0.30,0.85)) -> float` — draws one instance with its own left ink edge at `origin_x_mm` and its own baseline at `baseline_y_mm` (reportlab/PDF y, bottom-up); returns the mm width consumed. Consumed by `page.py` (Task 4).
- Produces: `SCALE: float`, `ROW_MM: float` — native-unit-to-mm conversion, reused by `page.py` for row geometry.

- [ ] **Step 1: Write the file**

```python
"""Draws a single propis letter card's captured strokes onto a reportlab
canvas, scaled from the app's own native coordinate system into real mm.

No connector-chaining here at all -- every instance a worksheet ever draws
is a single isolated letter (lowercase alone, uppercase alone, or a
lowercase+uppercase pair placed side by side with a plain gap, never
joined by a connecting pen stroke), so wordEngine.js's connector-lookup
system has nothing to port.
"""

import json
import os

from svg_path import path_bounds, draw_path

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TOPIC_JSON = os.path.join(ROOT, "tools", "propis", "topic.json")

# Mirrors propisRuling.js: UNIT_H is the native-unit height of one row
# (150), matched to a real 25mm row (10mm ascender gap + 5mm узкая строка +
# 10mm descender gap) -- so every letter's native coordinates scale by the
# same fixed ROW_MM / UNIT_H factor, regardless of which row it's drawn on.
UNIT_H = 150
ROW_MM = 25.0
SCALE = ROW_MM / UNIT_H

# The baseline every captured letter's own path data was drawn against --
# matches propisRuling.js's LETTER_BASELINE_UNIT exactly. This, not the
# letter's own bounding box, is what has to land on the ruling's real
# baseline (native y above 88 = above the baseline; below = descender).
LETTER_BASELINE_UNIT = 88


def load_letters():
    with open(TOPIC_JSON, encoding="utf-8") as f:
        topic = json.load(f)
    letters = {}
    for card in topic["cards"]:
        if card["type"] == "letter" and not card.get("variantOf"):
            letters[card["label"]] = card
    return letters


def letter_ink_bounds(card):
    """(minx, maxx, miny, maxy) in native units, across ALL of the card's
    strokes together -- matches how the app's own minX-shift normalization
    treats a multi-stroke letter (к, х, Й, Ё...) as one combined shape."""
    minx = miny = float("inf")
    maxx = maxy = float("-inf")
    for stroke in card["strokes"]:
        sx0, sx1, sy0, sy1 = path_bounds(stroke["d"])
        minx, maxx = min(minx, sx0), max(maxx, sx1)
        miny, maxy = min(miny, sy0), max(maxy, sy1)
    return minx, maxx, miny, maxy


def draw_letter(c, card, origin_x_mm, baseline_y_mm, opacity, color=(0.11, 0.30, 0.85)):
    """Draws one instance of `card`. Its own left ink edge lands at
    `origin_x_mm`; its own baseline (native y = LETTER_BASELINE_UNIT)
    lands at `baseline_y_mm`. Returns the mm width consumed (real ink
    width, not the nominal 100-unit capture-canvas box) so the caller can
    advance x for the next instance."""
    minx, maxx, _, _ = letter_ink_bounds(card)

    def transform(nx, ny):
        px = origin_x_mm + (nx - minx) * SCALE
        py = baseline_y_mm - (ny - LETTER_BASELINE_UNIT) * SCALE
        return px, py

    path = c.beginPath()
    for stroke in card["strokes"]:
        draw_path(path, stroke["d"], transform)

    c.saveState()
    c.setStrokeColorRGB(*color)
    c.setStrokeAlpha(opacity)
    c.setLineWidth(1.1)
    c.setLineCap(1)
    c.setLineJoin(1)
    c.drawPath(path, stroke=1, fill=0)
    c.restoreState()

    return (maxx - minx) * SCALE
```

- [ ] **Step 2: Verify against a real letter, visually**

Run:
```bash
cd scripts/propis_worksheets && python -c "
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from render import load_letters, draw_letter

letters = load_letters()
c = canvas.Canvas('../../output/_render_check.pdf', pagesize=(100*mm, 50*mm))
c.translate(0, 0)
c.scale(mm, mm)
c.setLineWidth(0.2)
c.line(0, 20, 100, 20)  # baseline reference
w = draw_letter(c, letters['л'], 5, 20, 1.0)
draw_letter(c, letters['И'], 5 + w + 5, 20, 1.0)
c.save()
print('wrote output/_render_check.pdf, л ink width =', w, 'mm')
"
```
Expected: no traceback, prints an ink-width number roughly in the 3-8mm range (a single letter at 25mm row height). Then actually look at the PDF (convert to PNG and view it, e.g. via `python -c "import fitz; d=fitz.open('output/_render_check.pdf'); d[0].get_pixmap(matrix=fitz.Matrix(4,4)).save('output/_render_check.png')"` and viewing the PNG) — confirm "л" and "И" both render as recognizable cursive letters sitting on the reference baseline, right-way up (not upside down — the single most likely bug from the y-flip transform above).

- [ ] **Step 3: Commit**

```bash
git add scripts/propis_worksheets/render.py
git commit -m "feat(propis-worksheets): render captured letter strokes onto a PDF canvas"
```

---

### Task 4: Page layout

**Files:**
- Create: `scripts/propis_worksheets/page.py`

**Interfaces:**
- Consumes: `render.draw_letter`, `render.ROW_MM` (Task 3); `letter_groups.GROUPS` shape (Task 2, passed in by caller — this module doesn't import it directly).
- Produces: `PAGE_W_MM: float`, `PAGE_H_MM: float` — the physical A5 page size, reused by `booklet.py` (Task 5) for imposition offsets.
- Produces: `draw_letter_page(c, group: dict, lower_label: str, upper_label: str|None, letters: dict) -> None` — draws one full A5 page's content at the canvas's current local origin (caller has already translated/scaled to the right A5 slot). Consumed by `booklet.py` (Task 5).

- [ ] **Step 1: Write the file**

```python
"""Draws one A5 letter-practice page's content (ruling + header + practice
rows) onto a reportlab canvas at whatever the canvas's CURRENT local
origin is -- booklet.py is responsible for translating/scaling to the
right A5 slot on the physical A4 sheet before calling draw_letter_page.

Assumes the canvas is already in a "1 unit = 1 mm" local frame (i.e. the
caller has done canvas.scale(mm, mm) upstream) -- every number in this
file is a plain mm value, not points.
"""

import math

from render import draw_letter, ROW_MM

PAGE_W_MM = 148.5
PAGE_H_MM = 210.0
MARGIN_MM = 12.0

ROW_TOP_GAP_MM = 10.0  # ascender gap, propisRuling NATIVE_L1->L2
ROW_NARROW_MM = 5.0    # узкая строка, NATIVE_L2->L3 (the working zone)
ROW_BOT_GAP_MM = 10.0  # descender gap, NATIVE_L3->L4 -- sums to ROW_MM (25.0)

ANGLE_DEG = 65.0
DIAGONAL_MM = 20.0
_TAN_ANGLE = math.tan(math.radians(90 - ANGLE_DEG))

GAP_MM = 5.0            # gap between repeated letter instances on a row
TAIL_FRACTION = 0.32    # final fraction of every row left blank, ruled-only

MODEL_OPACITY = 1.0
FADE_OPACITIES = [0.5, 0.5, 0.28, 0.28]  # repetitions 2, 3, 4, 5+ (clamped)


def _opacity_for_index(i):
    if i == 0:
        return MODEL_OPACITY
    return FADE_OPACITIES[min(i - 1, len(FADE_OPACITIES) - 1)]


def draw_ruling(c, usable_w_mm, top_y_mm, row_count):
    """propis's own 10/5/10mm ruling (bold baseline) + 65-degree/20mm
    diagonal guides -- NOT make_lined_paper_landscape_standard.py's
    different 4/8mm notebook scheme (confirmed with the user)."""
    total_h = row_count * ROW_MM
    bottom_y = top_y_mm - total_h

    c.saveState()
    c.setStrokeColorRGB(0.55, 0.62, 0.72)
    for row in range(row_count):
        row_top = top_y_mm - row * ROW_MM
        narrow_top_y = row_top - ROW_TOP_GAP_MM
        baseline_y = narrow_top_y - ROW_NARROW_MM
        descender_y = baseline_y - ROW_BOT_GAP_MM
        c.setLineWidth(0.3)
        c.line(0, row_top, usable_w_mm, row_top)
        c.line(0, descender_y, usable_w_mm, descender_y)
        c.setLineWidth(0.35)
        c.line(0, narrow_top_y, usable_w_mm, narrow_top_y)
        c.setLineWidth(1.0)
        c.line(0, baseline_y, usable_w_mm, baseline_y)

    c.setLineWidth(0.25)
    c.setStrokeAlpha(0.6)
    x = -total_h * _TAN_ANGLE
    x_end = usable_w_mm + total_h * _TAN_ANGLE
    while x < x_end:
        c.line(x, bottom_y, x + total_h * _TAN_ANGLE, top_y_mm)
        x += DIAGONAL_MM
    c.setStrokeAlpha(1)
    c.restoreState()


def draw_row(c, letters_row, row_top_y_mm, usable_w_mm):
    """One practice row: `letters_row` is a list of 1 card (lowercase- or
    uppercase-alone) or 2 cards (the paired row) to repeat together,
    fading per FADE_OPACITIES, stopping at TAIL_FRACTION of the row width
    -- the remainder is left as a blank ruled tail for independent
    writing."""
    baseline_y = row_top_y_mm - ROW_TOP_GAP_MM - ROW_NARROW_MM
    fill_limit_mm = usable_w_mm * (1 - TAIL_FRACTION)

    x = 0.0
    i = 0
    while x < fill_limit_mm:
        opacity = _opacity_for_index(i)
        for card in letters_row:
            width = draw_letter(c, card, x, baseline_y, opacity)
            x += width + GAP_MM
            if x >= fill_limit_mm:
                break
        i += 1


def draw_letter_page(c, group, lower_label, upper_label, letters):
    """One full A5 page: header, then practice rows. A letter with no
    uppercase counterpart (Ъ, Ь -- upper_label is None) gets 4
    lowercase-only rows instead of the standard 2-lower/1-upper/2-paired
    pattern, using the space that would have gone to the missing rows."""
    usable_w_mm = PAGE_W_MM - 2 * MARGIN_MM

    c.saveState()
    c.translate(MARGIN_MM, 0)

    c.setFillColorRGB(0.2, 0.2, 0.2)
    c.setFont("Helvetica-Bold", 13)
    header_letters = f"{upper_label}, {lower_label}" if upper_label else lower_label
    c.drawString(0, PAGE_H_MM - MARGIN_MM - 8, f"Группа {group['id']} · {header_letters}")
    c.setFillColorRGB(0.55, 0.55, 0.55)
    c.setFont("Helvetica", 8)
    c.drawString(0, PAGE_H_MM - MARGIN_MM - 16, group["label"])

    lower_card = letters[lower_label]
    if upper_label:
        upper_card = letters[upper_label]
        rows = [[lower_card], [lower_card], [upper_card], [lower_card, upper_card], [lower_card, upper_card]]
    else:
        rows = [[lower_card]] * 4

    content_top = PAGE_H_MM - MARGIN_MM - 24
    draw_ruling(c, usable_w_mm, content_top, len(rows))

    row_top = content_top
    for row_cards in rows:
        draw_row(c, row_cards, row_top, usable_w_mm)
        row_top -= ROW_MM

    c.restoreState()
```

- [ ] **Step 2: Verify one full page, visually**

Run:
```bash
cd scripts/propis_worksheets && python -c "
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from render import load_letters
from page import draw_letter_page, PAGE_W_MM, PAGE_H_MM

letters = load_letters()
c = canvas.Canvas('../../output/_page_check.pdf', pagesize=(PAGE_W_MM*mm, PAGE_H_MM*mm))
c.scale(mm, mm)
group = {'id': 1, 'label': 'Крючок'}
draw_letter_page(c, group, 'л', 'Л', letters)
c.showPage()
draw_letter_page(c, group, 'ъ', None, letters)
c.save()
print('wrote output/_page_check.pdf')
"
```
Expected: no traceback. Convert both pages to PNG (via the same PyMuPDF one-liner as Task 3 Step 2, looping `doc.page_count`) and actually view them. Confirm on page 1: header reads "Группа 1 · Л, л", 5 rows visible (2 lowercase л fading out with a blank tail, 1 uppercase Л fading out with a blank tail, 2 rows of "Лл" pairs fading out with a blank tail), ruling lines + diagonal guides visible and not overlapping the letters oddly. Confirm on page 2 (ъ, no uppercase): 4 rows of lowercase ъ only, page looks intentional (not obviously missing content), no crash/blank-uppercase artifact.

- [ ] **Step 3: Commit**

```bash
git add scripts/propis_worksheets/page.py
git commit -m "feat(propis-worksheets): A5 page layout (ruling + header + practice rows)"
```

---

### Task 5: Booklet imposition

**Files:**
- Create: `scripts/propis_worksheets/booklet.py`

**Interfaces:**
- Consumes: `page.draw_letter_page`, `page.PAGE_W_MM`, `page.PAGE_H_MM` (Task 4).
- Produces: `build_group_pdf(group: dict, letters: dict, out_path: str) -> int` — writes the imposed PDF for one group, returns the number of physical A4 sheets used (for the assembly-hint text later). Consumed by `build.py` (Task 6).

- [ ] **Step 1: Write the file**

```python
"""Saddle-stitch booklet imposition: arranges N per-letter A5 pages into
physical A4-landscape sheet-faces (2 A5 slots per face, printed
double-sided) in the order that reads correctly after folding down the
center and stapling -- the same physical assembly the existing
print_materials notebooks already use (fold + staple through the center,
per make_lined_paper_landscape_standard.py's own staple-slot markers).

Verified by hand during planning for n=4 and n=8: sheet i's front holds
pages (n-1-2i, 2i) left-to-right, its back holds pages (2i+1, n-2-2i) --
this is the standard "nested sheets" saddle-stitch layout (sheet 0 is the
OUTERMOST wrap, sheet n//4 - 1 is the INNERMOST, centered when assembled).
"""

from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm

from page import PAGE_W_MM, draw_letter_page


def _imposition_order(n):
    """n must be a multiple of 4. Returns a list of n//4 (front, back)
    pairs, each itself a (left_index, right_index) pair of 0-based page
    indices."""
    assert n % 4 == 0
    sheets = []
    for i in range(n // 4):
        front = (n - 1 - 2 * i, 2 * i)
        back = (2 * i + 1, n - 2 - 2 * i)
        sheets.append((front, back))
    return sheets


def build_group_pdf(group, letters, out_path):
    entries = list(group["letters"])  # [(lower, upper_or_None), ...]
    n = len(entries)
    if n % 4 != 0:
        n += 4 - (n % 4)  # pad with blank slots so the imposition math holds

    c = canvas.Canvas(out_path, pagesize=landscape(A4))

    def draw_slot(index, x_offset_mm):
        if index >= len(entries):
            return  # padding slot, left blank
        lower, upper = entries[index]
        c.saveState()
        c.translate(x_offset_mm * mm, 0)
        c.scale(mm, mm)
        draw_letter_page(c, group, lower, upper, letters)
        c.restoreState()

    sheets = _imposition_order(n)
    for front, back in sheets:
        draw_slot(front[0], 0)
        draw_slot(front[1], PAGE_W_MM)
        c.showPage()
        draw_slot(back[0], 0)
        draw_slot(back[1], PAGE_W_MM)
        c.showPage()

    c.save()
    return len(sheets)
```

- [ ] **Step 2: Unit-test the imposition math (no PDF needed)**

Create `scripts/propis_worksheets/test_booklet.py`:

```python
from booklet import _imposition_order


def test_single_sheet_four_pages():
    # 1-indexed: sheet holds (page4,page1) on front, (page2,page3) on back.
    # 0-indexed here: (3,0) front, (1,2) back.
    assert _imposition_order(4) == [((3, 0), (1, 2))]


def test_two_sheets_eight_pages_nest_correctly():
    assert _imposition_order(8) == [
        ((7, 0), (1, 6)),  # outer sheet
        ((5, 2), (3, 4)),  # inner sheet
    ]


def test_every_page_index_appears_exactly_once():
    n = 16
    seen = []
    for front, back in _imposition_order(n):
        seen.extend([front[0], front[1], back[0], back[1]])
    assert sorted(seen) == list(range(n))
```

Run: `cd scripts/propis_worksheets && python -m pytest test_booklet.py -v`
Expected: 3 passed. (These encode the hand-verified imposition math from
planning — if they ever fail after a future edit, the physical booklets
will print out of order, so don't weaken them to "make it pass.")

- [ ] **Step 3: Verify one full group PDF, visually**

Run:
```bash
cd scripts/propis_worksheets && python -c "
from render import load_letters
from letter_groups import GROUPS
from booklet import build_group_pdf

letters = load_letters()
group1 = next(g for g in GROUPS if g['id'] == 1)
sheets = build_group_pdf(group1, letters, '../../output/propis_worksheets_group1.pdf')
print('group 1:', sheets, 'sheet(s)')
"
```
Expected: prints `group 1: 1 sheet(s)` (4 letters = 1 sheet exactly, no padding needed). Convert every page of the resulting PDF to PNG and view them all. Confirm: page order front/back makes sense as a 4-page spread (по, in reading order once you mentally fold: и, л, м, ш each on their own page, in group order) — the real test is folding the printed sheet in your head (or actually printing it) and checking page 1 (и) comes right after the front cover position and page 4 (ш) lines up as the last inner page. If this feels hard to verify purely by looking at the raw front/back PDF pages, that's expected — the imposition order LOOKS scrambled in the raw PDF (that's the whole point of imposition); trust the unit-tested math from Step 2 over eyeballing the raw sheet, and instead visually verify each INDIVIDUAL page's own content (right letter, right layout) is correct.

- [ ] **Step 4: Commit**

```bash
git add scripts/propis_worksheets/booklet.py scripts/propis_worksheets/test_booklet.py
git commit -m "feat(propis-worksheets): saddle-stitch booklet imposition"
```

---

### Task 6: Build script + generate Group 1 end-to-end

**Files:**
- Create: `scripts/propis_worksheets/build.py`

**Interfaces:**
- Consumes: `letter_groups.GROUPS`, `render.load_letters`, `booklet.build_group_pdf` (Tasks 2, 3, 5).
- Produces: `output/propis_worksheets_group{N}.pdf` files (git-ignored build output, same as the existing `output/` directory's other notebook PDFs — not committed to git).

- [ ] **Step 1: Write the file**

```python
#!/usr/bin/env python3
"""Generates one imposed booklet PDF per letter group (see
letter_groups.GROUPS) into output/.

Usage:
  python build.py         # all groups
  python build.py 1       # just group 1 (fast iteration while tuning layout)
"""

import os
import sys

from letter_groups import GROUPS
from render import load_letters
from booklet import build_group_pdf

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTPUT_DIR = os.path.join(ROOT, "output")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    letters = load_letters()

    target = int(sys.argv[1]) if len(sys.argv) > 1 else None

    for group in GROUPS:
        if target is not None and group["id"] != target:
            continue
        missing = [l for l, u in group["letters"] if l not in letters or (u and u not in letters)]
        if missing:
            print(f"  группа {group['id']}: ПРОПУЩЕНЫ буквы {missing}, пропускаю")
            continue
        out_path = os.path.join(OUTPUT_DIR, f"propis_worksheets_group{group['id']}.pdf")
        sheets = build_group_pdf(group, letters, out_path)
        print(f"  группа {group['id']} ({group['label']}): {sheets} лист(ов) A4 -> {out_path}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run for Group 1 and verify the real output**

Run: `python scripts/propis_worksheets/build.py 1`
Expected: `группа 1 (Крючок): 1 лист(ов) A4 -> .../output/propis_worksheets_group1.pdf`, no missing-letters warning (и/л/м/ш/И/Л/М/Ш are all captured).

Convert to PNG and view every page (same PyMuPDF pattern as earlier tasks). This is the real end-to-end checkpoint for the whole pipeline built so far — confirm all 4 letters' pages look right (correct letter, correct header, rows fill+fade+leave a tail correctly, ruling looks like propis's own ruling not the notebook's).

- [ ] **Step 3: Commit**

```bash
git add scripts/propis_worksheets/build.py
git commit -m "feat(propis-worksheets): build.py CLI, verified end-to-end on group 1"
```

---

### Task 7: Register Group 1 in the print_materials catalog

**Files:**
- Modify: `src/print_materials/topic.json`
- Modify: `make_print_zip.py`

**Interfaces:**
- Consumes: `output/propis_worksheets_group1.pdf` (Task 6's output).
- Produces: an installable `print_materials` deck update via the existing `make_print_zip.py` pipeline — no new interfaces, this task wires existing systems together.

- [ ] **Step 1: Add the Group 1 item to `topic.json`**

Add to `src/print_materials/topic.json`'s `items` array (after the 3
existing `notebook_*` items):

```json
    {
      "id": "propis_worksheets_group1",
      "category": "worksheets",
      "title": "Прописи — группа 1 (и, л, м, ш)",
      "description": "Отработка написания букв: и, л, м, ш (строчная, заглавная, пара на строке).",
      "thumbnail": "thumbnails/propis_worksheets_group1.png",
      "files": [
        {
          "label": "Рабочие листы",
          "path": "print/группа1_прописи.pdf",
          "filename": "прописи_группа1.pdf",
          "hint": "1 лист A4, двусторонняя, альбомная"
        }
      ],
      "assembly": "Сложить по центру, скрепить степлером по сгибу"
    }
```

(The `"hint"` sheet count must match whatever `build.py`'s Task 6 run
actually printed for group 1 — 1 sheet, confirmed above; if a future
group's sheet count differs, its hint text needs to say so too, done in
Task 8.)

- [ ] **Step 2: Extend `copy_pdfs()` in `make_print_zip.py`**

In `make_print_zip.py`, find the `mapping` dict inside `copy_pdfs()` and
add one entry (same pattern as the 9 existing notebook entries, not a
rewrite):

```python
        "группа1_прописи.pdf": os.path.join(OUTPUT_DIR, "propis_worksheets_group1.pdf"),
```

- [ ] **Step 3: Run the propis-worksheets build, then the print_materials packaging pipeline**

Run:
```bash
python scripts/propis_worksheets/build.py 1
python make_print_zip.py
```
Expected: `make_print_zip.py`'s own log shows the new `группа1_прописи.pdf`
copied, a thumbnail generated for `propis_worksheets_group1`, the version
bumped, a new `public/decks/print_materials_vX.Y.Z.zip` written, and
`public/decks/catalog.json` updated.

- [ ] **Step 4: Verify the generated thumbnail and zip contents**

View `src/print_materials/thumbnails/propis_worksheets_group1.png` (should
be a recognizable first-page preview, not blank/corrupt). Then:
```bash
unzip -l public/decks/print_materials_v*.zip | grep -E "topic.json|группа1"
```
Expected: both `topic.json` and `print/группа1_прописи.pdf` listed inside
the zip.

- [ ] **Step 5: Run the JS test suite to confirm nothing else broke**

Run: `npx vitest run --exclude "**/.worktrees/**"`
Expected: all existing tests still pass (this task never touches
`src/topics/renderers/propis/` or any JS test file — this step exists only
to confirm the `topic.json` edit didn't accidentally break print_materials'
own renderer, if it has any tests).

- [ ] **Step 6: Commit**

```bash
git add src/print_materials/topic.json make_print_zip.py src/print_materials/thumbnails/propis_worksheets_group1.png public/decks/catalog.json public/decks/print_materials_v*.zip
git commit -m "feat(print_materials): register propis worksheets group 1"
```

---

### Task 8: Generate and register the remaining 5 groups

**Files:**
- Modify: `src/print_materials/topic.json` (5 more items)
- Modify: `make_print_zip.py` (5 more `mapping` entries)

**Interfaces:** none new — mechanical repetition of Task 7's pattern now
that the underlying pipeline (Tasks 1-6) is proven correct on Group 1.

- [ ] **Step 1: Generate all remaining groups**

Run: `python scripts/propis_worksheets/build.py` (no argument — all groups)
Expected: one log line per group (2 through 6), each reporting its own
sheet count (groups vary in letter count: 4, 6, 6, 8, 5 lowercase letters
— sheet counts will differ per group; note each one down for its own
`"hint"` text in the next step). No "ПРОПУЩЕНЫ буквы" warnings (every
letter needed is already captured, confirmed during brainstorming).

- [ ] **Step 2: Spot-check at least 2 of the 5 new group PDFs visually**

Convert to PNG and view: group 3 (the "Овал" group — round-letter shapes
stress the ink-bounds/centering logic differently than group 1's
straight-hook letters) and group 6 (the one with Ъ/Ь's lowercase-only
pages — confirms that branch still degrades sensibly at real scale, not
just in Task 4's isolated test).

- [ ] **Step 3: Add the remaining 5 items to `topic.json`**

Same shape as Task 7 Step 1, for groups 2-6 — `id`,
`title`/`description` naming the group's actual letters, `path`/`filename`
following the `группа{N}_прописи.pdf` convention, `hint` using each
group's own real sheet count from Step 1.

- [ ] **Step 4: Add the remaining 5 entries to `copy_pdfs()`'s `mapping`**

Same pattern as Task 7 Step 2, one line per group:
```python
        "группа2_прописи.pdf": os.path.join(OUTPUT_DIR, "propis_worksheets_group2.pdf"),
        "группа3_прописи.pdf": os.path.join(OUTPUT_DIR, "propis_worksheets_group3.pdf"),
        "группа4_прописи.pdf": os.path.join(OUTPUT_DIR, "propis_worksheets_group4.pdf"),
        "группа5_прописи.pdf": os.path.join(OUTPUT_DIR, "propis_worksheets_group5.pdf"),
        "группа6_прописи.pdf": os.path.join(OUTPUT_DIR, "propis_worksheets_group6.pdf"),
```

- [ ] **Step 5: Rebuild the full print_materials package**

Run: `python make_print_zip.py`
Expected: all 6 worksheet PDFs copied, all 6 thumbnails generated, version
bumped again, new zip + catalog.json written.

- [ ] **Step 6: Full verification pass**

- View all 6 new thumbnails (`src/print_materials/thumbnails/propis_worksheets_group*.png`) — none blank/corrupt.
- `unzip -l public/decks/print_materials_v*.zip` — confirm all 6 group PDFs + `topic.json` present.
- Re-run `npx vitest run --exclude "**/.worktrees/**"` — still green.
- Check `git status --short` before staging — confirm only the files this task actually touched are being committed (this repo has a recurring pattern of concurrent sessions leaving unrelated dirty files; don't sweep those into this commit).

- [ ] **Step 7: Commit**

```bash
git add src/print_materials/topic.json make_print_zip.py src/print_materials/thumbnails/propis_worksheets_group*.png public/decks/catalog.json public/decks/print_materials_v*.zip
git commit -m "feat(print_materials): register propis worksheets groups 2-6 (full Phase 1)"
```

- [ ] **Step 8: Update `docs/propis.md`**

Add a short note under a new "## Printed worksheets (Phase 1)" section (or
alongside the existing mode sections) recording: where the generator code
lives (`scripts/propis_worksheets/`), that it's a from-scratch Python
package reusing propis's own ruling geometry and captured strokes (not the
print_materials notebook family's font/ruling), the 6 confirmed letter
groups, and a pointer back to the design spec + this plan for the full
reasoning — matching how every other propis architectural decision in that
file is documented. Commit alongside Step 7's commit or as its own
docs-only follow-up.
