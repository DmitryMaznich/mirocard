import { aggregateStatistics } from "../../shared/session-statistics.mjs";
import { recoverHistoricalSession, mergeSessionHistory, sameSessionIdentity } from "../../shared/historical-session-statistics.mjs";
import { appendSession } from "./account-repository.mjs";

function parse(value, fallback) {
  try { return value == null ? fallback : JSON.parse(value); } catch { return fallback; }
}

export function sessionToApi(row) {
  const statistics = parse(row.statistics_json, null);
  return recoverHistoricalSession({
    id: row.id, studentId: row.student_id, topicId: row.topic_id, topicVersion: row.topic_version,
    mode: row.mode, modeId: row.mode, startedAt: row.started_at, completedAt: row.completed_at,
    correctCount: row.correct_count, incorrectCount: row.incorrect_count, percentCorrect: row.percent_correct,
    mistakes: parse(row.mistakes, []), cardEvents: parse(row.card_events, []), assessments: parse(row.assessments, []),
    activeDurationMs: row.active_duration_ms, elapsedDurationMs: row.elapsed_duration_ms,
    paramsSnapshot: parse(row.params_snapshot, null), statistics,
    conceptIds: statistics?.conditions?.conceptIds, textId: statistics?.conditions?.textId ?? undefined,
    completionReason: row.completion_reason, entryPoint: row.entry_point, createdAt: row.created_at,
  });
}

export function getSessionStatistics(db, accountId, filters) {
  // No history limit: the recent-200 client cache must never become an all-time
  // result. Old events are used only to verify recoverable historical counts;
  // no tap sequences are returned in the report.
  const rows = db.prepare(`SELECT id, student_id, topic_id, topic_version, mode,
    completed_at, correct_count, incorrect_count, percent_correct,
    active_duration_ms, statistics_json, completion_reason, params_snapshot, assessments,
    CASE WHEN statistics_json IS NULL THEN card_events ELSE NULL END AS card_events
    FROM sessions WHERE account_id = ? AND student_id = ?`).all(accountId, filters.studentId);
  return aggregateStatistics(rows.map(sessionToApi), filters);
}

export function restoreSessionHistory(db, accountId, sessions) {
  let restored = 0;
  const find = db.prepare("SELECT * FROM sessions WHERE id = ?");
  const student = db.prepare("SELECT id FROM students WHERE id = ? AND account_id = ? AND deleted_at IS NULL");
  for (const candidate of sessions) {
    if (!candidate || !["id", "studentId", "topicId", "topicVersion", "startedAt", "completedAt"].every(key => typeof candidate[key] === "string" && candidate[key]) || typeof (candidate.modeId ?? candidate.mode) !== "string" || !Number.isFinite(Date.parse(candidate.startedAt)) || !Number.isFinite(Date.parse(candidate.completedAt)) || !student.get(candidate.studentId, accountId)) continue;
    const recovered = recoverHistoricalSession(candidate);
    if (recovered.statistics?.schemaVersion !== "legacy-1" || !recovered.statistics.recovery) continue;
    const existing = find.get(candidate.id);
    if (existing && existing.account_id !== accountId) continue;
    const existingSession = existing ? sessionToApi(existing) : null;
    if (existingSession?.statistics && existingSession.statistics.schemaVersion !== "legacy-1") continue;
    if (existingSession && !sameSessionIdentity(existingSession, candidate)) continue;
    const merged = existingSession ? mergeSessionHistory([recovered], [existingSession])[0] : recovered;
    appendSession(db, accountId, merged);
    if (existing) db.prepare(`UPDATE sessions SET
      params_snapshot = COALESCE(NULLIF(params_snapshot, '{}'), ?),
      statistics_json = ?,
      assessments = COALESCE(NULLIF(assessments, '[]'), ?),
      active_duration_ms = COALESCE(active_duration_ms, ?),
      elapsed_duration_ms = COALESCE(elapsed_duration_ms, ?)
      WHERE id = ? AND account_id = ?`).run(
      merged.paramsSnapshot ? JSON.stringify(merged.paramsSnapshot) : null,
      merged.statistics ? JSON.stringify(merged.statistics) : null,
      Array.isArray(merged.assessments) && merged.assessments.length ? JSON.stringify(merged.assessments) : null,
      existing.active_duration_ms ?? null, existing.elapsed_duration_ms ?? null,
      candidate.id, accountId,
    );
    restored++;
  }
  return { restored };
}
