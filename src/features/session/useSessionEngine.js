import { useState, useCallback, useEffect, useRef } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { pushOp } from "@/core/syncApi";
import { deriveConcepts } from "@/shared/utils/topicUtils";
import { ENGINE_REGISTRY } from "@/topics/renderers/engineRegistry";
import { createSessionState, handleAnswer, handleAdvance, handleQualityAnswer, handleInstantCorrect, handleInstantIncorrect, computeSessionRecord } from "./sessionEngine";
import { useCardEventLogger } from "@/features/analytics/useCardEventLogger";
import { getDefaultModeSettings } from "@/topics/topicLoader";
import { persistStudentTopicLink } from "@/core/linkUtils";
import {
  clearActiveSessionSnapshot as clearPersistedActiveSessionSnapshot,
  createActiveSessionSnapshot,
  persistActiveSessionSnapshot,
  restoreActiveSessionState,
} from "./activeSession";

const INCORRECT_FEEDBACK_MS = 1500;

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
    const selected = allConcepts.filter((c) => selectedConceptIds.includes(c.conceptId));
    const deckPos = link.deckPosition ?? 0;
    const safeStart = selected.length > 0 ? deckPos % selected.length : 0;
    const concepts = safeStart === 0 ? selected : selected.slice(safeStart);
    const generateTasks = ENGINE_REGISTRY.flashcards;
    tasks = generateTasks ? generateTasks(mode.type, concepts, topicRecord.cards, sessionParams) : [];
    isDeckMode = true;
  } else if (renderer === "function_cards") {
    const allConcepts = deriveConcepts(topicRecord.cards);
    const selected = allConcepts.filter((c) => selectedConceptIds.includes(c.conceptId));
    const deckPos = link.deckPosition ?? 0;
    const safeStart = selected.length > 0 ? deckPos % selected.length : 0;
    const concepts = safeStart === 0 ? selected : selected.slice(safeStart);
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
  } else {
    const generateTasks = ENGINE_REGISTRY[renderer];
    const sessionSize = topicRecord.meta.sessionConfig?.maxSize ?? 500;
    const selectedCards = topicRecord.cards.filter((card) => selectedConceptIds.includes(card.conceptId));
    tasks = generateTasks
      ? generateTasks(mode, selectedCards.length ? selectedCards : topicRecord.cards, sessionSize, sessionParams)
      : [];
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
  const setActiveSessionSnapshot = useAppStore((s) => s.setActiveSessionSnapshot);
  const clearActiveSessionSnapshot = useAppStore((s) => s.clearActiveSessionSnapshot);
  const adultConfirmAdvance = useAppStore((s) => s.settings.adultConfirmAdvance ?? true);
  const tapToAdvance      = useAppStore((s) => s.settings.tapToAdvance ?? true);
  const autoAdvanceDelay  = useAppStore((s) => s.settings.autoAdvanceDelay ?? 3);

  const topicRecord = topicRecords.find((r) => r.meta.id === activeTopicId);
  const modeFromTopic = topicRecord?.modes?.find((m) => m.id === activeModeId);
  // Override evaluation/rewardThreshold from DEFAULT_MODES — stored records may be stale.
  const defaultModeSettings = topicRecord
    ? getDefaultModeSettings(topicRecord.meta.renderer, activeModeId)
    : null;
  const mode = modeFromTopic
    ? (defaultModeSettings
        ? { ...modeFromTopic, evaluation: defaultModeSettings.evaluation }
        : modeFromTopic)
    : activeModeId === "follow_instruction"
      ? { id: "follow_instruction", type: "follow_instruction", evaluation: "none" }
      : undefined;
  const activeStudent = students.find((s) => s.id === activeStudentId) ?? null;

  const linkKey = `${activeStudentId}_${activeTopicId}`;
  const link = studentTopicLinks[linkKey] ?? {};
  const rewardConfig = {
    videoRewardEnabled: link.videoRewardEnabled ?? true,
    rewardThreshold: link.rewardThreshold ?? defaultModeSettings?.rewardThreshold ?? 90,
    hasRewardVideos: (activeStudent?.rewardVideos?.length ?? 0) > 0,
  };
  const isReading = topicRecord?.meta.renderer === "reading";
  const selectedConceptIds = isReading
    ? (activeTextId ? [activeTextId] : [])
    : link.selectedConceptIds
      ?? topicRecord?.cards.filter((c) => c.primary).map((c) => c.conceptId)
      ?? [];
  const sessionParams = link.params ?? {};
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
  const lastRewardEarnedCountRef = useRef(0);

  async function finishSession(state) {
    const cardEvents = cardLogger.getCardEvents();
    cardLogger.resetCardEvents();

    if (state.isDeckMode) {
      const reps = link.repsPerConcept ?? 1;
      const conceptsDone = Math.max(0, Math.floor(state.taskIndex / reps));
      const currentDeckPos = link.deckPosition ?? 0;
      const totalSelected = selectedConceptIds.length;
      const newPos = totalSelected > 0 ? (currentDeckPos + conceptsDone) % totalSelected : 0;
      await persistStudentTopicLink(activeStudentId, activeTopicId, { deckPosition: newPos });
    }

    const record = {
      ...computeSessionRecord(state, activeStudentId, activeTopicId, topicRecord.meta.version, cardEvents),
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
        setRewardPending(true);
      }
    }
  }, [sessionState?.rewardEarnedCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearRewardPending = useCallback(() => setRewardPending(false), []);

  const onCorrect = useCallback((conceptId, cardId) => {
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
    setSessionState((s) => {
      if (!s || s.mode.evaluation === "none") return s;
      return {
        ...s,
        incorrectCount: s.incorrectCount + 1,
        mistakes: conceptId
          ? [...s.mistakes, { conceptId, cardId }]
          : s.mistakes,
      };
    });
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
  const streakCount = sessionState?.streakCount ?? 0;
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
    rewardPending,
    clearRewardPending,
    deckExhausted,
    handleRestartDeck,
    handleFinishDeck,
    onCorrect,
    onIncorrect,
    onMistake,
    onAdvance,
    onQualityAnswer,
    onCardShown: cardLogger.onCardShown,
    onTap:       cardLogger.onTap,
    onQuality:   cardLogger.onQuality,
  };
}
