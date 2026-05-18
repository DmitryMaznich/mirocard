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
    // stays synced:false, will retry on next saveAudioOverride
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
