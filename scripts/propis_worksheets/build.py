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
from word_booklet import build_word_notebook_pdf
from words import BLOCK_B, block_a_notebook_words
from text_booklet import build_text_notebook_pdf
from texts import TEXTS

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


def _build_word_notebooks(target):
    # Two separate files, block A vs block B (confirmed with the user
    # 2026-08-19, same split as the letter notebooks' own "часть 1"/"часть
    # 2"). Block A's notebook uses block_a_notebook_words() (BLOCK_A plus
    # each lowercase word's capitalized-first-letter twin, confirmed with
    # the user 2026-08-19) instead of BLOCK_A alone -- real content now
    # fills its natural size (~3 sheets) without needing an artificial
    # min_pages padding target; block B gets the ordinary
    # round-up-to-the-next-sheet treatment every other notebook in this
    # pipeline uses.
    if target is None or target in ("words1", "5"):
        letters = load_letters_with_variants()
        connectors_by_key = build_connectors_by_key(load_connectors())
        variant_index = build_variant_index(letters)
        words = block_a_notebook_words()
        out_path = os.path.join(OUTPUT_DIR, "propis_worksheets_words_part1.pdf")
        sheets = build_word_notebook_pdf(letters, connectors_by_key, variant_index, out_path, words)
        print(f"  тетрадь слов, часть 1 ({len(words)} слов): {sheets} лист(ов) A4 -> {out_path}")
    if target is None or target in ("words2", "6"):
        letters = load_letters_with_variants()
        connectors_by_key = build_connectors_by_key(load_connectors())
        variant_index = build_variant_index(letters)
        out_path = os.path.join(OUTPUT_DIR, "propis_worksheets_words_part2.pdf")
        sheets = build_word_notebook_pdf(letters, connectors_by_key, variant_index, out_path, BLOCK_B)
        print(f"  тетрадь слов, часть 2 ({len(BLOCK_B)} слов): {sheets} лист(ов) A4 -> {out_path}")


def _build_text_notebook(target):
    if target is not None and target not in ("texts", "7"):
        return
    letters = load_letters_with_variants()
    connectors_by_key = build_connectors_by_key(load_connectors())
    variant_index = build_variant_index(letters)
    out_path = os.path.join(OUTPUT_DIR, "propis_worksheets_texts.pdf")
    sheets = build_text_notebook_pdf(letters, connectors_by_key, variant_index, out_path, TEXTS)
    print(f"  тетрадь текстов ({len(TEXTS)} текстов): {sheets} лист(ов) A4 -> {out_path}")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    target = sys.argv[1] if len(sys.argv) > 1 else None
    non_letter_targets = ("syllables", "3", "words1", "5", "words2", "6", "texts", "7")

    if target is None or target not in non_letter_targets:
        letter_target = int(target) if target is not None else None
        _build_letter_notebooks(load_letters(), letter_target)
    if target is None or target in ("syllables", "3"):
        _build_syllable_notebook(target)
    if target is None or target in ("words1", "5", "words2", "6"):
        _build_word_notebooks(target)
    if target is None or target in ("texts", "7"):
        _build_text_notebook(target)


if __name__ == "__main__":
    main()
