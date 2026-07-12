import json

from backlog import append_entry, build_entry, public_chat_id


def test_public_chat_id_strips_supergroup_prefix():
    assert public_chat_id(-1001234567890) == '1234567890'


def test_public_chat_id_handles_plain_negative_id():
    assert public_chat_id(-987654321) == '987654321'


def test_build_entry_shapes_expected_fields():
    cached = {
        'author': 'Иван Тестов (@ivan_test)',
        'text': 'Кнопка Назад пропадает',
        'message_date': '2026-07-10T14:20:11+00:00',
    }
    entry = build_entry(-1001234567890, 456, cached, 'screenshots/-1001234567890_456.jpg')

    assert entry['id'] == '-1001234567890_456'
    assert entry['author'] == 'Иван Тестов (@ivan_test)'
    assert entry['text'] == 'Кнопка Назад пропадает'
    assert entry['message_date'] == '2026-07-10T14:20:11+00:00'
    assert entry['photo'] == 'screenshots/-1001234567890_456.jpg'
    assert entry['telegram_link'] == 'https://t.me/c/1234567890/456'
    assert entry['status'] == 'new'
    assert 'captured_at' in entry


def test_build_entry_without_photo():
    cached = {'author': 'A', 'text': 'B', 'message_date': '2026-07-10T14:20:11+00:00'}
    entry = build_entry(-1001234567890, 1, cached, None)
    assert entry['photo'] is None
    assert entry['voice'] is None


def test_build_entry_with_voice():
    cached = {'author': 'A', 'text': '', 'message_date': '2026-07-10T14:20:11+00:00'}
    entry = build_entry(-1001234567890, 2, cached, None, 'voice/-1001234567890_2.ogg')
    assert entry['voice'] == 'voice/-1001234567890_2.ogg'
    assert entry['photo'] is None


def test_build_entry_dm_source_has_no_telegram_link():
    cached = {'author': 'A', 'text': 'идея для приложения', 'message_date': '2026-07-10T14:20:11+00:00'}
    entry = build_entry(468130718, 5, cached, None, source='dm')
    assert entry['telegram_link'] is None


def test_build_entry_group_source_still_defaults_to_link():
    cached = {'author': 'A', 'text': 'B', 'message_date': '2026-07-10T14:20:11+00:00'}
    entry = build_entry(-1001234567890, 7, cached, None)
    assert entry['telegram_link'] == 'https://t.me/c/1234567890/7'


def test_append_entry_writes_jsonl_line(tmp_path):
    inbox_path = str(tmp_path / 'inbox.jsonl')
    append_entry(inbox_path, {'id': 'a'})
    lines = (tmp_path / 'inbox.jsonl').read_text(encoding='utf-8').splitlines()
    assert len(lines) == 1
    assert json.loads(lines[0]) == {'id': 'a'}


def test_append_entry_appends_multiple_lines_without_clobbering(tmp_path):
    inbox_path = str(tmp_path / 'inbox.jsonl')
    append_entry(inbox_path, {'id': 'a'})
    append_entry(inbox_path, {'id': 'b'})
    lines = (tmp_path / 'inbox.jsonl').read_text(encoding='utf-8').splitlines()
    assert [json.loads(line)['id'] for line in lines] == ['a', 'b']
