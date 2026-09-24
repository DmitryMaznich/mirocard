"""Page plan for the 24-page punctuation workbook.

KIND decides each page's diagonal grid: "dense" (3mm) for pages drilling
marks in isolation, "standard" (20mm) for pages with words/sentences.
CONTENT holds the pages built so far; any other page is printed as bare
ruling of its KIND.
"""

from content import ladder_page, chain_row, word_row, practice_page, text_page, mark_row, title_row, ROWS, BASELINES

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
    # letters (random order and case, no ь/ъ), each followed by a comma,
    # all half-tone dashed to trace, filled to the margin. Fixed seed -> the same page on every build.
    import random
    rng = random.Random(4)
    starters = LETTERS[:]
    rng.shuffle(starters)   # a different item opens every row
    for r, baseline in enumerate(BASELINES):
        letters = [ch for ch in LETTERS if ch != starters[r]]
        rng.shuffle(letters)
        # ы never starts a word, so it has no real capital -- lowercase only.
        items = [(ch.upper() if ch != "ы" and rng.random() < 0.5 else ch) + ","
                 for ch in [starters[r]] + letters]
        chain_row(ink, c, items, baseline, inset)


def p5(ink, c, inset, half, warnings, n):
    # Same as page 4, one step closer to real writing: short words (3-5
    # letters) each followed by a comma, natural spacing, all half-tone
    # dashed.
    import random
    rng = random.Random(5)
    starters = SHORT_WORDS[:]
    rng.shuffle(starters)   # a different item opens every row
    for r, baseline in enumerate(BASELINES):
        words = [w for w in SHORT_WORDS if w != starters[r]]
        rng.shuffle(words)
        chain_row(ink, c, [w + "," for w in [starters[r]] + words], baseline, inset)


def letters_row(seed):
    """Random letters, random case, each with a comma -- the page-4 row,
    reused to fill a copy page's leftover last row."""
    import random
    rng = random.Random(seed)
    letters = LETTERS[:]
    rng.shuffle(letters)
    return [(ch.upper() if ch != "ы" and rng.random() < 0.5 else ch) + "," for ch in letters]


def copy_page(ink, c, inset, models, warnings, n):
    """Pages 6-9 (user, 2026-09-24): 8 solid model lines, each with an empty
    row under it to copy into; the 17th row gets page-4 style letters."""
    ladder_page(ink, c, inset, [], models, warnings, n, last_row=letters_row(n))


def p6(ink, c, inset, half, warnings, n):
    # Lists of four (three looked sparse on the row -- user, 2026-09-24).
    copy_page(ink, c, inset, ["хлеб, сыр, сок, чай", "кот, пёс, мышь, ёж",
                              "мама, папа, я, Оля", "рыба, рак, кит, сом",
                              "шар, мяч, кукла, юла", "дом, сад, лес, луг",
                              "суп, каша, чай, торт", "зима, весна, лето, осень"], warnings, n)


def p7(ink, c, inset, half, warnings, n):
    # A list inside a sentence (sentences kept to one row, <= ~113mm).
    copy_page(ink, c, inset, ["Я взял хлеб, сыр и сок.", "Тут кот, пёс и ёж.",
                              "Вот лук, мак и мёд.", "Там лес, луг и сад.",
                              "Я ем суп, кашу и сыр.", "Там рыба, рак и кит.",
                              "Я вижу дом, сад и лес.", "У Оли мяч, шар и кот."], warnings, n)


def p8(ink, c, inset, half, warnings, n):
    # Comma, consolidation: new rhythms on the dense grid -- every 3 cells,
    # comma/dot alternating tightly, then 3-mark groups mixing the two.
    groups = [(g, {"inner_step": 2, "group_step": 4}) for g in (",,.", ".,,", ",.,", ",,,")]
    rhythm_page(ink, c, inset, half, "Запятая и точка", [
        (",", {"group_step": 3}),
        (",.", {"inner_step": 2, "group_step": 2}),
        groups,
        [(g, kw, 2) for g, kw in groups],
    ])


def p9(ink, c, inset, half, warnings, n):
    # Exclamation mark as it's really written (user, 2026-09-24): single !,
    # then !! and !!! with no gaps -- each ! on the neighbouring diagonal
    # (inner step 1 cell), groups 4 cells apart. The dot sits on the
    # diagonal/baseline crossing and the stem runs along the diagonal.
    single = ("!", {"group_step": 4})
    double = ("!!", {"inner_step": 1, "group_step": 4})
    triple = ("!!!", {"inner_step": 1, "group_step": 4})
    rhythm_page(ink, c, inset, half, "Восклицательный знак", [
        single, double, [triple],
        [(*single, 2), (*double, 2), (*triple, 2)],
    ])


def p10(ink, c, inset, half, warnings, n):
    # Dot vs exclamation mark, with a comma mixed in to break the monotony
    # (user, 2026-09-24): the three alternating every 4 cells, every 2
    # cells, then 3-mark groups in different orders, then templates.
    # "Точка и восклицательный знак" is 145mm -- too wide for the title row,
    # so the mark itself stands in for its name.
    groups = [(g, {"inner_step": 2, "group_step": 4}) for g in (".!,", "!,.", ",.!", "!.,")]
    rhythm_page(ink, c, inset, half, "Точка и !", [
        (".!,", {"inner_step": 4, "group_step": 4}),
        (".!,", {"inner_step": 2, "group_step": 2}),
        groups,
        [(g, kw, 2) for g, kw in groups],
    ])


