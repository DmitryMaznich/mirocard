from booklet import _imposition_order


def test_single_sheet_four_pages():
    # 1-indexed: sheet holds (page4,page1) on front, (page2,page3) on back.
    # 0-indexed here: (3,0) front, (1,2) back.
    assert _imposition_order(4) == [((3, 0), (1, 2))]


def test_two_sheets_eight_pages_nest_correctly():
    assert _imposition_order(8) == [
        ((7, 0), (1, 6)),  # outer sheet
        ((5, 2), (3, 4)),  # inner sheet
    ]


def test_every_page_index_appears_exactly_once():
    n = 16
    seen = []
    for front, back in _imposition_order(n):
        seen.extend([front[0], front[1], back[0], back[1]])
    assert sorted(seen) == list(range(n))
