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
    _retryInsertedAt: null, // taskIndex of last retry insertion (prevents duplicates)
  };
}

export function handleAnswer(state, isCorrect, conceptId, cardId) {
  if (state.mode.evaluation === "none") {
    return handleAdvance(state);
  }
  if (isCorrect) {
    return { ...state, status: "answer_correct", correctCount: state.correctCount + 1 };
  }

  // Re-insert current task at the end so it comes back for retry.
  // Guard: if already re-inserted for this taskIndex (e.g. draw_sign multi-fail), skip.
  const alreadyQueued = state._retryInsertedAt === state.taskIndex;
  const newTasks = alreadyQueued
    ? state.tasks
    : [...state.tasks, state.tasks[state.taskIndex]];

  return {
    ...state,
    status: "answer_incorrect",
    incorrectCount: state.incorrectCount + 1,
    mistakes: conceptId
      ? [...state.mistakes, { conceptId, cardId }]
      : state.mistakes,
    tasks: newTasks,
    _retryInsertedAt: alreadyQueued ? state._retryInsertedAt : state.taskIndex,
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
  const total = state.correctCount + state.incorrectCount;
  const isEvaluated = state.mode.evaluation !== "none";
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
    correctCount:   isEvaluated ? state.correctCount   : null,
    incorrectCount: isEvaluated ? state.incorrectCount : null,
    percentCorrect: isEvaluated && total > 0 ? Math.round((state.correctCount / total) * 100) : null,
    mistakes:       state.mistakes,
    assessments:    state.assessments?.length ? state.assessments : undefined,
  };
  if (!record.textId) delete record.textId;
  return record;
}
