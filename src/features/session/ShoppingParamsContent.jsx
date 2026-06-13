import { useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { useTimer } from "@/features/timer/TimerContext";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/Modal";
import { getRawRecipeTxt, pullRecipeKvFromServer, getRecipeOverrideForMode, saveRecipeOverrideForMode } from "@/core/groupStore";

export default function ShoppingParamsContent({ topicId, textId, filePath, topicTitle, modeTitle }) {
  const setScreen = useAppStore((s) => s.setScreen);
  const { markSessionStart } = useTimer();

  const [rawText,      setRawText]      = useState("");
  const [editingText,  setEditingText]  = useState(false);
  const [textEdit,     setTextEdit]     = useState("");

  async function loadText() {
    await pullRecipeKvFromServer().catch(() => {});
    const override = textId
      ? await getRecipeOverrideForMode(topicId, textId, "group").catch(() => null)
      : null;
    const text = override ?? (filePath ? await getRawRecipeTxt(topicId, filePath).catch(() => "") : "");
    setRawText(text ?? "");
  }

  useEffect(() => {
    loadText();
  }, [topicId, textId, filePath]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveEdit() {
    if (textId) await saveRecipeOverrideForMode(topicId, textId, "group", textEdit).catch(() => {});
    setRawText(textEdit);
    setEditingText(false);
  }

  async function handleReset() {
    if (textId) await saveRecipeOverrideForMode(topicId, textId, "group", null).catch(() => {});
    await loadText();
  }

  function handleDownload() {
    const blob = new Blob([rawText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shopping.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  function startSession() {
    markSessionStart();
    setScreen("session");
  }

  return (
    <div className="params-layout">
      <div className="params-info-col">
        {topicTitle && <div className="params-info-topic">{topicTitle}</div>}
        {modeTitle  && <div className="params-info-mode">{modeTitle}</div>}
        <div className="params-info-start">
          <Button fullWidth onClick={startSession}>Начать</Button>
        </div>
      </div>

      <div className="params-settings-col">
        <div className="params-body">
          <div className="param-row">
            <div className="param-label">Список покупок</div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button
                className="link-btn"
                onClick={() => { setTextEdit(rawText); setEditingText(true); }}
              >
                Редактировать
              </button>
              <button
                className="link-btn"
                onClick={handleReset}
                disabled={!textId}
                title="Сбросить изменения и загрузить из колоды"
              >
                Сбросить
              </button>
              <button
                className="link-btn"
                onClick={handleDownload}
                disabled={!rawText}
              >
                Скачать
              </button>
            </div>
          </div>
        </div>

        <div className="params-start-phone">
          <Button fullWidth onClick={startSession}>Начать</Button>
        </div>
      </div>

      {editingText && (
        <Modal title="Редактирование списка покупок" onClose={() => setEditingText(false)}>
          <textarea
            className="instruction-recipe-textarea"
            value={textEdit}
            onChange={(e) => setTextEdit(e.target.value)}
            rows={18}
          />
          <div className="instruction-recipe-actions">
            <button className="reading-secondary-btn" onClick={() => setEditingText(false)}>Отмена</button>
            <button className="reading-primary-btn" onClick={saveEdit}>Сохранить</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
