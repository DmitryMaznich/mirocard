"""Video ingestion: watches the video group, archives every video into a
shared Google Photos album, and reacts on the message to confirm it landed."""

import logging
import os

from telegram import ReactionTypeEmoji, Update
from telegram.ext import ContextTypes

from google_photos import GooglePhotosClient

log = logging.getLogger(__name__)


class VideoIngest:
    def __init__(self, chat_id: int, temp_dir: str, photos_client: GooglePhotosClient, album_id: str):
        self.chat_id = chat_id
        self.temp_dir = temp_dir
        self.photos_client = photos_client
        self.album_id = album_id
        os.makedirs(self.temp_dir, exist_ok=True)

    async def handle_message(self, update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
        if update.effective_chat is None or update.effective_chat.id != self.chat_id:
            return
        message = update.effective_message
        if message is None:
            return

        video = message.video
        if video is None and message.document and (message.document.mime_type or '').startswith('video/'):
            video = message.document
        if video is None:
            return

        suffix = os.path.splitext(getattr(video, 'file_name', None) or '')[1] or '.mp4'
        temp_path = os.path.join(self.temp_dir, f'{self.chat_id}_{message.message_id}{suffix}')

        try:
            tg_file = await ctx.bot.get_file(video.file_id)
            await tg_file.download_to_drive(temp_path)
            self.photos_client.upload_video(temp_path, self.album_id, filename=os.path.basename(temp_path))
            await self._react(ctx, message.message_id, '✅')
            log.info('Archived video %s/%s to Google Photos album %s', self.chat_id, message.message_id, self.album_id)
        except Exception:
            log.exception('Failed to archive video %s/%s', self.chat_id, message.message_id)
            await self._react(ctx, message.message_id, '❌')
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
