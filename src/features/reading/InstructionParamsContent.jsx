import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { useTimer } from "@/features/timer/TimerContext";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/Modal";
import { getInitials } from "@/shared/utils/format";
import { getGroup, saveGroup, getRecipeSettings, saveRecipeSettings, getRecipeOverrideForMode, saveRecipeOverrideForMode, getRawRecipeTxt, pullRecipeKvFromServer } from "@/core/groupStore";
import { parseRecipeTxt } from "@/topics/renderers/reading/parseRecipeTxt";

export default function InstructionParamsContent({ topicId, textId, filePath, topicTitle, textTitle, student }) {
  const setScreen        = useAppStore((s) => s.setScreen);
  const { markSessionStart } = useTimer();

  const [group,          setGroup]          = useState([]);
  const [newMemberName,  setNewMemberName]  = useState("");
  const [newMemberPhoto, setNewMemberPhoto] = useState(null);
  const memberPhotoRef = useRef(null);

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
      const settings = await getRecipeSettings(topicId).catch(() => ({ portions: 1 }));
      setPortions(settings.portions ?? 1);
      const [grp] = await Promise.all([
        getGroup(topicId).catch(() => []),
        loadRecipeText(),
      ]);
      setGroup(grp ?? []);
    }
    load();
  }, [topicId, textId, filePath]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleMemberPhotoFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setNewMemberPhoto(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function addMember() {
    const name = newMemberName.trim();
    if (!name) return;
    const next = [...group, { id: `m_${Date.now()}`, name, photoDataUrl: newMemberPhoto ?? null, stepRanges: "" }];
    setGroup(next);
    await saveGroup(topicId, next).catch(() => {});
    setNewMemberName("");
    setNewMemberPhoto(null);
  }

  async function removeMember(idx) {
    const next = group.filter((_, i) => i !== idx);
    setGroup(next);
    await saveGroup(topicId, next).catch(() => {});
  }

  function updateMemberRanges(idx, ranges) {
    setGroup((prev) => prev.map((m, i) => (i === idx ? { ...m, stepRanges: ranges } : m)));
  }

  async function toggleChef(idx) {
    const next = group.map((m, i) => ({ ...m, role: i === idx && m.role !== "chef" ? "chef" : null }));
    setGroup(next);
    await saveGroup(topicId, next).catch(() => {});
  }

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
    await saveRecipeSettings(topicId, { portions: next }).catch(() => {});
  }

  async function startSession() {
    await saveGroup(topicId, group).catch(() => {});
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

          <div className="param-row">
            <div className="param-label">Порций</div>
            <div className="all-texts-portions">
              <button className="all-texts-portions-btn" onClick={() => handlePortionsChange(-1)} disabled={portions <= 1}>−</button>
              <span className="all-texts-portions-value">{portions}</span>
              <button className="all-texts-portions-btn" onClick={() => handlePortionsChange(+1)} disabled={portions >= 20}>+</button>
            </div>
          </div>

          <div className="param-row param-row--block">
            <div className="param-label">Группа</div>
            <div className="instruction-cover-members">
              {group.map((member, i) => (
                <div key={member.id ?? member.name} className="instruction-cover-member">
                  <div className="instruction-cover-member-avatar">
                    {member.photoDataUrl
                      ? <img src={member.photoDataUrl} alt={member.name} />
                      : <div className="instruction-cover-member-initials">{member.name?.[0] ?? "?"}</div>
                    }
                  </div>
                  <div className="instruction-cover-member-info">
                    <div className="instruction-cover-member-name">{member.name}</div>
                    <input
                      className="instruction-cover-ranges-input"
                      value={member.stepRanges ?? ""}
                      onChange={(e) => updateMemberRanges(i, e.target.value)}
                      placeholder="шаги: 1-15"
                    />
                  </div>
                  <button
                    className={`instruction-cover-chef-btn${member.role === "chef" ? " instruction-cover-chef-btn--active" : ""}`}
                    onClick={() => toggleChef(i)}
                    title={member.role === "chef" ? "Снять роль шефа" : "Назначить шефом"}
                  >
                    👑
                  </button>
                  <button className="instruction-cover-member-remove" onClick={() => removeMember(i)}>×</button>
                </div>
              ))}
              <div className="instruction-cover-add-member">
                <button
                  className="instruction-cover-photo-btn"
                  onClick={() => memberPhotoRef.current?.click()}
                  title="Фото"
                >
                  {newMemberPhoto
                    ? <img src={newMemberPhoto} alt="" className="instruction-cover-photo-preview" />
                    : "📷"}
                </button>
                <input ref={memberPhotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleMemberPhotoFile} />
                <input
                  className="instruction-cover-name-input"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="Имя участника"
                  onKeyDown={(e) => e.key === "Enter" && addMember()}
                />
                <button className="instruction-cover-add-btn" onClick={addMember} disabled={!newMemberName.trim()}>+</button>
              </div>
            </div>
          </div>

          <div className="param-row">
            <div className="param-label">Инструкция</div>
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
