"""Saddle-stitch booklet imposition: arranges N per-page overlays of
propis letter content onto the REAL, ALREADY EXISTING "плотная" notebook
ruling PDF (make_lined_paper_landscape.py) -- physical A4-landscape
sheet-faces (2 A5 slots per face, printed double-sided) in the order that
reads correctly after folding down the center and stapling, same as the
existing print_materials notebooks.

Reuses the actual ruling page verbatim (regenerated fresh from its own
script every build, never redrawn here) rather than re-deriving an
equivalent grid, so the printed page is pixel-identical to the blank
copybook pages already in this topic (confirmed with the user
2026-08-15) -- and picks up that page's red margin lines, staple-slot
markers, and footer for free, none of which propis's own ruling ever
drew.

Verified by hand during planning for n=4 and n=8: sheet i's front holds
pages (n-1-2i, 2i) left-to-right, its back holds pages (2i+1, n-2-2i) --
this is the standard "nested sheets" saddle-stitch layout (sheet 0 is the
OUTERMOST wrap, sheet n//4 - 1 is the INNERMOST, centered when assembled).
"""

import os
import subprocess
import sys

from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from pypdf import PdfReader, PdfWriter

from page import PAGE_W_MM, LEFT_INSET_MM, CENTER_INSET_MM, draw_group_page, notebook_rows, paginate_rows

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RULING_SCRIPT = os.path.join(ROOT, "make_lined_paper_landscape.py")
RULING_PDF = os.path.join(ROOT, "lined_paper_A4_landscape.pdf")


def _ensure_ruling_pdf():
    """Regenerates the real "плотная" notebook ruling PDF from its own
    source script -- this module never redraws that grid itself, only
    reuses whatever the actual script currently produces."""
    subprocess.run([sys.executable, RULING_SCRIPT], cwd=ROOT, check=True)
    return RULING_PDF


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


def _build_overlay_pdf(pages, out_path):
    """Content-only pages (no ruling, no background) -- one physical A4
    sheet-face per showPage(), same page count and imposition order as
    the final output."""
    c = canvas.Canvas(out_path, pagesize=landscape(A4))
    n = len(pages)

    def draw_slot(index, x_offset_mm):
        # The left A5 slot's local x=0 is the page's outer edge (hug the
        # real margin); the right slot's local x=0 is the center divider
        # (hug that line instead) -- see page.py's LEFT_INSET_MM/CENTER_INSET_MM.
        inset = LEFT_INSET_MM if x_offset_mm == 0 else CENTER_INSET_MM
        # `index` is this slot's 0-based position in READING order (the
        # `pages` list is already in reading order; only the physical
        # placement below is scrambled by imposition) -- label reflects
        # that, not raw PDF page order.
        c.saveState()
        c.translate(x_offset_mm * mm, 0)
        c.scale(mm, mm)
        draw_group_page(c, pages[index], inset_mm=inset, page_label=f"{index + 1}/{n}")
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


def build_notebook_pdf(groups, letters, out_path):
    pages = paginate_rows(notebook_rows(groups, letters))
    n = len(pages)
    if n % 4 != 0:
        n += 4 - (n % 4)
    pages = pages + [[]] * (n - len(pages))  # pad with fully-ruled, letter-free pages

    ruling_path = _ensure_ruling_pdf()
    overlay_path = out_path + ".overlay.tmp.pdf"
    sheets = _build_overlay_pdf(pages, overlay_path)

    overlay_reader = PdfReader(overlay_path)
    writer = PdfWriter()

    for overlay_page in overlay_reader.pages:
        # Re-parse the ruling PDF fresh for every page -- reusing one
        # PdfReader instance across multiple writer.append() calls makes
        # pypdf alias the SAME underlying page object for each "copy", so
        # merge_page() on one page silently mutates all of them (verified
        # 2026-08-15: every output page ended up identical, showing the
        # union of all overlays, until this fix).
        writer.append(PdfReader(ruling_path))
        writer.pages[-1].merge_page(overlay_page)

    with open(out_path, "wb") as f:
        writer.write(f)
    os.remove(overlay_path)

    return sheets
