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
  if (Array.isArray(sessionState.tasks) && sessionState.tasks.length === 0) return null;

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

// A persisted snapshot can be arbitrarily stale (e.g. the app crashed/
// reloaded before the user picked anything new, leaving whatever topic/text
// was active from an unrelated earlier session). Booting straight into
// "session" for a topic/text that no longer resolves used to silently fall
// back to the first topic and its first text — this checks the snapshot's
// topic and text still exist in the current topicRecords before trusting it.
export function canResumeActiveSession(activeSession, topicRecords) {
  if (!activeSession?.sessionState) return false;
  // Recipe cooking (follow_instruction) must never auto-resume — always
  // started intentionally from the planner, not on any app restart.
  if (activeSession.context?.modeId === "follow_instruction") return false;
  const { topicId, textId } = activeSession.context;
  const record = (topicRecords ?? []).find((r) => r.meta?.id === topicId);
  if (!record) return false;
  if (textId && !(record.texts ?? []).some((t) => t.id === textId)) return false;
  return true;
}
