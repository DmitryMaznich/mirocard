"""Google Photos Library API client — OAuth token refresh + shared-album
video uploads via plain REST calls.

Not using googleapiclient's discovery-based client: the Photos Library API
was pulled from Google's public discovery directory in 2020, so
googleapiclient.discovery.build() can't reach it without a bundled discovery
doc. Plain requests + google-auth token refresh has no such dependency.
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
    'https://www.googleapis.com/auth/photoslibrary.sharing',
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

    def create_shared_album(self, title: str) -> dict:
        """Creates a new album owned by this account and shares it. Returns
        the album dict, including shareInfo.shareableUrl for inviting
        teammates (they join it from their own Google Photos app)."""
        resp = requests.post(
            f'{API_BASE}/albums',
            headers={**self._auth_header(), 'Content-Type': 'application/json'},
            json={'album': {'title': title}},
            timeout=30,
        )
        resp.raise_for_status()
        album = resp.json()

        share_resp = requests.post(
            f'{API_BASE}/albums/{album["id"]}:share',
            headers={**self._auth_header(), 'Content-Type': 'application/json'},
            json={'sharedAlbumOptions': {'isCollaborative': False, 'isCommentable': True}},
            timeout=30,
        )
        share_resp.raise_for_status()
        album['shareInfo'] = share_resp.json().get('shareInfo')
        return album

    def upload_video(self, file_path: str, album_id: str, filename: Optional[str] = None) -> dict:
        """Uploads a video file and adds it to album_id. album_id must be an
        album this account owns (created via create_shared_album)."""
        filename = filename or os.path.basename(file_path)
        with open(file_path, 'rb') as f:
            upload_resp = requests.post(
                f'{API_BASE}/uploads',
                headers={
                    **self._auth_header(),
                    'Content-Type': 'application/octet-stream',
                    'X-Goog-Upload-Content-Type': 'video/mp4',
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
