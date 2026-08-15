"""Graphomotor-complexity letter groups for propis worksheets (Phase 1).

Confirmed with the user 2026-08-14 -- see
docs/superpowers/specs/2026-08-14-propis-letter-worksheets-design.md.
Grouped by shared graphic construction element (school "Пропись"
methodology), not alphabetical order, not sound-articulation order.

Every lowercase letter pairs with its own uppercase counterpart, EXCEPT
Ъ/Ь (paired with None) -- both technically have capital forms but neither
practically appears capitalized in real Russian text, so they only get a
lowercase practice page (see page.py's handling of upper=None).
"""

GROUPS = [
    {
        "id": 1,
        "label": "Крючок",
        "letters": [("и", "И"), ("л", "Л"), ("м", "М"), ("ш", "Ш")],
    },
    {
        "id": 2,
        "label": "Крючок + доп. штрих",
        "letters": [("п", "П"), ("т", "Т"), ("ц", "Ц"), ("щ", "Щ")],
    },
    {
        "id": 3,
        "label": "Овал",
        "letters": [("а", "А"), ("е", "Е"), ("ё", "Ё"), ("о", "О"), ("с", "С"), ("э", "Э")],
    },
    {
        "id": 4,
        "label": "Петля",
        "letters": [("б", "Б"), ("в", "В"), ("д", "Д"), ("з", "З"), ("у", "У"), ("ф", "Ф")],
    },
    {
        "id": 5,
        "label": "Составные формы",
        "letters": [
            ("г", "Г"), ("ж", "Ж"), ("к", "К"), ("н", "Н"),
            ("х", "Х"), ("ч", "Ч"), ("ю", "Ю"), ("я", "Я"),
        ],
    },
    {
        "id": 6,
        "label": "Особые формы",
        "letters": [("й", "Й"), ("р", "Р"), ("ъ", None), ("ы", "Ы"), ("ь", None)],
    },
]
