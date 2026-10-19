// Only audited, single-response task types may report first-response accuracy.
// Other exercises retain activity/action counts until their scoring contract is
// explicitly adapted. No tap sequence is persisted here.
export const SINGLE_RESPONSE_TYPES = new Set(["yes_no", "find_n", "choose_word_by_picture", "emotion_control", "emotion_situation", "situation_emotion", "sort_by_attribute", "operation_audio"]);

export function createSessionMetrics() {
  return { schemaVersion: 1, firstCorrect: 0, firstTotal: 0, corrected: 0, assisted: 0, advancedTasks: 0, quality: {}, concepts: {}, current: null };
}

export function recordResponse(state, outcome) {
  if (!state.statistics || state.mode?.evaluation === "none") return state;
  const task = state.tasks[state.taskIndex];
  // `singleResponse`: a task from a mixed check (place_value «Проверка») —
  // one answer each, counted per its own `targetConceptId` (skill and picture).
  if (!SINGLE_RESPONSE_TYPES.has(task?.type) && !task?.singleResponse) return state;
  const stats = state.statistics;
  const current = stats.current;
  if (current?.finished) return state;
  const first = !current;
  const conceptId = task.targetConceptId ?? task.conceptId ?? task.card?.conceptId;
  const concepts = { ...stats.concepts };
  if (first && conceptId) {
    const previous = concepts[conceptId] ?? { total: 0, correct: 0 };
    concepts[conceptId] = { total: previous.total + 1, correct: previous.correct + (outcome === "correct" ? 1 : 0) };
  }
  return { ...state, statistics: { ...stats,
    firstTotal: stats.firstTotal + (first ? 1 : 0),
    firstCorrect: stats.firstCorrect + (first && outcome === "correct" ? 1 : 0),
    corrected: stats.corrected + (!first && outcome === "correct" ? 1 : 0),
    assisted: stats.assisted + (outcome === "assisted" ? 1 : 0),
    concepts,
    current: { finished: outcome !== "incorrect" },
  } };
}

// A check's wrong answer as the child gave it — the task, the answer and the
// right one — kept with the statistics for the result screen.
export function recordWrongAnswer(state, answer) {
  if (!state.statistics || !answer) return state;
  return { ...state, statistics: { ...state.statistics, wrongAnswers: [...(state.statistics.wrongAnswers ?? []), answer] } };
}

export function recordAdvance(state) {
  if (!state.statistics) return state;
  return { ...state, statistics: { ...state.statistics, advancedTasks: state.statistics.advancedTasks + 1, current: null } };
}

export function recordQuality(state, quality) {
  if (!state.statistics) return state;
  return { ...state, statistics: { ...state.statistics, quality: { ...state.statistics.quality, [quality]: (state.statistics.quality[quality] ?? 0) + 1 } } };
}

export function summarizeMetrics(state) {
  if (!state.statistics) return undefined;
  const { current: _current, ...summary } = state.statistics;
  return summary;
}

export function captureConditions(topic, mode, params, tasks, conceptIds, textId) {
  const defaults = Object.fromEntries(Object.entries(mode.params ?? {}).filter(([, definition]) => definition.default !== undefined).map(([key, definition]) => [key, definition.default]));
  const effectiveParams = { ...defaults, ...params };
  // This engine explicitly overrides these settings for transfer material.
  if (topic.meta.renderer === "word_formation" && params.materialSet === "transfer") Object.assign(effectiveParams, { introStage: "answer", showImage: false, hintMode: "phrase", activityStage: "check", questionHint: false });
  return { renderer: topic.meta.renderer, evaluation: mode.evaluation, params: effectiveParams, conceptIds: [...new Set(conceptIds ?? [])].sort(), textId: textId ?? null,
    optionCounts: [...new Set(tasks.filter(task => Array.isArray(task.options)).map(task => task.options.length))].sort((a, b) => a - b),
    taskTypes: [...new Set(tasks.map(task => task.type))].sort(),
  };
}
