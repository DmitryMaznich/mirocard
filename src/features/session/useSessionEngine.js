import { useState, useCallback, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { pushOp } from "@/core/syncApi";
import { deriveConcepts } from "@/shared/utils/topicUtils";
import { ENGINE_REGISTRY } from "@/topics/renderers/engineRegistry";
import { createSessionState, handleAnswer, handleAdvance, handleQualityAnswer, computeSessionRecord } from "./sessionEngine";
import { buildRewardProgress } from "./rewardProgress";

const INCORRECT_FEEDBACK_MS = 1500;

export function useSessionEngine() {
  const activeStudentId   = useAppStore((s) => s.activeStudentId);
  const activeTopicId     = useAppStore((s) => s.activeTopicId);
  const activeTextId      = useAppStore((s) => s.activeTextId);
  const activeModeId      = useAppStore((s) => s.activeModeId);
  const topicRecords      = useAppStore((s) => s.topicRecords);
  const students          = useAppStore((s) => s.students);
  const studentTopicLinks = useAppStore((s) => s.studentTopicLinks);
  const appendSession     = useAppStore((s) => s.appendSession);
  const adultConfirmAdvance = useAppStore((s) => s.settings.adultConfirmAdvance ?? true);
  const tapToAdvance      = useAppStore((s) => s.settings.tapToAdvance ?? true);
  const autoAdvanceDelay  = useAppStore((s) => s.settings.autoAdvanceDelay ?? 3);

  const topicRecord = topicRecords.find((r) => r.meta.id === activeTopicId);
  const modeFromTopic = topicRecord?.modes?.find((m) => m.id === activeModeId);
  const mode = modeFromTopic ?? (
    activeModeId === "follow_instruction"
      ? { id: "follow_instruction", type: "follow_instruction", evaluation: "none" }
      : undefined
  );
  const activeStudent = students.find((s) => s.id === activeStudentId) ?? null;

  const linkKey = `${activeStudentId}_${activeTopicId}`;
  const link = studentTopicLinks[linkKey] ?? {};
  const rewardConfig = {
    videoRewardEnabled: link.videoRewardEnabled ?? true,
    rewardThreshold: link.rewardThreshold ?? 90,
    hasRewardVideos: (activeStudent?.rewardVideos?.length ?? 0) > 0,
  };
  const isReading = topicRecord?.meta.renderer === "reading";
  const selectedConceptIds = isReading
    ? (activeTextId ? [activeTextId] : [])
    : link.selectedConceptIds
      ?? topicRecord?.cards.filter((c) => c.primary).map((c) => c.conceptId)
      ?? [];
  const sessionParams = link.params ?? {};

  const [sessionState, setSessionState] = useState(() => {
    if (!topicRecord || !mode) return null;

    const renderer = topicRecord.meta.renderer;
    let tasks;

    if (renderer === "reading") {
      const generateTasks = ENGINE_REGISTRY["reading"];
      tasks = generateTasks
        ? generateTasks(mode, topicRecord, activeTextId, sessionParams)
        : [];
    } else if (renderer === "flashcards") {
      const allConcepts = deriveConcepts(topicRecord.cards);
      const concepts = allConcepts.filter((c) => selectedConceptIds.includes(c.conceptId));
      const generateTasks = ENGINE_REGISTRY["flashcards"];
      tasks = generateTasks(mode.type, concepts, topicRecord.cards, sessionParams);
    } else if (renderer === "sentence_puzzle") {
      const generateTasks = ENGINE_REGISTRY["sentence_puzzle"];
      const spSelected = link.selectedConceptIds?.length ? link.selectedConceptIds : null;
      tasks = generateTasks ? generateTasks(mode, topicRecord, sessionParams, activeStudent, spSelected) : [];
    } else {
      const generateTasks = ENGINE_REGISTRY[renderer];
      const sessionSize = topicRecord.meta.sessionConfig?.maxSize ?? 15;
      const selectedCards = topicRecord.cards.filter((c) => selectedConceptIds.includes(c.conceptId));
      tasks = generateTasks
        ? generateTasks(mode, selectedCards.length ? selectedCards : topicRecord.cards, sessionSize, sessionParams)
        : [];
    }

    const baseState = createSessionState(
      tasks, mode, activeStudentId, activeTopicId,
      topicRecord.meta.version, selectedConceptIds, isReading ? activeTextId : null
    );
    if (mode.type === "assemble_text") {
      const totalWords = tasks.reduce((sum, t) => sum + (t.tokenCount ?? 0), 0);
      return { ...baseState, totalWords };
    }
    return baseState;
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

  async function finishSession(state) {
    const finalRewardProgress = buildRewardProgress({
      sessionState: state,
      mode: state.mode,
      ...rewardConfig,
    });
    const record = {
      ...computeSessionRecord(state, activeStudentId, activeTopicId, topicRecord.meta.version),
      reward: {
        videoEnabled: Boolean(rewardConfig.videoRewardEnabled),
        videoAvailable: finalRewardProgress.available,
        threshold: finalRewardProgress.threshold,
        target: finalRewardProgress.target,
        earned: finalRewardProgress.earned,
        completed: finalRewardProgress.completed,
        total: finalRewardProgress.total,
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
    appendSession(record);
    setCompletedRecord(record);
    pushOp("session.append", { ...record, mode: record.modeId });
  }

  const onCorrect = useCallback((conceptId, cardId) => {
    setSessionState((s) => {
      const next = handleAnswer(s, true, conceptId, cardId);
      if (next.status === "completed") finishSession(next);
      return next;
    });

    if (!tapToAdvance && !adultConfirmAdvance) {
      setTimeout(() => {
        setSessionState((s) => {
          if (s.status !== "answer_correct") return s;
          if (s.mode.type === "compare_first_number") return s;
          const advanced = handleAdvance(s);
          if (advanced.status === "completed") finishSession(advanced);
          return advanced;
        });
      }, autoAdvanceDelay * 1000);
    }
  }, [adultConfirmAdvance, tapToAdvance, autoAdvanceDelay]);

  const onIncorrect = useCallback((conceptId, cardId) => {
    setSessionState((s) => handleAnswer(s, false, conceptId, cardId));
    setTimeout(() => {
      setSessionState((s) => {
        if (s.status !== "answer_incorrect") return s;
        if (s.mode.type === "compare_first_number") return s;
        if (s.tasks[s.taskIndex]?.type === "choose_all") {
          const advanced = handleAdvance(s);
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
      if (next.status === "completed") finishSession(next);
      return next;
    });
  }, []);

  const onQualityAnswer = useCallback((quality, conceptId, cardId) => {
    setSessionState((s) => {
      const next = handleQualityAnswer(s, quality, conceptId, cardId);
      if (next.status === "completed") finishSession(next);
      return next;
    });
  }, []);

  const currentTask = sessionState?.tasks[sessionState.taskIndex] ?? null;
  const rewardProgress = buildRewardProgress({
    sessionState,
    mode,
    ...rewardConfig,
  });

  return {
    sessionState,
    currentTask,
    mode,
    topicRecord,
    sessionParams,
    completedRecord,
    rewardProgress,
    onCorrect,
    onIncorrect,
    onMistake,
    onAdvance,
    onQualityAnswer,
  };
}
