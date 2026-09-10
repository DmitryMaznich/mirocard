#!/usr/bin/env python3
"""Mirocard2 testers-group feedback bot.

Listens to the testers group, caches messages, and — when the owner reacts
with 👀 — saves the message into feedback/inbox.jsonl. Also accepts direct
messages from the owner in a private chat with the bot, saving them
immediately (no reaction needed there).

Run: python mirocard_feedback_bot.py
"""

import logging
import os
import subprocess
from typing import Optional

from telegram import ReactionTypeEmoji, Update
from telegram.ext import Application, ContextTypes, MessageHandler, MessageReactionHandler, TypeHandler, filters

from backlog import append_entry, build_entry
from env_helpers import get_env, get_int_env
from formatting import format_author, has_pin_reaction
from message_cache import MessageCache

BOT_TOKEN = get_env('FEEDBACK_BOT_TOKEN', required=True)
OWNER_ID = get_int_env('FEEDBACK_BOT_OWNER_ID', required=True)
CHAT_ID = get_int_env('FEEDBACK_BOT_CHAT_ID', required=True)
RETENTION_DAYS = get_int_env('FEEDBACK_BOT_CACHE_RETENTION_DAYS', default=30)
DATA_DIR = get_env('FEEDBACK_BOT_DATA_DIR', required=True)

# Media ingestion (optional — unset FEEDBACK_BOT_MEDIA_INGESTS to disable).
# One or more "chat_id:album_id" pairs, separated by ';' — each configured
# group gets its own MediaIngest instance archiving into its own album.
LOCAL_BOT_API_URL = get_env('TELEGRAM_LOCAL_API_URL')
MEDIA_INGESTS_RAW = get_env('FEEDBACK_BOT_MEDIA_INGESTS')

CACHE_PATH = os.path.join(DATA_DIR, 'message_cache.json')
INBOX_PATH = os.path.join(DATA_DIR, 'inbox.jsonl')
LOG_PATH = os.path.join(DATA_DIR, 'bot.log')

os.makedirs(DATA_DIR, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    handlers=[logging.StreamHandler(), logging.FileHandler(LOG_PATH, encoding='utf-8')],
)
log = logging.getLogger(__name__)

cache = MessageCache(CACHE_PATH, retention_days=RETENTION_DAYS)


async def log_all_updates(update: Update, _ctx: ContextTypes.DEFAULT_TYPE) -> None:
    chat = update.effective_chat
    log.info(
        'Update received: update_id=%s chat_id=%s chat_type=%s update=%s',
        update.update_id, chat.id if chat else None, chat.type if chat else None,
        update.to_dict(),
    )


async def handle_group_message(update: Update, _ctx: ContextTypes.DEFAULT_TYPE) -> None:
    if update.effective_chat is None or update.effective_chat.id != CHAT_ID:
        return
    message = update.effective_message
    if message is None:
        return

    user = update.effective_user
    author = format_author(user.full_name, user.username) if user else 'Unknown'
    photo_file_id = message.photo[-1].file_id if message.photo else None
    voice_file_id = message.voice.file_id if message.voice else None
    text = message.text or message.caption or ''

    cache.remember(
        CHAT_ID, message.message_id,
        author=author,
        text=text,
        photo_file_id=photo_file_id,
        voice_file_id=voice_file_id,
        message_date=message.date.isoformat(),
    )


async def _download_attachment(ctx: ContextTypes.DEFAULT_TYPE, file_id: str,
                                dir_name: str, filename: str) -> Optional[str]:
    dest_dir = os.path.join(DATA_DIR, dir_name)
    os.makedirs(dest_dir, exist_ok=True)
    dest_path = os.path.join(dest_dir, filename)
    try:
        tg_file = await ctx.bot.get_file(file_id)
        await tg_file.download_to_drive(dest_path)
        return f'{dir_name}/{filename}'
    except Exception:
        log.exception('Failed to download attachment %s/%s', dir_name, filename)
        return None


