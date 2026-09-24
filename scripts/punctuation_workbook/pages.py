"""Page plan for the 24-page punctuation workbook.

KIND decides each page's diagonal grid: "dense" (3mm) for pages drilling
marks in isolation, "standard" (20mm) for pages with words/sentences.
CONTENT holds the pages built so far; any other page is printed as bare
ruling of its KIND.
"""

from content import chain_row, word_row, practice_page, text_page, mark_row, title_row, ROWS, BASELINES

DENSE_PAGES = {1, 2, 3, 8, 9, 10, 13, 14, 18}
KIND = {n: ("dense" if n in DENSE_PAGES else "standard") for n in range(1, 25)}


def rhythm_page(ink, c, inset, half, title, blocks):
    """Dense-grid mark page (agreed with the user on page 1, 2026-09-24):
    a dashed title word on row 1, then four blocks of four rows, each block
    a different rhythm so the child follows the grid rather than stamping
    marks mechanically:
      1. full rows, wide step          2. full rows, narrow step
      3. groups, tapering (n, n-1, ..., min 2)
      4. rhythm templates: model + just enough faded repeats to show the
         step, cycling through the rhythms above.
    `blocks` = the four (group, kwargs) specs; block 3/4 cycle through a
    list of specs if given one."""
    title_row(ink, c, title, inset)
    rows = BASELINES[1:]
    wide, narrow, groups, templates = blocks
    full = None
    for r, baseline in enumerate(rows):
        block, i = divmod(r, 4)
        if block == 0:
            g, kw = wide
            mark_row(ink, c, g, baseline, inset, half, **kw)
        elif block == 1:
            g, kw = narrow
            mark_row(ink, c, g, baseline, inset, half, **kw)
        elif block == 2:
            g, kw = groups[i % len(groups)]
            if i == 0:
                full = mark_row(ink, c, g, baseline, inset, half, **kw)
            else:
                mark_row(ink, c, g, baseline, inset, half, max_groups=max(full - i, 2), **kw)
        else:
            g, kw, n = templates[i % len(templates)]
            mark_row(ink, c, g, baseline, inset, half, max_groups=n, **kw)


def p1(ink, c, inset, half, warnings, n):
    # Full stop. (The ТЗ's "кот. дом. мама." words moved to page 4 -- words
    # drown in the dense grid.)
    step4 = (".", {"group_step": 4})
    step2 = (".", {"group_step": 2})
    pair = ("..", {"inner_step": 2, "group_step": 4})
    rhythm_page(ink, c, inset, half, "Точка", [
        step4, step2, [pair],
        [(*step4, 2), (*step2, 3), (*pair, 2)],
    ])


def p2(ink, c, inset, half, warnings, n):
    # Comma: same ladder as page 1. Commas sit mid-cell (MARK_OFFSET_CELLS).
    step4 = (",", {"group_step": 4})
    step2 = (",", {"group_step": 2})
    pair = (",,", {"inner_step": 2, "group_step": 4})
    rhythm_page(ink, c, inset, half, "Запятая", [
        step4, step2, [pair],
        [(*step4, 2), (*step2, 3), (*pair, 2)],
    ])


def p3(ink, c, inset, half, warnings, n):
    # Dot vs comma: alternating every 4 cells, alternating every 2 cells,
    # then 4-mark sequences (a different one each row), then templates.
    seqs = [(s, {"inner_step": 2, "group_step": 4}) for s in (".,,.", ",.,.", "..,,", ",..,")]
    rhythm_page(ink, c, inset, half, "Точка и запятая", [
        (".,", {"inner_step": 4, "group_step": 4}),
        (".,", {"inner_step": 2, "group_step": 2}),
        seqs,
        [(g, kw, 2) for g, kw in seqs],
    ])


def word_page(ink, c, inset, rows):
    """rows: (text, mode) per ruled row, top to bottom (see word_row)."""
    for baseline, spec in zip(BASELINES, rows):
        if spec:
            word_row(ink, c, spec[0], baseline, inset, spec[1])


LETTERS = [ch for ch in "абвгдеёжзийклмнопрстуфхцчшщыэюя"]
SHORT_WORDS = ["кот", "дом", "сок", "мама", "папа", "лес", "сад", "мяч", "рыба", "лиса",
               "нос", "сыр", "суп", "луна", "зима", "гора", "утка", "окно", "стол", "лук",
               "мак", "жук", "шар", "чай", "каша", "сова", "волк", "роза", "небо", "река",
               "море", "дуб", "сом", "кит", "лампа", "вода", "книга", "мост", "торт", "кран"]


def p4(ink, c, inset, half, warnings, n):
    # Agreed with the user 2026-09-24: switch between DIFFERENT letters and
    # the comma, keeping the comma's size and place. Every row: single
    # letters (random order and case, no ь/ъ), each followed by a comma;
    # first one solid, the rest half-tone dashed to trace, filled to the
    # margin. Fixed seed -> the same page on every build.
    import random
    rng = random.Random(4)
    starters = LETTERS[:]
    rng.shuffle(starters)   # a different solid model opens every row
    for r, baseline in enumerate(BASELINES):
        letters = [ch for ch in LETTERS if ch != starters[r]]
        rng.shuffle(letters)
        # ы never starts a word, so it has no real capital -- lowercase only.
        items = [(ch.upper() if ch != "ы" and rng.random() < 0.5 else ch) + ","
                 for ch in [starters[r]] + letters]
        chain_row(ink, c, items, baseline, inset)


def p5(ink, c, inset, half, warnings, n):
    # Same as page 4, one step closer to real writing: short words (3-5
    # letters) each followed by a comma, natural spacing, first word solid,
    # the rest half-tone dashed.
    import random
    rng = random.Random(5)
    starters = SHORT_WORDS[:]
    rng.shuffle(starters)   # a different solid model opens every row
    for r, baseline in enumerate(BASELINES):
        words = [w for w in SHORT_WORDS if w != starters[r]]
        rng.shuffle(words)
        chain_row(ink, c, [w + "," for w in [starters[r]] + words], baseline, inset)


def p20(ink, c, inset, half, warnings, n):
    # Comma + ? / ! in one sentence. Top: tracing (faded), middle: fainter
    # tracing, bottom: one full model with an empty row under it.
    a = ["Где хлеб, сыр и сок?", "Смотри, какой дом!", "Кот, ты где?", "Папа, иди сюда!"]
    b = ["Оля, ты дома?", "Стой, тут лужа!", "Мама, кто там?", "Ура, снег идёт!"]
    rows = ([(s, 0.5) for s in a] + [(s, 0.28) for s in a]
            + [x for s in b for x in ((s, 1.0), None)] + [None])
    text_page(ink, c, rows, inset, warnings, n)


CONTENT = {1: p1, 2: p2, 3: p3, 4: p4, 5: p5, 20: p20}
