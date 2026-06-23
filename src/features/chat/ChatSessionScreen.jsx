import { useState, useCallback, useEffect, useRef } from "react";
import { useAppStore } from "@/core/store";
import { useConversation } from "./useConversation";
import ChatView from "@/shared/components/chat/ChatView";
import ChatSummary from "./ChatSummary";
import "./chat.css";

function resolveVars(str, name) {
  return str?.replace(/\{\{name\}\}/g, name) ?? str;
}

function resolveScript(raw, name) {
  if (!raw) return null;
  return {
    ...raw,
    turns: raw.turns.map((turn) => ({
      ...turn,
      text:             resolveVars(turn.text, name),
      reactionOnSend:   resolveVars(turn.reactionOnSend, name),
      reactionOnCorrect: resolveVars(turn.reactionOnCorrect, name),
      choices: turn.choices?.map((c) => ({ ...c, text: resolveVars(c.text, name) })),
    })),
  };
}

export default function ChatSessionScreen() {
  const setScreen       = useAppStore((s) => s.setScreen);
  const appendSession   = useAppStore((s) => s.appendSession);
  const activeTopicId   = useAppStore((s) => s.activeTopicId);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const topicRecords    = useAppStore((s) => s.topicRecords);
  const students        = useAppStore((s) => s.students);

  const student     = students.find((s) => s.id === activeStudentId);
  const studentName = student?.name ?? "";
  const topicRecord = topicRecords.find((r) => r.meta.id === activeTopicId);
  const rawScript   = topicRecord
    ? { turns: topicRecord.turns ?? [], contact: topicRecord.contact ?? null }
    : null;
  const script = resolveScript(rawScript, studentName);

  const {
    messages, currentChoices, isTyping, sendChoice,
    isComplete, score, disabledChoices, showHint, contact,
  } = useConversation(script);

  const [showingSummary, setShowingSummary] = useState(false);
  const [finalScore, setFinalScore]         = useState(null);
  const sessionSavedRef                     = useRef(false);

  useEffect(() => {
    if (!isComplete || sessionSavedRef.current) return;
    sessionSavedRef.current = true;

    const percent = score.total > 0
      ? Math.round((score.correct / score.total) * 100)
      : 100;

    appendSession({
      id:             crypto.randomUUID(),
      studentId:      activeStudentId,
      topicId:        activeTopicId,
      conceptIds:     [],
      mistakes:       [],
      completedAt:    new Date().toISOString(),
      percentCorrect: percent,
      chatScore:      { correct: score.correct, total: score.total },
    });

    setFinalScore(score);
    setShowingSummary(true);
  }, [isComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBack   = useCallback(() => setScreen("home"), [setScreen]);
  const handleRepeat = useCallback(() => {
    sessionSavedRef.current = false;
    setScreen("chat_session");
  }, [setScreen]);
  const handleHome   = useCallback(() => setScreen("home"), [setScreen]);

  if (showingSummary) {
    return <ChatSummary score={finalScore} onRepeat={handleRepeat} onHome={handleHome} />;
  }

  if (!script) {
    return <div className="screen-center">Тема не загружена</div>;
  }

  return (
    <ChatView
      contact={contact}
      topicId={activeTopicId}
      messages={messages}
      isTyping={isTyping}
      currentChoices={currentChoices}
      disabledChoices={disabledChoices}
      showHint={showHint}
      onSendChoice={sendChoice}
      onBack={handleBack}
    />
  );
}
