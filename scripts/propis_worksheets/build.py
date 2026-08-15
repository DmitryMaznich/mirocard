#!/usr/bin/env python3
"""Generates one imposed booklet PDF per letter group (see
letter_groups.GROUPS) into output/.

Usage:
  python build.py         # all groups
  python build.py 1       # just group 1 (fast iteration while tuning layout)
"""

import os
import sys

from pypdf import PdfReader, PdfWriter

from letter_groups import GROUPS
from render import load_letters
from booklet import build_group_pdf

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTPUT_DIR = os.path.join(ROOT, "output")
ALL_PDF_PATH = os.path.join(OUTPUT_DIR, "propis_worksheets_all.pdf")


def _merge_all(group_paths):
    """Concatenates every already-built group PDF, in group order, into one
    downloadable file -- each group's own 12-page block stays a complete,
    correctly-imposed 6-sheet booklet on its own (no re-imposition here,
    just page concatenation), so printing/folding/stapling one group's page
    range still produces that group's standalone tetrad. One file instead
    of 6 separate downloads (confirmed with the user 2026-08-15)."""
    writer = PdfWriter()
    page_ranges = []
    page_num = 1
    for group_id, path in group_paths:
        reader = PdfReader(path)
        writer.append(reader)
        n = len(reader.pages)
        page_ranges.append((group_id, page_num, page_num + n - 1))
        page_num += n
    with open(ALL_PDF_PATH, "wb") as f:
        writer.write(f)
    return page_ranges


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    letters = load_letters()

    target = int(sys.argv[1]) if len(sys.argv) > 1 else None

    group_paths = []
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
        group_paths.append((group["id"], out_path))

    if target is None and len(group_paths) == len(GROUPS):
        page_ranges = _merge_all(group_paths)
        print(f"\n  объединено в {ALL_PDF_PATH}:")
        for group_id, first, last in page_ranges:
            print(f"    группа {group_id}: страницы {first}-{last}")


if __name__ == "__main__":
    main()
