import { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/core/store";
import {
  getRawRecipeTxt,
  getRecipeOverrideForMode,
  saveRecipeOverrideForMode,
  getRecipeSettings,
} from "@/core/groupStore";
import { getTopicTitle } from "@/shared/utils/format";

function autoResize(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

function RecipeEditor({ topicId, text, original, saved, mode }) {
  const [value, setValue]   = useState(saved ?? original ?? "");
  const [status, setStatus] = useState(saved ? "saved" : "original");
  const textareaRef         = useRef(null);
  const originalRef         = useRef(original);

  useEffect(() => {
    if (original && !saved) {
      setValue(original);
      originalRef.current = original;
      setStatus("original");
    }
  }, [original, saved]);

  useEffect(() => {
    setValue(saved ?? original ?? "");
    setStatus(saved ? "saved" : "original");
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { autoResize(textareaRef.current); }, [value]);

  function handleChange(e) {
    setValue(e.target.value);
    setStatus("dirty");
    autoResize(e.target);
  }

  async function handleSave() {
    setStatus("saving");
    await saveRecipeOverrideForMode(topicId, text.id, mode, value);
    setStatus("saved");
  }

  function handleReset() {
    setValue(originalRef.current ?? "");
    setStatus("original");
  }

  const isDirty  = status === "dirty";
  const isSaving = status === "saving";
  const isSaved  = status === "saved";

  return (
    <div className={`recipe-editor ${isDirty ? "recipe-editor--dirty" : ""}`}>
      <div className="recipe-editor__toolbar">
        <span className="recipe-editor__status">
          {isSaving && "Сохранение…"}
          {isSaved  && !isDirty && "✓ Сохранено"}
          {isDirty  && "● Изменено"}
        </span>
        <div className="recipe-editor__actions">
          {(isDirty || isSaved) && (
            <button
              className="recipe-editor__btn recipe-editor__btn--reset"
              onClick={handleReset}
              title="Сбросить к оригиналу из ZIP"
            >
              ↺
            </button>
          )}
          <button
            className="recipe-editor__btn recipe-editor__btn--save"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
          >
            Сохранить
          </button>
        </div>
      </div>
      <textarea
        ref={textareaRef}
        className="recipe-editor__textarea"
        value={value}
        onChange={handleChange}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
      />
    </div>
  );
}

export default function AllTextsScreen() {
  const setScreen     = useAppStore((s) => s.setScreen);
  const activeTopicId = useAppStore((s) => s.activeTopicId);
  const topicRecords  = useAppStore((s) => s.topicRecords);

  const topicRecord  = topicRecords.find((r) => r.meta.id === activeTopicId);
  const instructions = (topicRecord?.texts ?? []).filter((t) => t.kind === "instruction");

  const [mode,    setMode]    = useState("group");
  const [data,    setData]    = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeTopicId) return;
    getRecipeSettings(activeTopicId).then((s) => setMode(s.mode ?? "group")).catch(() => {});
  }, [activeTopicId]);

  useEffect(() => {
    if (!activeTopicId || !instructions.length) { setLoading(false); return; }
    setLoading(true);
    Promise.all(
      instructions.map(async (t) => {
        const [original, saved] = await Promise.all([
          t.file ? getRawRecipeTxt(activeTopicId, t.file) : null,
          getRecipeOverrideForMode(activeTopicId, t.id, mode).catch(() => null),
        ]);
        return [t.id, { original, saved }];
      })
    ).then((entries) => {
      setData(Object.fromEntries(entries));
      setLoading(false);
    });
  }, [activeTopicId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("texts")}>←</button>
        <h1 className="screen-title">
          {topicRecord ? getTopicTitle(topicRecord.meta.title) : "Все тексты"}
        </h1>
        <div className="all-texts-mode-toggle">
          <button
            className={`all-texts-mode-btn ${mode === "group" ? "all-texts-mode-btn--active" : ""}`}
            onClick={() => setMode("group")}
          >
            Группа
          </button>
          <button
            className={`all-texts-mode-btn ${mode === "individual" ? "all-texts-mode-btn--active" : ""}`}
            onClick={() => setMode("individual")}
          >
            Инд.
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="empty-state__text">Загрузка…</div>
        </div>
      ) : (
        <div className="all-texts-scroll">
          {instructions.map((text, i) => (
            <div key={`${text.id}_${mode}`} className="all-texts-block">
              <div className="all-texts-block__header">
                <span className="all-texts-index">{i + 1}</span>
                <span className="all-texts-block__title">
                  {getTopicTitle(text.title) || text.id}
                </span>
              </div>
              <RecipeEditor
                topicId={activeTopicId}
                text={text}
                original={data[text.id]?.original ?? null}
                saved={data[text.id]?.saved ?? null}
                mode={mode}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
