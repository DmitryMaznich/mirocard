"""Page plan for the 24-page punctuation workbook.

KIND decides each page's diagonal grid: "dense" (3mm) for pages drilling
marks in isolation, "standard" (20mm) for pages with words/sentences.
CONTENT holds the pages built so far; any other page is printed as bare
ruling of its KIND.
"""

from content import practice_page, text_page, mark_row, ROWS, BASELINES

DENSE_PAGES = {1, 2, 3, 8, 9, 10, 13, 14, 18}
KIND = {n: ("dense" if n in DENSE_PAGES else "standard") for n in range(1, 25)}


def p1(ink, c, inset, half, warnings, n):
    # Full stop: size and landing on the line are all there is to it, so the
    # rhythm changes every few rows instead of 17 identical rows (agreed with
    # the user 2026-09-24): every 4 cells -> every 2 cells -> pairs one cell
    # apart (tapering) -> one model per row. The ТЗ's "кот. дом. мама." words
    # moved to page 4 -- words drown in the dense grid.
    for r, baseline in enumerate(BASELINES):
        if r < 4:
            mark_row(ink, c, ".", baseline, inset, half, group_step=4)
        elif r < 8:
            mark_row(ink, c, ".", baseline, inset, half, group_step=2)
        elif r < 12:
            if r == 8:
                full = mark_row(ink, c, "..", baseline, inset, half, inner_step=2, group_step=4)
            else:
                mark_row(ink, c, "..", baseline, inset, half, max_groups=max(full - (r - 8), 1),
                         inner_step=2, group_step=4)
        else:
            mark_row(ink, c, ".", baseline, inset, half, max_groups=1)


def p2(ink, c, inset, half, warnings, n):
    # Comma alone: a mark every 4 cells, full rows on top, taper below,
    # model-only rows at the bottom.
    rows = [","] * ROWS
    practice_page(ink, c, rows, inset, half, first_sample_row=13)


def p3(ink, c, inset, half, warnings, n):
    # Dot vs comma: alternating pair, then short sequences.
    rows = ([(".,", {"inner_step": 4, "group_step": 4})] * 4
            + [".,,."] * 3 + [",.,."] * 3 + ["..,,"] * 3
            + [".,,.", ",.,.", "..,,", ",..,"])
    practice_page(ink, c, rows, inset, half, first_sample_row=13)


def p20(ink, c, inset, half, warnings, n):
    # Comma + ? / ! in one sentence. Top: tracing (faded), middle: fainter
    # tracing, bottom: one full model with an empty row under it.
    a = ["Где хлеб, сыр и сок?", "Смотри, какой дом!", "Кот, ты где?", "Папа, иди сюда!"]
    b = ["Оля, ты дома?", "Стой, тут лужа!", "Мама, кто там?", "Ура, снег идёт!"]
    rows = ([(s, 0.5) for s in a] + [(s, 0.28) for s in a]
            + [x for s in b for x in ((s, 1.0), None)] + [None])
    text_page(ink, c, rows, inset, warnings, n)


CONTENT = {1: p1, 2: p2, 3: p3, 20: p20}
