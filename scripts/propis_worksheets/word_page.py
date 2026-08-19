"""Draws whole-word ("слова") pages onto the same real notebook ruling
page.py's letter worksheets use -- one word per row, the real N-letter
trajectory (connectors.build_word_trajectory + render.draw_pair) drawn
once at the row's start, no fading repetitions and no dotted tracing
(confirmed with the user 2026-08-19: same content shape as
syllable_page.py's rows -- a real word is just a longer, more varied
trajectory through the same connector machinery -- just words instead of
consonant+vowel pairs, and words.ROWS_PER_WORD rows per word instead of
syllables.ROWS_PER_SYLLABLE).
"""

from connectors import build_word_trajectory
from render import draw_pair
from page import (
    LEFT_INSET_MM,
    row_baselines,
    draw_page_number_badge,
)

ROWS_PER_PAGE = len(row_baselines())


def draw_word_row(c, word, baseline_y_mm, letters, connectors_by_key, variant_index):
    segments = build_word_trajectory(word, letters, connectors_by_key, variant_index)
    draw_pair(c, segments, 0.0, baseline_y_mm, 1.0)


def draw_word_page(c, page_rows, letters, connectors_by_key, variant_index,
                    inset_mm=LEFT_INSET_MM, page_number=None, number_align="left"):
    """Content-only overlay for one A5 slot, same contract as
    page.draw_group_page / syllable_page.draw_syllable_page: `page_rows`
    is this page's slice of words.word_notebook_rows() (one word per row,
    or None for a blank padding row)."""
    if page_number is not None:
        draw_page_number_badge(c, page_number, number_align)

    c.saveState()
    c.translate(inset_mm, 0)
    for baseline_y, word in zip(row_baselines(), page_rows):
        if word is None:
            continue
        draw_word_row(c, word, baseline_y, letters, connectors_by_key, variant_index)
    c.restoreState()
