# Audio Overrides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users record their own voice for individual recipe steps, stored per account and synced across devices; Web Speech API remains the fallback.

**Architecture:** New `audio_overrides` SQLite table + 4 REST endpoints on the existing Node.js backend; new `audioOverrides` IndexedDB store + `audioStore.js` module on the frontend; `AudioRecordDialog` component wired into `InstructionTask` setup phase; TTS effect updated to prefer recorded audio over Web Speech API.

**Tech Stack:** Node.js native HTTP server (no framework), SQLite `DatabaseSync`, MediaRecorder API, IndexedDB, React

---

## File Map

| File | Change |
|---|---|
| `backend/lib/db.mjs` | Add `audio_overrides` table |
| `backend/lib/http.mjs` | Add `readRawBody`, `writeAudio` helpers |
| `backend/server.mjs` | Add 4 handlers + 4 routes + imports |
| `src/core/db.js` | Bump DB_VERSION 2→3, add `audioOverrides` store + `audio` helpers |
| `src/core/api.js` | Add `getApiToken()` export |
| `src/core/audioStore.js` | New module — CRUD + server sync |
| `src/topics/renderers/reading/AudioRecordDialog.jsx` | New component — MediaRecorder UI |
| `src/topics/renderers/reading/index.jsx` | Audio section in setup phase + playback override |
| `src/styles.css` | New CSS for audio section and dialog |

---

## Task 1: Backend — DB schema

**Files:**
- Modify: `backend/lib/db.mjs`

- [ ] **Step 1: Add `audio_overrides` table to the `db.exec()` call**

Open `backend/lib/db.mjs`. Inside the big template-literal passed to `db.exec(...)` (after the `photos` table definition, before the closing backtick), add:

```sql
    CREATE TABLE IF NOT EXISTS audio_overrides (
      account_id   TEXT    NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      topic_id     TEXT    NOT NULL,
      text_id      TEXT    NOT NULL,
      step_num     INTEGER NOT NULL,
      audio_data   BLOB    NOT NULL,
      content_type TEXT    NOT NULL DEFAULT 'audio/webm;codecs=opus',
      byte_size    INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL,
      PRIMARY KEY (account_id, topic_id, text_id, step_num)
    );
    CREATE INDEX IF NOT EXISTS idx_audio_overrides_lookup
      ON audio_overrides(account_id, topic_id, text_id);
```

- [ ] **Step 2: Start backend to verify no SQL errors**

```bash
cd c:/Users/dmazn/Projects/Mirocard2
node backend/server.mjs
```

