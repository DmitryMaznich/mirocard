import { useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { scriptToText, textToScript } from "./scriptFormat";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";
import { getInitials } from "@/shared/utils/format";
import "./chatParams.css";

export default function ChatParamsScreen() {
  const setScreen             = useAppStore((s) => s.setScreen);
  const activeTopicId         = useAppStore((s) => s.activeTopicId);
  const activeModeId          = useAppStore((s) => s.activeModeId);
  const topicRecords          = useAppStore((s) => s.topicRecords);
  const chatScriptOverride    = useAppStore((s) => s.chatScriptOverride);
  const setChatScriptOverride = useAppStore((s) => s.setChatScriptOverride);
  const activeStudentId       = useAppStore((s) => s.activeStudentId);
  const students              = useAppStore((s) => s.students);

  const student    = students.find((s) => s.id === activeStudentId);
  const closeAdults = student?.closeAdults ?? [];

  const topicRecord = topicRecords.find((r) => r.meta.id === activeTopicId);
  const modeScript  = activeModeId ? topicRecord?.scripts?.[activeModeId] : null;
  const rawScript   = topicRecord
    ? {
        contact: modeScript?.contact ?? topicRecord.contact ?? null,
        turns:   modeScript?.turns   ?? topicRecord.turns   ?? [],
      }
    : null;

  const overrideKey   = activeModeId ? `${activeTopicId}:${activeModeId}` : activeTopicId;
  const savedOverride = chatScriptOverride?.topicId === overrideKey ? chatScriptOverride : null;

  const [scriptText,      setScriptText]      = useState(savedOverride?.text ?? scriptToText(rawScript));
  const [editingScript,   setEditingScript]   = useState(false);
  const [scriptEdit,      setScriptEdit]      = useState("");
  const [selectedAdultId, setSelectedAdultId] = useState(savedOverride?.contactOverride?.id ?? null);
  const [error,           setError]           = useState(null);

  useEffect(() => {
    const saved = chatScriptOverride?.topicId === overrideKey ? chatScriptOverride : null;
    setScriptText(saved?.text ?? scriptToText(rawScript));
    setSelectedAdultId(saved?.contactOverride?.id ?? null);
    setError(null);
  }, [activeTopicId, activeModeId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!topicRecord) {
    return <div className="screen-center">Тема не загружена</div>;
  }

  const modeTitle  = activeModeId
    ? (topicRecord.modes?.find((m) => m.id === activeModeId)?.ui?.title?.ru ?? activeModeId)
    : null;
  const topicTitle = topicRecord.meta.title?.ru ?? topicRecord.meta.title;

  const selectedAdult = selectedAdultId
    ? closeAdults.find((a) => a.id === selectedAdultId) ?? null
    : null;

  function handleStart() {
    try {
      const parsed = textToScript(scriptText, rawScript?.contact);
      if (!parsed.turns.length) {
        setError("Нет ни одного хода. Добавь реплику контакта и варианты ответа.");
        return;
      }
      const contactOverride = selectedAdult
        ? { id: selectedAdult.id, name: selectedAdult.name, photo: selectedAdult.photo ?? null }
        : null;
      setChatScriptOverride(overrideKey, scriptText, contactOverride);
      setScreen("chat_session");
    } catch (e) {
      setError(String(e));
    }
  }

  function handleReset() {
    setScriptText(scriptToText(rawScript));
    setError(null);
  }

  function handleDownload() {
    const filename = `${modeTitle ?? topicTitle}.txt`;
    const blob = new Blob([scriptText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen(topicRecord.modes?.length > 0 ? "modes" : "home")}>←</button>
        <h1 className="screen-title">{modeTitle ?? topicTitle}</h1>
      </div>

      <div className="params-layout">

        {/* ─── Левая колонка (инфо + кнопка) ─── */}
        <div className="params-info-col">
          <div className="params-info-topic">{topicTitle}</div>
          {modeTitle && <div className="params-info-mode">{modeTitle}</div>}
          {student && (
            <div className="params-info-student">
              <div className="params-info-student__avatar">
                {student.photoDataUrl
                  ? <img src={student.photoDataUrl} alt={student.name} />
                  : getInitials(student.name)}
              </div>
              <div className="params-info-student__name">{student.name}</div>
            </div>
          )}
          {error && <div className="chat-params-error">{error}</div>}
          <div className="params-info-start">
            <Button fullWidth onClick={handleStart}>Начать занятие</Button>
          </div>
        </div>

        {/* ─── Правая колонка (настройки) ─── */}
        <div className="params-settings-col">
          <div className="params-body">

            {/* Выбор контакта */}
            {closeAdults.length > 0 && (
              <div className="param-row param-row--block">
                <div className="param-label">С кем чат</div>
                <div className="chat-contact-picker">
                  <button
                    className={`chat-contact-option${!selectedAdultId ? " chat-contact-option--active" : ""}`}
                    onClick={() => setSelectedAdultId(null)}
                  >
                    <span className="chat-contact-option__avatar chat-contact-option__avatar--emoji">
                      {rawScript?.contact?.emoji ?? "💬"}
                    </span>
                    <span className="chat-contact-option__name">{rawScript?.contact?.name ?? "По умолчанию"}</span>
                  </button>
                  {closeAdults.map((adult) => (
                    <button
                      key={adult.id}
                      className={`chat-contact-option${selectedAdultId === adult.id ? " chat-contact-option--active" : ""}`}
                      onClick={() => setSelectedAdultId(adult.id)}
                    >
                      <span className="chat-contact-option__avatar">
                        {adult.photo
                          ? <img src={adult.photo} alt={adult.name} />
                          : getInitials(adult.name)}
                      </span>
                      <span className="chat-contact-option__name">{adult.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Скрипт */}
            <div className="param-row">
              <div className="param-label">Скрипт</div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button
                  className="link-btn"
                  onClick={() => { setScriptEdit(scriptText); setEditingScript(true); }}
                >
                  Редактировать
                </button>
                <button className="link-btn" onClick={handleReset}>
                  Сбросить
                </button>
                <button className="link-btn" onClick={handleDownload} disabled={!scriptText}>
                  Скачать
                </button>
              </div>
            </div>

          </div>

          {error && <div className="chat-params-error" style={{ margin: "0 12px 8px" }}>{error}</div>}

          <div className="params-start-phone">
            <Button fullWidth onClick={handleStart}>Начать занятие</Button>
          </div>
        </div>
      </div>

      {/* Модал редактирования */}
      {editingScript && (
        <Modal title="Редактирование скрипта" onClose={() => setEditingScript(false)}>
          <div className="chat-params-hint" style={{ marginBottom: 8 }}>
            <code>~ любой ответ</code>
            <code>+ правильный &gt; реакция</code>
            <code>- неправильный &gt; реакция</code>
            <code>&gt; реакция на ~ блок</code>
          </div>
          <textarea
            className="instruction-recipe-textarea"
            value={scriptEdit}
            onChange={(e) => setScriptEdit(e.target.value)}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            rows={18}
          />
          <div className="instruction-recipe-actions">
            <button className="reading-secondary-btn" onClick={() => setEditingScript(false)}>Отмена</button>
            <button className="reading-primary-btn" onClick={() => { setScriptText(scriptEdit); setEditingScript(false); }}>Сохранить</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
