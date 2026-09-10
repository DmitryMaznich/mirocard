"""Media ingestion: watches a Telegram group, archives every photo/video
into a Google Photos album, and reacts on the message to confirm it landed.
One MediaIngest instance is bound to exactly one (chat, album) pair; the bot
registers one per configured source group."""

import logging
import mimetypes
import os
import subprocess

import requests
from telegram import ReactionTypeEmoji, Update
from telegram.ext import ContextTypes

from formatting import format_author
from google_photos import GooglePhotosClient

log = logging.getLogger(__name__)

TELEGRAM_BOT_API_CONTAINER = 'telegram-bot-api'


def _extract_media(message):
    """Returns (media_object, mime_type) for the first photo/video found in
    the message (as an attachment or a document sent as a file), or
    (None, None) if the message has neither."""
    if message.photo:
        # PhotoSize carries no mime_type — Telegram always re-encodes
        # attached photos as JPEG. message.photo is ordered smallest-first.
        return message.photo[-1], 'image/jpeg'
    if message.video:
        return message.video, message.video.mime_type or 'video/mp4'
    if message.document:
        mime_type = message.document.mime_type or ''
        if mime_type.startswith('image/') or mime_type.startswith('video/'):
            return message.document, mime_type
    return None, None


def _guess_suffix(media, mime_type: str) -> str:
    file_name = getattr(media, 'file_name', None)
    if file_name:
        ext = os.path.splitext(file_name)[1]
        if ext:
            return ext
    return mimetypes.guess_extension(mime_type) or ('.jpg' if mime_type.startswith('image/') else '.mp4')


class MediaIngest:
    def __init__(self, chat_id: int, temp_dir: str, photos_client: GooglePhotosClient, album_id: str,
                 bot_token: str, local_api_url: str):
        self.chat_id = chat_id
        self.temp_dir = temp_dir
        self.photos_client = photos_client
        self.album_id = album_id
        self.bot_token = bot_token
        self.local_api_url = local_api_url
        os.makedirs(self.temp_dir, exist_ok=True)

    async def handle_message(self, update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
        if update.effective_chat is None or update.effective_chat.id != self.chat_id:
            return
        message = update.effective_message
        if message is None:
            return

        media, mime_type = _extract_media(message)
        if media is None:
            return

        suffix = _guess_suffix(media, mime_type)
        temp_path = os.path.join(self.temp_dir, f'{self.chat_id}_{message.message_id}{suffix}')

        try:
            # Call getFile over raw HTTP instead of ctx.bot.get_file():
            # python-telegram-bot's File.file_path getter concatenates
            # base_file_url with whatever the server returned, assuming a
            # relative path. The server runs with --local (needed to lift
            # its 20 MB getFile cap), so it actually returns an *absolute
            # path inside the telegram-bot-api container's own filesystem*
            # — concatenating that produces a broken URL. Reading the raw
            # JSON response sidesteps that, and gives us the real container
            # path to pull out with `docker cp` (this process runs on the
            # Windows host, not inside that container, so it can't just
            # open the path either).
            resp = requests.get(
                f'{self.local_api_url}/bot{self.bot_token}/getFile',
                params={'file_id': media.file_id},
                timeout=180,
            )
            resp.raise_for_status()
            raw_path = resp.json()['result']['file_path']

            cp_result = subprocess.run(
                ['docker', 'cp', f'{TELEGRAM_BOT_API_CONTAINER}:{raw_path}', temp_path],
                capture_output=True, timeout=120,
            )

            # telegram-bot-api never deletes files it downloads from
            # Telegram — left alone, they accumulate on disk forever (this
            # is what filled the host's C: drive after one bulk upload).
            # Delete the container's copy as soon as we know raw_path,
            # regardless of whether `docker cp` itself succeeded — if cp
            # fails (e.g. host disk full) and this cleanup only ran on the
            # success path, the container's copy would never be removed,
            # which shrinks free disk space further and makes the next
            # `docker cp` even more likely to fail the same way.
            rm_result = subprocess.run(
                ['docker', 'exec', TELEGRAM_BOT_API_CONTAINER, 'rm', '-f', raw_path],
                capture_output=True, timeout=30,
            )
            if rm_result.returncode != 0:
                log.warning(
                    'Could not delete %s inside %s container: %s',
                    raw_path, TELEGRAM_BOT_API_CONTAINER, rm_result.stderr.decode(errors='replace'),
                )

            if cp_result.returncode != 0:
                raise RuntimeError(f'docker cp failed: {cp_result.stderr.decode(errors="replace")}')

            media_item = self.photos_client.upload_media(
                temp_path, self.album_id, mime_type, filename=os.path.basename(temp_path),
            )

            user = update.effective_user
            if user is not None:
                author = format_author(user.full_name, user.username)
                sent_at = message.date.strftime('%Y-%m-%d %H:%M UTC')
                description = f'Прислал: {author}\n{sent_at}'
                try:
                    self.photos_client.set_description(media_item['id'], description)
                except Exception:
                    # Best-effort — the item is already archived either way.
                    log.exception('Failed to set description on %s/%s', self.chat_id, message.message_id)

            # 👍/👎 rather than ✅/❌: the latter aren't in Telegram's
            # always-available reaction set and fail with Reaction_invalid
            # unless a group's Settings > Reactions is set to "All Reactions"
            # — 👍/👎 already work unconditionally for the testers-group flow
            # in mirocard_feedback_bot.py, so reuse them here too.
            await self._react(ctx, message.message_id, '👍')
            log.info('Archived %s/%s to Google Photos album %s', self.chat_id, message.message_id, self.album_id)
        except Exception:
            log.exception('Failed to archive %s/%s', self.chat_id, message.message_id)
            await self._react(ctx, message.message_id, '👎')
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    async def _react(self, ctx: ContextTypes.DEFAULT_TYPE, message_id: int, emoji: str) -> None:
        try:
            await ctx.bot.set_message_reaction(
                chat_id=self.chat_id, message_id=message_id, reaction=[ReactionTypeEmoji(emoji)],
            )
        except Exception:
            log.exception('Failed to set reaction %s on %s/%s', emoji, self.chat_id, message_id)