Expected: `Mirocard2 backend running on port 3012` — no errors. Then Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add backend/lib/db.mjs
git commit -m "feat(backend): add audio_overrides table"
```

---

## Task 2: Backend — raw body helpers

**Files:**
- Modify: `backend/lib/http.mjs`

- [ ] **Step 1: Add `readRawBody` and `writeAudio` to the bottom of the file**

```js
export async function readRawBody(request, maxBytes = 2 * 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBytes) throw { status: 413, message: "Payload too large" };
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function writeAudio(response, audioBuffer, contentType) {
  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": audioBuffer.length,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  response.end(audioBuffer);
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/lib/http.mjs
git commit -m "feat(backend): add readRawBody and writeAudio helpers"
```

---

## Task 3: Backend — API handlers

**Files:**
- Modify: `backend/server.mjs`

- [ ] **Step 1: Add `readRawBody` and `writeAudio` to the import from `./lib/http.mjs`**

Find the existing import line (around line 30):
```js
import { writeJson, writeNoContent, readJsonBody, getBearerToken } from "./lib/http.mjs";
```
Change it to:
```js
import { writeJson, writeNoContent, readJsonBody, readRawBody, writeAudio, getBearerToken } from "./lib/http.mjs";
```

- [ ] **Step 2: Add the four handler functions before the `// ─── Router` comment**

Paste this block immediately before the `// ─── Router` line:

```js
// ─── Audio Overrides ──────────────────────────────────────────────────────────

async function handleListAudioOverrides(req, res) {
  const account = requireAuth(req);
  const url = new URL(req.url, "http://localhost");
  const topicId = url.searchParams.get("topicId");
  const textId  = url.searchParams.get("textId");
  if (!topicId || !textId) throw { status: 400, message: "topicId and textId required" };
  const rows = db.prepare(
    "SELECT step_num, byte_size, updated_at FROM audio_overrides WHERE account_id=? AND topic_id=? AND text_id=?"
  ).all(account.id, topicId, textId);
  writeJson(res, 200, rows.map((r) => ({ stepNum: r.step_num, byteSize: r.byte_size, updatedAt: r.updated_at })));
}

async function handlePutAudioOverride(req, res) {
  const account = requireAuth(req);
  const parts = normalizeApiPath(new URL(req.url, "http://localhost").pathname).split("/").filter(Boolean);
  // parts: ["audio-overrides", topicId, textId, stepNum]
  const [, topicId, textId, stepNumStr] = parts;
  const stepNum = parseInt(stepNumStr, 10);
  if (!topicId || !textId || isNaN(stepNum)) throw { status: 400, message: "Invalid path" };
  const body = await readRawBody(req, 2 * 1024 * 1024);
  if (body.length === 0) throw { status: 400, message: "Empty body" };
  const contentType = req.headers["content-type"] || "audio/webm;codecs=opus";
  const now = Date.now();
  db.prepare(`
    INSERT INTO audio_overrides(account_id, topic_id, text_id, step_num, audio_data, content_type, byte_size, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id, topic_id, text_id, step_num)
    DO UPDATE SET audio_data=excluded.audio_data, content_type=excluded.content_type,
                  byte_size=excluded.byte_size, updated_at=excluded.updated_at
  `).run(account.id, topicId, textId, stepNum, body, contentType, body.length, now);
  writeJson(res, 200, { ok: true, byteSize: body.length, updatedAt: now });
}

async function handleGetAudioOverrideData(req, res) {
  const account = requireAuth(req);
  const parts = normalizeApiPath(new URL(req.url, "http://localhost").pathname).split("/").filter(Boolean);
  // parts: ["audio-overrides", topicId, textId, stepNum, "data"]
  const [, topicId, textId, stepNumStr] = parts;
  const stepNum = parseInt(stepNumStr, 10);
  if (!topicId || !textId || isNaN(stepNum)) throw { status: 400, message: "Invalid path" };
  const row = db.prepare(
    "SELECT audio_data, content_type FROM audio_overrides WHERE account_id=? AND topic_id=? AND text_id=? AND step_num=?"
  ).get(account.id, topicId, textId, stepNum);
  if (!row) throw { status: 404, message: "Not found" };
  writeAudio(res, row.audio_data, row.content_type);
}

async function handleDeleteAudioOverride(req, res) {
  const account = requireAuth(req);
  const parts = normalizeApiPath(new URL(req.url, "http://localhost").pathname).split("/").filter(Boolean);
  // parts: ["audio-overrides", topicId, textId, stepNum]
  const [, topicId, textId, stepNumStr] = parts;
  const stepNum = parseInt(stepNumStr, 10);
  if (!topicId || !textId || isNaN(stepNum)) throw { status: 400, message: "Invalid path" };
  db.prepare(
    "DELETE FROM audio_overrides WHERE account_id=? AND topic_id=? AND text_id=? AND step_num=?"
  ).run(account.id, topicId, textId, stepNum);
  writeJson(res, 200, { ok: true });
}
```

- [ ] **Step 3: Add the four routes to the router dispatch table**

Find the `// Sync` block in the router:
```js
    // Sync
    if (method === "POST"   && p === "/sync")                     return await handleSync(req, res);
```

Add immediately after it:
```js
    // Audio overrides
    if (method === "GET"    && p === "/audio-overrides")                                        return await handleListAudioOverrides(req, res);
    if (method === "PUT"    && /^\/audio-overrides\/[^/]+\/[^/]+\/\d+$/.test(p))               return await handlePutAudioOverride(req, res);
    if (method === "GET"    && /^\/audio-overrides\/[^/]+\/[^/]+\/\d+\/data$/.test(p))         return await handleGetAudioOverrideData(req, res);
    if (method === "DELETE" && /^\/audio-overrides\/[^/]+\/[^/]+\/\d+$/.test(p))               return await handleDeleteAudioOverride(req, res);
```

- [ ] **Step 4: Start backend and smoke-test with curl**

```bash
node backend/server.mjs &
# Login to get a token first, then:
curl -s http://localhost:3012/audio-overrides?topicId=test&textId=test \
  -H "Authorization: Bearer <your-token>"
# Expected: []
```

(Or simply verify server starts without errors, and trust the route matching.)

- [ ] **Step 5: Commit**

```bash
git add backend/server.mjs
git commit -m "feat(backend): add audio-overrides CRUD endpoints"
```

---

## Task 4: Frontend — IndexedDB store

**Files:**
- Modify: `src/core/db.js`

- [ ] **Step 1: Bump `DB_VERSION` from 2 to 3**

```js
const DB_VERSION = 3;
```

- [ ] **Step 2: Add `audioOverrides` store creation inside `onupgradeneeded`**

After the existing `syncQueue` store creation block, add:
```js
      if (!db.objectStoreNames.contains("audioOverrides")) {
        db.createObjectStore("audioOverrides");
      }
```

- [ ] **Step 3: Add `audio` helpers at the bottom of the file, after the `topics` export**

```js
// ─── audioOverrides helpers ───────────────────────────────────────────────────

export const audio = {
  get: (db, key) => req2p(tx(db, "audioOverrides", "readonly").get(key)),
  set: (db, key, value) => req2p(tx(db, "audioOverrides", "readwrite").put(value, key)),
  del: (db, key) => req2p(tx(db, "audioOverrides", "readwrite").delete(key)),

  getByPrefix(db, prefix) {
    return new Promise((resolve, reject) => {
      const store = tx(db, "audioOverrides", "readonly");
      const range = IDBKeyRange.bound(prefix, prefix + "￿", false, false);
      const results = [];
      const req = store.openCursor(range);
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { results.push({ key: String(cursor.key), value: cursor.value }); cursor.continue(); }
        else resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add src/core/db.js
git commit -m "feat(db): add audioOverrides IndexedDB store"
```

---

## Task 5: Frontend — API token export

**Files:**
- Modify: `src/core/api.js`

- [ ] **Step 1: Add `_currentToken` variable and update `setApiToken` and add `getApiToken`**

Replace the current:
```js
// Singleton instance — updated when token changes
let _api = createApiClient();

export function setApiToken(token) {
  _api = createApiClient({ token });
}
```

With:
```js
// Singleton instance — updated when token changes
let _api = createApiClient();
let _currentToken = null;

export function setApiToken(token) {
  _currentToken = token;
  _api = createApiClient({ token });
}

export function getApiToken() {
  return _currentToken;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/api.js
git commit -m "feat(api): export getApiToken for binary fetch calls"
```

---

## Task 6: Frontend — audioStore.js

**Files:**
- Create: `src/core/audioStore.js`

- [ ] **Step 1: Create the file**

```js
import { getDb, audio as audioDB } from "@/core/db";
import { api, getApiToken } from "@/core/api";

const audioKey    = (topicId, textId, stepNum) => `${topicId}:${textId}:${stepNum}`;
const audioPrefix = (topicId, textId)          => `${topicId}:${textId}:`;

/** Get cached audio Blob for a step, or null if not recorded. */
export async function getAudioOverride(topicId, textId, stepNum) {
  const db = await getDb();
  const entry = await audioDB.get(db, audioKey(topicId, textId, stepNum));
  return entry?.blob ?? null;
}

/** List all locally cached audio overrides for a text. */
export async function listLocalAudioOverrides(topicId, textId) {
  const db = await getDb();
  const entries = await audioDB.getByPrefix(db, audioPrefix(topicId, textId));
  return entries.map(({ key, value }) => ({
    stepNum: parseInt(key.split(":")[2], 10),
    blob: value.blob,
    updatedAt: value.updatedAt,
    synced: value.synced,
  }));
}

/** Save a recorded Blob locally and attempt to upload to server. */
export async function saveAudioOverride(topicId, textId, stepNum, blob) {
  const db = await getDb();
  const updatedAt = Date.now();
  await audioDB.set(db, audioKey(topicId, textId, stepNum), { blob, updatedAt, synced: false });
  try {
    await uploadAudio(topicId, textId, stepNum, blob, updatedAt);
  } catch {
    // stays synced:false, will retry on next saveAudioOverride or manual sync
  }
}

/** Delete locally and on server. */
export async function deleteAudioOverride(topicId, textId, stepNum) {
  const db = await getDb();
  await audioDB.del(db, audioKey(topicId, textId, stepNum));
  await api.delete(`/audio-overrides/${encodeURIComponent(topicId)}/${encodeURIComponent(textId)}/${stepNum}`).catch(() => {});
}

async function uploadAudio(topicId, textId, stepNum, blob, updatedAt) {
  const token = getApiToken();
  const headers = { "Content-Type": blob.type || "audio/webm;codecs=opus" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(
    `/api/audio-overrides/${encodeURIComponent(topicId)}/${encodeURIComponent(textId)}/${stepNum}`,
    { method: "PUT", headers, body: blob }
  );
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const db = await getDb();
  await audioDB.set(db, audioKey(topicId, textId, stepNum), { blob, updatedAt, synced: true });
}

/**
 * Fetch server manifest and download any steps missing or outdated locally.
 * Called on topic open to pull recordings from other devices.
 */
export async function syncAudioOverrides(topicId, textId) {
  let manifest;
  try {
    manifest = await api.get(
      `/audio-overrides?topicId=${encodeURIComponent(topicId)}&textId=${encodeURIComponent(textId)}`
    );
  } catch {
    return; // offline or server error — skip
  }

  const db = await getDb();
  for (const { stepNum, updatedAt } of manifest) {
    const local = await audioDB.get(db, audioKey(topicId, textId, stepNum));
    if (local && local.updatedAt >= updatedAt) continue;
    try {
      const token = getApiToken();
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(
        `/api/audio-overrides/${encodeURIComponent(topicId)}/${encodeURIComponent(textId)}/${stepNum}/data`,
        { headers }
      );
      if (!res.ok) continue;
      const blob = await res.blob();
      await audioDB.set(db, audioKey(topicId, textId, stepNum), { blob, updatedAt, synced: true });
    } catch {}
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/audioStore.js
git commit -m "feat(audioStore): CRUD + server sync for audio overrides"
```

---

## Task 7: Frontend — AudioRecordDialog component

**Files:**
- Create: `src/topics/renderers/reading/AudioRecordDialog.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { useState, useRef, useEffect } from "react";
import Modal from "@/shared/components/Modal";
import { getAudioOverride, saveAudioOverride, deleteAudioOverride } from "@/core/audioStore";

export default function AudioRecordDialog({ topicId, textId, stepNum, stepText, onClose, onSaved, onDeleted }) {
  // state: "loading" | "idle" | "recording" | "done" | "existing"
  const [state, setState] = useState("loading");
  const [recBlob, setRecBlob]       = useState(null);
  const [existingBlob, setExisting] = useState(null);
  const [recSeconds, setRecSeconds] = useState(0);
  const [saving, setSaving]         = useState(false);
  const mediaRecRef = useRef(null);
  const chunksRef   = useRef([]);
  const timerRef    = useRef(null);

  useEffect(() => {
    getAudioOverride(topicId, textId, stepNum).then((blob) => {
      if (blob) { setExisting(blob); setState("existing"); }
      else setState("idle");
    });
    return () => {
      clearInterval(timerRef.current);
      mediaRecRef.current?.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function startRecording() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      alert("Нет доступа к микрофону");
      return;
    }
    chunksRef.current = [];
    const mr = new MediaRecorder(stream, { audioBitsPerSecond: 16000 });
    mr.stream = stream;
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
      setRecBlob(blob);
      setState("done");
      clearInterval(timerRef.current);
    };
    mr.start(100);
    mediaRecRef.current = mr;
    setRecSeconds(0);
    setState("recording");
    timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    mediaRecRef.current?.stop();
  }

  function playBlob(blob) {
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    a.onended = () => URL.revokeObjectURL(url);
    a.play();
  }

  async function handleSave() {
    setSaving(true);
    await saveAudioOverride(topicId, textId, stepNum, recBlob);
    setSaving(false);
    onSaved?.(`s${stepNum}`);
  }

  async function handleDelete() {
    await deleteAudioOverride(topicId, textId, stepNum);
    onDeleted?.(`s${stepNum}`);
  }

  const mm = String(Math.floor(recSeconds / 60)).padStart(2, "0");
  const ss = String(recSeconds % 60).padStart(2, "0");

  return (
    <Modal title={`Шаг ${stepNum}`} onClose={onClose}>
      <div className="audio-dialog">
        <div className="audio-dialog-step-text">{stepText}</div>

        {state === "loading" && (
          <p className="audio-dialog-hint">Загрузка…</p>
        )}

        {state === "idle" && (
          <button className="audio-dialog-btn audio-dialog-btn--record" onClick={startRecording}>
            🎙 Начать запись
          </button>
        )}

        {state === "recording" && (
          <div className="audio-dialog-recording">
            <span className="audio-dialog-timer">{mm}:{ss}</span>
            <button className="audio-dialog-btn audio-dialog-btn--stop" onClick={stopRecording}>
              ⏹ Стоп
            </button>
          </div>
        )}

        {state === "done" && (
          <div className="audio-dialog-row">
            <button className="audio-dialog-btn" onClick={() => playBlob(recBlob)}>▶ Прослушать</button>
            <button className="audio-dialog-btn" onClick={() => { setRecBlob(null); setState("idle"); }}>× Перезаписать</button>
            <button className="audio-dialog-btn audio-dialog-btn--save" onClick={handleSave} disabled={saving}>
              {saving ? "Сохранение…" : "✓ Сохранить"}
            </button>
          </div>
        )}

        {state === "existing" && (
          <div className="audio-dialog-row">
            <button className="audio-dialog-btn" onClick={() => playBlob(existingBlob)}>▶ Текущая</button>
            <button className="audio-dialog-btn audio-dialog-btn--record" onClick={startRecording}>🎙 Перезаписать</button>
            <button className="audio-dialog-btn audio-dialog-btn--delete" onClick={handleDelete}>🗑 Удалить</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/topics/renderers/reading/AudioRecordDialog.jsx
git commit -m "feat(reading): AudioRecordDialog component with MediaRecorder"
```

---

## Task 8: Frontend — InstructionTask integration

**Files:**
- Modify: `src/topics/renderers/reading/index.jsx`

- [ ] **Step 1: Add imports at the top of the file**

After the existing imports, add:
```js
import { getAudioOverride, listLocalAudioOverrides, syncAudioOverrides } from "@/core/audioStore";
import AudioRecordDialog from "./AudioRecordDialog";
```

- [ ] **Step 2: Add state variables inside `InstructionTask`, after existing setup-phase state**

After `const memberPhotoRef = useRef(null);`, add:
```js
  const [recordedSteps, setRecordedSteps] = useState(new Set()); // step ids like "s1"
  const [audioDialogStep, setAudioDialogStep] = useState(null);  // {id, num, text} | null
```

- [ ] **Step 3: Update the load `useEffect` to also load audio overrides and trigger sync**

Find the existing `load()` function inside the `useEffect`. After `setGroup(grp ?? [])` and the rawText block, add:

```js
      // Load local audio overrides + sync from server
      const textId = task.text?.id ?? "";
      const overrides = await listLocalAudioOverrides(topicId, textId).catch(() => []);
      setRecordedSteps(new Set(overrides.map((o) => `s${o.stepNum}`)));
      syncAudioOverrides(topicId, textId)
        .then(() => listLocalAudioOverrides(topicId, textId))
        .then((ovrs) => setRecordedSteps(new Set(ovrs.map((o) => `s${o.stepNum}`))))
        .catch(() => {});
```

- [ ] **Step 4: Update the TTS `useEffect` in the running phase to prefer audio overrides**

Find:
```js
  useEffect(() => {
    if (phase !== "running" || !step) return;
    const text = owner?.name ? `${owner.name}. ${step.text}` : step.text;
    speak(text);
  }, [stepIndex, steps, phase]); // eslint-disable-line react-hooks/exhaustive-deps
```

Replace with:
```js
  useEffect(() => {
    if (phase !== "running" || !step) return;
    const textId  = task.text?.id ?? "";
    const stepNum = step.id?.startsWith("s") ? parseInt(step.id.slice(1), 10) : null;
    let cancelled = false;
    if (textId && stepNum != null) {
      getAudioOverride(topicId, textId, stepNum).then((blob) => {
        if (cancelled) return;
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = new Audio(url);
          a.onended = () => URL.revokeObjectURL(url);
          a.play();
        } else {
          const text = owner?.name ? `${owner.name}. ${step.text}` : step.text;
          speak(text);
        }
      });
    } else {
      const text = owner?.name ? `${owner.name}. ${step.text}` : step.text;
      speak(text);
    }
    return () => { cancelled = true; };
  }, [stepIndex, steps, phase]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 5: Update `reSpeak` to also prefer audio overrides**

Find:
```js
  const reSpeak = useCallback(() => {
    if (!step) return;
    const text = owner?.name ? `${owner.name}. ${step.text}` : step.text;
    speak(text);
  }, [step, owner, speak]);
```

Replace with:
```js
  const reSpeak = useCallback(() => {
    if (!step) return;
    const textId  = task.text?.id ?? "";
    const stepNum = step.id?.startsWith("s") ? parseInt(step.id.slice(1), 10) : null;
    if (textId && stepNum != null) {
      getAudioOverride(topicId, textId, stepNum).then((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = new Audio(url);
          a.onended = () => URL.revokeObjectURL(url);
          a.play();
        } else {
          const text = owner?.name ? `${owner.name}. ${step.text}` : step.text;
          speak(text);
        }
      });
    } else {
      const text = owner?.name ? `${owner.name}. ${step.text}` : step.text;
      speak(text);
    }
  }, [step, owner, speak, topicId, task.text?.id]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 6: Add the audio section to the setup phase JSX**

In the setup phase JSX, find the "Изменить текст инструкции" button:
```jsx
        <button
          className="instruction-cover-edit-recipe"
          onClick={() => { setRecipeEdit(rawRecipe); setEditingRecipe(true); }}
        >
          Изменить текст инструкции
        </button>
```

Insert immediately after that button:
```jsx
        {baseSteps.some((s) => s.type !== "heading") && (
          <div className="instruction-cover-section">
            <div className="instruction-cover-section-label">Аудио шагов</div>
            <div className="instruction-audio-list">
              {baseSteps.filter((s) => s.type !== "heading").map((s) => {
                const num = parseInt(s.id.slice(1), 10);
                const hasAudio = recordedSteps.has(s.id);
                return (
                  <button
                    key={s.id}
                    className={`instruction-audio-item${hasAudio ? " instruction-audio-item--recorded" : ""}`}
                    onClick={() => setAudioDialogStep({ id: s.id, num, text: s.text })}
                  >
                    <span className="instruction-audio-num">{num}</span>
                    <span className="instruction-audio-text">
                      {s.text.length > 55 ? s.text.slice(0, 55) + "…" : s.text}
                    </span>
                    {hasAudio && <span className="instruction-audio-dot" aria-label="записано" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {audioDialogStep && (
          <AudioRecordDialog
            topicId={topicId}
            textId={task.text?.id ?? ""}
            stepNum={audioDialogStep.num}
            stepText={audioDialogStep.text}
            onClose={() => setAudioDialogStep(null)}
            onSaved={(stepId) => {
              setRecordedSteps((prev) => new Set([...prev, stepId]));
              setAudioDialogStep(null);
            }}
            onDeleted={(stepId) => {
              setRecordedSteps((prev) => { const n = new Set(prev); n.delete(stepId); return n; });
              setAudioDialogStep(null);
            }}
          />
        )}
```

- [ ] **Step 7: Commit**

```bash
git add src/topics/renderers/reading/index.jsx
git commit -m "feat(reading): audio overrides section in setup + playback priority"
```

---

## Task 9: Frontend — CSS

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add styles at the end of the file (before the final closing line if any)**

```css
/* ─── Audio step overrides ──────────────────────────────────────────────────── */

.instruction-audio-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.instruction-audio-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  background: #f7f7f7;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  font-size: 14px;
  color: #333;
  transition: background 0.12s;
}

.instruction-audio-item:active {
  background: #eef2ff;
}

.instruction-audio-item--recorded {
  border-color: #b3c8f5;
  background: #f0f4ff;
}

.instruction-audio-num {
  flex-shrink: 0;
  min-width: 24px;
  font-weight: 700;
  color: #888;
  font-size: 13px;
}

.instruction-audio-text {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.instruction-audio-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary, #5b8def);
}

/* ─── Audio record dialog ────────────────────────────────────────────────────── */

.audio-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0 8px;
  min-width: 260px;
}

.audio-dialog-step-text {
  font-size: 15px;
  color: #222;
  line-height: 1.45;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 8px;
}

.audio-dialog-hint {
  color: #aaa;
  font-size: 14px;
  text-align: center;
}

.audio-dialog-recording {
  display: flex;
  align-items: center;
  gap: 14px;
}

.audio-dialog-timer {
  font-size: 22px;
  font-weight: 700;
  color: #e55;
  font-variant-numeric: tabular-nums;
  min-width: 50px;
}

.audio-dialog-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.audio-dialog-btn {
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid #ddd;
  background: #f5f5f5;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
}

.audio-dialog-btn--record {
  background: #fff0f0;
  border-color: #f5b8b8;
  color: #c33;
}

.audio-dialog-btn--stop {
  background: #fff0f0;
  border-color: #f5b8b8;
  color: #c33;
}

.audio-dialog-btn--save {
  background: var(--color-primary, #5b8def);
  border-color: var(--color-primary, #5b8def);
  color: #fff;
}

.audio-dialog-btn--save:disabled {
  opacity: 0.5;
  cursor: default;
}

.audio-dialog-btn--delete {
  background: #fff5f5;
  border-color: #f5c0c0;
  color: #b33;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "feat(styles): audio step list and record dialog CSS"
```

---

## Task 10: Build and deploy

- [ ] **Step 1: Build**

```bash
cd c:/Users/dmazn/Projects/Mirocard2
npm run build
```

Expected: `✓ built in ~700ms` — no errors.

- [ ] **Step 2: Deploy**

```bash
npm run deploy:prod
```

Expected: `deploy target is consistent.` with new version number.

- [ ] **Step 3: Verify on device**

1. Open the app on the phone, navigate to "Чтение. Готовим еду" → любой рецепт
2. На экране настройки появился раздел "Аудио шагов" со списком пронумерованных шагов
3. Тапнуть любой шаг → открывается диалог с текстом шага и кнопкой "🎙 Начать запись"
4. Записать → прослушать → сохранить → на строке появляется синяя точка
5. Нажать "Начать" → шаги воспроизводятся: записанный шаг — голосом, остальные — Web Speech API
6. Открыть на другом устройстве с тем же аккаунтом → синяя точка появляется и там, воспроизведение тоже работает
