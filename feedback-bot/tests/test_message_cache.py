from datetime import datetime, timedelta, timezone

from message_cache import MessageCache


def test_remember_and_get_roundtrip(tmp_path):
    cache = MessageCache(str(tmp_path / 'cache.json'))
    cache.remember(
        -100123, 456,
        author='Иван Тестов (@ivan_test)',
        text='Кнопка не работает',
        photo_file_id=None,
        message_date='2026-07-10T12:00:00+00:00',
    )
    entry = cache.get(-100123, 456)
    assert entry is not None
    assert entry['author'] == 'Иван Тестов (@ivan_test)'
    assert entry['text'] == 'Кнопка не работает'
    assert entry['photo_file_id'] is None


def test_get_missing_returns_none(tmp_path):
    cache = MessageCache(str(tmp_path / 'cache.json'))
    assert cache.get(-100123, 999) is None


def test_persists_across_reload(tmp_path):
    path = str(tmp_path / 'cache.json')
    cache = MessageCache(path)
    cache.remember(
        -100123, 456,
        author='Иван', text='Баг', photo_file_id='file123',
        message_date='2026-07-10T12:00:00+00:00',
    )
    reloaded = MessageCache(path)
    entry = reloaded.get(-100123, 456)
    assert entry is not None
    assert entry['photo_file_id'] == 'file123'


def test_prune_removes_old_entries_keeps_recent(tmp_path):
    cache = MessageCache(str(tmp_path / 'cache.json'), retention_days=30)
    now = datetime.now(timezone.utc)

    cache.remember(-100123, 1, author='A', text='old', photo_file_id=None, message_date=now.isoformat())
    cache._data[cache._key(-100123, 1)]['cached_at'] = (now - timedelta(days=40)).isoformat()
    cache._save()

    cache.remember(-100123, 2, author='B', text='recent', photo_file_id=None, message_date=now.isoformat())

    removed = cache.prune(now=now)
    assert removed == 1
    assert cache.get(-100123, 1) is None
    assert cache.get(-100123, 2) is not None
