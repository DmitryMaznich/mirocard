import json
import os
from datetime import datetime, timezone
from typing import Optional


def public_chat_id(chat_id: int) -> str:
    """Strips Telegram's -100 supergroup prefix, for building t.me/c/ links."""
    text = str(chat_id)
    if text.startswith('-100'):
        return text[4:]
    return text.lstrip('-')


def build_entry(chat_id: int, message_id: int, cached: dict, photo_relpath: Optional[str],
                 voice_relpath: Optional[str] = None, source: str = 'group') -> dict:
    """`source='group'` builds a t.me/c/ deep link; `source='dm'` (a private
    chat with the bot) has no such link, so `telegram_link` is None."""
    telegram_link = (
        f'https://t.me/c/{public_chat_id(chat_id)}/{message_id}' if source == 'group' else None
    )
    return {
        'id': f'{chat_id}_{message_id}',
        'captured_at': datetime.now(timezone.utc).isoformat(),
        'message_date': cached['message_date'],
        'author': cached['author'],
        'text': cached['text'],
        'photo': photo_relpath,
        'voice': voice_relpath,
        'telegram_link': telegram_link,
        'status': 'new',
    }


def append_entry(inbox_path: str, entry: dict) -> None:
    directory = os.path.dirname(inbox_path) or '.'
    os.makedirs(directory, exist_ok=True)
    with open(inbox_path, 'a', encoding='utf-8') as f:
        f.write(json.dumps(entry, ensure_ascii=False) + '\n')
