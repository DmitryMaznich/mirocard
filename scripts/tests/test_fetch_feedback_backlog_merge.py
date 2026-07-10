import importlib.util
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parent.parent / 'fetch-feedback-backlog.py'


def _load_module():
    spec = importlib.util.spec_from_file_location('fetch_feedback_backlog', MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_merge_backlog_adds_missing_remote_entries():
    mod = _load_module()
    remote = [
        {'id': 'a', 'captured_at': '2026-07-01T00:00:00'},
        {'id': 'b', 'captured_at': '2026-07-02T00:00:00'},
    ]
    local = [{'id': 'a', 'captured_at': '2026-07-01T00:00:00', 'status': 'done'}]

    merged, added = mod.merge_backlog(remote, local)

    assert [e['id'] for e in added] == ['b']
    assert len(merged) == 2
    assert next(e for e in merged if e['id'] == 'a')['status'] == 'done'


def test_merge_backlog_no_duplicates_on_rerun():
    mod = _load_module()
    entries = [{'id': 'a', 'captured_at': '2026-07-01T00:00:00'}]

    merged, added = mod.merge_backlog(entries, entries)

    assert added == []
    assert len(merged) == 1


def test_parse_jsonl_skips_blank_lines():
    mod = _load_module()
    text = '{"id": "a"}\n\n{"id": "b"}\n'

    result = mod.parse_jsonl(text)

    assert [e['id'] for e in result] == ['a', 'b']
