import { getDb, kv } from '@/core/db';
import { useAppStore } from '@/core/store';
import { accountKv } from '@/topics/accountKv';
import { comparePeopleDocuments } from '../../../shared/my-people-v2.mjs';
import { newId } from './peopleLearning';
const prefix = studentId => `my_people:v2:${studentId}:`;
const cacheKey = (owner, studentId) => `peopleLearning:${owner}:${studentId}`;
export async function loadLearningDocuments(owner, studentId) {
  const db = await getDb(), cache = await kv.get(db, cacheKey(owner, studentId)) ?? {};
  let remote;
  try { remote = await accountKv.list(prefix(studentId)); } catch { return cache; }
  // Do not let an account switch write another account's documents.
  if (useAppStore.getState().account?.id !== owner) return cache;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('keyval', 'readwrite'), values = tx.objectStore('keyval');
    let merged;
    tx.oncomplete = () => resolve(merged);
    tx.onerror = () => reject(tx.error);
    const request = values.get(cacheKey(owner, studentId));
    request.onsuccess = () => {
      merged = { ...(request.result ?? {}) };
      const conflicts = [];
      for (const { key, value } of remote) {
        const local = merged[key];
        if (key.includes(':plan:') && local && Number(value.revision) >= Number(local.revision) && value.id !== local.id && value.parentId !== local.id && local.parentId !== value.id) conflicts.push(key);
        if (comparePeopleDocuments(value, local) > 0) merged[key] = value;
      }
      merged.__conflicts = conflicts;
      values.put(merged, cacheKey(owner, studentId));
    };
  });
}
export const learningDocKey = (studentId, kind, scope) => `${prefix(studentId)}${kind}:${scope}`;
export async function saveLearningDocument(owner, studentId, kind, scope, payload, expectedId) {
  if (useAppStore.getState().account?.id !== owner) throw new Error('Аккаунт изменился. Откройте тему заново.');
  const db = await getDb(), localKey = cacheKey(owner, studentId), key = learningDocKey(studentId, kind, scope);
  // Check the last server-confirmed plan before replacing it; offline changes
  // remain queued and a later conflicting winner is visible on refresh.
  if (kind === 'plan') {
    const docs = await loadLearningDocuments(owner, studentId);
    if ((docs[key]?.id ?? null) !== (expectedId ?? null)) throw new Error('План изменился на другом устройстве. Вернитесь и откройте подготовку заново.');
  }
  if (useAppStore.getState().account?.id !== owner) throw new Error('Аккаунт изменился. Откройте тему заново.');
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['keyval', 'syncQueue'], 'readwrite'), values = tx.objectStore('keyval');
    let saved;
    tx.oncomplete = () => resolve(saved);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Не удалось сохранить план.'));
    const request = values.get(localKey);
    request.onsuccess = () => {
      const docs = request.result ?? {}, previous = docs[key];
      saved = { ...payload, schemaVersion: 2, studentId, id: newId(), parentId: previous?.id ?? null,
        revision: (previous?.revision ?? 0) + 1, updatedAt: new Date().toISOString() };
      values.put({ ...docs, [key]: saved }, localKey);
      tx.objectStore('syncQueue').add({ type: 'kv.upsert', data: { key, value: saved } });
    };
  });
}
export async function loadLearningLocal(owner, studentId) {
  return await kv.get(await getDb(), cacheKey(owner, studentId)) ?? {};
}
