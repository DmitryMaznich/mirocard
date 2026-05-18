# Audio Overrides — Design Spec

**Date:** 2026-05-18  
**Feature:** Per-step voice recording overrides for instruction recipes  
**Scope:** InstructionTask (reading renderer) + backend audio storage + cross-device sync

---

## Problem

Web Speech API pronunciations are sometimes unacceptable for specific steps. Users need a way to record their own voice for individual steps and have those recordings available on all their devices.

---

## Solution Overview

- Web Speech API remains the default for all steps (zero setup, works immediately)
- Users can optionally record audio for any step where TTS is inadequate
- Recordings are stored in IndexedDB locally and synced to the backend per account
- On another device, recordings are fetched on demand when a topic is opened
- Playback: recorded audio takes priority over Web Speech API; fallback to TTS if no recording

---

## Data Model

### Backend — new SQLite table

```sql
CREATE TABLE IF NOT EXISTS audio_overrides (
  account_id   TEXT    NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  topic_id     TEXT    NOT NULL,
  text_id      TEXT    NOT NULL,
  step_num     INTEGER NOT NULL,
  audio_data   BLOB    NOT NULL,
  content_type TEXT    NOT NULL DEFAULT 'audio/webm;codecs=opus',
  byte_size    INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,   -- Unix ms
  PRIMARY KEY (account_id, topic_id, text_id, step_num)
);
```

Audio is stored as raw binary (BLOB). No base64 encoding in the DB. Content-Type is always `audio/webm;codecs=opus` (Chrome/Android MediaRecorder default).

### Frontend — new IndexedDB store `audioOverrides`

Added to `db.mjs` as store #4 (DB_VERSION bump to 3):

```
key:   "{topicId}:{textId}:{stepNum}"   (string)
value: { blob: Blob, updatedAt: number, synced: boolean }
```

`synced: false` means not yet uploaded to server (e.g., recorded while offline).

---

## API Endpoints

All require `Authorization: Bearer <token>`.

### GET /audio-overrides

Query params: `topicId`, `textId`

Returns manifest only (no audio data):
```json
[
  { "stepNum": 2, "byteSize": 8192, "updatedAt": 1716030000000 },
  { "stepNum": 5, "byteSize": 9500, "updatedAt": 1716031000000 }
]
```

### PUT /audio-overrides/:topicId/:textId/:stepNum

Body: raw binary audio (`Content-Type: audio/webm;codecs=opus`)  
Response: `{ ok: true, byteSize: N, updatedAt: N }`

Max upload size: 2 MB per step (enforced server-side).

### DELETE /audio-overrides/:topicId/:textId/:stepNum

Response: `{ ok: true }`

### GET /audio-overrides/:topicId/:textId/:stepNum/data

Returns raw audio binary with correct `Content-Type` header.  
Used when downloading a step's audio to another device.

---

## Sync Strategy

**Eager push (upload):**
- User saves a recording → immediately `PUT` to server
- If offline or request fails → store with `synced: false` in IndexedDB
- On `online` event or next app visibility → flush all `synced: false` entries

**Lazy pull (download):**
- When InstructionTask mounts → `GET /audio-overrides?topicId=X&textId=Y`
- Compare each `{ stepNum, updatedAt }` against local IndexedDB
- Download only entries missing or older locally
- Store downloaded audio as `synced: true`

**Conflict resolution:** Last-write-wins per `(account_id, topic_id, text_id, step_num)`. No merging.

---

## New Module: `src/core/audioStore.js`

Responsibilities:
- `getAudioOverride(topicId, textId, stepNum)` → `Blob | null` from IndexedDB
- `saveAudioOverride(topicId, textId, stepNum, blob)` → write to IndexedDB + attempt upload
- `deleteAudioOverride(topicId, textId, stepNum)` → remove from IndexedDB + DELETE to server
- `listAudioOverrides(topicId, textId)` → `{ stepNum, blob, synced }[]` from IndexedDB
- `syncAudioOverrides(topicId, textId)` → fetch manifest, download missing/stale entries
- `flushUnsynced()` → upload all `synced: false` entries (called on reconnect)

---

## UI — Setup Phase Addition

A new collapsible section **"Аудио шагов"** appears in the setup phase of `InstructionTask`, below the recipe editor.

### Step list

Each row shows:
- Step number
- First ~40 chars of step text (truncated)
- Blue dot indicator if a recording exists for this step

```
Аудио шагов
┌─────────────────────────────────────┐
│ ●  1   Возьмите кастрюлю…           │
│     2   Налейте воду в кастрюлю…    │
│ ●  3   Поставьте на плиту…          │
│    ...                              │
└─────────────────────────────────────┘
```

Tapping any row opens the **recording dialog**.

### Recording dialog

Shows step number, full step text, and recording controls.

**State: no existing recording**
```
Шаг 2 · "Налейте воду в кастрюлю"
[ 🎙 Начать запись ]
```

**State: recording in progress**
```
Шаг 2 · "Налейте воду в кастрюлю"
● 0:03  [ ⏹ Остановить ]
```

**State: recording done, not yet saved**
```
Шаг 2 · "Налейте воду в кастрюлю"
[ ▶ Прослушать ]  [ × Перезаписать ]  [ ✓ Сохранить ]
```

**State: existing recording**
```
Шаг 2 · "Налейте воду в кастрюлю"
[ ▶ Текущая запись ]  [ 🎙 Перезаписать ]  [ 🗑 Удалить ]
```

On **Сохранить**: blob → IndexedDB → attempt upload → close dialog → dot appears on row.  
On **Удалить**: remove from IndexedDB → DELETE to server → close dialog → dot disappears.

---

## Playback Integration

In `InstructionTask` running phase, `playStep(stepNum)` function:

```js
async function playStep(stepNum) {
  const override = await getAudioOverride(topicId, textId, stepNum);
  if (override) {
    const url = URL.createObjectURL(override);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play();
  } else {
    speak(step.text);
  }
}
```

Called on step change (same trigger as current `speak()` call). No other changes to session logic.

---

## Backend Changes

### `backend/lib/db.mjs`
- Add `CREATE TABLE IF NOT EXISTS audio_overrides (...)` to schema init
- Add index: `CREATE INDEX IF NOT EXISTS idx_audio_overrides_account ON audio_overrides(account_id, topic_id, text_id)`

### `backend/server.mjs`
- Add 4 new route handlers (list, upload, download, delete)
- Add to route dispatch table
- Enforce 2 MB max body size on PUT endpoint

---

## Files Changed

| File | Change |
|---|---|
| `backend/lib/db.mjs` | New table + index |
| `backend/server.mjs` | 4 new endpoints |
| `src/core/db.js` | New `audioOverrides` store, DB_VERSION 2→3 |
| `src/core/audioStore.js` | New module (CRUD + sync) |
| `src/topics/renderers/reading/index.jsx` | Audio section in setup, playStep() override |

No changes to: ZIP format, topic.json, parseRecipeTxt, groupStore, styles (minor additions only).

---

## Out of Scope

- Group member name recordings (separate feature, same architecture)
- TTS API integration (not needed)
- Audio compression beyond MediaRecorder defaults
- Per-device recording history / audit log
