import { useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { scriptToText, textToScript } from "./scriptFormat";
import "./chatParams.css";

export default function ChatParamsScreen() {
  const setScreen             = useAppStore((s) => s.setScreen);
  const activeTopicId         = useAppStore((s) => s.activeTopicId);
  const activeModeId          = useAppStore((s) => s.activeModeId);
  const topicRecords          = useAppStore((s) => s.topicRecords);
  const chatScriptOverride    = useAppStore((s) => s.chatScriptOverride);
  const setChatScriptOverride = useAppStore((s) => s.setChatScriptOverride);

  const topicRecord = topicRecords.find((r) => r.meta.id === activeTopicId);
  const modeScript  = activeModeId ? topicRecord?.scripts?.[activeModeId] : null;
  const rawScript   = topicRecord
    ? {
        contact: modeScript?.contact ?? topicRecord.contact ?? null,
        turns:   modeScript?.turns   ?? topicRecord.turns   ?? [],
      }
    : null;

  const overrideKey   = activeModeId ? `${activeTopicId}:${activeModeId}` : activeTopicId;
  const initialText =
    chatScriptOverride?.topicId === overrideKey
      ? chatScriptOverride.text
      : scriptToText(rawScript);

  const [text, setText]     = useState(initialText);
  const [error, setError]   = useState(null);

  useEffect(() => {
    const next =
      chatScriptOverride?.topicId === overrideKey
        ? chatScriptOverride.text
        : scriptToText(rawScript);
    setText(next);
    setError(null);
  }, [activeTopicId, activeModeId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleStart() {
    try {
      const parsed = textToScript(text, rawScript?.contact);
      if (!parsed.turns.length) {
        setError("Нет ни одного хода. Добавь реплику Мамы и варианты ответа.");
        return;
      }
      setChatScriptOverride(overrideKey, text);
      setScreen("chat_session");
    } catch (e) {
      setError(String(e));
    }
  }

  function handleReset() {
    setText(scriptToText(rawScript));
    setError(null);
  }

  if (!topicRecord) {
    return <div className="screen-center">Тема не загружена</div>;
  }

  return (
    <div className="chat-params-screen">
      <div className="chat-params-header">
        <button className="chat-params-back" onClick={() => setScreen(topicRecord.modes?.length > 0 ? "modes" : "home")}>←</button>
        <span className="chat-params-title">
          {activeModeId
            ? (topicRecord.modes?.find((m) => m.id === activeModeId)?.ui?.title?.ru ?? activeModeId)
            : (topicRecord.meta.title?.ru ?? topicRecord.meta.title)}
        </span>
        <button className="chat-params-reset" onClick={handleReset} title="Сбросить к оригиналу">↺</button>
      </div>

      <div className="chat-params-hint">
        <code>~ любой ответ</code>
        <code>+ правильный &gt; реакция</code>
        <code>- неправильный &gt; реакция</code>
        <code>&gt; реакция на ~ блок</code>
      </div>

      <textarea
        className="chat-params-editor"
        value={text}
        onChange={(e) => { setText(e.target.value); setError(null); }}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
      />

      {error && <div className="chat-params-error">{error}</div>}

      <div className="chat-params-footer">
        <button className="btn btn--primary chat-params-start" onClick={handleStart}>
          Начать
        </button>
      </div>
    </div>
  );
}
