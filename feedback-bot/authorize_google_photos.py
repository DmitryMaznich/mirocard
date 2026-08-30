#!/usr/bin/env python3
"""One-time interactive Google Photos setup for video ingestion.

Run manually, on a machine with a browser available (see
docs/feedback-bot-setup.md, "Video ingestion" section, for why the runtime
host usually isn't that machine):

    python authorize_google_photos.py

Does two things, only on the first run:
1. Runs the OAuth installed-app flow (opens a browser) and saves a refresh
   token to GOOGLE_PHOTOS_TOKEN_PATH, so the bot process can renew access
   tokens on its own afterwards, with no browser involved.
2. If GOOGLE_PHOTOS_ALBUM_ID isn't set yet, creates a new shared album named
   GOOGLE_PHOTOS_ALBUM_TITLE, prints its id and shareable link, and stops —
   copy the id into .env as GOOGLE_PHOTOS_ALBUM_ID, then send the link to
   your team so they can join the album from their own Google Photos.
"""

import os

from google_auth_oauthlib.flow import InstalledAppFlow

from env_helpers import get_env
from google_photos import SCOPES, GooglePhotosClient


def main() -> None:
    client_secret_path = get_env('GOOGLE_PHOTOS_CLIENT_SECRET_PATH', required=True)
    token_path = get_env('GOOGLE_PHOTOS_TOKEN_PATH', required=True)

    if not os.path.exists(token_path):
        flow = InstalledAppFlow.from_client_secrets_file(client_secret_path, SCOPES)
        creds = flow.run_local_server(port=0)
        os.makedirs(os.path.dirname(token_path) or '.', exist_ok=True)
        with open(token_path, 'w', encoding='utf-8') as f:
            f.write(creds.to_json())
        print(f'Saved Google Photos token to {token_path}')
    else:
        print(f'Token already exists at {token_path}, skipping OAuth flow.')

    album_id = get_env('GOOGLE_PHOTOS_ALBUM_ID')
    if album_id:
        print(f'GOOGLE_PHOTOS_ALBUM_ID is already set to {album_id} — not creating a new album.')
        return

    title = get_env('GOOGLE_PHOTOS_ALBUM_TITLE', default='Video Archive')
    client = GooglePhotosClient(client_secret_path, token_path)
    album = client.create_shared_album(title)
    share_url = (album.get('shareInfo') or {}).get('shareableUrl')

    print('\nCreated shared album:')
    print(f'  id: {album["id"]}')
    print(f'  shareable link (send this to your team): {share_url}')
    print('\nAdd this line to feedback-bot/.env, then restart the bot:')
    print(f'  GOOGLE_PHOTOS_ALBUM_ID={album["id"]}')


if __name__ == '__main__':
    main()
