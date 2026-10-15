// Shared by the server and offline UI. Unknown settings deliberately remain in
// the comparison key: splitting too much is preferable to merging unlike work.
import { recoverHistoricalSession } from "./historical-session-statistics.mjs";
const PRESENTATION_PARAMS = new Set(["strictStars", "answersPerStar", "soundEnabled", "volume", "videoRewardEnabled", "rewardThreshold"]);

export function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  return value;
}

export function comparisonConditions(session) {
  if (!session.statistics?.conditions) return null;
  const conditions = session.statistics.conditions;
  return stableValue({
    ...conditions,
    params: Object.fromEntries(Object.entries(conditions.params ?? {}).filter(([key]) => !PRESENTATION_PARAMS.has(key))),
  });
}

const count = value => Number.isFinite(value) && value >= 0 ? value : 0;
const emptyTotals = () => ({ sessions: 0, recoveredSessions: 0, recoveredResponseSessions: 0, savedSettingsSessions: 0, firstMeasuredSessions: 0, completedSeries: 0, manualSessions: 0, activeDurationMs: 0, timedSessions: 0, firstCorrect: 0, firstTotal: 0, corrected: 0, assisted: 0, correctActions: 0, incorrectActions: 0, assessedSessions: 0, advancedTasks: 0, quality: {} });

function addSession(target, session) {
  target.sessions++;
  if (session.recordState === "checkpoint") target.checkpointSessions = (target.checkpointSessions ?? 0) + 1;
  const stats = session.statistics;
  if (stats?.source === "active_snapshot") target.snapshotRecoveredSessions = (target.snapshotRecoveredSessions ?? 0) + 1;
  if (stats?.recovery) target.recoveredSessions++;
  if (stats?.recovery?.responses) target.recoveredResponseSessions++;
  if (stats?.recovery?.savedParams) target.savedSettingsSessions++;
  if (count(stats?.firstTotal) > 0) target.firstMeasuredSessions++;
  if (session.completionReason === "series_completed") target.completedSeries++;
  if (session.completionReason === "manual") target.manualSessions++;
  if (Number.isFinite(session.activeDurationMs)) { target.activeDurationMs += count(session.activeDurationMs); target.timedSessions++; }
  target.firstCorrect += count(stats?.firstCorrect);
  target.firstTotal += count(stats?.firstTotal);
  target.corrected += count(stats?.corrected);
  target.assisted += count(stats?.assisted);
  target.advancedTasks += count(stats?.advancedTasks);
  if (session.correctCount != null || session.incorrectCount != null) {
    target.correctActions += count(session.correctCount);
    target.incorrectActions += count(session.incorrectCount);
    target.assessedSessions++;
  }
  for (const [quality, value] of Object.entries(stats?.quality ?? {})) target.quality[quality] = (target.quality[quality] ?? 0) + count(value);
}

export function aggregateStatistics(sessions, { studentId, topicId = null, since = null, until = null, timeZone = "UTC" } = {}) {
  const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const unique = new Map();
  for (const session of sessions) {
    if (!session?.id || session.studentId !== studentId || (topicId && session.topicId !== topicId)) continue;
    const timestamp = Date.parse(session.completedAt);
    if (!Number.isFinite(timestamp) || (since && timestamp < Date.parse(since)) || (until && timestamp >= Date.parse(until))) continue;
    unique.set(session.id, recoverHistoricalSession(session));
  }
  const totals = emptyTotals();
  const groups = new Map();
  const topics = new Map();
  const days = new Set();
  for (const session of unique.values()) {
    addSession(totals, session);
    days.add(dayFormatter.format(new Date(session.completedAt)));
    const modeId = session.modeId ?? session.mode;
    const conditions = comparisonConditions(session);
    const key = JSON.stringify([session.topicId, modeId, session.topicVersion, session.statistics?.schemaVersion ?? null, conditions]);
    if (!groups.has(key)) groups.set(key, { key, topicId: session.topicId, modeId, topicVersion: session.topicVersion, conditions, totals: emptyTotals(), trend: [], concepts: {} });
    const group = groups.get(key);
    addSession(group.totals, session);
    group.trend.push({ id: session.id, completedAt: session.completedAt, firstCorrect: count(session.statistics?.firstCorrect), firstTotal: count(session.statistics?.firstTotal) });
    for (const [conceptId, counts] of Object.entries(session.statistics?.concepts ?? {})) {
      const concept = group.concepts[conceptId] ??= { total: 0, correct: 0 };
      concept.total += count(counts.total); concept.correct += count(counts.correct);
    }
    if (!topics.has(session.topicId)) topics.set(session.topicId, { topicId: session.topicId, totals: emptyTotals(), lastAt: null });
    const topic = topics.get(session.topicId);
    addSession(topic.totals, session);
    if (!topic.lastAt || session.completedAt > topic.lastAt) topic.lastAt = session.completedAt;
  }
  for (const group of groups.values()) group.trend = group.trend.sort((a, b) => a.completedAt.localeCompare(b.completedAt)).slice(-12);
  return { totals, activeDays: days.size, groups: [...groups.values()], topics: [...topics.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt)), recent: [...unique.values()].sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, 20).map(({ id, topicId: tid, modeId, mode, startedAt, completedAt, activeDurationMs, elapsedDurationMs, percentCorrect, completionReason }) => ({ id, topicId: tid, modeId: modeId ?? mode, startedAt, completedAt, activeDurationMs, elapsedDurationMs, percentCorrect, completionReason })) };
}
