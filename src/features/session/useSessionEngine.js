import { useState, useCallback, useEffect, useRef } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { pushOp } from "@/core/syncApi";
import { deriveConcepts, getConceptCards, readModeSelectedConceptIds } from "@/shared/utils/topicUtils";
import { ENGINE_REGISTRY } from "@/topics/renderers/engineRegistry";
import { createSessionState, handleAnswer, handleAdvance, handleQualityAnswer, handleInstantCorrect, handleInstantIncorrect, handleInPlaceIncorrect, computeSessionRecord } from "./sessionEngine";
import { useCardEventLogger } from "@/features/analytics/useCardEventLogger";
import { useActiveSessionTimer } from "./useActiveSessionTimer";
import { getDefaultModeSettings } from "@/topics/topicLoader";
import { persistStudentTopicLink } from "@/core/linkUtils";
import {
  clearActiveSessionSnapshot as clearPersistedActiveSessionSnapshot,
  createActiveSessionSnapshot,
  persistActiveSessionSnapshot,
  restoreActiveSessionState,
} from "./activeSession";

const INCORRECT_FEEDBACK_MS = 1500;

function resolveStrictStars(mode, savedValue) {
  // Some reaction drills are a true "correct answers in a row" exercise.
  // Their progression must not inherit a soft-count setting saved in another
  // mode of the same topic.
  if (mode?.rewardDefaults?.forceStrictStars) return true;
  return savedValue ?? mode?.rewardDefaults?.strictStars ?? true;
}

// Shared between the initial mode lookup and the loopModes auto-advance
// effect below, so both resolve a mode id the exact same way.
function resolveMode(topicRecord, modeId) {
  const modeFromTopic = topicRecord?.modes?.find((m) => m.id === modeId);
  // Override evaluation/rewardThreshold from DEFAULT_MODES — stored records may be stale.
  const defaultModeSettings = topicRecord
    ? getDefaultModeSettings(topicRecord.meta.renderer, modeId)
    : null;
  return modeFromTopic
    ? (defaultModeSettings
        ? { ...modeFromTopic, evaluation: defaultModeSettings.evaluation }
        : modeFromTopic)
    : modeId === "follow_instruction"
      ? { id: "follow_instruction", type: "follow_instruction", evaluation: "none" }
      : undefined;
}

