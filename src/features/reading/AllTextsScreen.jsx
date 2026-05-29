import { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/core/store";
import {
  getRawRecipeTxt,
  getRecipeOverrideForMode,
  saveRecipeOverrideForMode,
  getUserRecipes,
  createUserRecipe,
  deleteUserRecipe,
  pullRecipeKvFromServer,
} from "@/core/groupStore";
import { getTopicTitle } from "@/shared/utils/format";

function autoResize(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

function RecipeEditor({ topicId, text, original, saved, onDelete, onSave }) {
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

  useEffect(() => { autoResize(textareaRef.current); }, [value]);

  function handleChange(e) {
    setValue(e.target.value);
    setStatus("dirty");
    autoResize(e.target);
  }

  async function handleSave() {
    setStatus("saving");
    await saveRecipeOverrideForMode(topicId, text.id, "group", value);
    setStatus("saved");
    onSave?.(value);
  }

  async function handleReset() {
    await saveRecipeOverrideForMode(topicId, text.id, "group", null);
    setValue(originalRef.current ?? "");
    setStatus("original");
    onSave?.(null);
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
          {!text.createdByUser && (isDirty || isSaved) && (
            <button
              className="recipe-editor__btn recipe-editor__btn--reset"
              onClick={handleReset}
              title="Сбросить к оригиналу из ZIP"
            >
              ↺
            </button>
          )}
          {text.createdByUser && onDelete && (
            <button
              className="recipe-editor__btn recipe-editor__btn--delete"
              onClick={onDelete}
              title="Удалить рецепт"
            >
              ✕
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
        placeholder={text.createdByUser ? "Введите название рецепта в первой строке, затем шаги…" : ""}
      />
    </div>
  );
}

export default function AllTextsScreen() {
  const setScreen     = useAppStore((s) => s.setScreen);
  const activeTopicId = useAppStore((s) => s.activeTopicId);
  const topicRecords  = useAppStore((s) => s.topicRecords);

  const topicRecord    = topicRecords.find((r) => r.meta.id === activeTopicId);
  const baseInstructions = (topicRecord?.texts ?? []).filter((t) => t.kind === "instruction");

  const [data,         setData]         = useState({});
  const [loading,      setLoading]      = useState(true);
  const [userRecipes,  setUserRecipes]  = useState([]);
  const [newTitle,     setNewTitle]     = useState("");
  const [addingNew,    setAddingNew]    = useState(false);
  const [pullTick,     setPullTick]     = useState(0);

  const instructions = [...baseInstructions, ...userRecipes];

  useEffect(() => {
    if (!activeTopicId) return;
    pullRecipeKvFromServer()
      .catch(() => {})
      .finally(() => {
        getUserRecipes(activeTopicId).then(setUserRecipes).catch(() => {});
        setPullTick((t) => t + 1);
      });
  }, [activeTopicId]);

  useEffect(() => {
    if (!activeTopicId || !instructions.length) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    Promise.all(
      instructions.map(async (t) => {
        const [original, saved] = await Promise.all([
          t.file ? getRawRecipeTxt(activeTopicId, t.file) : null,
          getRecipeOverrideForMode(activeTopicId, t.id, "group").catch(() => null),
        ]);
        return [t.id, { original, saved }];
      })
    ).then((entries) => {
      if (cancelled) return;
      setData(Object.fromEntries(entries));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeTopicId, userRecipes.length, pullTick]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreateRecipe() {
    const title = newTitle.trim();
    if (!title) return;
    const entry = await createUserRecipe(activeTopicId, title);
    setUserRecipes((prev) => [...prev, entry]);
    setData((prev) => ({ ...prev, [entry.id]: { original: null, saved: null } }));
    setNewTitle("");
    setAddingNew(false);
  }

  async function handleDeleteRecipe(recipeId) {
    await deleteUserRecipe(activeTopicId, recipeId);
    setUserRecipes((prev) => prev.filter((r) => r.id !== recipeId));
    setData((prev) => { const next = { ...prev }; delete next[recipeId]; return next; });
  }

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
                  {text.createdByUser && <span className="all-texts-user-badge"> · мой</span>}
                </span>
              </div>
              <RecipeEditor
                topicId={activeTopicId}
                text={text}
                original={data[text.id]?.original ?? null}
                saved={data[text.id]?.saved ?? null}
                onDelete={text.createdByUser ? () => handleDeleteRecipe(text.id) : null}
                onSave={(val) => setData((prev) => ({ ...prev, [text.id]: { ...prev[text.id], saved: val } }))}
              />
            </div>
          ))}

          {addingNew ? (
            <div className="all-texts-new-recipe">
              <input
                className="all-texts-new-recipe__input"
                type="text"
                placeholder="Название рецепта"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateRecipe()}
                autoFocus
              />
              <div className="all-texts-new-recipe__actions">
                <button className="recipe-editor__btn recipe-editor__btn--save" onClick={handleCreateRecipe} disabled={!newTitle.trim()}>
                  Создать
                </button>
                <button className="recipe-editor__btn" onClick={() => { setAddingNew(false); setNewTitle(""); }}>
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <button className="all-texts-add-btn" onClick={() => setAddingNew(true)}>
              + Новый рецепт
            </button>
          )}
        </div>
      )}
    </div>
  );
}
