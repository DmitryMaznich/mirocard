"""Saddle-stitch booklet build for the whole-word ("слова") notebooks --
same real ruling PDF, same imposition/pypdf-merge plumbing as booklet.py's
letter notebooks and syllable_booklet.py's letter-connections notebook,
just drawing word_page.draw_word_page pages instead.

Split into two separate downloadable files, block A vs block B (confirmed
with the user 2026-08-19), same as the letter notebooks' own "часть
1"/"часть 2" split -- build.py calls build_word_notebook_pdf once per
block, each with its own out_path.
"""

import os

from page import paginate_rows
from word_page import draw_word_page, ROWS_PER_PAGE
from words import word_notebook_rows

from booklet import (
    _ensure_ruling_pdf,
    _build_overlay_pdf_generic,
    _merge_with_ruling,
)


def _build_word_overlay_pdf(pages, out_path, letters, connectors_by_key, variant_index):
    def draw_page_fn(c, index, page_rows, inset, page_number, number_align):
        draw_word_page(
            c, page_rows, letters, connectors_by_key, variant_index,
            inset_mm=inset, page_number=page_number, number_align=number_align,
        )

    return _build_overlay_pdf_generic(pages, out_path, draw_page_fn)


def build_word_notebook_pdf(letters, connectors_by_key, variant_index, out_path, words=None, min_pages=0):
    """min_pages: pad with fully-ruled, word-free pages up to AT LEAST this
    many pages (still rounded up to the next multiple of 4 -- every page
    still needs a partner to fold/staple into a real sheet), even past the
    natural minimum a page count divisible by 4 would need. Block A's own
    notebook uses this deliberately (confirmed with the user 2026-08-19):
    its real word list only needs 6 content pages, but forcing it to a
    small 8-page/2-sheet booklet made it feel like an afterthought next to
    its sibling notebooks -- padding it out to a full 24-page/6-sheet
    booklet (blank pages after the real content, correctly numbered same
    as any other page -- draw_word_page always stamps the badge whether or
    not page_rows has content) makes it a comparable physical object to
    print and bind, at the cost of blank pages instead of invented words."""
    pages = paginate_rows(word_notebook_rows(words), per_page=ROWS_PER_PAGE)
    n = max(len(pages), min_pages)
    if n % 4 != 0:
        n += 4 - (n % 4)
    pages = pages + [[]] * (n - len(pages))  # pad with fully-ruled, word-free pages

    ruling_path = _ensure_ruling_pdf()
    overlay_path = out_path + ".overlay.tmp.pdf"
    sheets = _build_word_overlay_pdf(pages, overlay_path, letters, connectors_by_key, variant_index)
    _merge_with_ruling(overlay_path, ruling_path, out_path)
    os.remove(overlay_path)

    return sheets