EXCLAMATIONS = ["Да!", "Нет!", "Стой!", "Ура!", "Смотри!", "Ой!", "Ах!", "Беги!", "Иди!",
                "Мама!", "Папа!", "Сюда!", "Тише!", "Вперёд!", "Браво!", "Эх!", "Лови!",
                "Держи!", "Верно!", "Привет!"]


def p11(ink, c, inset, half, warnings, n):
    # "!" after a word, as page 5 does for the comma: exclamations at natural
    # spacing, all half-tone dashed, a different one opening every row.
    import random
    rng = random.Random(11)
    starters = EXCLAMATIONS[:]
    rng.shuffle(starters)
    for r, baseline in enumerate(BASELINES):
        first = starters[r % len(starters)]
        rest = [w for w in EXCLAMATIONS if w != first]
        rng.shuffle(rest)
        chain_row(ink, c, [first] + rest, baseline, inset)


def p12(ink, c, inset, half, warnings, n):
    # Sentences with "!" -- same copy layout as pages 6-7 (model + empty
    # row, letters with commas on the last row). Longer ones picked so the
    # rows aren't half empty.
    copy_page(ink, c, inset, ["Какой большой кот!", "Какой чудесный день!",
                              "Какой добрый пёс!", "Тише, тут спят!", "Стой, тут лужа!",
                              "Мама, иди сюда!", "Смотри, радуга!", "Папа, лови мяч!"], warnings, n)


def p13(ink, c, inset, half, warnings, n):
    # Question mark: single ?, then ?? and ?! -- inside a group the marks
    # sit one diagonal apart (6mm), not on neighbouring ones: the ?'s hook
    # is ~3.3mm wide, wider than a 3mm cell, and ?? on adjacent diagonals
    # merged into one squiggle (user agreed 2026-09-24). ??? was dropped as
    # rare; ?! is common in real texts.
    single = ("?", {"group_step": 4})
    double = ("??", {"inner_step": 2, "group_step": 4})
    qexcl = ("?!", {"inner_step": 2, "group_step": 4})
    rhythm_page(ink, c, inset, half, "Вопросительный знак", [
        single, double, [qexcl],
        [(*single, 2), (*double, 2), (*qexcl, 2)],
    ])


def p14(ink, c, inset, half, warnings, n):
    # ? and ! together, like page 10 for dot and !: alternating every 4 and
    # every 2 cells (never adjacent diagonals -- the ?'s hook is wider than a
    # cell), then 3-mark groups mixing in . and ,, then templates.
    groups = [(g, {"inner_step": 2, "group_step": 4}) for g in ("?!.", "!?,", ".?!", ",!?")]
    rhythm_page(ink, c, inset, half, "? и !", [
        ("?!", {"inner_step": 4, "group_step": 4}),
        ("?!", {"inner_step": 3, "group_step": 3}),   # 2 cells read as one squiggle
        groups,
        [(g, kw, 2) for g, kw in groups],
    ])


QUESTIONS = ["Кто?", "Где?", "Что?", "Как?", "Когда?", "Куда?", "Зачем?", "Почему?",
             "Откуда?", "Чей?", "Сколько?", "Да?", "Нет?", "Ты?", "Правда?", "Можно?",
             "Опять?", "Кому?", "Какой?", "Уже?"]


def p15(ink, c, inset, half, warnings, n):
    # "?" after a word, as page 11 does for "!": all half-tone dashed, a
    # different word opening every row.
    import random
    rng = random.Random(15)
    starters = QUESTIONS[:]
    rng.shuffle(starters)
    for r, baseline in enumerate(BASELINES):
        first = starters[r % len(starters)]
        rest = [w for w in QUESTIONS if w != first]
        rng.shuffle(rest)
        chain_row(ink, c, [first] + rest, baseline, inset)


def p16(ink, c, inset, half, warnings, n):
    # Short questions -- copy layout (model + empty row, letters with
    # commas on the last row); the longer ones, so rows aren't half empty.
    copy_page(ink, c, inset, ["Кто там стучит?", "Где лежит книга?", "Почему небо синее?",
                              "Когда будет обед?", "Ты любишь кашу?", "Куда идёт папа?",
                              "Что ты рисуешь?", "Кто съел торт?"], warnings, n)


def p17(ink, c, inset, half, warnings, n):
    # One sentence, different ending: . ? ! side by side. Full triples only
    # fit for one-word sentences; longer ones come as pairs.
    copy_page(ink, c, inset, ["Да. Да? Да!", "Нет. Нет? Нет!", "Кот. Кот? Кот!",
                              "Иди. Иди? Иди!", "Это кот. Это кот?", "Он спит. Он спит!",
                              "Мы тут. Мы тут?", "Снег идёт. Снег идёт!"], warnings, n)


def p20(ink, c, inset, half, warnings, n):
    # Comma + ? / ! in one sentence. Top: tracing (faded), middle: fainter
    # tracing, bottom: one full model with an empty row under it.
    a = ["Где хлеб, сыр и сок?", "Смотри, какой дом!", "Кот, ты где?", "Папа, иди сюда!"]
    b = ["Оля, ты дома?", "Стой, тут лужа!", "Мама, кто там?", "Ура, снег идёт!"]
    rows = ([(s, 0.5) for s in a] + [(s, 0.28) for s in a]
            + [x for s in b for x in ((s, 1.0), None)] + [None])
    text_page(ink, c, rows, inset, warnings, n)


CONTENT = {1: p1, 2: p2, 3: p3, 4: p4, 5: p5, 6: p6, 7: p7, 8: p8, 9: p9, 10: p10, 11: p11, 12: p12, 13: p13, 14: p14, 15: p15, 16: p16, 17: p17, 20: p20}
