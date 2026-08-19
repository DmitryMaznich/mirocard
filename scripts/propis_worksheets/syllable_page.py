"""Draws letter-connection ("слоги") pages onto the same real notebook
ruling page.py's letter worksheets use -- one pair per row, the real
connector trajectory (connectors.build_pair + render.draw_pair) drawn
once at the row's start, no fading repetitions and no dotted tracing
(confirmed with the user 2026-08-19: "слоги предлагаем только образцы в
начале строки, без пунктиров" -- same content shape as page.py's
style="sample" letter rows, just drawing a pair instead of a single
card).
"""

from connectors import build_pair
from render import draw_pair
from page import (
    CONTENT_W_MM,
    LEFT_INSET_MM,
    row_baselines,
    draw_page_number_badge,
)

ROWS_PER_PAGE = len(row_baselines())


def draw_syllable_row(c, pair, baseline_y_mm, letters, connectors_by_key, variant_index):
    segments = build_pair(pair[0], pair[1], letters, connectors_by_key, variant_index)
    draw_pair(c, segments, 0.0, baseline_y_mm, 1.0)


def draw_syllable_page(c, page_rows, letters, connectors_by_key, variant_index,
                        inset_mm=LEFT_INSET_MM, page_number=None, number_align="left"):
    """Content-only overlay for one A5 slot, same contract as
    page.draw_group_page: `page_rows` is this page's slice of
    syllables.syllable_notebook_rows() (one (letter1, letter2) pair per
    row, or None for a blank padding row)."""
    if page_number is not None:
        draw_page_number_badge(c, page_number, number_align)

    c.saveState()
    c.translate(inset_mm, 0)
    for baseline_y, pair in zip(row_baselines(), page_rows):
        if pair is None:
            continue
        draw_syllable_row(c, pair, baseline_y, letters, connectors_by_key, variant_index)
    c.restoreState()