// Shared between the top-level render and the loopModes auto-advance effect,
// so a freshly picked next mode gets the same concept selection a normal
// mode switch (via ModePickerScreen -> params) would have produced.
function resolveModeSelection(topicRecord, mode, link, isReading, activeTextId) {
  const sessionParams = { ...(link.params ?? {}), strictStars: resolveStrictStars(mode, link.strictStars) };
  const defaultModeConceptIds = getConceptCards(topicRecord, mode, sessionParams)
    .filter((c) => c.primary)
    .map((c) => c.conceptId);
  const modeSelectedConceptIds = mode
    ? readModeSelectedConceptIds(topicRecord, mode, link.selectedConceptIds?.length ? link.selectedConceptIds : null, sessionParams)
    : (link.selectedConceptIds?.length ? link.selectedConceptIds : null);
  // A newly added scoped mode can inherit an old saved selection whose ids do
  // not belong to its own card pool. Do not let that stale selection create an
  // empty session: retain valid ids, otherwise start with the mode defaults.
  const validSelectedConceptIds = modeSelectedConceptIds?.filter((id) => defaultModeConceptIds.includes(id)) ?? [];
  const selectedConceptIds = isReading
    ? (activeTextId ? [activeTextId] : [])
    : (validSelectedConceptIds.length ? validSelectedConceptIds : defaultModeConceptIds);
  return { sessionParams, selectedConceptIds };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Spatial prepositions use their own `relations` multi-select in Params.
// That choice must be authoritative: a legacy selection from the generic
// concept picker belongs to an older version of the topic and can otherwise
// hide the cards requested by the new control.
export function cardsForRenderer(topicRecord, mode, selectedConceptIds) {
  const allCards = topicRecord?.cards ?? [];
  const selectedIds = new Set(selectedConceptIds ?? []);
  const selectedCards = shuffle(allCards.filter((card) => selectedIds.has(card.conceptId)));
  const modeHasCategoryParam = Boolean(mode?.params?.category);
  const spatialRelationsOwnFilter = topicRecord?.meta?.renderer === "spatial_prepositions"
    && mode?.params?.relations?.type === "enum_multi";

  return {
    selectedCards,
    cards: modeHasCategoryParam || spatialRelationsOwnFilter
      ? allCards
      : (selectedCards.length ? selectedCards : allCards),
  };
}

function buildGeneratedSessionState({
  topicRecord,
  mode,
  activeStudentId,
  activeTopicId,
  activeTextId,
  activeText,
  activeStudent,
  link,
  selectedConceptIds,
  sessionParams,
}) {
  if (!topicRecord || !mode) return null;

  const renderer = topicRecord.meta.renderer;
  let tasks;
  let isDeckMode = false;

  if (renderer === "reading") {
    const generateTasks = ENGINE_REGISTRY.reading;
    tasks = generateTasks
      ? generateTasks(mode, topicRecord, activeTextId, sessionParams, activeText)
      : [];
  } else if (renderer === "flashcards") {
    const allConcepts = deriveConcepts(topicRecord.cards);
    // These drills do not use parent-selectable picture concepts. Their one
    // metadata card is part of the mode itself, so an old saved selection must
    // never be allowed to filter it away and leave the session with no tasks.
    const isSelfContainedDrill = ["navigator", "coordinates"].includes(mode.type);
    const selected = isSelfContainedDrill
      ? allConcepts.filter((c) => c.cards.some((card) => card.taskKind === mode.type))
      : allConcepts.filter((c) => selectedConceptIds.includes(c.conceptId));
    const deckPos = link.deckPosition ?? 0;
    const safeStart = selected.length > 0 ? deckPos % selected.length : 0;
    const concepts = shuffle(safeStart === 0 ? selected : [...selected.slice(safeStart), ...selected.slice(0, safeStart)]);
    const generateTasks = ENGINE_REGISTRY.flashcards;
    tasks = generateTasks ? generateTasks(mode.type, concepts, topicRecord.cards, sessionParams) : [];
    isDeckMode = true;
  } else if (renderer === "function_cards") {
    const allConcepts = deriveConcepts(topicRecord.cards);
    const selected = allConcepts.filter((c) => selectedConceptIds.includes(c.conceptId));
    const deckPos = link.deckPosition ?? 0;
    const safeStart = selected.length > 0 ? deckPos % selected.length : 0;
    const concepts = shuffle(safeStart === 0 ? selected : [...selected.slice(safeStart), ...selected.slice(0, safeStart)]);
    const generateTasks = ENGINE_REGISTRY.function_cards;
    tasks = generateTasks ? generateTasks(mode.type, concepts, topicRecord.cards, sessionParams) : [];
    isDeckMode = true;
  } else if (renderer === "sentence_puzzle") {
    const generateTasks = ENGINE_REGISTRY.sentence_puzzle;
    const spSelected = link.selectedConceptIds?.length ? link.selectedConceptIds : null;
    tasks = generateTasks ? generateTasks(mode, topicRecord, sessionParams, activeStudent, spSelected) : [];
  } else if (renderer === "magnetic_alphabet") {
    const generateTasks = ENGINE_REGISTRY.magnetic_alphabet;
    tasks = generateTasks ? generateTasks(mode, topicRecord, sessionParams) : [];
  } else if (renderer === "narrative") {
    const generateTasks = ENGINE_REGISTRY.narrative;
    tasks = generateTasks ? generateTasks(mode, topicRecord, sessionParams, selectedConceptIds) : [];
  } else if (renderer === "print_materials") {
    const generateTasks = ENGINE_REGISTRY.print_materials;
    tasks = generateTasks ? generateTasks(mode, topicRecord) : [];
  } else {
    const generateTasks = ENGINE_REGISTRY[renderer];
    const sessionSize = 500;
    // Category filters, and spatial prepositions' own relation selector, are
    // authoritative — pass the full topic pool so an older generic concept
    // selection cannot silently hide the requested cards.
    const { selectedCards, cards: cardsForEngine } = cardsForRenderer(topicRecord, mode, selectedConceptIds);
    tasks = generateTasks
      ? generateTasks(mode, cardsForEngine, sessionSize, sessionParams)
      : [];
    // If the concept filter excluded cards required for this mode (e.g. only finger cards
    // selected but mode needs arithmetic cards), fall back to all cards so the session starts.
    if (!tasks.length && selectedCards.length && generateTasks) {
      tasks = generateTasks(mode, topicRecord.cards, sessionSize, sessionParams);
    }
  }

  const baseState = createSessionState(
    tasks,
    mode,
    activeStudentId,
    activeTopicId,
    topicRecord.meta.version,
    selectedConceptIds,
    renderer === "reading" ? activeTextId : null,
    isDeckMode,
    link.answersPerStar ?? 1,
    resolveStrictStars(mode, link.strictStars),
  );

  if (mode.type === "assemble_text") {
    const totalWords = tasks.reduce((sum, task) => sum + (task.tokenCount ?? 0), 0);
    return { ...baseState, totalWords };
  }

  return baseState;
}

export function useSessionEngine() {
  const activeStudentId   = useAppStore((s) => s.activeStudentId);
  const activeTopicId     = useAppStore((s) => s.activeTopicId);
  const activeTextId      = useAppStore((s) => s.activeTextId);
  const activeText        = useAppStore((s) => s.activeText);
  const activeModeId      = useAppStore((s) => s.activeModeId);
  const topicRecords      = useAppStore((s) => s.topicRecords);
  const students          = useAppStore((s) => s.students);
  const studentTopicLinks = useAppStore((s) => s.studentTopicLinks);
  const appendSession     = useAppStore((s) => s.appendSession);
  const activeSessionSnapshot = useAppStore((s) => s.activeSessionSnapshot);
  const isStudentPortal = useAppStore((s) => s.isStudentPortal);
  const setActiveSessionSnapshot = useAppStore((s) => s.setActiveSessionSnapshot);
  const clearActiveSessionSnapshot = useAppStore((s) => s.clearActiveSessionSnapshot);
  const adultConfirmAdvance = useAppStore((s) => s.settings.adultConfirmAdvance ?? true);
  const tapToAdvance      = useAppStore((s) => s.settings.tapToAdvance ?? true);
  const autoAdvanceDelay  = useAppStore((s) => s.settings.autoAdvanceDelay ?? 3);

  const setActiveModeId = useAppStore((s) => s.setActiveModeId);

  const topicRecord = topicRecords.find((r) => r.meta.id === activeTopicId);
  // Override evaluation/rewardThreshold from DEFAULT_MODES — stored records may be stale.
  const defaultModeSettings = topicRecord
    ? getDefaultModeSettings(topicRecord.meta.renderer, activeModeId)
    : null;
  const mode = resolveMode(topicRecord, activeModeId);
  const activeStudent = students.find((s) => s.id === activeStudentId) ?? null;

  const linkKey = `${activeStudentId}_${activeTopicId}`;
  const link = studentTopicLinks[linkKey] ?? {};
  const rewardConfig = {
    videoRewardEnabled: link.videoRewardEnabled ?? true,
    rewardThreshold: link.rewardThreshold ?? defaultModeSettings?.rewardThreshold ?? 90,
    hasRewardVideos: (activeStudent?.rewardVideos?.length ?? 0) > 0,
  };
  const isReading = topicRecord?.meta.renderer === "reading";
  const { sessionParams, selectedConceptIds } = resolveModeSelection(topicRecord, mode, link, isReading, activeTextId);
  const cardLogger = useCardEventLogger();

  const [sessionState, setSessionState] = useState(() => {
    const generatedState = buildGeneratedSessionState({
      topicRecord,
      mode,
      activeStudentId,
      activeTopicId,
      activeTextId,
      activeText,
      activeStudent,
      link,
      selectedConceptIds,
      sessionParams,
    });
    if (!generatedState) return null;

    return restoreActiveSessionState(activeSessionSnapshot, {
      studentId: activeStudentId,
      topicId: activeTopicId,
      textId: isReading ? activeTextId : null,
      modeId: activeModeId,
      topicVersion: topicRecord.meta.version,
    }) ?? generatedState;
  });
  const { getActiveDurationMs } = useActiveSessionTimer(
    Boolean(sessionState && sessionState.status !== "completed"),
  );

  // Recovery: if the session was built without adult cards (closeAdults not yet
  // in the store at mount time), rebuild as soon as the store catches up — but
  // only while the user hasn't made any progress yet.
  useEffect(() => {
    if (!sessionState || !mode) return;
    if (sessionState.taskIndex > 0 || sessionState.correctCount > 0) return;
    if (topicRecord?.meta?.renderer !== "sentence_puzzle") return;
    if (!activeStudent?.closeAdults?.length) return;
    const hasAdultCards = sessionState.tasks.some((t) => t.pool?.some((c) => c.id?.startsWith("adult_")));
    if (hasAdultCards) return;

    const generateTasks = ENGINE_REGISTRY["sentence_puzzle"];
    const spSelected = link.selectedConceptIds?.length ? link.selectedConceptIds : null;
    const tasks = generateTasks ? generateTasks(mode, topicRecord, sessionParams, activeStudent, spSelected) : [];
    if (!tasks.length) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionState(
      createSessionState(tasks, mode, activeStudentId, activeTopicId, topicRecord.meta.version, selectedConceptIds, null)
    );
  }, [activeStudent]); // eslint-disable-line react-hooks/exhaustive-deps

  const [completedRecord, setCompletedRecord] = useState(null);
  const [rewardPending, setRewardPending] = useState(false);
  const [deckExhausted, setDeckExhausted] = useState(false);
  const lastRewardEarnedCountRef = useRef(sessionState?.rewardEarnedCount ?? 0);

  // meta.loopModes topics (currently just people_names) never show the
  // "Начать снова / Завершить" deck-exhausted dialog: the deck's own end is
  // treated as a cue to move straight into the next mode in topicRecord.modes
  // (wrapping past the last one), so a single continuous session cycles
  // through every mode. The adult is the only one who ends the session, via
  // the existing header close button — see SessionHeader/openSessionExitPrompt.
  useEffect(() => {
    if (!deckExhausted || !topicRecord?.meta?.loopModes) return;
    const modes = topicRecord.modes ?? [];
    if (!modes.length) return;
    const startIndex = modes.findIndex((m) => m.id === activeModeId);
    // Some modes (e.g. people_names' generalisation_probe) legitimately have
    // no tasks yet — they need content the deck doesn't have today (held-out
    // photos). A 0-task mode never reaches "deck_exhausted" on its own, so
    // landing on one here would otherwise strand the loop on the "нет
    // подходящих предложений" fallback screen. Try each mode in turn and
    // settle on the first one that actually has cards.
    for (let step = 1; step <= modes.length; step++) {
      const candidateId = modes[(startIndex + step) % modes.length]?.id;
      const candidateMode = resolveMode(topicRecord, candidateId);
      if (!candidateMode) continue;
      const { sessionParams: candidateParams, selectedConceptIds: candidateSelected } =
        resolveModeSelection(topicRecord, candidateMode, link, isReading, activeTextId);
      const newState = buildGeneratedSessionState({
        topicRecord, mode: candidateMode, activeStudentId, activeTopicId,
        activeTextId, activeText, activeStudent, link,
        selectedConceptIds: candidateSelected, sessionParams: candidateParams,
      });
      if (!newState || newState.tasks.length === 0) continue;
      setDeckExhausted(false);
      setActiveModeId(candidateId);
      setSessionState(newState);
      return;
    }
  }, [deckExhausted, topicRecord, activeModeId, link, isReading, activeTextId, activeStudentId, activeTopicId, activeText, activeStudent, setActiveModeId]);

  async function finishSession(state) {
    const cardEvents = cardLogger.getCardEvents();
    cardLogger.resetCardEvents();

    // Deck-mode sessions only ever reach "completed" via handleFinishDeck, which is
    // only reachable after "deck_exhausted" (the whole deck was already shown) - it
    // already persists deckPosition:0 itself. Recomputing it here from taskIndex used
    // to clobber that reset with a wrong, near-the-end position (taskIndex counts
    // tasks, not concepts, and isn't advanced past the last valid index on exhaustion),
    // which made the next session's `selected.slice(deckPos)` start from just the last
    // concept or two instead of the full deck.

    const record = {
      ...computeSessionRecord(state, activeStudentId, activeTopicId, topicRecord.meta.version, cardEvents, {
        activeDurationMs: Math.round(getActiveDurationMs()),
        elapsedDurationMs: Math.max(0, Date.now() - new Date(state.startedAt).getTime()),
        paramsSnapshot: sessionParams,
        entryPoint: isStudentPortal ? "student_portal" : "therapist",
      }),
      reward: {
        videoEnabled: Boolean(rewardConfig.videoRewardEnabled),
        videoAvailable: Boolean(rewardConfig.hasRewardVideos && rewardConfig.videoRewardEnabled),
        earned: (state.rewardEarnedCount ?? 0) > 0,
      },
    };
    const db = await getDb();
    await kv.set(db, "lastContext", {
      studentId: activeStudentId,
      topicId:   activeTopicId,
      textId:    activeTextId ?? null,
      modeId:    activeModeId,
    });
    const existing = (await kv.get(db, "sessions")) ?? [];
    const updated = [...existing, record].slice(-200);
    await kv.set(db, "sessions", updated);
    await clearPersistedActiveSessionSnapshot(db);
    clearActiveSessionSnapshot();
    appendSession(record);
    setCompletedRecord(record);
    pushOp("session.append", { ...record, mode: record.modeId });
  }

  useEffect(() => {
    if (!sessionState || !topicRecord || !activeModeId) return undefined;
    if (sessionState.status === "completed") return undefined;

    const snapshot = createActiveSessionSnapshot(
      {
        studentId: activeStudentId,
        topicId: activeTopicId,
        textId: isReading ? activeTextId : null,
        modeId: activeModeId,
      },
      sessionState,
    );

    setActiveSessionSnapshot(snapshot);

    let cancelled = false;
    getDb()
      .then((db) => {
        if (cancelled) return;
        return persistActiveSessionSnapshot(db, snapshot);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [
    activeModeId,
    activeStudentId,
    activeTextId,
    activeTopicId,
    isReading,
    sessionState,
    setActiveSessionSnapshot,
    topicRecord,
  ]);

  useEffect(() => {
    if (!sessionState) return;
    const earned = sessionState.rewardEarnedCount ?? 0;
    if (earned > lastRewardEarnedCountRef.current) {
      lastRewardEarnedCountRef.current = earned;
      if (rewardConfig.hasRewardVideos && rewardConfig.videoRewardEnabled) {
        const timer = window.setTimeout(() => setRewardPending(true), 0);
        return () => window.clearTimeout(timer);
      }
    }
    return undefined;
  }, [sessionState?.rewardEarnedCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearRewardPending = useCallback(() => setRewardPending(false), []);

  const onPrevious = useCallback(() => {
    setSessionState(s => {
      if (s.taskIndex <= 0) return s;
      return { ...s, taskIndex: s.taskIndex - 1, status: "task_active" };
    });
  }, []);

  const onCorrect = useCallback((conceptId, cardId, options = {}) => {
    if (options.assisted) {
      setSessionState((s) => {
        const next = handleAdvance(s);
        if (next.status === "deck_exhausted") { setDeckExhausted(true); return next; }
        if (next.status === "completed") finishSession(next);
        return next;
      });
      return;
    }
    setSessionState((s) => {
      if (s.mode?.evaluation === "instant") {
        return handleInstantCorrect(s, conceptId, cardId);
      }
      const next = handleAnswer(s, true, conceptId, cardId);
      if (next.status === "deck_exhausted") { setDeckExhausted(true); return next; }
      if (next.status === "completed") finishSession(next);
      return next;
    });

    if (!tapToAdvance && !adultConfirmAdvance) {
      setTimeout(() => {
        setSessionState((s) => {
          if (s.status !== "answer_correct") return s;
          if (s.mode.type === "compare_first_number") return s;
          if (s.mode.type === "sort_letters") return s;
          if (s.mode.type === "story_sequence") return s;
          const advanced = handleAdvance(s);
          if (advanced.status === "deck_exhausted") { setDeckExhausted(true); return advanced; }
          if (advanced.status === "completed") finishSession(advanced);
          return advanced;
        });
      }, autoAdvanceDelay * 1000);
    }
  }, [adultConfirmAdvance, tapToAdvance, autoAdvanceDelay]);

  const onIncorrect = useCallback((conceptId, cardId) => {
    setSessionState((s) => {
      if (s.mode?.evaluation === "instant") {
        return handleInstantIncorrect(s, conceptId, cardId);
      }
      return handleAnswer(s, false, conceptId, cardId);
    });
    setTimeout(() => {
      setSessionState((s) => {
        if (s.status !== "answer_incorrect") return s;
        if (s.mode.type === "compare_first_number") return s;
        if (s.tasks[s.taskIndex]?.type === "choose_all") {
          const advanced = handleAdvance(s);
          if (advanced.status === "deck_exhausted") { setDeckExhausted(true); return advanced; }
          if (advanced.status === "completed") finishSession(advanced);
          return advanced;
        }
        return { ...s, status: "task_active", taskRetry: (s.taskRetry ?? 0) + 1 };
      });
    }, INCORRECT_FEEDBACK_MS);
  }, []);

  const onMistake = useCallback((conceptId, cardId) => {
    setSessionState((s) => handleInPlaceIncorrect(s, conceptId, cardId));
  }, []);

  const onAdvance = useCallback(() => {
    setSessionState((s) => {
      const next = handleAdvance(s);
      if (next.status === "deck_exhausted") { setDeckExhausted(true); return next; }
      if (next.status === "completed") finishSession(next);
      return next;
    });
  }, []);

  const onQualityAnswer = useCallback((quality, conceptId, cardId) => {
    setSessionState((s) => {
      const next = handleQualityAnswer(s, quality, conceptId, cardId);
      if (next.status === "deck_exhausted") { setDeckExhausted(true); return next; }
      if (next.status === "completed") finishSession(next);
      return next;
    });
  }, []);

  const handleRestartDeck = useCallback(async () => {
    await persistStudentTopicLink(activeStudentId, activeTopicId, { deckPosition: 0 });
    setDeckExhausted(false);
    const newState = buildGeneratedSessionState({
      topicRecord, mode, activeStudentId, activeTopicId,
      activeTextId, activeText, activeStudent,
      link: { ...link, deckPosition: 0 },
      selectedConceptIds, sessionParams,
    });
    if (newState) setSessionState(newState);
  }, [activeStudentId, activeTopicId, topicRecord, mode, activeTextId, activeText, activeStudent, link, selectedConceptIds, sessionParams]);

  const handleFinishDeck = useCallback(() => {
    setDeckExhausted(false);
    persistStudentTopicLink(activeStudentId, activeTopicId, { deckPosition: 0 });
    if (sessionState) finishSession({ ...sessionState, status: "completed" });
  }, [sessionState, activeStudentId, activeTopicId]);

  const currentTask = sessionState?.tasks[sessionState.taskIndex] ?? null;
  const answersPerStar = sessionState?.answersPerStar ?? 1;
  // When the reward modal is visible, keep the bar full (5 stars) — the internal
  // streakCount resets to 0 in the same update that fires the reward, which makes
  // it look like the reward appeared "without any stars". Show the winning state
  // until the user dismisses the modal, then the bar naturally resets to 0.
  const streakCount = rewardPending
    ? answersPerStar * 5
    : (sessionState?.streakCount ?? 0);
  const bestStreak = sessionState?.bestStreak ?? 0;
  const rewardProgress = {
    available: Boolean(rewardConfig.hasRewardVideos && rewardConfig.videoRewardEnabled),
  };

  return {
    sessionState,
    currentTask,
    mode,
    topicRecord,
    sessionParams,
    completedRecord,
    rewardProgress,
    streakCount,
    bestStreak,
    answersPerStar,
    rewardPending,
    clearRewardPending,
    deckExhausted,
    handleRestartDeck,
    handleFinishDeck,
    onCorrect,
    onPrevious,
    onIncorrect,
    onMistake,
    onAdvance,
    onQualityAnswer,
    onCardShown: cardLogger.onCardShown,
    onTap:       cardLogger.onTap,
    onQuality:   cardLogger.onQuality,
  };
}
