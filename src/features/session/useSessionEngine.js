import { useState, useCallback } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { deriveConcepts } from "@/shared/utils/topicUtils";
import { generateTasks } from "@/topics/renderers/flashcards/engine";
import { createSessionState, handleAnswer, handleAdvance, computeSessionRecord } from "./sessionEngine";

const FEEDBACK_DELAY_MS = 900;

export function useSessionEngine() {
  const activeStudentId   = useAppStore((s) => s.activeStudentId);
  const activeTopicId     = useAppStore((s) => s.activeTopicId);
  const activeModeId      = useAppStore((s) => s.activeModeId);
  const topicRecords      = useAppStore((s) => s.topicRecords);
  const studentTopicLinks = useAppStore((s) => s.studentTopicLinks);
  const appendSession     = useAppStore((s) => s.appendSession);
  const setScreen         = useAppStore((s) => s.setScreen);

  const topicRecord = topicRecords.find((r) => r.meta.id === activeTopicId);
  const mode = topicRecord?.modes?.find((m) => m.id === activeModeId);

  const linkKey = `${activeStudentId}_${activeTopicId}`;
  const link = studentTopicLinks[linkKey] ?? {};
  const selectedConceptIds = link.selectedConceptIds
    ?? topicRecord?.cards.filter((c) => c.primary).map((c) => c.conceptId)
    ?? [];
  const sessionParams = link.params ?? {};

  const [sessionState, setSessionState] = useState(() => {
    if (!topicRecord || !mode) return null;
    const allConcepts = deriveConcepts(topicRecord.cards);
    const concepts = allConcepts.filter((c) => selectedConceptIds.includes(c.conceptId));
    const tasks = generateTasks(mode.type, concepts, topicRecord.cards, sessionParams);
    return createSessionState(
      tasks, mode, activeStudentId, activeTopicId,
      topicRecord.meta.version, selectedConceptIds
    );
  });

  const [completedRecord, setCompletedRecord] = useState(null);

  async function finishSession(state) {
    const record = computeSessionRecord(state, activeStudentId, activeTopicId, topicRecord.meta.version);
    const db = await getDb();
    const existing = (await kv.get(db, "sessions")) ?? [];
    const updated = [...existing, record].slice(-200);
    await kv.set(db, "sessions", updated);
    appendSession(record);
    setCompletedRecord(record);
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
        return handleAdvance(s);
      });
    }, FEEDBACK_DELAY_MS * 1.8);
  }, []);

  const onAdvance = useCallback(() => {
    setSessionState((s) => {
      const next = handleAdvance(s);
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
    completedRecord,
    onCorrect,
    onIncorrect,
    onAdvance,
  };
}
