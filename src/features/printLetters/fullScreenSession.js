// A full-screen renderer reports a finished piece of work (math_tests: one «Проверить») as a lesson:
// the same compact session record an ordinary session writes (useSessionEngine.persistSession), so it
// shows in the student's history and in «Продолжить» on the home screen.
export function fullScreenSessionRecord({ result, studentId, record, mode }) {
  const startedAt = new Date(result.startedAt ?? result.at ?? Date.now()).toISOString();
  const completedAt = new Date(result.at ?? Date.now()).toISOString();
  const total = Number(result.total) || 0;
  const right = Math.max(0, Math.min(total, Number(result.right) || 0));
  return {
    id: `session_${startedAt}_${record.meta.id}_${Math.random().toString(36).slice(2, 8)}`,
    studentId,
    topicId: record.meta.id,
    topicVersion: record.meta.version,
    modeId: mode.id,
    conceptIds: [],
    startedAt,
    completedAt,
    recordRevision: 0,
    recordState: "final",
    recordUpdatedAt: new Date().toISOString(),
    activeDurationMs: null,
    elapsedDurationMs: Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)),
    paramsSnapshot: { testId: result.testId ?? null, testTitle: result.testTitle ?? null },
    entryPoint: "therapist",
    completionReason: "series_completed",
    statistics: {},
    correctCount: total ? right : null,
    incorrectCount: total ? total - right : null,
    percentCorrect: total ? Math.round((right / total) * 100) : null,
    mistakes: [],
  };
}
