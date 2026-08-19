"""Positions propis letter-practice content to align with the REAL, ALREADY
EXISTING notebook ruling PDF (make_lined_paper_landscape.py's "плотная"
page) -- booklet.py overlays this module's content onto that actual PDF
page rather than redrawing an equivalent grid, so the printed page is
pixel-identical to the blank copybook pages already in print_materials
(confirmed with the user 2026-08-15: reuse the real asset, don't
re-derive the geometry).

No per-letter header: content flows continuously, row after row, letter
after letter, across as many pages as a group needs -- paginate_rows() is
the only place page breaks get decided.

Assumes the canvas is already in a "1 unit = 1 mm" local frame (i.e. the
caller has done canvas.scale(mm, mm) upstream) -- every number in this
file is a plain mm value, not points.
"""

from render import draw_letter, letter_ink_bounds, SCALE

PAGE_W_MM = 148.5
PAGE_H_MM = 210.0
MARGIN_MM = 15.0  # matches make_lined_paper_landscape.py's own red margin lines

# Mirrors make_lined_paper_landscape.py's horizontal-line loop exactly (same
# narrow/wide alternation, same starting phase from y=0) -- this file never
# draws these lines itself, it only needs to know where the real page put
# them, to anchor letter baselines onto the actual thick lines.
NARROW_MM = 4.0
WIDE_MM = 8.0
ROW_CYCLE_MM = NARROW_MM + WIDE_MM  # 12mm baseline-to-baseline

GAP_MM = 5.0            # gap between repeated letter instances on a row
TAIL_FRACTION = 0.32    # final fraction of every row left blank, ruled-only

MODEL_OPACITY = 1.0
FADE_OPACITIES = [0.5, 0.5, 0.28, 0.28]  # repetitions 2, 3, 4, 5+ (clamped)


def _opacity_for_index(i):
    if i == 0:
        return MODEL_OPACITY
    return FADE_OPACITIES[min(i - 1, len(FADE_OPACITIES) - 1)]


# Every letter gets this many full pages of practice, fixed -- a notebook's
# sheet count is however many letters its groups cover x this, not a target
# page count to distribute (confirmed with the user 2026-08-15, replacing
# the earlier fixed-24-pages-per-group scheme).
PAGES_PER_LETTER = 2


