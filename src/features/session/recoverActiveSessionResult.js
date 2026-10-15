import { kv } from "@/core/db";
import { normalizeActiveSessionSnapshot } from "./activeSession";
import { computeSessionRecord } from "./sessionEngine";
import { persistSessionRecord } from "./sessionPersistence";

export async function recoverActiveSessionResult(db, raw, studentIds) {
  const snapshot = normalizeActiveSessionSnapshot(raw);
  if (!snapshot || !studentIds.includes(snapshot.context.studentId)) return null;
  const state = snapshot.sessionState;
  if (!state.id || !state.mode || !state.topicVersion || !state.startedAt) return null;
  if (!(state.correctCount > 0 || state.incorrectCount > 0 || state.taskIndex > 0 || state.assessments?.length > 0)) return null;
  const at = state.lastActivityAt ?? snapshot.updatedAt;
  if (!Number.isFinite(Date.parse(at)) || !Number.isFinite(Date.parse(state.startedAt))) return null;
  // A normal, already checkpointed session requires no historical recovery.
  if (((await kv.get(db, "sessions")) ?? []).some(record => record.id === state.id)) return null;
  const context = snapshot.context;
  const record = computeSessionRecord(state, context.studentId, context.topicId, state.topicVersion, [], {
    recordState: "checkpoint", completionReason: "checkpoint", completedAt: at,
    activeDurationMs: state.persistedActiveDurationMs ?? null,
    elapsedDurationMs: Math.max(0, Date.parse(at) - Date.parse(state.startedAt)),
    paramsSnapshot: state.statistics?.conditions?.params ?? {},
  });
  record.statistics = { ...(record.statistics ?? { schemaVersion: "snapshot-1" }), source: "active_snapshot" };
  return persistSessionRecord(db, record);
}
