# Telegram Feedback Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Telegram bot that silently watches the Mirocard2 testers group, captures any message the owner pins with a 📌 reaction into a local backlog file, and provide a script to sync that backlog to the local dev machine for triage in Claude Code.

**Architecture:** A small Python service (`feedback-bot/`) using `python-telegram-bot`, deployed to the Mirocard2 runtime host (`192.168.1.163`) as its own Windows Scheduled Task, fully independent from `MirocardBackend2` and from the unrelated `kaplieva_bot.py` process. It keeps a persistent on-disk cache of recent group messages (so a 📌 reaction still resolves after a bot restart) and appends matched messages to `feedback/inbox.jsonl` + `feedback/screenshots/`. A separate local script (`scripts/fetch-feedback-backlog.py`) pulls new entries over SSH, merging by id without touching locally-edited entries.

**Tech Stack:** Python 3 (`python-telegram-bot>=20.8,<22`, `paramiko` for the fetch/deploy scripts — already installed locally), `pytest` for unit tests.

## Global Constraints

- Bot reacts to 📌 reactions **only from the configured `FEEDBACK_BOT_OWNER_ID`** — reactions from any other user are ignored (spec: only the owner marks feedback).
- Bot only processes messages/reactions from the configured `FEEDBACK_BOT_CHAT_ID` — ignores any other chat it might be added to.
- Bot never posts messages into the group; the only visible action is a ✅ or ⚠️ reaction on the original message.
- `feedback/` (backlog + screenshots) is working data, not source — must be gitignored, never committed.
- Sync from runtime host to local machine is one-directional; `scripts/fetch-feedback-backlog.py` must never overwrite a local entry that already exists (in particular, must preserve a locally-edited `status` field).
- The bot runs on the Mirocard2 **runtime host** (`192.168.1.163`), never on Synology — Synology is backup storage only (per `CLAUDE.md`).
- The bot is a new, independent Telegram bot/token — it must not reuse the `Kaplieva_bot` process or token.
- Secrets (`FEEDBACK_BOT_TOKEN`, SSH deploy credentials) live only in `.env` files outside git, following the existing `MIROCARD_DEPLOY_*` / `feedback-bot/.env` conventions.

---

## File Structure

```
feedback-bot/
  requirements.txt          # python-telegram-bot pin
  .env.example              # documents required env vars (no real secrets)
  env_helpers.py            # .env loader (copied pattern from Kaplieva project)
  formatting.py             # pure helpers: format_author(), has_pin_reaction()
  message_cache.py          # persistent cache of recent group messages
  backlog.py                # builds + appends feedback/inbox.jsonl entries
  mirocard_feedback_bot.py  # entrypoint: wires python-telegram-bot handlers
  tests/
    conftest.py
    test_formatting.py
    test_message_cache.py
    test_backlog.py

scripts/
  fetch-feedback-backlog.py   # SSH-pulls new backlog entries + screenshots
  deploy-feedback-bot.py      # SFTP-uploads feedback-bot/*.py, restarts the task
  install-feedback-bot-task.ps1  # one-time: registers the Scheduled Task (run on host)
  tests/
    conftest.py
    test_fetch_feedback_backlog_merge.py
    test_deploy_feedback_bot_filelist.py

docs/
  feedback-bot-setup.md     # manual runbook: BotFather, .env, first deploy, task, live test

.gitignore                  # add `feedback/`
```

---

### Task 1: Scaffold `feedback-bot/` package

**Files:**
- Create: `feedback-bot/requirements.txt`
- Create: `feedback-bot/.env.example`
- Create: `feedback-bot/env_helpers.py`
- Test: none (no logic yet — verified by Task 2 importing this module)

**Interfaces:**
- Produces: `get_env(name, default=None, required=False)`, `get_int_env(name, default=None, required=False) -> int`, `get_bytes_env(name, default=None, required=False) -> bytes` — used by every other `feedback-bot/*.py` module.

- [ ] **Step 1: Create `feedback-bot/requirements.txt`**

```text
python-telegram-bot>=20.8,<22
```

- [ ] **Step 2: Create `feedback-bot/.env.example`**

```text
# Token from @BotFather for the dedicated Mirocard feedback bot (NOT Kaplieva_bot).
FEEDBACK_BOT_TOKEN=123456789:AAExampleTokenReplaceMe

# Telegram user id of the owner — only this user's pin reactions are captured.
FEEDBACK_BOT_OWNER_ID=468130718

# Telegram chat id of the testers group (negative number, e.g. -1001234567890).
FEEDBACK_BOT_CHAT_ID=-1001234567890

# Days to keep cached messages so a reaction can still resolve after a restart.
FEEDBACK_BOT_CACHE_RETENTION_DAYS=30

# Where inbox.jsonl, screenshots/, and message_cache.json are written.
FEEDBACK_BOT_DATA_DIR=C:/Users/dmazn/Projects/Mirocard2/feedback
```

