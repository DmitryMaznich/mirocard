function generateId() {
  return "session_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

export function createSessionState(tasks, mode, studentId, topicId, topicVersion, conceptIds) {
  return {
    status: "task_active",
    tasks,
    taskIndex: 0,
    mode,
    studentId,
    topicId,
    topicVersion,
    conceptIds,
    correctCount: 0,
    incorrectCount: 0,
    mistakes: [],
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

export function handleAdvance(state) {
  const nextIndex = state.taskIndex + 1;
  if (nextIndex >= state.tasks.length) {
    return { ...state, status: "completed" };
  }
  return { ...state, status: "task_active", taskIndex: nextIndex };
}

export function computeSessionRecord(state, studentId, topicId, topicVersion) {
  const total = state.correctCount + state.incorrectCount;
  const isEvaluated = state.mode.evaluation !== "none";
  return {
    id:             generateId(),
    studentId,
    topicId,
    topicVersion,
    modeId:         state.mode.id,
    conceptIds:     state.conceptIds,
    startedAt:      state.startedAt,
    completedAt:    new Date().toISOString(),
    correctCount:   isEvaluated ? state.correctCount   : null,
    incorrectCount: isEvaluated ? state.incorrectCount : null,
    percentCorrect: isEvaluated && total > 0 ? Math.round((state.correctCount / total) * 100) : null,
    mistakes:       state.mistakes,
  };
}
