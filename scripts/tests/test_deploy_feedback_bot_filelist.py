import importlib.util
from pathlib import Path

import pytest

MODULE_PATH = Path(__file__).resolve().parent.parent / 'deploy-feedback-bot.py'


def _load_module():
    spec = importlib.util.spec_from_file_location('deploy_feedback_bot', MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_build_upload_file_list_pairs_local_and_remote_paths(tmp_path):
    mod = _load_module()
    (tmp_path / 'a.py').write_text('# a', encoding='utf-8')
    (tmp_path / 'b.py').write_text('# b', encoding='utf-8')

    pairs = mod.build_upload_file_list(tmp_path, ['a.py', 'b.py'])

    assert pairs == [
        (str(tmp_path / 'a.py'), f'{mod.REMOTE_BOT_ROOT}/a.py'),
        (str(tmp_path / 'b.py'), f'{mod.REMOTE_BOT_ROOT}/b.py'),
    ]


def test_build_upload_file_list_raises_on_missing_file(tmp_path):
    mod = _load_module()
    (tmp_path / 'a.py').write_text('# a', encoding='utf-8')

    with pytest.raises(FileNotFoundError):
        mod.build_upload_file_list(tmp_path, ['a.py', 'missing.py'])
