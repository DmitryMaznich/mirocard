"""Builds the punctuation handwriting workbook: 24 A5 pages imposed as a
saddle-stitch booklet on A4-landscape sheets, like every other
propis_worksheets notebook.

    python build.py                     # gray grid (chosen by the user 2026-09-24)
    python build.py --palette blue      # or black: the other notebooks' grid / max contrast
    python build.py --png 2 3 20        # + 200dpi PNG of these A5 pages

Output (<repo>/output/):
    punctuation_workbook[_<palette>].pdf        the 12 imposed sheets only
    Знаки_препинания_A4_для_печати_книжкой.pdf  cover + blank back + sheets,
                                                with print preferences embedded
    Знаки_препинания_A5_по_порядку.pdf          pages 1-24 in reading order
"""

import argparse
import os
import subprocess
import sys

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from content import HERE, Ink, LEFT_INSET_MM, CENTER_INSET_MM, page_number
from pages import CONTENT, KIND
from ruling import draw_sheet_ruling, HALF_W

from booklet import _imposition_order  # noqa: E402  (content.py put ../propis_worksheets on sys.path)

ROOT = os.path.dirname(os.path.dirname(HERE))
OUT_DIR = os.path.join(ROOT, "output")
N_PAGES = 24


def build(out_path, palette):
    ink = Ink()
    warnings = []
    c = canvas.Canvas(out_path, pagesize=landscape(A4))
    c.setTitle("Знаки препинания — пропись")
    c.setAuthor("Mironium TEAM")
    placement = {}  # page number -> (pdf page index, is_left)
    pdf_index = 0
    for front, back in _imposition_order(N_PAGES):
        for left, right in (front, back):
            ln, rn = left + 1, right + 1
            draw_sheet_ruling(c, KIND[ln], KIND[rn], palette)
            for n, is_left in ((ln, True), (rn, False)):
                offset_mm = 0.0 if is_left else HALF_W / mm
                inset = LEFT_INSET_MM if is_left else CENTER_INSET_MM
                c.saveState()
                c.translate(offset_mm * mm, 0)
                c.scale(mm, mm)
                if n in CONTENT:
                    CONTENT[n](ink, c, inset, offset_mm, warnings, n)
                page_number(c, n, "left" if is_left else "right")
                c.restoreState()
                placement[n] = (pdf_index, is_left)
            c.showPage()
            pdf_index += 1
    c.save()
    return warnings, placement


COVER_SCRIPT = os.path.join(os.path.dirname(HERE), "cover_tetrad.py")
PRINT_PDF = "Знаки_препинания_A4_для_печати_книжкой.pdf"
READING_PDF = "Знаки_препинания_A5_по_порядку.pdf"


def build_cover():
    """Cover from the shared propis cover script (punctuation variant)."""
    subprocess.run([sys.executable, COVER_SCRIPT, "--style=знаки", "--variant=punctuation"],
                   cwd=ROOT, check=True)
    return os.path.join(ROOT, "cover_знаки_punctuation.pdf")


def assemble_print_pdf(sheets_pdf, cover_pdf, out_path):
    """Cover, a blank page (the cover's back -- so a duplex print keeps the
    cover on its own sheet), then the imposed sheets. Print preferences
    embedded (duplex flip on short edge, no scaling, tray by page size):
    Acrobat Reader honours them; browsers and most other viewers ignore
    them, so they're a convenience, not a guarantee."""
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import NameObject, BooleanObject, DictionaryObject

    w = PdfWriter()
    cover = PdfReader(cover_pdf)
    w.append(cover)
    box = cover.pages[0].mediabox
    w.add_blank_page(width=float(box.width), height=float(box.height))
    w.append(PdfReader(sheets_pdf))
    w._root_object[NameObject("/ViewerPreferences")] = DictionaryObject({
        NameObject("/Duplex"): NameObject("/DuplexFlipShortEdge"),
        NameObject("/PrintScaling"): NameObject("/None"),
        NameObject("/PickTrayByPDFSize"): BooleanObject(True),
    })
    with open(out_path, "wb") as f:
        w.write(f)


def reading_order_pdf(sheets_pdf, placement, out_path):
    """Pages 1..N as single A5 pages, cropped out of the imposed sheets."""
    from pypdf import PdfReader, PdfWriter
    src = PdfReader(sheets_pdf)
    w = PdfWriter()
    for n in range(1, N_PAGES + 1):
        idx, is_left = placement[n]
        page = w.add_page(src.pages[idx])
        box = page.mediabox
        half = float(box.width) / 2
        x0 = 0 if is_left else half
        for b in (page.mediabox, page.cropbox):
            b.lower_left = (x0, 0)
            b.upper_right = (x0 + half, float(box.height))
    with open(out_path, "wb") as f:
        w.write(f)


PROPIS_DIR = os.path.join(ROOT, "tools", "propis")
DECK_PRINT = os.path.join(PROPIS_DIR, "print", "прописи_знаки_препинания.pdf")
DECK_THUMB = os.path.join(PROPIS_DIR, "thumbnails", "propis_worksheets_punctuation.png")


def stage_for_deck(print_pdf):
    """Put the print PDF and its thumbnail where tools/propis/topic.json's
    `propis_worksheets_punctuation` item expects them, so
    scripts/build-propis-deck.mjs ships them in the deck zip. Both dirs are
    gitignored (regenerated, never committed) -- same as every other
    print material. Thumbnail = first page (the cover) at ~108 dpi, the
    same way make_print_zip.py makes the others."""
    import shutil
    os.makedirs(os.path.dirname(DECK_PRINT), exist_ok=True)
    shutil.copy(print_pdf, DECK_PRINT)
    print(DECK_PRINT)
    try:
        import pymupdf
    except ImportError:
        try:
            import fitz as pymupdf
        except ImportError:
            print("pymupdf not installed -- thumbnail skipped")
            return
    os.makedirs(os.path.dirname(DECK_THUMB), exist_ok=True)
    doc = pymupdf.open(DECK_PRINT)
    doc[0].get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5)).save(DECK_THUMB)
    print(DECK_THUMB)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--palette", default="gray", choices=["blue", "gray", "black"])
    ap.add_argument("--png", nargs="*", type=int, default=None)
    args = ap.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)
    suffix = "" if args.palette == "gray" else f"_{args.palette}"
    out = os.path.join(OUT_DIR, f"punctuation_workbook{suffix}.pdf")
    warnings, placement = build(out, args.palette)
    for w in warnings:
        print("WARNING:", w)
    print(out)

    if args.palette == "gray":   # the final files are built from the chosen grid only
        print_pdf = os.path.join(OUT_DIR, PRINT_PDF)
        assemble_print_pdf(out, build_cover(), print_pdf)
        print(print_pdf)
        stage_for_deck(print_pdf)
        reading = os.path.join(OUT_DIR, READING_PDF)
        reading_order_pdf(out, placement, reading)
        print(reading)

    if args.png is not None:
        import pymupdf
        doc = pymupdf.open(out)
        for n in args.png or sorted(CONTENT):
            idx, is_left = placement[n]
            page = doc[idx]
            r = page.rect
            clip = pymupdf.Rect(0, 0, r.width / 2, r.height) if is_left else \
                pymupdf.Rect(r.width / 2, 0, r.width, r.height)
            png = out[:-4] + f"_p{n:02d}.png"
            page.get_pixmap(dpi=200, clip=clip).save(png)
            print(png)


if __name__ == "__main__":
    main()