async def _set_confirmation_reaction(ctx: ContextTypes.DEFAULT_TYPE, message_id: int, emoji: str) -> None:
    try:
        await ctx.bot.set_message_reaction(
            chat_id=CHAT_ID, message_id=message_id,
            reaction=[ReactionTypeEmoji(emoji)],
        )
    except Exception:
        log.exception('Failed to set confirmation reaction %s on %s/%s', emoji, CHAT_ID, message_id)


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
        await _set_confirmation_reaction(ctx, reaction.message_id, '👎')
        return

    photo_relpath = None
    if cached.get('photo_file_id'):
        photo_relpath = await _download_attachment(
            ctx, cached['photo_file_id'], 'screenshots', f'{CHAT_ID}_{reaction.message_id}.jpg',
        )

    voice_relpath = None
    if cached.get('voice_file_id'):
        voice_relpath = await _download_attachment(
            ctx, cached['voice_file_id'], 'voice', f'{CHAT_ID}_{reaction.message_id}.ogg',
        )

    try:
        entry = build_entry(CHAT_ID, reaction.message_id, cached, photo_relpath, voice_relpath)
        append_entry(INBOX_PATH, entry)
    except Exception:
        log.exception('Failed to write backlog entry for %s/%s', CHAT_ID, reaction.message_id)
        return

    await _set_confirmation_reaction(ctx, reaction.message_id, '👍')


