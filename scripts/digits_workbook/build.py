"""Builds the digits workbook: 24 A5 pages imposed as a saddle-stitch
booklet on A4-landscape sheets, like the punctuation workbook
(../punctuation_workbook/build.py), whose ruling it reuses ("cells" kind
added for the first half).

    python build.py              # output/digits_workbook.pdf
    python build.py --png 1 2    # + 200dpi PNG of these A5 pages
"""

import argparse
import os

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from digits_content import HERE, load_cards, page_number
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
            draw_sheet_ruling(c, KIND[ln], KIND[rn], "gray")
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
