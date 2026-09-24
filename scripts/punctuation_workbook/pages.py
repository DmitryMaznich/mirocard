"""Content of each workbook page. One function per page, named pN.

Every page follows the same top-to-bottom ladder: clear gray tracing ->
lighter tracing -> partial model -> one black model + empty ruled space ->
nothing but the ruling.
"""

from layout import BLACK, T1, T2, T3, text_row, marks_row


def p2(pg):
    pg.title("Запятая", "форма знака")
    pg.figure([(",", "маленький знак на строке + короткий хвостик вниз")])

    pg.note("Обведи запятые. Хвостик — короткий, чуть влево.")
    pg.row(marks_row(",,,,,,,", T1, 16.0))
    pg.row(marks_row(",,,,,,,", T2, 16.0))
    pg.row(marks_row(",,,,,,,", T3, 16.0))

    pg.note("Допиши хвостики.")
    pg.row(marks_row(",,,,,,,", T2, 16.0, parts={"head"}))
    pg.row(marks_row(",,,,,,,", T3, 16.0, parts={"head"}))

    pg.note("Смотри на образец и пиши рядом.")
    pg.row(marks_row(",", BLACK, 16.0))
    pg.row(marks_row(",", BLACK, 16.0))
    pg.row(marks_row(",", BLACK, 16.0))

    pg.note("Напиши по 6 запятых в каждой строке сам.")
    pg.rows(2)


def p3(pg):
    pg.title("Точка и запятая", "похожие знаки")
    pg.figure([(".", "точка остаётся на строке"), (",", "запятая идёт вниз")])

    pg.note("Обведи.")
    pg.row(marks_row(".,.,.,.,", T1, 14.0))
    pg.row(marks_row(".,,.,..,", T2, 14.0))

    pg.note("Спиши. Смотри, где точка, а где запятая.")
    pg.row(marks_row(".,,.", BLACK, 7.0))
    pg.row(marks_row(",.,.", BLACK, 7.0))
    pg.row(marks_row("..,,", BLACK, 7.0))
    pg.row(marks_row(",..,", BLACK, 7.0))

    pg.note("Напиши сам, как сказано.")
    pg.prompt_row("точка, запятая, запятая, точка")
    pg.prompt_row("запятая, точка, запятая, точка")
    pg.prompt_row("точка, точка, запятая")
    pg.prompt_row("запятая, запятая, точка, запятая")
    pg.prompt_row("точка, запятая, точка, запятая, точка")


def p20(pg):
    pg.title("Запятая, вопрос, восклицание", "в одной строке")

    pg.note("Обведи.")
    pg.row(text_row("Ты взял хлеб, сыр и сок?", T1))
    pg.row(text_row("Смотри, какой дом!", T1))

    pg.note("Обведи слова. Знаки обведи тщательно.")
    pg.row(text_row("Кот, ты где?", T2, T1))
    pg.row(text_row("Папа, иди сюда!", T2, T1))

    pg.note("Обведи слова и поставь знаки сам.")
    pg.row(text_row("Ты купил сыр, чай и сок?", T3, mark_mode="slot"))
    pg.row(text_row("Ура, мы идём гулять!", T3, mark_mode="slot"))

    pg.note("Спиши предложение в строку ниже.")
    pg.row(text_row("Оля, ты дома?", BLACK))
    pg.row()
    pg.row(text_row("Стой, тут лужа!", BLACK))
    pg.row()
    pg.row(text_row("Мама, кто там?", BLACK))
    pg.row()


PAGES = {2: p2, 3: p3, 20: p20}
