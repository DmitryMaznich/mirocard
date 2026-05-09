import { useState, useCallback } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { pushOp } from "@/core/syncApi";
import { deriveConcepts } from "@/shared/utils/topicUtils";
import { ENGINE_REGISTRY } from "@/topics/renderers/engineRegistry";
import { createSessionState, handleAnswer, handleAdvance, handleQualityAnswer, computeSessionRecord } from "./sessionEngine";

const FEEDBACK_DELAY_MS = 3000;

export function useSessionEngine() {
  const activeStudentId   = useAppStore((s) => s.activeStudentId);
  const activeTopicId     = useAppStore((s) => s.activeTopicId);
  const activeTextId      = useAppStore((s) => s.activeTextId);
  const activeModeId      = useAppStore((s) => s.activeModeId);
  const topicRecords      = useAppStore((s) => s.topicRecords);
  const studentTopicLinks = useAppStore((s) => s.studentTopicLinks);
  const appendSession     = useAppStore((s) => s.appendSession);

  const topicRecord = topicRecords.find((r) => r.meta.id === activeTopicId);
  const mode = topicRecord?.modes?.find((m) => m.id === activeModeId);

  const linkKey = `${activeStudentId}_${activeTopicId}`;
  const link = studentTopicLinks[linkKey] ?? {};
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

  const [completedRecord, setCompletedRecord] = useState(null);

  async function finishSession(state) {
    const record = computeSessionRecord(state, activeStudentId, activeTopicId, topicRecord.meta.version);
    const db = await getDb();
    // Persist last context for smart-resume
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
    setTimeout(() => {
      setSessionState((s) => {
        if (s.status !== "answer_correct") return s;
        if (s.mode.type === "compare_first_number") return s;
        const advanced = handleAdvance(s);
        if (advanced.status === "completed") finishSession(advanced);
        return advanced;
      });
    }, FEEDBACK_DELAY_MS);
  }, []);

  const onIncorrect = useCallback((conceptId, cardId) => {
    setSessionState((s) => handleAnswer(s, false, conceptId, cardId));
    setTimeout(() => {
      setSessionState((s) => {
        if (s.status !== "answer_incorrect") return s;
        if (s.mode.type === "compare_first_number") return s;
        return handleAdvance(s);
      });
    }, FEEDBACK_DELAY_MS);
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

  return {
    sessionState,
    currentTask,
    mode,
    topicRecord,
    sessionParams,
    completedRecord,
    onCorrect,
    onIncorrect,
    onMistake,
    onAdvance,
    onQualityAnswer,
  };
}
