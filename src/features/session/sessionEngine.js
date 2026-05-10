function generateId() {
  return "session_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

export function createSessionState(tasks, mode, studentId, topicId, topicVersion, conceptIds, textId = null) {
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
    correctCount: 0,
    incorrectCount: 0,
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
    return { ...state, status: "answer_correct", correctCount: state.correctCount + 1 };
  }

  return {
    ...state,
    status: "answer_incorrect",
    incorrectCount: state.incorrectCount + 1,
    mistakes: conceptId
      ? [...state.mistakes, { conceptId, cardId }]
      : state.mistakes,
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
    return { ...state, status: "completed" };
  }
  return { ...state, status: "task_active", taskIndex: nextIndex };
}

export function computeSessionRecord(state, studentId, topicId, topicVersion) {
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
    correctCount,
    incorrectCount,
    percentCorrect,
    mistakes:       state.mistakes,
    assessments:    state.assessments?.length ? state.assessments : undefined,
  };
  if (!record.textId) delete record.textId;
  return record;
}
