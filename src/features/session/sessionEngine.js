import { applyRewardMistake, rewardAttemptComplete } from "../../../shared/reward-policy.mjs";
import { createSessionMetrics, recordResponse, recordAdvance, recordQuality, recordWrongAnswer, summarizeMetrics } from "../analytics/sessionMetrics";

function generateId() {
  return "session_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

export function sessionDay(at = new Date()) {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
}

export function markSessionAction(state) {
  const now = new Date();
  const day = sessionDay(now);
  const previousDay = state.statisticsDay ?? sessionDay(new Date(state.startedAt));
  if (previousDay !== day) {
    const statistics = createSessionMetrics();
    statistics.conditions = state.statistics?.conditions;
    // A correction after midnight is still not a new first response.
    statistics.current = state.statistics?.current ?? null;
    state = { ...state, id: generateId(), startedAt: now.toISOString(), recordRevision: 0,
      correctCount: 0, incorrectCount: 0, mistakes: [], assessments: [], statistics,
      persistedActiveDurationMs: 0 };
  }
  return { ...state, statisticsDay: day, recordRevision: (state.recordRevision ?? 0) + 1, lastActivityAt: now.toISOString() };
}

function taskRelation(task) {
  return task?.card?.relation ?? null;
}

// A looping mixed drill starts a fresh round from a new order.  Prefer a
// relation different from the one that just closed the previous round, so the
// child never gets an accidental two-card run of the same preposition.
export function reshuffleLoopTasks(tasks) {
  const remaining = [...tasks];
  const next = [];
  let previousRelation = taskRelation(tasks.at(-1));

  while (remaining.length) {
    const eligibleIndexes = remaining
      .map((task, index) => ({ task, index }))
      .filter(({ task }) => taskRelation(task) !== previousRelation)
      .map(({ index }) => index);
    const indexes = eligibleIndexes.length ? eligibleIndexes : remaining.map((_, index) => index);
    const index = indexes[Math.floor(Math.random() * indexes.length)];
    const [task] = remaining.splice(index, 1);
    next.push(task);
    previousRelation = taskRelation(task);
  }

  return next;
}

// Task types that never call handleAnswer/handleInstantCorrect (advance-only)
const ADVANCE_ONLY_TYPES = new Set(["pair_intro", "season_overview"]);

export function createSessionState(tasks, mode, studentId, topicId, topicVersion, conceptIds, textId = null, isDeckMode = false, answersPerStar = 1, strictStars = true, rewardPolicy = undefined) {
  const rawAps = Math.max(1, Math.min(3, Math.round(answersPerStar ?? 1)));
  const evaluableCount = tasks.filter(t => !ADVANCE_ONLY_TYPES.has(t.type)).length;
  // Cap so 5 stars can always be earned within the available evaluable tasks.
  // Math.floor(evaluableCount / 5) = 0 when there are fewer than 5 tasks → cap to 1.
  const effectiveAps = Math.max(1, Math.min(rawAps, Math.floor(evaluableCount / 5) || 1));
  return {
    id: generateId(),
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
    ...(rewardPolicy ? { rewardPolicy } : {}),
    correctCount: 0,
    incorrectCount: 0,
    streakCount: 0,
    bestStreak: 0,
    rewardEarnedCount: 0,
    mistakes: [],
    assessments: [],
    statistics: createSessionMetrics(),
    recordRevision: 0,
    statisticsDay: sessionDay(),
    startedAt: new Date().toISOString(),
  };
}

function learningStreakAfterCorrect(state, count) {
  if (state.rewardAttemptCredited) return state.learningStreakCount ?? 0;
  return state.rewardHadAnyError ? 0 : (state.learningStreakCount ?? 0) + count;
}

export function handleAnswer(state, isCorrect, conceptId, cardId, options = {}) {
  state = markSessionAction(state);
  if (state.mode.evaluation === "none") {
    return handleAdvance(state);
  }
  state = recordResponse(state, isCorrect ? "correct" : "incorrect");
  if (isCorrect) {
    const scoreCount = Math.max(1, Math.round(Number(options.scoreCount) || 1));
    const streakTarget = 5 * (state.answersPerStar ?? 1);
    const rewardScore = state.rewardPolicy?.version === 2 && (state.rewardAttemptBlocked || state.rewardAttemptCredited) ? 0 : scoreCount;
    const streakCount = (state.streakCount ?? 0) + rewardScore;
    const earnedNow = Math.floor(streakCount / streakTarget);
    const rewardEarnedCount = (state.rewardEarnedCount ?? 0) + earnedNow;
    const finalStreak = streakCount % streakTarget;
    return {
      ...state,
      status: "answer_correct",
      correctCount: state.correctCount + scoreCount,
      streakCount: finalStreak,
      bestStreak: Math.max(state.bestStreak ?? 0, state.rewardPolicy?.version === 2 ? learningStreakAfterCorrect(state, scoreCount) : Math.min(streakCount, streakTarget)),
      rewardEarnedCount,
      ...(state.rewardPolicy?.version === 2 ? {
        rewardAttemptCredited: true,
        learningStreakCount: learningStreakAfterCorrect(state, scoreCount),
        rewardChangeReason: earnedNow > 0 ? "exchange" : rewardScore > 0 ? "gain" : state.rewardChangeReason,
      } : {}),
    };
  }
  return {
    ...applyRewardMistake(state),
    status: "answer_incorrect",
    incorrectCount: state.incorrectCount + 1,
    mistakes: conceptId
      ? [...state.mistakes, { conceptId, cardId }]
      : state.mistakes,
  };
}

// An instant-evaluation mode cycles its tasks until the adult ends it — except
// a `finite` one (a place-value check: «7. Контрольная работа: до 100»), which ends after
// its last task, whether that answer was right or wrong.
function finiteDone(state) {
  return Boolean(state.mode?.finite) && state.taskIndex + 1 >= state.tasks.length;
}

// One right answer toward the reward series: the streak grows, and a full
// series (5 × answersPerStar) earns a reward and starts the next one.
function creditRewardStreak(state) {
  const streakTarget = 5 * (state.answersPerStar ?? 1);
  const rewardScore = state.rewardPolicy?.version === 2 && (state.rewardAttemptBlocked || state.rewardAttemptCredited) ? 0 : 1;
  const streakCount = (state.streakCount ?? 0) + rewardScore;
  const rewardEarnedCount = streakCount >= streakTarget
    ? (state.rewardEarnedCount ?? 0) + 1
    : (state.rewardEarnedCount ?? 0);
  return {
    ...state,
    streakCount: streakCount >= streakTarget ? 0 : streakCount,
    bestStreak: Math.max(state.bestStreak ?? 0, state.rewardPolicy?.version === 2 ? learningStreakAfterCorrect(state, 1) : streakCount),
    rewardEarnedCount,
    ...(state.rewardPolicy?.version === 2 ? { learningStreakCount: learningStreakAfterCorrect(state, 1), rewardChangeReason: streakCount >= streakTarget ? "exchange" : rewardScore > 0 ? "gain" : state.rewardChangeReason } : {}),
  };
}

// A mode with `rewardPerBlock` gives the video for a finished block, not for a
// series of right answers. The stars show how far the child is through the
// block: tasks carry `blockStars` (the block's five stars spread over its
// checks), and the task that closes the block carries `rewardAfter`. Moving on
// from a task — answered alone, with help or skipped — credits them; a mistake
// takes nothing away (the block is taught without errors).
function blockReward(state) {
  const task = state.tasks?.[state.taskIndex];
  if (!task?.blockStars && !task?.rewardAfter) return state;
  const perStar = state.answersPerStar ?? 1;
  if (task.rewardAfter) {
    return { ...state, streakCount: 0, rewardEarnedCount: (state.rewardEarnedCount ?? 0) + 1 };
  }
  return { ...state, streakCount: Math.min(5 * perStar, (state.streakCount ?? 0) + task.blockStars * perStar) };
}

export function handleInstantCorrect(state) {
  state = markSessionAction(state);
  state = recordAdvance(recordResponse(state, "correct"));
  const nextIndex = (state.taskIndex + 1) % state.tasks.length;
  const credited = state.mode?.rewardPerBlock ? blockReward(state) : creditRewardStreak(state);
  return {
    ...rewardAttemptComplete(credited),
    status: finiteDone(state) ? "completed" : "task_active",
    taskIndex: nextIndex,
    taskRetry: 0,
    correctCount: state.correctCount + 1,
  };
}

export function handleInstantIncorrect(state, conceptId, cardId, answer) {
  state = markSessionAction(state);
  state = recordAdvance(recordWrongAnswer(recordResponse(state, "incorrect"), answer));
  const incorrectCount = state.incorrectCount + 1;
  const mistakes = conceptId ? [...state.mistakes, { conceptId, cardId }] : state.mistakes;
  const nextIndex = (state.taskIndex + 1) % state.tasks.length;
  return { ...rewardAttemptComplete(applyRewardMistake(state)), status: finiteDone(state) ? "completed" : "task_active", taskIndex: nextIndex, taskRetry: 0, incorrectCount, mistakes };
}

// Custom exercises sometimes need immediate feedback and a retry on the same
// task. Keep that interaction in the shared scoring path so strict stars use
// exactly the same reset rule as every other evaluated answer.
export function handleInPlaceIncorrect(state, conceptId, cardId) {
  if (!state || state.mode?.evaluation === "none") return state;
  state = markSessionAction(state);
  state = recordResponse(state, "incorrect");
  const incorrectCount = state.incorrectCount + 1;
  const mistakes = conceptId ? [...state.mistakes, { conceptId, cardId }] : state.mistakes;
  return {
    ...applyRewardMistake(state, true),
    status: "task_active",
    taskRetry: (state.taskRetry ?? 0) + 1,
    incorrectCount,
    mistakes,
  };
}

// A narrower sibling of handleInPlaceIncorrect: records the mistake and
// resets the star streak the same way, but does NOT bump taskRetry — that
// counter drives SessionScreen.jsx's remount key, and some in-task mistakes
// (e.g. compare_apply's "Выбери число" hint: a wrong sign drawn inside it)
// must cost the streak without remounting the renderer, since the renderer's
// own local UI state (which hint tiles are already solved, whether the hint
// is even open) needs to survive the reset — the child keeps working right
// where they were, just without the streak.
export function handleStreakReset(state, conceptId, cardId) {
  if (!state || state.mode?.evaluation === "none") return state;
  state = markSessionAction(state);
  state = recordResponse(state, "incorrect");
  const incorrectCount = state.incorrectCount + 1;
  const mistakes = conceptId ? [...state.mistakes, { conceptId, cardId }] : state.mistakes;
  return {
    ...applyRewardMistake(state, true),
    incorrectCount,
    mistakes,
  };
}

// In a mode the adult rates («Сделай», «Что делает?»: evaluation "adult"),
// the rating drives the reward series like a right or wrong answer elsewhere:
// «Легко» (done alone) counts toward it, «Не понимает» is a mistake (resets it
// under «Без ошибок»), «С подсказкой» neither - a prompted answer is not
// rewarded, but the child is not punished for needing help.
const REWARD_CREDIT_QUALITIES = new Set(["easy", "independent", "correct"]);
const REWARD_MISTAKE_QUALITIES = new Set(["fail"]);

export function handleQualityAnswer(state, quality, conceptId, cardId) {
  state = markSessionAction(state);
  state = recordQuality(state, quality);
  if (state.mode?.evaluation === "adult") {
    if (REWARD_CREDIT_QUALITIES.has(quality)) state = creditRewardStreak(state);
    else if (REWARD_MISTAKE_QUALITIES.has(quality)) state = applyRewardMistake(state);
  }
  const assessment = { quality, conceptId, cardId, taskIndex: state.taskIndex };
  return handleAdvance({
    ...state,
    assessments: [...state.assessments, assessment],
  });
}

export function handleAdvance(state) {
  state = markSessionAction(state);
  state = recordAdvance(state);
  if (state.mode?.rewardPerBlock) state = blockReward(state);
  const nextIndex = state.taskIndex + 1;
  if (nextIndex >= state.tasks.length) {
    if (state.mode?.loop) {
      return {
        ...rewardAttemptComplete(state),
        status: "task_active",
        taskIndex: 0,
        taskRetry: 0,
        tasks: state.mode.reshuffleOnLoop ? reshuffleLoopTasks(state.tasks) : state.tasks,
      };
    }
    return { ...rewardAttemptComplete(state), status: state.isDeckMode ? "deck_exhausted" : "completed" };
  }
  return { ...rewardAttemptComplete(state), status: "task_active", taskIndex: nextIndex };
}

function collapseOutcomes(items, keys) {
  const groups = new Map();
  for (const item of items ?? []) {
    const key = JSON.stringify(keys.map(field => item[field] ?? null));
    const existing = groups.get(key);
    if (existing) existing.count += item.count ?? 1;
    else groups.set(key, { ...Object.fromEntries(keys.map(field => [field, item[field]])), count: item.count ?? 1 });
  }
  return [...groups.values()];
}

export function computeSessionRecord(state, studentId, topicId, topicVersion, cardEvents = [], telemetry = {}) {
  const isEvaluated = state.mode.evaluation !== "none";

  let correctCount, incorrectCount, percentCorrect;
  if (isEvaluated && state.totalWords != null && telemetry.recordState === "checkpoint") {
    // This renderer reports completed lines and wrong placements, not every
    // correct word. Unfinished words cannot be inferred as correct.
    correctCount = null;
    incorrectCount = null;
    percentCorrect = null;
  } else if (isEvaluated && state.totalWords != null) {
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
    id:             state.id ?? `session_${state.startedAt}_${topicId}`,
    studentId,
    topicId,
    topicVersion,
    textId:         state.textId ?? undefined,
    modeId:         state.mode.id,
    conceptIds:     state.conceptIds,
    startedAt:      state.startedAt,
    completedAt:    telemetry.completedAt ?? new Date().toISOString(),
    recordRevision: state.recordRevision ?? 0,
    recordState: telemetry.recordState ?? "final",
    recordUpdatedAt: new Date().toISOString(),
    activeDurationMs: telemetry.activeDurationMs ?? null,
    elapsedDurationMs: telemetry.elapsedDurationMs ?? null,
    paramsSnapshot: telemetry.paramsSnapshot ?? {},
    entryPoint: telemetry.entryPoint ?? "therapist",
    completionReason: telemetry.completionReason ?? (state.status === "completed" || state.status === "deck_exhausted" ? "series_completed" : "manual"),
    statistics: summarizeMetrics(state),
    correctCount,
    incorrectCount,
    percentCorrect,
    mistakes:       collapseOutcomes(state.mistakes, ["conceptId", "cardId"]),
    assessments:    state.assessments?.length ? collapseOutcomes(state.assessments, ["quality", "conceptId", "cardId"]) : undefined,
    cardEvents:     cardEvents.length ? cardEvents : undefined,
  };
  if (!record.textId) delete record.textId;
  return record;
}
