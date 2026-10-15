import { api, getApiToken } from "@/core/api";
import { getDb, kv } from "@/core/db";
import { recoverHistoricalSession } from "../../../shared/historical-session-statistics.mjs";

// The snapshot is read from the original local history, not today's settings.
// Upload compact recovered evidence only. Matching/retries are checked again
// by the server; the original events stay intact on the originating device.
export async function restoreHistoricalSessions(accountId, token = getApiToken()) {
  if (!accountId || !token || getApiToken() !== token) return;
  const db = await getDb();
  const [account, storedAccountId, sessions] = await Promise.all([kv.get(db, "account"), kv.get(db, "accountId"), kv.get(db, "sessions")]);
  if ((account?.id ?? storedAccountId) !== accountId) return;
  const candidates = (sessions ?? []).map(recoverHistoricalSession).filter(session => session.statistics?.schemaVersion === "legacy-1");
  for (let start = 0; start < candidates.length; start += 100) {
    if (getApiToken() !== token) return;
    const batch = candidates.slice(start, start + 100).map(({ id, studentId, topicId, topicVersion, modeId, mode, startedAt, completedAt, correctCount, incorrectCount, percentCorrect, paramsSnapshot, statistics, assessments, activeDurationMs, elapsedDurationMs }) => ({ id, studentId, topicId, topicVersion, modeId: modeId ?? mode, startedAt, completedAt, correctCount, incorrectCount, percentCorrect, paramsSnapshot, statistics, assessments, activeDurationMs, elapsedDurationMs }));
    await api.post("/statistics/restore", { sessions: batch });
  }
}
