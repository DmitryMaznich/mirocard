"""Google Photos Library API client — OAuth token refresh + album video
uploads via plain REST calls.

Not using googleapiclient's discovery-based client: the Photos Library API
was pulled from Google's public discovery directory in 2020, so
googleapiclient.discovery.build() can't reach it without a bundled discovery
doc. Plain requests + google-auth token refresh has no such dependency.

Google retired the sharing endpoints (albums.share/.unshare, the
sharedAlbums.* methods, and the photoslibrary.sharing/photoslibrary scopes)
for all apps on 2025-03-31 — see https://developers.google.com/photos/support/updates.
albums.create and mediaItems.batchCreate under photoslibrary.appendonly still
work, so this client creates an ordinary app-owned album and uploads into it;
turning that album into a *shared* one (so teammates can see new uploads) has
to be done once, manually, from the Google Photos app by the album owner.
"""

import logging
import os
from typing import Optional

import requests
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials

log = logging.getLogger(__name__)

SCOPES = [
    'https://www.googleapis.com/auth/photoslibrary.appendonly',
    # Needed only for mediaItems.patch (set_description below) — lets us
    # write a caption ("who sent this") onto items *this app created*.
    # There's no separate "author" field in the API to set instead: Google
    # Photos' native "added by" attribution only exists for items uploaded
    # by different real Google accounts into a shared album, and everything
    # here is uploaded by this one bot account regardless of who sent it in
    # Telegram — description is the only place left to record that.
    'https://www.googleapis.com/auth/photoslibrary.edit.appcreateddata',
    # Needed for mediaItems.search / albums.get to list what this app has
    # already uploaded (used by the backlog-recovery tooling to dedupe
    # against real album contents instead of trusting local logs, which
    # have proven unreliable — they've been lost/truncated by restarts more
    # than once). Read-only, scoped to items this app created, not the
    # whole library.
    'https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata',
]
API_BASE = 'https://photoslibrary.googleapis.com/v1'


class GooglePhotosClient:
    def __init__(self, client_secret_path: str, token_path: str):
        self.client_secret_path = client_secret_path
        self.token_path = token_path
        self._creds: Optional[Credentials] = None

    def _load_credentials(self) -> Credentials:
        if self._creds and self._creds.valid:
            return self._creds
        if not os.path.exists(self.token_path):
            raise RuntimeError(
                f'No saved Google Photos token at {self.token_path}. '
                'Run authorize_google_photos.py once interactively first.'
            )
        creds = Credentials.from_authorized_user_file(self.token_path, SCOPES)
        if creds.expired and creds.refresh_token:
            creds.refresh(GoogleAuthRequest())
            self._save_credentials(creds)
        self._creds = creds
        return creds

    def _save_credentials(self, creds: Credentials) -> None:
        directory = os.path.dirname(self.token_path) or '.'
        os.makedirs(directory, exist_ok=True)
        with open(self.token_path, 'w', encoding='utf-8') as f:
            f.write(creds.to_json())

    def _auth_header(self) -> dict:
        return {'Authorization': f'Bearer {self._load_credentials().token}'}

    def create_album(self, title: str) -> dict:
        """Creates a new album owned by this account. Returns the album
        dict. The album is NOT shared — Google retired the sharing API in
        2025-03; share it manually, once, from the Google Photos app."""
        resp = requests.post(
            f'{API_BASE}/albums',
            headers={**self._auth_header(), 'Content-Type': 'application/json'},
            json={'album': {'title': title}},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()

    def upload_media(self, file_path: str, album_id: str, mime_type: str,
                      filename: Optional[str] = None) -> dict:
        """Uploads a photo or video file and adds it to album_id. album_id
        must be an album this account owns (created via create_album).
        mime_type is whatever Telegram reported for the file (e.g.
        'video/mp4', 'image/jpeg') — Google Photos accepts both photo and
        video content through this same upload+batchCreate flow."""
        filename = filename or os.path.basename(file_path)
        with open(file_path, 'rb') as f:
            upload_resp = requests.post(
                f'{API_BASE}/uploads',
                headers={
                    **self._auth_header(),
                    'Content-Type': 'application/octet-stream',
                    'X-Goog-Upload-Content-Type': mime_type,
                    'X-Goog-Upload-Protocol': 'raw',
                    'X-Goog-Upload-File-Name': filename,
                },
                data=f,
                timeout=600,
            )
        upload_resp.raise_for_status()
        upload_token = upload_resp.text

        create_resp = requests.post(
            f'{API_BASE}/mediaItems:batchCreate',
            headers={**self._auth_header(), 'Content-Type': 'application/json'},
            json={
                'albumId': album_id,
                'newMediaItems': [{
                    'simpleMediaItem': {'fileName': filename, 'uploadToken': upload_token},
                }],
            },
            timeout=60,
        )
        create_resp.raise_for_status()
        item_result = create_resp.json()['newMediaItemResults'][0]
        status = item_result.get('status', {})
        if status.get('code') not in (None, 0):
            raise RuntimeError(f'Google Photos upload failed: {status}')
        return item_result['mediaItem']

    def set_description(self, media_item_id: str, description: str) -> dict:
        """Sets the description (caption) on a media item this app created.
        mediaItems.patch only allows updating 'description' — there's no
        structured field for anything else, including an "author"."""
        resp = requests.patch(
            f'{API_BASE}/mediaItems/{media_item_id}',
            headers={**self._auth_header(), 'Content-Type': 'application/json'},
            params={'updateMask': 'description'},
            json={'description': description},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()