- [ ] **Step 3: Create `feedback-bot/env_helpers.py`**

```python
import os
from pathlib import Path
from typing import Optional


_LOADED = False


def load_dotenv() -> None:
    global _LOADED
    if _LOADED:
        return

    here = Path(__file__).resolve().parent
    env_path = here / '.env'
    if env_path.exists():
        for line in env_path.read_text(encoding='utf-8').splitlines():
            raw = line.strip()
            if not raw or raw.startswith('#') or '=' not in raw:
                continue
            key, value = raw.split('=', 1)
            key = key.strip()
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
                value = value[1:-1]
            value = value.replace('\\n', '\n').replace('\\r', '\r')
            os.environ.setdefault(key, value)

    _LOADED = True


def get_env(name: str, default: Optional[str] = None, required: bool = False) -> Optional[str]:
    load_dotenv()
    value = os.getenv(name, default)
    if required and (value is None or value == ''):
        raise RuntimeError(f'Missing required environment variable: {name}')
    return value


def get_int_env(name: str, default: Optional[int] = None, required: bool = False) -> Optional[int]:
    value = get_env(name, default=None if default is None else str(default), required=required)
    return int(value) if value is not None and value != '' else value
```

- [ ] **Step 4: Install dependencies locally for development**

Run: `pip install -r feedback-bot/requirements.txt pytest`
Expected: installs succeed (paramiko and pytest are already present on this machine; python-telegram-bot gets installed fresh).

- [ ] **Step 5: Commit**

```bash
git add feedback-bot/requirements.txt feedback-bot/.env.example feedback-bot/env_helpers.py
git commit -m "feat: scaffold feedback-bot package with env loader"
```

---

### Task 2: `formatting.py` — pure helpers (TDD)

**Files:**
- Create: `feedback-bot/formatting.py`
- Create: `feedback-bot/tests/conftest.py`
- Test: `feedback-bot/tests/test_formatting.py`

**Interfaces:**
- Consumes: nothing (pure functions, no I/O).
- Produces: `format_author(full_name: str, username: Optional[str]) -> str`, `has_pin_reaction(emojis) -> bool`, `PIN_EMOJI: str` — used by `mirocard_feedback_bot.py` (Task 5).

- [ ] **Step 1: Create `feedback-bot/tests/conftest.py`**

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
```

- [ ] **Step 2: Write the failing test — `feedback-bot/tests/test_formatting.py`**

```python
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `python -m pytest feedback-bot/tests/test_formatting.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'formatting'`

- [ ] **Step 4: Create `feedback-bot/formatting.py`**

```python
from typing import Iterable, Optional

PIN_EMOJI = '📌'


def format_author(full_name: str, username: Optional[str]) -> str:
    if username:
        return f'{full_name} (@{username})'
    return full_name


def has_pin_reaction(emojis: Iterable[str]) -> bool:
    return PIN_EMOJI in set(emojis)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest feedback-bot/tests/test_formatting.py -v`
Expected: 5 passed

- [ ] **Step 6: Commit**

```bash
git add feedback-bot/formatting.py feedback-bot/tests/conftest.py feedback-bot/tests/test_formatting.py
git commit -m "feat: add feedback-bot formatting helpers with tests"
```

---

### Task 3: `message_cache.py` — persistent message cache (TDD)

**Files:**
- Create: `feedback-bot/message_cache.py`
- Test: `feedback-bot/tests/test_message_cache.py`

**Interfaces:**
- Consumes: nothing external.
- Produces: `class MessageCache(path: str, retention_days: int = 30)` with methods `remember(chat_id, message_id, *, author, text, photo_file_id, message_date) -> None`, `get(chat_id, message_id) -> Optional[dict]`, `prune(now: Optional[datetime] = None) -> int` — used by `mirocard_feedback_bot.py` (Task 5).

- [ ] **Step 1: Write the failing test — `feedback-bot/tests/test_message_cache.py`**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest feedback-bot/tests/test_message_cache.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'message_cache'`

- [ ] **Step 3: Create `feedback-bot/message_cache.py`**

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest feedback-bot/tests/test_message_cache.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add feedback-bot/message_cache.py feedback-bot/tests/test_message_cache.py
git commit -m "feat: add persistent message cache for feedback bot"
```

---

### Task 4: `backlog.py` — build and append backlog entries (TDD)

**Files:**
- Create: `feedback-bot/backlog.py`
- Test: `feedback-bot/tests/test_backlog.py`

