import { kv } from "@/core/db";

export const ACTIVE_SESSION_KEY = "activeSession";
export const ACTIVE_SESSION_SCHEMA_VERSION = 1;

export function normalizeActiveSessionSnapshot(raw) {
  if (!raw || typeof raw !== "object") return null;

  const sessionState = raw.sessionState;
  const context = raw.context;

  if (!sessionState || typeof sessionState !== "object") return null;
  if (!context || typeof context !== "object") return null;
  if (!context.studentId || !context.topicId || !context.modeId) return null;
  if (sessionState.status === "completed") return null;

  return {
    schemaVersion: Number(raw.schemaVersion) || ACTIVE_SESSION_SCHEMA_VERSION,
    updatedAt: raw.updatedAt ?? null,
    context: {
      studentId: context.studentId,
      topicId: context.topicId,
      textId: context.textId ?? null,
      modeId: context.modeId,
    },
    sessionState,
  };
}

export function createActiveSessionSnapshot(context, sessionState) {
  return normalizeActiveSessionSnapshot({
    schemaVersion: ACTIVE_SESSION_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    context,
    sessionState,
  });
}

export function restoreActiveSessionState(snapshot, context) {
  const normalized = normalizeActiveSessionSnapshot(snapshot);
  if (!normalized) return null;

  if (normalized.context.studentId !== context.studentId) return null;
  if (normalized.context.topicId !== context.topicId) return null;
  if ((normalized.context.textId ?? null) !== (context.textId ?? null)) return null;
  if (normalized.context.modeId !== context.modeId) return null;
  if (normalized.sessionState.topicVersion !== context.topicVersion) return null;

  return normalized.sessionState;
}

export async function persistActiveSessionSnapshot(db, snapshot) {
  const normalized = normalizeActiveSessionSnapshot(snapshot);
  if (!normalized) {
    await kv.del(db, ACTIVE_SESSION_KEY);
    return;
  }
  await kv.set(db, ACTIVE_SESSION_KEY, normalized);
}

export async function clearActiveSessionSnapshot(db) {
  await kv.del(db, ACTIVE_SESSION_KEY);
}
