function generateId() {
  return "session_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

// Task types that never call handleAnswer/handleInstantCorrect (advance-only)
const ADVANCE_ONLY_TYPES = new Set(["pair_intro", "season_overview"]);

export function createSessionState(tasks, mode, studentId, topicId, topicVersion, conceptIds, textId = null, isDeckMode = false, answersPerStar = 1, strictStars = true) {
  const rawAps = Math.max(1, Math.min(3, Math.round(answersPerStar ?? 1)));
  const evaluableCount = tasks.filter(t => !ADVANCE_ONLY_TYPES.has(t.type)).length;
  // Cap so 5 stars can always be earned within the available evaluable tasks.
  // Math.floor(evaluableCount / 5) = 0 when there are fewer than 5 tasks → cap to 1.
  const effectiveAps = Math.max(1, Math.min(rawAps, Math.floor(evaluableCount / 5) || 1));
  return {
    status: "task_active",
    tasks,
    taskIndex: 0,
    mode,
    studentId,
    topicId,
    topicVersion,
    textId,
    conceptIds,
    isDeckMode,
    answersPerStar: effectiveAps,
    strictStars: !!strictStars,
    correctCount: 0,
    incorrectCount: 0,
    streakCount: 0,
    bestStreak: 0,
    rewardEarnedCount: 0,
    mistakes: [],
    assessments: [],
    startedAt: new Date().toISOString(),
  };
}

export function handleAnswer(state, isCorrect, conceptId, cardId) {
  if (state.mode.evaluation === "none") {
    return handleAdvance(state);
  }
  if (isCorrect) {
    const streakTarget = 5 * (state.answersPerStar ?? 1);
    const streakCount = (state.streakCount ?? 0) + 1;
    const rewardEarnedCount = streakCount >= streakTarget
      ? (state.rewardEarnedCount ?? 0) + 1
      : (state.rewardEarnedCount ?? 0);
    const finalStreak = streakCount >= streakTarget ? 0 : streakCount;
    return {
      ...state,
      status: "answer_correct",
      correctCount: state.correctCount + 1,
      streakCount: finalStreak,
      bestStreak: Math.max(state.bestStreak ?? 0, streakCount),
      rewardEarnedCount,
    };
  }
  return {
    ...state,
    status: "answer_incorrect",
    incorrectCount: state.incorrectCount + 1,
    streakCount: state.strictStars ? 0 : (state.streakCount ?? 0),
    mistakes: conceptId
      ? [...state.mistakes, { conceptId, cardId }]
      : state.mistakes,
  };
}

export function handleInstantCorrect(state) {
  const streakTarget = 5 * (state.answersPerStar ?? 1);
  const streakCount = (state.streakCount ?? 0) + 1;
  const correctCount = state.correctCount + 1;
  const rewardEarnedCount = streakCount >= streakTarget
    ? (state.rewardEarnedCount ?? 0) + 1
    : (state.rewardEarnedCount ?? 0);
  const finalStreak = streakCount >= streakTarget ? 0 : streakCount;
  const nextIndex = (state.taskIndex + 1) % state.tasks.length;
  return {
    ...state,
    status: "task_active",
    taskIndex: nextIndex,
    taskRetry: 0,
    correctCount,
    streakCount: finalStreak,
    bestStreak: Math.max(state.bestStreak ?? 0, streakCount),
    rewardEarnedCount,
  };
}

export function handleInstantIncorrect(state, conceptId, cardId) {
  const incorrectCount = state.incorrectCount + 1;
  const mistakes = conceptId ? [...state.mistakes, { conceptId, cardId }] : state.mistakes;
  const nextIndex = (state.taskIndex + 1) % state.tasks.length;
  return { ...state, status: "task_active", taskIndex: nextIndex, taskRetry: 0, incorrectCount, streakCount: state.strictStars ? 0 : (state.streakCount ?? 0), mistakes };
}

// Custom exercises sometimes need immediate feedback and a retry on the same
// task. Keep that interaction in the shared scoring path so strict stars use
// exactly the same reset rule as every other evaluated answer.
export function handleInPlaceIncorrect(state, conceptId, cardId) {
  if (!state || state.mode?.evaluation === "none") return state;
  const incorrectCount = state.incorrectCount + 1;
  const mistakes = conceptId ? [...state.mistakes, { conceptId, cardId }] : state.mistakes;
  return {
    ...state,
    status: "task_active",
    taskRetry: (state.taskRetry ?? 0) + 1,
    incorrectCount,
    streakCount: state.strictStars ? 0 : (state.streakCount ?? 0),
    mistakes,
  };
}

export function handleQualityAnswer(state, quality, conceptId, cardId) {
  const assessment = { quality, conceptId, cardId, taskIndex: state.taskIndex };
  return handleAdvance({
    ...state,
    assessments: [...state.assessments, assessment],
  });
}

export function handleAdvance(state) {
  const nextIndex = state.taskIndex + 1;
  if (nextIndex >= state.tasks.length) {
    return { ...state, status: state.isDeckMode ? "deck_exhausted" : "completed" };
  }
  return { ...state, status: "task_active", taskIndex: nextIndex };
}

export function computeSessionRecord(state, studentId, topicId, topicVersion, cardEvents = [], telemetry = {}) {
  const isEvaluated = state.mode.evaluation !== "none";

  let correctCount, incorrectCount, percentCorrect;
  if (isEvaluated && state.totalWords != null) {
    // Word-level tracking: errors = wrong slot attempts, total = all words in poem
    const wrong = Math.min(state.incorrectCount, state.totalWords);
    correctCount   = state.totalWords - wrong;
    incorrectCount = wrong;
    percentCorrect = Math.max(0, Math.round(((state.totalWords - wrong) / state.totalWords) * 100));
  } else {
    const total = state.correctCount + state.incorrectCount;
    correctCount   = isEvaluated ? state.correctCount   : null;
    incorrectCount = isEvaluated ? state.incorrectCount : null;
    percentCorrect = isEvaluated && total > 0 ? Math.round((state.correctCount / total) * 100) : null;
  }

  const record = {
    id:             generateId(),
    studentId,
    topicId,
    topicVersion,
    textId:         state.textId ?? undefined,
    modeId:         state.mode.id,
    conceptIds:     state.conceptIds,
    startedAt:      state.startedAt,
    completedAt:    new Date().toISOString(),
    activeDurationMs: telemetry.activeDurationMs ?? null,
    elapsedDurationMs: telemetry.elapsedDurationMs ?? null,
    paramsSnapshot: telemetry.paramsSnapshot ?? {},
    entryPoint: telemetry.entryPoint ?? "therapist",
    correctCount,
    incorrectCount,
    percentCorrect,
    mistakes:       state.mistakes,
    assessments:    state.assessments?.length ? state.assessments : undefined,
    cardEvents:     cardEvents.length ? cardEvents : undefined,
  };
  if (!record.textId) delete record.textId;
  return record;
}