**Interfaces:**
- Consumes: a `cached` dict shaped like `message_cache.MessageCache.get()`'s return value (`author`, `text`, `message_date` keys).
- Produces: `public_chat_id(chat_id: int) -> str`, `build_entry(chat_id: int, message_id: int, cached: dict, photo_relpath: Optional[str]) -> dict`, `append_entry(inbox_path: str, entry: dict) -> None` — used by `mirocard_feedback_bot.py` (Task 5) and read back by `scripts/fetch-feedback-backlog.py` (Task 6, as plain JSONL — no direct import).

- [ ] **Step 1: Write the failing test — `feedback-bot/tests/test_backlog.py`**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest feedback-bot/tests/test_backlog.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'backlog'`

- [ ] **Step 3: Create `feedback-bot/backlog.py`**

```python
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


def build_entry(chat_id: int, message_id: int, cached: dict, photo_relpath: Optional[str]) -> dict:
    return {
        'id': f'{chat_id}_{message_id}',
        'captured_at': datetime.now(timezone.utc).isoformat(),
        'message_date': cached['message_date'],
        'author': cached['author'],
        'text': cached['text'],
        'photo': photo_relpath,
        'telegram_link': f'https://t.me/c/{public_chat_id(chat_id)}/{message_id}',
        'status': 'new',
    }


def append_entry(inbox_path: str, entry: dict) -> None:
    directory = os.path.dirname(inbox_path) or '.'
    os.makedirs(directory, exist_ok=True)
    with open(inbox_path, 'a', encoding='utf-8') as f:
        f.write(json.dumps(entry, ensure_ascii=False) + '\n')
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest feedback-bot/tests/test_backlog.py -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add feedback-bot/backlog.py feedback-bot/tests/test_backlog.py
git commit -m "feat: add backlog entry builder and writer for feedback bot"
```

---

### Task 5: `mirocard_feedback_bot.py` — wire the Telegram handlers

**Files:**
- Create: `feedback-bot/mirocard_feedback_bot.py`
- Test: none automated (requires a live Telegram connection — covered by the manual test checklist in Task 9's runbook)

**Interfaces:**
- Consumes: `env_helpers.get_env`/`get_int_env` (Task 1), `formatting.PIN_EMOJI`/`has_pin_reaction` (Task 2), `message_cache.MessageCache` (Task 3), `backlog.build_entry`/`append_entry` (Task 4).
- Produces: `main()` entrypoint (invoked via `python mirocard_feedback_bot.py`) — this is the process the Scheduled Task in Task 8 runs.

- [ ] **Step 1: Create `feedback-bot/mirocard_feedback_bot.py`**

```python
#!/usr/bin/env python3
"""Mirocard2 testers-group feedback bot.

Listens to the testers group, caches messages, and — when the owner reacts
with 📌 — saves the message into feedback/inbox.jsonl.

Run: python mirocard_feedback_bot.py
"""

import logging
import os

from telegram import ReactionTypeEmoji, Update
from telegram.ext import Application, ContextTypes, MessageHandler, MessageReactionHandler, filters

from backlog import append_entry, build_entry
from env_helpers import get_env, get_int_env
from formatting import format_author, has_pin_reaction
from message_cache import MessageCache

BOT_TOKEN = get_env('FEEDBACK_BOT_TOKEN', required=True)
OWNER_ID = get_int_env('FEEDBACK_BOT_OWNER_ID', required=True)
CHAT_ID = get_int_env('FEEDBACK_BOT_CHAT_ID', required=True)
RETENTION_DAYS = get_int_env('FEEDBACK_BOT_CACHE_RETENTION_DAYS', default=30)
DATA_DIR = get_env('FEEDBACK_BOT_DATA_DIR', required=True)

CACHE_PATH = os.path.join(DATA_DIR, 'message_cache.json')
INBOX_PATH = os.path.join(DATA_DIR, 'inbox.jsonl')
SCREENSHOTS_DIR = os.path.join(DATA_DIR, 'screenshots')

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

cache = MessageCache(CACHE_PATH, retention_days=RETENTION_DAYS)


async def handle_group_message(update: Update, _ctx: ContextTypes.DEFAULT_TYPE) -> None:
    if update.effective_chat is None or update.effective_chat.id != CHAT_ID:
        return
    message = update.effective_message
    if message is None:
        return

    user = update.effective_user
    author = format_author(user.full_name, user.username) if user else 'Unknown'
    photo_file_id = message.photo[-1].file_id if message.photo else None
    text = message.text or message.caption or ''

    cache.remember(
        CHAT_ID, message.message_id,
        author=author,
        text=text,
        photo_file_id=photo_file_id,
        message_date=message.date.isoformat(),
    )