def letter_rows_for(lower_card, upper_card, num_pages=1):
    """Fills exactly `num_pages` full "practice" pages' worth of rows for a
    single letter: the 2-lower/1-upper/2-paired pattern (or lowercase-alone
    for a letter with no uppercase, Ъ/Ь) repeated enough times to fill
    num_pages * ROWS_PER_PAGE exactly -- so every notebook's pages break
    cleanly on letter boundaries, and no page is left partially blank.
    This is page 1 of the letter's PAGES_PER_LETTER pages (draw_group_page's
    style="practice") -- unchanged since 2026-08-15."""
    if upper_card is not None:
        base = [[lower_card], [lower_card], [upper_card], [lower_card, upper_card], [lower_card, upper_card]]
    else:
        base = [[lower_card]]
    total_rows = num_pages * ROWS_PER_PAGE
    reps = -(-total_rows // len(base))  # ceil division
    return (base * reps)[:total_rows]


def letter_sample_rows_for(lower_card, upper_card):
    """Fills exactly one "sample" page's worth of rows: the model letter
    shown ONCE at the start of each row with the rest left blank (no
    fading repetitions) -- independent-practice page 2 of the letter's
    PAGES_PER_LETTER pages (draw_group_page's style="sample"), confirmed
    with the user 2026-08-18. Rows come in blocks -- lowercase-alone,
    then uppercase-alone, then paired -- at roughly 30/30/40% (rounded to
    fill ROWS_PER_PAGE exactly). A letter with no uppercase (Ъ, Ь) just
    gets ROWS_PER_PAGE lowercase-alone rows, matching letter_rows_for's
    own fallback."""
    n = ROWS_PER_PAGE
    if upper_card is None:
        return [[lower_card]] * n
    n_lower = round(n * 0.3)
    n_upper = round(n * 0.3)
    n_paired = n - n_lower - n_upper
    return [[lower_card]] * n_lower + [[upper_card]] * n_upper + [[lower_card, upper_card]] * n_paired


def notebook_rows(groups, letters):
    """Flattens every letter across `groups` (in order) into one ordered
    list of practice rows -- each letter contributes exactly
    PAGES_PER_LETTER pages' worth (one "practice" page, one "sample"
    page), so paginate_rows() below always breaks on letter boundaries
    and pages alternate practice/sample throughout the whole notebook."""
    rows = []
    for group in groups:
        for lower, upper in group["letters"]:
            lower_card = letters[lower]
            upper_card = letters[upper] if upper else None
            rows.extend(letter_rows_for(lower_card, upper_card))
            rows.extend(letter_sample_rows_for(lower_card, upper_card))
    return rows


def _thick_line_ys():
    """Every thick (baseline) line's y across the FULL page height, in the
    same bottom-up frame make_lined_paper_landscape.py draws in (y=0 at the
    page's bottom edge, no margin inset -- the real page's ruling isn't
    clipped to the red margin lines, so neither is this)."""
    ys = []
    y = 0.0
    pattern_index = 0
    while y < PAGE_H_MM:
        if pattern_index % 2 == 0:
            y += NARROW_MM
        else:
            y += WIDE_MM
            if y < PAGE_H_MM:
                ys.append(y)
        pattern_index += 1
    return ys


def row_baselines():
    """Baseline y for every practice row on one page, top-to-bottom, in the
    same bottom-up mm frame as _thick_line_ys. Drops only the topmost thick
    line, so row 0 keeps a full cycle of ascender headroom instead of
    sitting flush against the page's top edge -- the bottom-most thick
    line IS used as the last row's baseline (dropping it too, as an
    earlier version did, left a whole extra ruled cycle at the bottom of
    the page with no content on it at all -- flagged by the user
    2026-08-15 as a visibly empty row; the descender room below the last
    row's baseline comes for free from the page's own bottom margin)."""
    thick_ys = _thick_line_ys()
    return list(reversed(thick_ys[:-1]))


ROWS_PER_PAGE = len(row_baselines())


def paginate_rows(rows, per_page=ROWS_PER_PAGE):
    """Splits a flat row list into per-page chunks."""
    if not rows:
        return [[]]
    return [rows[i:i + per_page] for i in range(0, len(rows), per_page)]


def _instance_width_mm(letters_row):
    """Width of one repeated instance of `letters_row` (1 card, or 2 for a
    paired row) -- the same quantity draw_row's own loop accumulates per
    repetition, computed without touching a canvas so _natural_count can
    dry-run how many instances a row would fit before any taper is applied."""
    total = 0.0
    for card in letters_row:
        minx, maxx, _, _ = letter_ink_bounds(card)
        total += (maxx - minx) * SCALE + GAP_MM
    return total


def _natural_count(letters_row, fill_limit_mm):
    """How many repetitions of `letters_row` draw_row would fit into
    fill_limit_mm with no cap -- the taper's starting point for a row."""
    inst_w = _instance_width_mm(letters_row)
    if inst_w <= 0:
        return 0
    count = 0
    x = 0.0
    while x < fill_limit_mm:
        x += inst_w
        count += 1
    return count


def draw_row(c, letters_row, baseline_y_mm, usable_w_mm, max_instances=None):
    """One practice row: `letters_row` is a list of 1 card (lowercase- or
    uppercase-alone) or 2 cards (the paired row) to repeat together,
    fading per FADE_OPACITIES, stopping at TAIL_FRACTION of the row width
    -- the remainder is left as a blank ruled tail for independent
    writing. `max_instances`, if given, stops after that many repetitions
    even if more would still fit (used for the bottom-half taper)."""
    fill_limit_mm = usable_w_mm * (1 - TAIL_FRACTION)

    x = 0.0
    i = 0
    while x < fill_limit_mm:
        if max_instances is not None and i >= max_instances:
            break
        opacity = _opacity_for_index(i)
        for card in letters_row:
            width = draw_letter(c, card, x, baseline_y_mm, opacity)
            x += width + GAP_MM
            if x >= fill_limit_mm:
                break
        i += 1


# Horizontal start inset for content, per A5 slot side. The LEFT slot's
# local x=0 is the page's own outer edge, so MARGIN_MM hugs the real red
# margin line there. The RIGHT slot's local x=0 is the CENTER divider
# (booklet.py translates it there), so a small inset hugs that line
# instead -- confirmed with the user 2026-08-15: content should start
# near the margin on the left half, near the center divider on the right.
LEFT_INSET_MM = MARGIN_MM + 2.0
CENTER_INSET_MM = 2.0 + 2.0
CONTENT_W_MM = PAGE_W_MM - 2 * MARGIN_MM

# Page-number badge: centered in the slot's own OUTER margin strip (between
# the real page edge and the real red margin line, i.e. past/outside the
# margin, not inside the writing area) -- confirmed with the user
# 2026-08-15. A white filled circle sits behind the digits so they stay
# legible over the ruling's own diagonal hatching underneath.
NUMBER_CX_LEFT_MM = MARGIN_MM / 2
NUMBER_CX_RIGHT_MM = PAGE_W_MM - MARGIN_MM / 2
NUMBER_CY_MM = 10.0
NUMBER_R_MM = 4.0


def draw_page_number_badge(c, page_number, number_align):
    """White-circle page-number badge, past the outer margin (see
    LEFT_INSET_MM/CENTER_INSET_MM's docstring for why it sits there) --
    factored out of draw_group_page so syllable_page.py's pages (a
    different content type, same physical page/ruling) can stamp an
    identical badge without duplicating the geometry or the mm/pt font
    conversion gotcha."""
    cx = NUMBER_CX_LEFT_MM if number_align == "left" else NUMBER_CX_RIGHT_MM
    c.saveState()
    c.setFillColorRGB(1, 1, 1)
    c.circle(cx, NUMBER_CY_MM, NUMBER_R_MM, stroke=0, fill=1)
    # The canvas is already scale(mm, mm)'d (booklet.py), so a font size
    # given directly in points here would render mm-sized (7 -> ~20pt) --
    # convert from the real target point size to match the ruling page's
    # own "© Mironium" footer text (also 7pt) exactly.
    c.setFont("Helvetica", 7 / 2.83465)
    c.setFillColorRGB(0.45, 0.45, 0.45)
    c.drawCentredString(cx, NUMBER_CY_MM - 1.0, str(page_number))
    c.restoreState()


def draw_group_page(c, page_rows, inset_mm=LEFT_INSET_MM, page_number=None, number_align="left", style="practice"):
    """Content-only overlay for one A5 slot: whatever practice rows landed
    on this page, positioned to align with the real ruling PDF's own lines.
    Draws no ruling, no background, no header -- booklet.py merges this
    onto the actual notebook page. `inset_mm` is which reference line
    (outer margin or center divider) this slot's content should hug.

    `style="practice"` (a letter's page 1) fills the top half of every row
    to the normal TAIL_FRACTION width; from the middle row down, each
    row's own natural fit-count shrinks by one more repetition per row --
    a taper ("скос", confirmed with the user 2026-08-15) that leaves
    progressively more blank ruled space toward the bottom for
    independent writing. `style="sample"` (a letter's page 2, confirmed
    with the user 2026-08-18) draws the model once at the start of every
    row and leaves the rest blank -- no repetitions, no taper.

    `page_number`, if given, is stamped past the outer margin, in a white
    circle badge (`number_align="left"` for the left slot, "right" for the
    right slot -- standard book pagination, verso/recto numbers sitting at
    the outer edge) in READING order (after fold and staple), not raw PDF
    page order, so a parent can flip through the assembled notebook and
    confirm nothing is out of sequence (confirmed with the user
    2026-08-15: raw imposition order looks scrambled and caused real
    confusion once already)."""
    baselines = row_baselines()
    middle = len(baselines) // 2
    fill_limit_mm = CONTENT_W_MM * (1 - TAIL_FRACTION)

    if page_number is not None:
        draw_page_number_badge(c, page_number, number_align)

    c.saveState()
    c.translate(inset_mm, 0)

    if style == "sample":
        for baseline_y, row_cards in zip(baselines, page_rows):
            draw_row(c, row_cards, baseline_y, CONTENT_W_MM, max_instances=1)
    else:
        for row_index, (baseline_y, row_cards) in enumerate(zip(baselines, page_rows)):
            if row_index < middle:
                draw_row(c, row_cards, baseline_y, CONTENT_W_MM)
            else:
                natural = _natural_count(row_cards, fill_limit_mm)
                cap = max(natural - (row_index - middle + 1), 1)
                draw_row(c, row_cards, baseline_y, CONTENT_W_MM, max_instances=cap)

    c.restoreState()
