import json
import os
import tempfile
from datetime import datetime, timedelta, timezone
from typing import Optional


class MessageCache:
    def __init__(self, path: str, retention_days: int = 30):
        self.path = path
        self.retention_days = retention_days
        self._data = self._load()

    def _load(self) -> dict:
        if not os.path.exists(self.path):
            return {}
        with open(self.path, 'r', encoding='utf-8') as f:
            raw = f.read().strip()
        return json.loads(raw) if raw else {}

    def _save(self) -> None:
        directory = os.path.dirname(self.path) or '.'
        os.makedirs(directory, exist_ok=True)
        fd, tmp_path = tempfile.mkstemp(dir=directory, prefix='.cache_', suffix='.tmp')
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                json.dump(self._data, f, ensure_ascii=False, indent=2)
            os.replace(tmp_path, self.path)
        except Exception:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            raise

    @staticmethod
    def _key(chat_id: int, message_id: int) -> str:
        return f'{chat_id}_{message_id}'

    def remember(self, chat_id: int, message_id: int, *, author: str, text: str,
                 photo_file_id: Optional[str], message_date: str) -> None:
        self._data[self._key(chat_id, message_id)] = {
            'chat_id': chat_id,
            'message_id': message_id,
            'author': author,
            'text': text,
            'photo_file_id': photo_file_id,
            'message_date': message_date,
            'cached_at': datetime.now(timezone.utc).isoformat(),
        }
        self._save()

    def get(self, chat_id: int, message_id: int) -> Optional[dict]:
        return self._data.get(self._key(chat_id, message_id))

    def prune(self, now: Optional[datetime] = None) -> int:
        now = now or datetime.now(timezone.utc)
        cutoff = now - timedelta(days=self.retention_days)
        stale = [
            key for key, value in self._data.items()
            if datetime.fromisoformat(value['cached_at']) < cutoff
        ]
        for key in stale:
            del self._data[key]
        if stale:
            self._save()
        return len(stale)
