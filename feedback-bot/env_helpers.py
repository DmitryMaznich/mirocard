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
