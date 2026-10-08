"""Builds the digits workbook: 24 A5 pages imposed as a saddle-stitch
booklet on A4-landscape sheets, like the punctuation workbook
(../punctuation_workbook/build.py), whose ruling it reuses ("cells" kind
added for the first half).

    python build.py              # output/digits_workbook.pdf (sheets only)
                                 # + Цифры_A4_для_печати_книжкой.pdf: cover,
                                 #   blank back, sheets, print preferences
    python build.py --png 1 2    # + 200dpi PNG of these A5 pages
"""

import argparse
import os
import subprocess
import sys

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from digits_content import HERE, MARGIN_MM, load_cards, page_number
from digits_pages import CONTENT, KIND
from ruling import draw_sheet_ruling, HALF_W
from booklet import _imposition_order  # noqa: E402  (digits_content put ../propis_worksheets on sys.path)

ROOT = os.path.dirname(os.path.dirname(HERE))
OUT_DIR = os.path.join(ROOT, "output")
N_PAGES = 24


def build(out_path):
    cards = load_cards()
    c = canvas.Canvas(out_path, pagesize=landscape(A4))
    c.setTitle("Цифры — пропись")
    c.setAuthor("Mironium TEAM")
    placement = {}
    idx = 0
    for front, back in _imposition_order(N_PAGES):
        for left, right in (front, back):
            ln, rn = left + 1, right + 1
            draw_sheet_ruling(c, KIND[ln], KIND[rn], "gray", margin_mm=MARGIN_MM)
            for n, is_left in ((ln, True), (rn, False)):
                c.saveState()
                c.translate(0 if is_left else HALF_W, 0)
                c.scale(mm, mm)
                if n in CONTENT:
                    CONTENT[n](c, cards, is_left)
                page_number(c, n, "left" if is_left else "right")
                c.restoreState()
                placement[n] = (idx, is_left)
            c.showPage()
            idx += 1
    c.save()
    return placement


PRINT_PDF = "Цифры_A4_для_печати_книжкой.pdf"


def build_cover():
    """Cover from the shared propis cover script (digits variant)."""
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "cover_tetrad.py"),
                    "--style=цифры", "--variant=digits"], cwd=ROOT, check=True)
    return os.path.join(ROOT, "cover_цифры_digits.pdf")


PROPIS_DIR = os.path.join(ROOT, "tools", "propis")
DECK_PRINT = os.path.join(PROPIS_DIR, "print", "прописи_цифры.pdf")
DECK_THUMB = os.path.join(PROPIS_DIR, "thumbnails", "propis_worksheets_digits.png")


def stage_for_deck(print_pdf):
    """Where tools/propis/topic.json's `propis_worksheets_digits` item
    expects its PDF and thumbnail (both dirs gitignored, shipped in the
    deck zip by scripts/build-propis-deck.mjs). Thumbnail = the cover page,
    as for the punctuation workbook."""
    import shutil
    import pymupdf
    os.makedirs(os.path.dirname(DECK_PRINT), exist_ok=True)
    shutil.copy(print_pdf, DECK_PRINT)
    os.makedirs(os.path.dirname(DECK_THUMB), exist_ok=True)
    pymupdf.open(DECK_PRINT)[0].get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5)).save(DECK_THUMB)
    print(DECK_PRINT)
    print(DECK_THUMB)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--png", nargs="*", type=int, default=None)
    args = ap.parse_args()
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, "digits_workbook.pdf")
    placement = build(out)
    from digits_pages import WARNINGS
    for w in WARNINGS:
        print("WARNING:", w)
    print(out)
    sys.path.insert(0, os.path.join(ROOT, "scripts"))
    from propis_print_notebooks import merge   # cover + blank back + sheets + print prefs
    print_pdf = os.path.join(OUT_DIR, PRINT_PDF)
    merge(build_cover(), out, print_pdf)
    print(print_pdf)
    stage_for_deck(print_pdf)
    if args.png is not None:
        import pymupdf
        doc = pymupdf.open(out)
        for n in args.png or sorted(CONTENT):
            i, is_left = placement[n]
            r = doc[i].rect
            clip = pymupdf.Rect(0, 0, r.width / 2, r.height) if is_left else \
                pymupdf.Rect(r.width / 2, 0, r.width, r.height)
            png = out[:-4] + f"_p{n:02d}.png"
            doc[i].get_pixmap(dpi=200, clip=clip).save(png)
            print(png)


if __name__ == "__main__":
    main()
