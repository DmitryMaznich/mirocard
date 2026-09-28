"""Page plan for the digits workbook (agreed with the user 2026-09-28):

    1-9    one digit per page, in order 1..9
    10     0 (after 9, right before 10 -- as in 1st-grade maths textbooks;
           "zero = nothing" is abstract, and 0 vs the letter О)
    11-20  combinations, then examples with + − = (all on the "клетка" grid:
           maths is written in cells, never on the slanted propis ruling)
    21-24  digits inside handwritten text, on the standard propis ruling

The combination/example split inside 11-20 is not decided yet.
"""

from digits_content import practice_row

TEXT_PAGES = range(21, 25)
KIND = {n: ("standard" if n in TEXT_PAGES else "cells") for n in range(1, 25)}

ORDER = "1234567890"


# Vertical budget (42 cells of 5mm; user, 2026-09-28: use the page fully, no
# empty rows, one empty cell between rows stays): big rows 2 cells tall,
# standard rows 1 cell, one-cell gap after each. Top of the first big digit
# on line 3 (15mm from the top edge, clear of the printer's unprintable
# strip); last baseline on line 40 (10mm up: the footer is at 3mm, the page
# badge sits in the margin). That's 2 big + 16 standard rows.
BIG_ROWS = (5, 8)
STD_ROWS = tuple(range(10, 41, 2))   # 16 rows


def digit_page(c, cards, d, is_left):
    """One digit, top to bottom:
      2 big rows (2 cells tall): model + 5, then + 3 dashed copies to trace;
      4 standard rows (digit, empty cell): model + 6 copies, rest free;
      3 rows tapering the copies (4, 2, 1) -- propis "скос";
      model alone on the remaining rows (the child writes the row himself);
      from page 2 on, the last 2 rows review every digit so far."""
    done = ORDER[:ORDER.index(d)]
    practice_row(c, cards, d, is_left, BIG_ROWS[0], cells_h=2, step=3, n_trace=5)
    practice_row(c, cards, d, is_left, BIG_ROWS[1], cells_h=2, step=3, n_trace=3)
    rows = list(STD_ROWS)
    review = rows[-2:] if done else []
    if review:
        rows = rows[:-2]
    for i, t in enumerate(rows):
        if i < 4:
            practice_row(c, cards, d, is_left, t)
        elif i < 7:
            practice_row(c, cards, d, is_left, t, n_trace=(4, 2, 1)[i - 4])
        else:
            practice_row(c, cards, d, is_left, t, model_only=True)
    if review:
        seq = done + d
        practice_row(c, cards, seq, is_left, review[0], n_trace=len(seq))
        practice_row(c, cards, seq, is_left, review[1], model_only=True)


CONTENT = {i + 1: (lambda c, cards, is_left, d=d: digit_page(c, cards, d, is_left))
           for i, d in enumerate(ORDER[:1])}
