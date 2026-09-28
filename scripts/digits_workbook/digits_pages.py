"""Page plan for the digits workbook (planned with the user 2026-09-28):
pages 1-12 on a 5mm "клетка" grid (digits, numbers, + − =), pages 13-24 on
the standard propis ruling (digits inside handwritten text). Digit order
follows the hand's motion, not 0-9: straight lines (1 4 7), ovals (0 6 9),
arcs (2 3 5 8)."""

from digits_content import practice_row

KIND = {n: ("cells" if n <= 12 else "standard") for n in range(1, 25)}


def digit_block(c, cards, d, is_left, t):
    """4 rows for one digit: big (2 cells) model + tracing, two standard
    rows (digit, empty cell), and model-only to write alone."""
    practice_row(c, cards, d, is_left, t, cells_h=2, step=3, n_trace=5)
    practice_row(c, cards, d, is_left, t + 3)
    practice_row(c, cards, d, is_left, t + 5)
    practice_row(c, cards, d, is_left, t + 7, model_only=True)


def p1(c, cards, is_left):
    digit_block(c, cards, "1", is_left, 5)
    digit_block(c, cards, "4", is_left, 17)
    # both together: alternate, then write alone
    practice_row(c, cards, "14", is_left, 29, n_trace=6)
    practice_row(c, cards, "41", is_left, 31, n_trace=6)
    practice_row(c, cards, "14", is_left, 33, model_only=True)
    practice_row(c, cards, "41", is_left, 35, model_only=True)


CONTENT = {1: p1}
