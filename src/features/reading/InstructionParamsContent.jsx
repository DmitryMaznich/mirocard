import { useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { useTimer } from "@/features/timer/TimerContext";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/Modal";
import { getInitials } from "@/shared/utils/format";
import { getRecipeSettings, saveRecipeSettings, getRecipeOverrideForMode, saveRecipeOverrideForMode, getRawRecipeTxt, pullRecipeKvFromServer } from "@/core/groupStore";
import { parseRecipeTxt } from "@/topics/renderers/reading/parseRecipeTxt";

export default function InstructionParamsContent({ topicId, textId, filePath, topicTitle, textTitle, student, kind = "instruction", fixedPortions = null }) {
  const isShopping = kind === "shopping_list";
  const setScreen        = useAppStore((s) => s.setScreen);
  const { markSessionStart } = useTimer();

  const [portions,       setPortions]       = useState(1);
  const [rawRecipe,      setRawRecipe]      = useState("");
  const [editingRecipe,  setEditingRecipe]  = useState(false);
  const [recipeEdit,     setRecipeEdit]     = useState("");

  async function loadRecipeText() {
    const rawText = await (async () => {
      if (textId) {
        const override = await getRecipeOverrideForMode(topicId, textId, "group").catch(() => null);
        if (override) return override;
      }
      if (filePath) return getRawRecipeTxt(topicId, filePath).catch(() => null);
      return null;
    })();
    if (rawText) {
      setRawRecipe(rawText);
    }
  }

  useEffect(() => {
    async function load() {
      await pullRecipeKvFromServer().catch(() => {});
      const settings = await getRecipeSettings(topicId, textId).catch(() => ({ portions: 1 }));
      setPortions(settings.portions ?? 1);
      await loadRecipeText();
    }
    load();
  }, [topicId, textId, filePath]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveRecipeEdit() {
    if (textId) await saveRecipeOverrideForMode(topicId, textId, "group", recipeEdit).catch(() => {});
    setRawRecipe(recipeEdit);
    setEditingRecipe(false);
  }

  async function handleReset() {
    if (textId) await saveRecipeOverrideForMode(topicId, textId, "group", null).catch(() => {});
    await loadRecipeText();
  }

  function handleDownload() {
    const filename = textTitle ? `${textTitle}.txt` : "recipe.txt";
    const blob = new Blob([rawRecipe], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handlePortionsChange(delta) {
    const next = Math.max(1, Math.min(20, portions + delta));
    setPortions(next);
    await saveRecipeSettings(topicId, textId, { portions: next }).catch(() => {});
  }

  async function startSession() {
    markSessionStart();
    setScreen("session");
  }

  return (
    <div className="params-layout">
      <div className="params-info-col">
        {topicTitle && <div className="params-info-topic">{topicTitle}</div>}
        {textTitle  && <div className="params-info-mode">{textTitle}</div>}
        {student && (
          <div className="params-info-student">
            <div className="params-info-student__avatar">
              {student.photoDataUrl
                ? <img src={student.photoDataUrl} alt={student.name} />
                : getInitials(student.name)
              }
            </div>
            <div className="params-info-student__name">{student.name}</div>
          </div>
        )}
        <div className="params-info-start">
          <Button fullWidth onClick={startSession}>Начать занятие</Button>
        </div>
      </div>

      <div className="params-settings-col">
        <div className="params-body">

          {!isShopping && (
          <div className="param-row">
            <div className="param-label">Порций</div>
            {fixedPortions
              ? <span className="all-texts-portions-fixed">готовим {fixedPortions}</span>
              : <div className="all-texts-portions">
                  <button className="all-texts-portions-btn" onClick={() => handlePortionsChange(-1)} disabled={portions <= 1}>−</button>
                  <span className="all-texts-portions-value">{portions}</span>
                  <button className="all-texts-portions-btn" onClick={() => handlePortionsChange(+1)} disabled={portions >= 20}>+</button>
                </div>
            }
          </div>
          )}

          <div className="param-row">
            <div className="param-label">{isShopping ? "Список покупок" : "Инструкция"}</div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button
                className="link-btn"
                onClick={() => { setRecipeEdit(rawRecipe); setEditingRecipe(true); }}
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
                disabled={!rawRecipe}
              >
                Скачать
              </button>
            </div>
          </div>

        </div>

        <div className="params-start-phone">
          <Button fullWidth onClick={startSession}>Начать занятие</Button>
        </div>
      </div>

      {editingRecipe && (
        <Modal title="Редактирование инструкции" onClose={() => setEditingRecipe(false)}>
          <textarea
            className="instruction-recipe-textarea"
            value={recipeEdit}
            onChange={(e) => setRecipeEdit(e.target.value)}
            rows={18}
          />
          <div className="instruction-recipe-actions">
            <button className="reading-secondary-btn" onClick={() => setEditingRecipe(false)}>Отмена</button>
            <button className="reading-primary-btn" onClick={saveRecipeEdit}>Сохранить</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
