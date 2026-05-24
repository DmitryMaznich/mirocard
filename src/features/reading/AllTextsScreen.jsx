import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/core/store";
import { getRawRecipeTxt, getRecipeOverride, saveRecipeOverride } from "@/core/groupStore";
import { getTopicTitle } from "@/shared/utils/format";

function autoResize(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

function RecipeEditor({ topicId, text, original, saved }) {
  const [value, setValue]       = useState(saved ?? original ?? "");
  const [status, setStatus]     = useState(saved ? "saved" : "original"); // "original" | "dirty" | "saving" | "saved"
  const textareaRef             = useRef(null);
  const originalRef             = useRef(original);

  // sync original once it loads
  useEffect(() => {
    if (original && !saved) {
      setValue(original);
      originalRef.current = original;
      setStatus("original");
    }
  }, [original, saved]);

  useEffect(() => { autoResize(textareaRef.current); }, [value]);

  function handleChange(e) {
    setValue(e.target.value);
    setStatus("dirty");
    autoResize(e.target);
  }

  async function handleSave() {
    setStatus("saving");
    await saveRecipeOverride(topicId, text.id, value);
    setStatus("saved");
  }

  function handleReset() {
    setValue(originalRef.current ?? "");
    setStatus(originalRef.current === value ? "original" : "dirty");
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

  const [data, setData]       = useState({}); // { [id]: { original, saved } }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeTopicId || !instructions.length) { setLoading(false); return; }
    Promise.all(
      instructions.map(async (t) => {
        const [original, saved] = await Promise.all([
          t.file ? getRawRecipeTxt(activeTopicId, t.file) : null,
          getRecipeOverride(activeTopicId, t.id).catch(() => null),
        ]);
        return [t.id, { original, saved }];
      })
    ).then((entries) => {
      setData(Object.fromEntries(entries));
      setLoading(false);
    });
  }, [activeTopicId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("texts")}>←</button>
        <h1 className="screen-title">
          {topicRecord ? getTopicTitle(topicRecord.meta.title) : "Все тексты"}
        </h1>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="empty-state__text">Загрузка…</div>
        </div>
      ) : (
        <div className="all-texts-scroll">
          {instructions.map((text, i) => (
            <div key={text.id} className="all-texts-block">
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
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