async def handle_reaction(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    reaction = update.message_reaction
    if reaction is None or reaction.chat.id != CHAT_ID:
        return
    if reaction.user is None or reaction.user.id != OWNER_ID:
        return

    new_emojis = {r.emoji for r in reaction.new_reaction if getattr(r, 'emoji', None)}
    if not has_pin_reaction(new_emojis):
        return

    cached = cache.get(CHAT_ID, reaction.message_id)
    if cached is None:
        log.warning('No cached message for reaction on %s/%s', CHAT_ID, reaction.message_id)
        await ctx.bot.set_message_reaction(
            chat_id=CHAT_ID, message_id=reaction.message_id,
            reaction=[ReactionTypeEmoji('⚠️')],
        )
        return

    photo_relpath = None
    if cached.get('photo_file_id'):
        os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
        filename = f'{CHAT_ID}_{reaction.message_id}.jpg'
        dest_path = os.path.join(SCREENSHOTS_DIR, filename)
        try:
            tg_file = await ctx.bot.get_file(cached['photo_file_id'])
            await tg_file.download_to_drive(dest_path)
            photo_relpath = f'screenshots/{filename}'
        except Exception:
            log.exception('Failed to download photo for %s/%s', CHAT_ID, reaction.message_id)

    try:
        entry = build_entry(CHAT_ID, reaction.message_id, cached, photo_relpath)
        append_entry(INBOX_PATH, entry)
    except Exception:
        log.exception('Failed to write backlog entry for %s/%s', CHAT_ID, reaction.message_id)
        return

    await ctx.bot.set_message_reaction(
        chat_id=CHAT_ID, message_id=reaction.message_id,
        reaction=[ReactionTypeEmoji('✅')],
    )


async def prune_cache_job(_ctx: ContextTypes.DEFAULT_TYPE) -> None:
    removed = cache.prune()
    if removed:
        log.info('Pruned %d stale cache entries', removed)


def main() -> None:
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(MessageHandler(filters.ChatType.GROUPS, handle_group_message))
    app.add_handler(MessageReactionHandler(handle_reaction))
    app.job_queue.run_repeating(prune_cache_job, interval=60 * 60 * 24, first=60)
    log.info('Mirocard feedback bot started (chat=%d, owner=%d)', CHAT_ID, OWNER_ID)
    app.run_polling(drop_pending_updates=True, allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Verify the module imports cleanly**

Create a throwaway `feedback-bot/.env` with placeholder values (`FEEDBACK_BOT_TOKEN=x`, `FEEDBACK_BOT_OWNER_ID=1`, `FEEDBACK_BOT_CHAT_ID=-1`, `FEEDBACK_BOT_DATA_DIR=` a tmp path), then:

Run: `python -c "import mirocard_feedback_bot"` (from inside `feedback-bot/`)
Expected: no exception (module-level code only reads env vars and builds the `MessageCache`, doesn't connect to Telegram). Delete the throwaway `.env` afterward — it must not be committed.

- [ ] **Step 3: Commit**

```bash
git add feedback-bot/mirocard_feedback_bot.py
git commit -m "feat: wire feedback bot Telegram handlers"
```

---

### Task 6: `scripts/fetch-feedback-backlog.py` — sync backlog to local machine (TDD on merge logic)

**Files:**
- Create: `scripts/fetch-feedback-backlog.py`
- Create: `scripts/tests/conftest.py`
- Test: `scripts/tests/test_fetch_feedback_backlog_merge.py`

**Interfaces:**
- Consumes: same `MIROCARD_DEPLOY_HOSTS`/`MIROCARD_DEPLOY_USER`/`MIROCARD_DEPLOY_PORT`/`MIROCARD_DEPLOY_PASSWORD`/`MIROCARD_DEPLOY_KEY_PATH` env vars as `scripts/fetch-production-db-backup.py`.
- Produces: `merge_backlog(remote_entries: list, local_entries: list) -> tuple[list, list]`, `parse_jsonl(text: str) -> list` — pure functions, no other task depends on them, but they're the testable core of this script.

- [ ] **Step 1: Create `scripts/tests/conftest.py`**

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
```

- [ ] **Step 2: Write the failing test — `scripts/tests/test_fetch_feedback_backlog_merge.py`**

```python
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `python -m pytest scripts/tests/test_fetch_feedback_backlog_merge.py -v`
Expected: FAIL — `fetch-feedback-backlog.py` doesn't exist yet, so `spec_from_file_location` produces a module with a `None` loader and `exec_module` raises `AttributeError`.

- [ ] **Step 4: Create `scripts/fetch-feedback-backlog.py`**

```python
#!/usr/bin/env python
"""Pull new feedback backlog entries and screenshots from the runtime host.

Reads SSH connection settings from the local .env file (the same
MIROCARD_DEPLOY_* variables used by fetch-production-db-backup.py). Merges
remote inbox.jsonl entries into the local feedback/inbox.jsonl without
touching locally-edited entries (in particular, local `status` values).
"""

import argparse
import json
from pathlib import Path

import paramiko

REMOTE_FEEDBACK_ROOT = "C:/Users/dmazn/Projects/Mirocard2/feedback"


def load_env(path):
    env = {}
    env_path = Path(path)
    if not env_path.exists():
        return env
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def connect(env):
    hosts = [h.strip() for h in env.get("MIROCARD_DEPLOY_HOSTS", "100.72.91.115").split(",") if h.strip()]
    user = env.get("MIROCARD_DEPLOY_USER", "dmazn")
    port = int(env.get("MIROCARD_DEPLOY_PORT", "22"))
    password = env.get("MIROCARD_DEPLOY_PASSWORD")
    key_path = env.get("MIROCARD_DEPLOY_KEY_PATH")
    if not password and not key_path:
        raise RuntimeError("No SSH credential found. Set MIROCARD_DEPLOY_PASSWORD or MIROCARD_DEPLOY_KEY_PATH.")

    last_error = None
    for host in hosts:
        try:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            kwargs = {
                "hostname": host,
                "port": port,
                "username": user,
                "timeout": 15,
                "banner_timeout": 30,
            }
            if key_path:
                kwargs["key_filename"] = key_path
            else:
                kwargs["password"] = password
            client.connect(**kwargs)
            return client, host
        except Exception as exc:  # pragma: no cover - operational fallback
            last_error = exc
    raise last_error


def sftp_path(windows_path):
    return windows_path.replace("\\", "/")


def parse_jsonl(text):
    entries = []
    for line in text.splitlines():
        line = line.strip()
        if line:
            entries.append(json.loads(line))
    return entries


def merge_backlog(remote_entries, local_entries):
    """Adds remote entries missing locally, without touching existing local entries.

    Returns (merged_entries, newly_added_entries), merged sorted by captured_at.
    """
    local_by_id = {entry["id"]: entry for entry in local_entries}
    newly_added = [entry for entry in remote_entries if entry["id"] not in local_by_id]
    merged = list(local_entries) + newly_added
    merged.sort(key=lambda entry: entry.get("captured_at", ""))
    return merged, newly_added


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", default=".env")
    parser.add_argument("--out-dir", default="feedback")
    parser.add_argument("--remote-root", default=REMOTE_FEEDBACK_ROOT)
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    local_inbox_path = out_dir / "inbox.jsonl"
    local_entries = (
        parse_jsonl(local_inbox_path.read_text(encoding="utf-8"))
        if local_inbox_path.exists() else []
    )

    env = load_env(args.env)
    client, host = connect(env)
    try:
        sftp = client.open_sftp()
        try:
            remote_inbox_path = sftp_path(f"{args.remote_root}/inbox.jsonl")
            with sftp.open(remote_inbox_path, "r") as f:
                remote_text = f.read().decode("utf-8")
            remote_entries = parse_jsonl(remote_text)

            merged, newly_added = merge_backlog(remote_entries, local_entries)

            for entry in newly_added:
                photo = entry.get("photo")
                if not photo:
                    continue
                local_photo_path = out_dir / photo
                if local_photo_path.exists():
                    continue
                remote_photo_path = sftp_path(f"{args.remote_root}/{photo}")
                local_photo_path.parent.mkdir(parents=True, exist_ok=True)
                sftp.get(remote_photo_path, str(local_photo_path))

            body = "\n".join(json.dumps(entry, ensure_ascii=False) for entry in merged)
            local_inbox_path.write_text(body + ("\n" if merged else ""), encoding="utf-8")
            print(f"Synced from {host}: {len(newly_added)} new entries, {len(merged)} total.")
        finally:
            sftp.close()
    finally:
        client.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest scripts/tests/test_fetch_feedback_backlog_merge.py -v`
Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch-feedback-backlog.py scripts/tests/conftest.py scripts/tests/test_fetch_feedback_backlog_merge.py
git commit -m "feat: add feedback backlog sync script with tested merge logic"
```

---

### Task 7: `scripts/deploy-feedback-bot.py` — deploy to the runtime host (TDD on file-list logic)

**Files:**
- Create: `scripts/deploy-feedback-bot.py`
- Test: `scripts/tests/test_deploy_feedback_bot_filelist.py`

**Interfaces:**
- Consumes: same `MIROCARD_DEPLOY_*` env vars as Task 6.
- Produces: `build_upload_file_list(local_dir: Path, filenames: list) -> list[tuple[str, str]]` — pure, tested; the rest of the script (SSH/SFTP calls) is exercised manually in Task 9's runbook.

- [ ] **Step 1: Write the failing test — `scripts/tests/test_deploy_feedback_bot_filelist.py`**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest scripts/tests/test_deploy_feedback_bot_filelist.py -v`
Expected: FAIL — `deploy-feedback-bot.py` doesn't exist yet.

- [ ] **Step 3: Create `scripts/deploy-feedback-bot.py`**

```python
#!/usr/bin/env python
"""Deploy feedback-bot/*.py to the runtime host and restart MirocardFeedbackBot.

Mirrors the manual backend-deploy pattern documented in DEPLOYMENT.md: upload
via SFTP, then restart via the scheduled task — never edit files directly on
the host.
"""

import argparse
from pathlib import Path

import paramiko

REMOTE_BOT_ROOT = "C:/Users/dmazn/Projects/Mirocard2/feedback-bot"
LOCAL_BOT_DIR = Path(__file__).resolve().parent.parent / "feedback-bot"
DEPLOYED_FILES = [
    "mirocard_feedback_bot.py",
    "message_cache.py",
    "backlog.py",
    "formatting.py",
    "env_helpers.py",
    "requirements.txt",
]


def load_env(path):
    env = {}
    env_path = Path(path)
    if not env_path.exists():
        return env
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def connect(env):
    hosts = [h.strip() for h in env.get("MIROCARD_DEPLOY_HOSTS", "100.72.91.115").split(",") if h.strip()]
    user = env.get("MIROCARD_DEPLOY_USER", "dmazn")
    port = int(env.get("MIROCARD_DEPLOY_PORT", "22"))
    password = env.get("MIROCARD_DEPLOY_PASSWORD")
    key_path = env.get("MIROCARD_DEPLOY_KEY_PATH")
    if not password and not key_path:
        raise RuntimeError("No SSH credential found. Set MIROCARD_DEPLOY_PASSWORD or MIROCARD_DEPLOY_KEY_PATH.")

    last_error = None
    for host in hosts:
        try:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            kwargs = {
                "hostname": host,
                "port": port,
                "username": user,
                "timeout": 15,
                "banner_timeout": 30,
            }
            if key_path:
                kwargs["key_filename"] = key_path
            else:
                kwargs["password"] = password
            client.connect(**kwargs)
            return client, host
        except Exception as exc:  # pragma: no cover - operational fallback
            last_error = exc
    raise last_error


def build_upload_file_list(local_dir: Path, filenames):
    """Pairs each filename with its local and remote (posix) path.

    Raises FileNotFoundError if a file is missing locally.
    """
    pairs = []
    for name in filenames:
        local_path = local_dir / name
        if not local_path.exists():
            raise FileNotFoundError(f"Missing local file: {local_path}")
        pairs.append((str(local_path), f"{REMOTE_BOT_ROOT}/{name}"))
    return pairs


def restart_bot_task(client):
    _stdin, stdout, _stderr = client.exec_command(
        'wmic process where "CommandLine like \'%mirocard_feedback_bot.py%\'" get ProcessId'
    )
    stdout.channel.recv_exit_status()
    for line in stdout.read().decode().splitlines():
        pid = line.strip()
        if pid.isdigit():
            client.exec_command(f"taskkill /PID {pid} /F")
    client.exec_command('schtasks /run /tn "MirocardFeedbackBot"')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", default=".env")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    pairs = build_upload_file_list(LOCAL_BOT_DIR, DEPLOYED_FILES)

    if args.dry_run:
        for local_path, remote_path in pairs:
            print(f"{local_path} -> {remote_path}")
        return

    env = load_env(args.env)
    client, host = connect(env)
    try:
        sftp = client.open_sftp()
        try:
            client.exec_command(f'mkdir "{REMOTE_BOT_ROOT}"')
            for local_path, remote_path in pairs:
                sftp.put(local_path, remote_path)
                print(f"Uploaded {local_path} -> {remote_path}")
        finally:
            sftp.close()
        restart_bot_task(client)
        print(f"Deployed to {host} and restarted MirocardFeedbackBot.")
    finally:
        client.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest scripts/tests/test_deploy_feedback_bot_filelist.py -v`
Expected: 2 passed

- [ ] **Step 5: Dry-run against the real local files**

Run: `python scripts/deploy-feedback-bot.py --dry-run`
Expected: prints 6 `local -> remote` path pairs for `mirocard_feedback_bot.py`, `message_cache.py`, `backlog.py`, `formatting.py`, `env_helpers.py`, `requirements.txt` — no network call made.

- [ ] **Step 6: Commit**

```bash
git add scripts/deploy-feedback-bot.py scripts/tests/test_deploy_feedback_bot_filelist.py
git commit -m "feat: add feedback bot deploy script with tested file-list logic"
```

---

### Task 8: `scripts/install-feedback-bot-task.ps1` — register the Scheduled Task

**Files:**
- Create: `scripts/install-feedback-bot-task.ps1`
- Test: none (Windows Scheduled Task registration; runs on the host, verified manually in Task 9)

**Interfaces:**
- Consumes: `feedback-bot/mirocard_feedback_bot.py` must already exist at the given `-ProjectRoot` on the host (deployed by Task 7's script).
- Produces: a running `MirocardFeedbackBot` Scheduled Task on the runtime host.

- [ ] **Step 1: Create `scripts/install-feedback-bot-task.ps1`**

```powershell
<#
.SYNOPSIS
  Installs the Windows scheduled task that runs the Mirocard feedback bot.

.DESCRIPTION
  Registers "MirocardFeedbackBot" as an always-running task (starts at boot,
  restarts on crash, no execution time limit) - independent of the
  MirocardBackend2 task and of the Kaplieva_bot process. Run this once,
  directly on the runtime host, after feedback-bot/ has been deployed there.
#>

[CmdletBinding()]
param(
  [string]$ProjectRoot = "C:\Users\dmazn\Projects\Mirocard2",
  [string]$PythonExe = "python",
  [switch]$Force
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$botScript = Join-Path $ProjectRoot 'feedback-bot\mirocard_feedback_bot.py'
if (-not (Test-Path -LiteralPath $botScript -PathType Leaf)) { throw "Missing script: $botScript" }

$taskName = 'MirocardFeedbackBot'
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing -and -not $Force) {
  throw "Scheduled task already exists: $taskName. Re-run with -Force to replace it."
}
if ($existing -and $Force) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action = New-ScheduledTaskAction -Execute $PythonExe -Argument "`"$botScript`"" -WorkingDirectory (Split-Path $botScript -Parent)
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Mirocard testers-group feedback bot (persistent)' | Out-Null

Write-Host "Registered task: $taskName"
Write-Host "Start it now with:"
Write-Host "  Start-ScheduledTask -TaskName `"$taskName`""
```

- [ ] **Step 2: Syntax-check the script locally**

Run: `powershell -NoProfile -Command "$null = Get-Command -Syntax { . '.\scripts\install-feedback-bot-task.ps1' -ProjectRoot 'C:\x' -Force }; [System.Management.Automation.PSParser]::Tokenize((Get-Content .\scripts\install-feedback-bot-task.ps1 -Raw), [ref]$null) | Out-Null; 'OK'"`
Expected: prints `OK` (confirms the file parses as valid PowerShell without executing it).

- [ ] **Step 3: Commit**

```bash
git add scripts/install-feedback-bot-task.ps1
git commit -m "feat: add scheduled task installer for feedback bot"
```

---

### Task 9: `.gitignore`, setup runbook, and full local test pass

**Files:**
- Modify: `.gitignore`
- Create: `docs/feedback-bot-setup.md`
- Test: full local suite (`feedback-bot/tests`, `scripts/tests`)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed by other tasks — this is the final task.

- [ ] **Step 1: Add `feedback/` to `.gitignore`**

Append to `.gitignore` (near the other backup-artifact entries):

```gitignore
# Telegram testers feedback backlog (working data, not source)
feedback/
```

- [ ] **Step 2: Create `docs/feedback-bot-setup.md`**

```markdown
# Feedback bot — setup runbook

One-time setup to bring the Telegram testers-group feedback bot online.
Design: `docs/superpowers/specs/2026-07-10-telegram-feedback-bot-design.md`.
Code: `feedback-bot/`, `scripts/fetch-feedback-backlog.py`, `scripts/deploy-feedback-bot.py`.

## 1. Create the bot in @BotFather

1. `/newbot` → name it (e.g. "Mirocard Feedback"), get the token.
2. `/setprivacy` → select the new bot → **Disable** (it must see all group
   messages, not just commands, to cache them for later reactions).
3. Add the bot to the Mirocard2 testers group as a regular member (admin not
   required).

## 2. Collect the IDs you need

- **Owner Telegram user id**: message `@userinfobot` from your own account.
- **Group chat id**: add `@RawDataBot` to the group temporarily (or check
  `getUpdates` after sending a message) — it's a negative number like
  `-1001234567890` for a supergroup.

## 3. Configure `.env` on the runtime host

On `192.168.1.163`, create `C:/Users/dmazn/Projects/Mirocard2/feedback-bot/.env`
(this file is never uploaded by the deploy script — create/edit it directly on
the host over SSH or RDP) with real values, following `feedback-bot/.env.example`:

```text
FEEDBACK_BOT_TOKEN=<token from step 1>
FEEDBACK_BOT_OWNER_ID=<your user id from step 2>
FEEDBACK_BOT_CHAT_ID=<group chat id from step 2>
FEEDBACK_BOT_CACHE_RETENTION_DAYS=30
FEEDBACK_BOT_DATA_DIR=C:/Users/dmazn/Projects/Mirocard2/feedback
```

## 4. First deploy

From the local machine, with `MIROCARD_DEPLOY_PASSWORD` (or
`MIROCARD_DEPLOY_KEY_PATH`) set in the environment:

```bash
python scripts/deploy-feedback-bot.py
```

This uploads `feedback-bot/*.py` and `requirements.txt` to
`C:/Users/dmazn/Projects/Mirocard2/feedback-bot/` on the runtime host and
tries to restart the `MirocardFeedbackBot` task (harmless no-op the first
time, since the task doesn't exist yet).

Then, on the runtime host itself, install dependencies once:

```powershell
cd C:\Users\dmazn\Projects\Mirocard2\feedback-bot
pip install -r requirements.txt
```

## 5. Register the scheduled task

On the runtime host itself (not over a plain SSH exec — Scheduled Task
registration needs an interactive session per the existing `MirocardBackend2`
precedent documented in `DEPLOYMENT.md`):

```powershell
cd C:\Users\dmazn\Projects\Mirocard2
.\scripts\install-feedback-bot-task.ps1
Start-ScheduledTask -TaskName "MirocardFeedbackBot"
```

## 6. Manual test checklist (from the design doc)

1. Send a plain text message in the testers group, then a message with a
   photo attached. React 📌 on both (as the owner).
   Expect: ✅ appears on both within a few seconds; two new lines appear in
   `C:/Users/dmazn/Projects/Mirocard2/feedback/inbox.jsonl` on the runtime
   host, and the screenshot lands in `feedback/screenshots/`.
2. Restart the bot task (`Stop-ScheduledTask` then
   `Start-ScheduledTask -TaskName "MirocardFeedbackBot"`), then react 📌 on a
   message that was sent *before* the restart.
   Expect: ✅ still appears (the persistent cache survived the restart).
3. React 📌 as a **different** Telegram account (not the owner).
   Expect: no reaction from the bot, no new backlog entry.
4. From the local dev machine:
   ```bash
   python scripts/fetch-feedback-backlog.py
   ```
   Expect: new entries appear in the local `feedback/inbox.jsonl`; running it
   again immediately prints `0 new entries` and doesn't duplicate lines.
5. Manually edit one local entry's `status` to `"done"`, then run
   `scripts/fetch-feedback-backlog.py` again.
   Expect: that entry's `status` is still `"done"` after the sync.
```

- [ ] **Step 3: Run the full local test suite**

Run: `python -m pytest feedback-bot/tests scripts/tests -v`
Expected: all tests pass (20 tests: 5 formatting + 4 cache + 6 backlog + 3 merge + 2 filelist).

- [ ] **Step 4: Commit**

```bash
git add .gitignore docs/feedback-bot-setup.md
git commit -m "docs: add feedback bot setup runbook, ignore feedback/ data"
```

---

## Self-Review Notes

- **Spec coverage:** passive collection (Task 5), owner-only 📌 reactions (Task 5 `OWNER_ID` check), persistent restart-safe cache (Task 3 + manual test 2 in Task 9), one-way merge preserving local `status` (Task 6 + manual test 5), `feedback/` gitignored (Task 9), independent bot/token/process from `Kaplieva_bot` (Task 1 `.env.example`, design doc rationale), runtime host not Synology (Task 8 `install-feedback-bot-task.ps1` targets the runtime host), error handling ✅/⚠️ (Task 5).
- **No placeholders:** every step has complete, runnable code; the two steps without automated tests (Task 5's Telegram wiring, Task 8's PowerShell task) are explicitly called out as manually verified in Task 9's runbook, matching the design doc's own Testing section.
- **Type/name consistency checked:** `MessageCache.remember/get/prune` (Task 3) match the calls in `mirocard_feedback_bot.py` (Task 5); `backlog.build_entry/append_entry` (Task 4) match Task 5's usage; `formatting.format_author/has_pin_reaction/PIN_EMOJI` (Task 2) match Task 5's usage; `merge_backlog`/`parse_jsonl` signatures in Task 6's test match the implementation.
- **Live rollout is intentionally outside this plan's checkboxes** — Task 9's runbook documents the exact commands, but actually running them against the real bot token / real runtime host / real Telegram group is an operational action the user (or Claude Code with explicit go-ahead at that time) performs deliberately, not something to execute unattended while implementing this plan.