async def handle_owner_dm(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    """Every message the owner sends directly to the bot is saved immediately —
    no reaction needed, since a DM to the bot is already a deliberate action."""
    chat = update.effective_chat
    user = update.effective_user
    if chat is None or user is None or user.id != OWNER_ID:
        return
    message = update.effective_message
    if message is None:
        return

    text = message.text or message.caption or ''

    photo_relpath = None
    if message.photo:
        photo_relpath = await _download_attachment(
            ctx, message.photo[-1].file_id, 'screenshots', f'{chat.id}_{message.message_id}.jpg',
        )

    voice_relpath = None
    if message.voice:
        voice_relpath = await _download_attachment(
            ctx, message.voice.file_id, 'voice', f'{chat.id}_{message.message_id}.ogg',
        )

    cached = {
        'author': format_author(user.full_name, user.username),
        'text': text,
        'message_date': message.date.isoformat(),
    }

    try:
        entry = build_entry(chat.id, message.message_id, cached, photo_relpath, voice_relpath, source='dm')
        append_entry(INBOX_PATH, entry)
    except Exception:
        log.exception('Failed to write backlog entry from DM %s/%s', chat.id, message.message_id)
        await message.reply_text('❌ Не удалось сохранить.')
        return

    await message.reply_text('✅ Сохранено в backlog.')


async def prune_cache_job(_ctx: ContextTypes.DEFAULT_TYPE) -> None:
    removed = cache.prune()
    if removed:
        log.info('Pruned %d stale cache entries', removed)


async def prune_telegram_bot_api_cache_job(_ctx: ContextTypes.DEFAULT_TYPE) -> None:
    """Backstop for media_ingest.py's per-request cleanup: it deletes each
    file right after use, but only on the success path. A getFile call that
    times out client-side (large video, host under load) can leave
    telegram-bot-api's own downloaded copy orphaned with nothing left to
    clean it up — this filled the host's disk twice before this job existed.
    Sweeping the whole cache periodically, independent of any single
    request's outcome, is what actually prevents that. A rare race is
    possible if this fires mid-request (deletes a file another handler is
    about to `docker cp`), but a lost download just fails that one item
    with a 👎 — cheap compared to the disk filling up again."""
    result = subprocess.run(
        ['docker', 'exec', 'telegram-bot-api', 'sh', '-c', 'rm -rf /var/lib/telegram-bot-api/*/documents/*'],
        capture_output=True, timeout=60,
    )
    if result.returncode != 0:
        log.warning('telegram-bot-api cache prune failed: %s', result.stderr.decode(errors='replace'))


def main() -> None:
    builder = Application.builder().token(BOT_TOKEN)
    if LOCAL_BOT_API_URL:
        # Standard Bot API caps file downloads at 20 MB — too small for phone
        # video. A local Bot API server (telegram-bot-api) raises that to
        # 2 GB; see docs/feedback-bot-setup.md section "Video ingestion".
        builder = builder.base_url(f'{LOCAL_BOT_API_URL}/bot').base_file_url(f'{LOCAL_BOT_API_URL}/file/bot')
        # get_file on a large, not-yet-cached video blocks server-side until
        # the local API server finishes pulling it from Telegram over
        # MTProto, which can take well over PTB's default ~5s read timeout.
        builder = builder.read_timeout(180).connect_timeout(30).write_timeout(180).pool_timeout(30)
        log.info('Using local Bot API server at %s', LOCAL_BOT_API_URL)
    app = builder.build()
    app.add_handler(TypeHandler(Update, log_all_updates), group=-1)
    # Scoped to CHAT_ID specifically, not just any group: PTB dispatches an
    # update to the first matching handler per group and stops there, so a
    # broad ChatType.GROUPS filter here would swallow messages from other
    # group chats (e.g. the video-ingestion chat below) before they ever
    # reach their own handler.
    app.add_handler(MessageHandler(filters.Chat(chat_id=CHAT_ID), handle_group_message))
    app.add_handler(MessageHandler(filters.ChatType.PRIVATE, handle_owner_dm))
    app.add_handler(MessageReactionHandler(handle_reaction))

    if MEDIA_INGESTS_RAW:
        from google_photos import GooglePhotosClient
        from media_ingest import MediaIngest

        client_secret_path = get_env('GOOGLE_PHOTOS_CLIENT_SECRET_PATH', required=True)
        token_path = get_env('GOOGLE_PHOTOS_TOKEN_PATH', required=True)
        photos_client = GooglePhotosClient(client_secret_path, token_path)

        for entry in MEDIA_INGESTS_RAW.split(';'):
            entry = entry.strip()
            if not entry:
                continue
            chat_id_str, album_id = entry.split(':', 1)
            ingest_chat_id = int(chat_id_str)
            media_temp_dir = os.path.join(DATA_DIR, f'media_tmp_{ingest_chat_id}')

            media_ingest = MediaIngest(
                ingest_chat_id, media_temp_dir, photos_client, album_id,
                bot_token=BOT_TOKEN, local_api_url=LOCAL_BOT_API_URL,
            )
            # Scoped to this exact chat, not just any group — same reasoning
            # as handle_group_message above: PTB stops at the first handler
            # that matches per group, and with several ingest chats now
            # configured, a broader filter would let one swallow another's
            # updates before they reach the right MediaIngest.
            app.add_handler(MessageHandler(
                filters.Chat(chat_id=ingest_chat_id)
                & (filters.PHOTO | filters.VIDEO | filters.Document.IMAGE | filters.Document.VIDEO),
                media_ingest.handle_message,
            ))
            log.info('Media ingestion enabled: chat=%d album=%s', ingest_chat_id, album_id)

        app.job_queue.run_repeating(prune_telegram_bot_api_cache_job, interval=30 * 60, first=5 * 60)

    app.job_queue.run_repeating(prune_cache_job, interval=60 * 60 * 24, first=60)
    log.info('Mirocard feedback bot started (chat=%d, owner=%d)', CHAT_ID, OWNER_ID)
    # drop_pending_updates=False: on a restart after downtime (a crash, a
    # deploy, this host running out of disk), Telegram is still holding
    # whatever came in while we were offline — dropping it here would
    # silently discard messages/videos nobody ever saw archived instead of
    # just processing them a bit late.
    app.run_polling(drop_pending_updates=False, allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    main()
