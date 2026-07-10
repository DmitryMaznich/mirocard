from formatting import PIN_EMOJI, format_author, has_pin_reaction


def test_format_author_with_username():
    assert format_author('Иван Тестов', 'ivan_test') == 'Иван Тестов (@ivan_test)'


def test_format_author_without_username():
    assert format_author('Иван Тестов', None) == 'Иван Тестов'


def test_has_pin_reaction_true_when_present():
    assert has_pin_reaction({PIN_EMOJI, '👍'}) is True


def test_has_pin_reaction_false_when_absent():
    assert has_pin_reaction({'👍', '❤️'}) is False


def test_has_pin_reaction_false_when_empty():
    assert has_pin_reaction(set()) is False
