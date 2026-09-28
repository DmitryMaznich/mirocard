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


def digit_page(c, cards, d, is_left):
    """One digit, top to bottom (grid line index t = baseline):
      two big rows (2 cells tall): model + dashed copies to trace;
      four standard rows (digit, empty cell): model + 6 copies, rest free;
      three rows tapering the copies (4, 2, 1) -- propis "скос";
      then the model alone, the child writes the row by himself;
      last two rows: review of every digit so far (from page 2 on)."""
    done = ORDER[:ORDER.index(d)]
    practice_row(c, cards, d, is_left, 5, cells_h=2, step=3, n_trace=5)
    practice_row(c, cards, d, is_left, 8, cells_h=2, step=3, n_trace=3)
    for t in (11, 13, 15, 17):
        practice_row(c, cards, d, is_left, t)
    for t, n in ((19, 4), (21, 2), (23, 1)):
        practice_row(c, cards, d, is_left, t, n_trace=n)
    model_rows = (25, 27, 29, 31, 33, 35, 37) if not done else (25, 27, 29, 31, 33)
    for t in model_rows:
        practice_row(c, cards, d, is_left, t, model_only=True)
    if done:
        seq = done + d
        practice_row(c, cards, seq, is_left, 35, n_trace=len(seq))
        practice_row(c, cards, seq, is_left, 37, model_only=True)


CONTENT = {i + 1: (lambda c, cards, is_left, d=d: digit_page(c, cards, d, is_left))
           for i, d in enumerate(ORDER[:1])}
