from typing import Iterable, Optional

PIN_EMOJI = '👀'


def format_author(full_name: str, username: Optional[str]) -> str:
    if username:
        return f'{full_name} (@{username})'
    return full_name


def has_pin_reaction(emojis: Iterable[str]) -> bool:
    return PIN_EMOJI in set(emojis)
