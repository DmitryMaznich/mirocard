#!/usr/bin/env python3
"""Generates one imposed booklet PDF per notebook (see
letter_groups.NOTEBOOKS) into output/ -- each notebook is its own
downloadable file (confirmed with the user 2026-08-18: 2 separate files,
not merged into one), so printing/binding one doesn't require pulling a
page range out of a bigger file.

Usage:
  python build.py         # all notebooks
  python build.py 1       # just notebook 1 (fast iteration while tuning layout)
"""

import os
import sys

from letter_groups import NOTEBOOKS, notebook_groups
from render import load_letters, load_letters_with_variants, load_connectors
from booklet import build_notebook_pdf
from connectors import build_connectors_by_key, build_variant_index
from syllable_booklet import build_syllable_notebook_pdf
from syllables import all_pairs

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTPUT_DIR = os.path.join(ROOT, "output")


def _build_letter_notebooks(letters, target):
    for notebook in NOTEBOOKS:
        if target is not None and target != notebook["id"]:
            continue
        groups = notebook_groups(notebook)
        all_letters = [pair for g in groups for pair in g["letters"]]
        missing = [l for l, u in all_letters if l not in letters or (u and u not in letters)]
        if missing:
            print(f"  тетрадь {notebook['id']}: ПРОПУЩЕНЫ буквы {missing}, пропускаю")
            continue
        out_path = os.path.join(OUTPUT_DIR, f"propis_worksheets_notebook{notebook['id']}.pdf")
        sheets = build_notebook_pdf(groups, letters, out_path)
        print(f"  тетрадь {notebook['id']} ({notebook['label']}, {len(all_letters)} букв): {sheets} лист(ов) A4 -> {out_path}")


def _build_syllable_notebook(target):
    if target is not None and target not in ("syllables", "3"):
        return
    letters = load_letters_with_variants()
    connectors_by_key = build_connectors_by_key(load_connectors())
    variant_index = build_variant_index(letters)
    pairs = all_pairs()

    out_path = os.path.join(OUTPUT_DIR, "propis_worksheets_syllables.pdf")
    sheets = build_syllable_notebook_pdf(letters, connectors_by_key, variant_index, out_path, pairs)
    print(f"  тетрадь слогов ({len(pairs)} пар): {sheets} лист(ов) A4 -> {out_path}")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    target = sys.argv[1] if len(sys.argv) > 1 else None

    if target not in ("syllables", "3"):
        letter_target = int(target) if target is not None else None
        _build_letter_notebooks(load_letters(), letter_target)
    if target is None or target in ("syllables", "3"):
        _build_syllable_notebook(target)


if __name__ == "__main__":
    main()
