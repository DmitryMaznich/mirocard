"""Page plan for the digits workbook (agreed with the user 2026-09-28):

    1-9    one digit per page, in order 1..9
    10     0 (after 9, right before 10 -- as in 1st-grade maths textbooks;
           "zero = nothing" is abstract, and 0 vs the letter О)
    11-15  numbers: 10, 11-15, 16-20, tens and "twins", digit order in a
           number (12 / 21)
    16     the signs + − =
    17-20  examples to COPY (not to solve -- this notebook teaches writing):
           + up to 5, − up to 5, ± up to 10, with two-digit numbers
    (all on the "клетка" grid: maths is written in cells, never on the
    slanted propis ruling; each character in its own cell, a number's
    digits side by side, one free cell between numbers, three between
    examples. Only + and − (user, 2026-09-28); > < and × : are captured
    for the app but left out of this notebook.)
    21-24  digits inside handwritten text, on the standard propis ruling

"""

from digits_content import practice_row, seq_row, units_row, COLS

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
        review_rows(c, cards, done + d, is_left, *review)


def review_rows(c, cards, seq, is_left, t1, t2):
    """Every digit so far, in order -- never cut mid-sequence:
      row 1: the sequence half-tone dashed, repeated whole while it fits;
      row 2: short sequence (fits twice): solid once, then room to copy it;
             longer: every other digit solid, the gaps left for the child
             to fill in ("1 _ 3 _ 5 _ 7") -- recalling the order."""
    slots = COLS // 2
    reps = max(slots // len(seq), 1)
    seq_row(c, cards, [(ch, "dashed") for ch in seq * reps], is_left, t1)
    if 2 * len(seq) <= slots:
        seq_row(c, cards, [(ch, "solid") for ch in seq], is_left, t2)
    else:
        seq_row(c, cards, [(ch, "solid" if i % 2 == 0 else None)
                           for i, ch in enumerate(seq)], is_left, t2)


# Pages 11-20 have no big rows (they introduced a digit's shape; numbers
# and examples don't need it): 19 standard rows, line 4 to line 40.
ROWS19 = tuple(range(4, 41, 2))


def fits(units, gap):
    return sum(len(u) for u in units) + gap * (len(units) - 1) <= COLS


def ladder(c, cards, unit, is_left, rows, gap=1):
    """Model + dashed copies filling the row, then fewer, then the model
    alone -- the digit pages' ladder, for a multi-cell unit."""
    per_row = (COLS + gap) // (len(unit) + gap)
    counts = [per_row - 1] * (len(rows) - 2) + [1, 0] if len(rows) > 2 else [per_row - 1, 0][:len(rows)]
    for t, n in zip(rows, counts):
        units_row(c, cards, [(unit, "solid")] + [(unit, "dashed")] * n, is_left, t, gap)


def sequence_rows(c, cards, seq, is_left, rows):
    """A number sequence, cycling: dashed to trace, then every other number
    solid with gaps to fill in (odd, then even positions)."""
    styles = ["dashed", "odd", "even"]
    for i, t in enumerate(rows):
        st = styles[i % 3]
        if st == "dashed":
            units = [(u, "dashed") for u in seq]
        else:
            keep = 0 if st == "odd" else 1
            units = [(u, "solid" if j % 2 == keep else None) for j, u in enumerate(seq)]
        units_row(c, cards, units, is_left, t)


def p11(c, cards, is_left):
    """10 -- the first number with two digits, side by side."""
    r = ROWS19
    for t in r[:4]:
        units_row(c, cards, [("10", "solid")] + [("10", "dashed")] * 5, is_left, t)
    for t, n in zip(r[4:7], (4, 2, 1)):
        units_row(c, cards, [("10", "solid")] + [("10", "dashed")] * n, is_left, t)
    for t in r[7:13]:
        units_row(c, cards, [("10", "solid")], is_left, t)
    sequence_rows(c, cards, [str(i) for i in range(1, 11)], is_left, r[13:])


def numbers_page(c, cards, numbers, is_left):
    """Each number: model + 5 copies / model + 2 copies / model alone;
    then the run (previous number .. last) as a sequence."""
    r = ROWS19
    for k, n in enumerate(numbers):
        a, b, m = r[3 * k: 3 * k + 3]
        units_row(c, cards, [(n, "solid")] + [(n, "dashed")] * 5, is_left, a)
        units_row(c, cards, [(n, "solid")] + [(n, "dashed")] * 2, is_left, b)
        units_row(c, cards, [(n, "solid")], is_left, m)
    # the page's numbers plus the one before (10..20 is 32 cells, a row has 24)
    run = [str(i) for i in range(int(numbers[0]) - 1, int(numbers[-1]) + 1)]
    sequence_rows(c, cards, run, is_left, r[3 * len(numbers):])


def p14(c, cards, is_left):
    """Tens 10..90 and "twins" 11..99, each split in two rows that fit."""
    r = ROWS19
    tens = [str(10 * i) for i in range(1, 10)]
    twins = [str(11 * i) for i in range(1, 10)]
    for block, rows in ((tens, r[0:8]), (twins, r[8:16])):
        halves = (block[:5], block[5:])
        for i, t in enumerate(rows):
            h = halves[i % 2]
            kind = ("dashed", "dashed", "odd", "odd", "even", "even", "first", "first")[i]
            if kind == "dashed":
                units = [(u, "dashed") for u in h]
            elif kind == "first":
                units = [(h[0], "solid")] + [(u, None) for u in h[1:]]
            else:
                keep = 0 if kind == "odd" else 1
                units = [(u, "solid" if j % 2 == keep else None) for j, u in enumerate(h)]
            units_row(c, cards, units, is_left, t)
    mix = [a for pair in zip(tens, twins) for a in pair]
    units_row(c, cards, [(u, "dashed") for u in mix[:8]], is_left, r[16])
    units_row(c, cards, [(u, "dashed") for u in mix[8:16]], is_left, r[17])
    units_row(c, cards, [(u, "solid" if j % 2 == 0 else None) for j, u in enumerate(mix[:8])], is_left, r[18])


ORDER_PAIRS = [("12", "21"), ("13", "31"), ("16", "61"), ("17", "71"), ("18", "81"), ("69", "96")]


def p15(c, cards, is_left):
    """Digit order inside a number: 12 and 21 are different numbers (user
    liked the idea, 2026-09-28). Per pair: pair + 3 dashed pairs / pair + 1
    dashed pair / pair alone; last row all pairs to trace."""
    r = ROWS19
    for k, (a, b) in enumerate(ORDER_PAIRS):
        rows = r[3 * k: 3 * k + 3]
        for t, n in zip(rows, (3, 1, 0)):
            units_row(c, cards, [(a, "solid"), (b, "solid")] + [(a, "dashed"), (b, "dashed")] * n, is_left, t)
    units_row(c, cards, [(u, "dashed") for p in ORDER_PAIRS[:4] for u in p], is_left, r[18])


def p16(c, cards, is_left):
    """+ − = : 4 rows each (full, 2 copies, 1 copy, model alone), then
    expressions without answers, each sign in its own cell."""
    r = ROWS19
    for k, sign in enumerate("+−="):
        rows = r[4 * k: 4 * k + 4]
        for t, n in zip(rows, (6, 2, 1, 0)):
            units_row(c, cards, [(sign, "solid")] + [(sign, "dashed")] * n, is_left, t,
                      gap=1, dots="all")   # the signs are new here: show where to start
    exprs = ["1+1", "2+1", "3−1", "2−1", "1+2", "3+1", "4−1"]
    for t, e in zip(r[12:], exprs):
        units_row(c, cards, [(e, "solid"), (e, "dashed"), (e, "dashed"), (e, None)], is_left, t, gap=3)


def examples_page(c, cards, examples, is_left, per_row=3):
    """Examples to copy: first half of the rows model + dashed copy + room
    to copy, the rest model + room only. Examples cycle if there are fewer
    than rows."""
    r = ROWS19
    half = (len(r) + 1) // 2
    for i, t in enumerate(r):
        e = examples[i % len(examples)]
        if per_row == 3:
            units = [(e, "solid"), (e, "dashed" if i < half else None), (e, None)]
        else:
            units = [(e, "solid"), (e, "dashed" if i < half else None)]
        units_row(c, cards, units, is_left, t, gap=3)


PLUS5 = ["1+1=2", "1+2=3", "2+1=3", "1+3=4", "3+1=4", "2+2=4", "1+4=5", "4+1=5", "2+3=5", "3+2=5"]
MINUS5 = ["2−1=1", "3−1=2", "3−2=1", "4−1=3", "4−2=2", "4−3=1", "5−1=4", "5−2=3", "5−3=2", "5−4=1"]
MIXED10 = ["5+1=6", "6+2=8", "7+3=10", "4+4=8", "8−2=6", "9−3=6", "10−5=5", "6+3=9", "7−4=3",
           "8+2=10", "9−6=3", "5+5=10", "10−3=7", "7+2=9", "6−6=0", "3+6=9", "10−8=2", "4+5=9", "9−1=8"]
TWO_DIGIT = ["10+1=11", "10+2=12", "10+5=15", "10+9=19", "12−2=10", "15−5=10", "17−7=10",
             "11+1=12", "13+2=15", "14+4=18", "16+3=19", "18−3=15", "19−4=15", "15+5=20",
             "20−5=15", "12+6=18", "17−2=15", "11+8=19", "20−10=10"]

CONTENT = {i + 1: (lambda c, cards, is_left, d=d: digit_page(c, cards, d, is_left))
           for i, d in enumerate(ORDER)}
CONTENT.update({
    11: p11,
    12: lambda c, cards, is_left: numbers_page(c, cards, ["11", "12", "13", "14", "15"], is_left),
    13: lambda c, cards, is_left: numbers_page(c, cards, ["16", "17", "18", "19", "20"], is_left),
    14: p14,
    15: p15,
    16: p16,
    17: lambda c, cards, is_left: examples_page(c, cards, PLUS5, is_left),
    18: lambda c, cards, is_left: examples_page(c, cards, MINUS5, is_left),
    19: lambda c, cards, is_left: examples_page(c, cards, MIXED10, is_left),
    20: lambda c, cards, is_left: examples_page(c, cards, TWO_DIGIT, is_left, per_row=2),
})
