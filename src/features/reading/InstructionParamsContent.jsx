import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { useTimer } from "@/features/timer/TimerContext";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/Modal";
import { getInitials } from "@/shared/utils/format";
import { getGroup, saveGroup, getRecipeOverride, getRawRecipeTxt, saveRecipeOverride } from "@/core/groupStore";
import { listLocalAudioOverrides, syncAudioOverrides } from "@/core/audioStore";
import AudioRecordDialog from "@/topics/renderers/reading/AudioRecordDialog";
import { parseRecipeTxt } from "@/topics/renderers/reading/parseRecipeTxt";

export default function InstructionParamsContent({ topicId, textId, filePath, topicTitle, textTitle, student }) {
  const setScreen                  = useAppStore((s) => s.setScreen);
  const setInstructionAudioEnabled = useAppStore((s) => s.setInstructionAudioEnabled);
  const { markSessionStart }       = useTimer();

  const [group,           setGroup]           = useState([]);
  const [newMemberName,   setNewMemberName]   = useState("");
  const [newMemberPhoto,  setNewMemberPhoto]  = useState(null);
  const memberPhotoRef = useRef(null);

  const [audioEnabled,    setAudioEnabled]    = useState(false);
  const [audioStepsOpen,  setAudioStepsOpen]  = useState(false);
  const [recordedSteps,   setRecordedSteps]   = useState(new Set());
  const [audioDialogStep, setAudioDialogStep] = useState(null);

  const [baseSteps,     setBaseSteps]     = useState([]);
  const [rawRecipe,     setRawRecipe]     = useState("");
  const [editingRecipe, setEditingRecipe] = useState(false);
  const [recipeEdit,    setRecipeEdit]    = useState("");

  useEffect(() => {
    async function load() {
      const [grp, rawText] = await Promise.all([
        getGroup(topicId).catch(() => []),
        (async () => {
          if (textId) {
            const override = await getRecipeOverride(topicId, textId).catch(() => null);
            if (override) return override;
          }
          if (filePath) return getRawRecipeTxt(topicId, filePath).catch(() => null);
          return null;
        })(),
      ]);
      setGroup(grp ?? []);
      if (rawText) {
        setRawRecipe(rawText);
        setBaseSteps(parseRecipeTxt(rawText));
      }
      const tid = textId ?? "";
      const overrides = await listLocalAudioOverrides(topicId, tid).catch(() => []);
      setRecordedSteps(new Set(overrides.map((o) => `s${o.stepNum}`)));
      syncAudioOverrides(topicId, tid)
        .then(() => listLocalAudioOverrides(topicId, tid))
        .then((ovrs) => setRecordedSteps(new Set(ovrs.map((o) => `s${o.stepNum}`))))
        .catch(() => {});
    }
    load();
  }, [topicId, textId, filePath]);

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
    if (textId) await saveRecipeOverride(topicId, textId, recipeEdit).catch(() => {});
    setRawRecipe(recipeEdit);
    setBaseSteps(parseRecipeTxt(recipeEdit));
    setEditingRecipe(false);
  }

  async function startSession() {
    await saveGroup(topicId, group).catch(() => {});
    setInstructionAudioEnabled(audioEnabled);
    markSessionStart();
    setScreen("session");
  }

  const actionSteps   = baseSteps.filter((s) => s.type !== "heading");
  const recordedCount = actionSteps.filter((s) => recordedSteps.has(s.id)).length;

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
            <div className="param-label">Аудио</div>
            <div className="param-enum-group">
              <button
                className={`enum-btn ${!audioEnabled ? "enum-btn--active" : ""}`}
                onClick={() => setAudioEnabled(false)}
              >
                Выкл
              </button>
              <button
                className={`enum-btn ${audioEnabled ? "enum-btn--active" : ""}`}
                onClick={() => setAudioEnabled(true)}
              >
                Вкл
              </button>
            </div>
          </div>

          {actionSteps.length > 0 && (
            <>
              <div className="param-row">
                <div className="param-label">
                  Запись шагов{recordedCount > 0 ? ` · ${recordedCount}/${actionSteps.length}` : ""}
                </div>
                <button
                  className="link-btn"
                  onClick={() => setAudioStepsOpen((v) => !v)}
                >
                  {audioStepsOpen ? "Скрыть" : "Открыть"}
                </button>
              </div>
              {audioStepsOpen && (
                <div className="param-row param-row--block" style={{ paddingTop: 4 }}>
                  <div className="instruction-audio-list">
                    {actionSteps.map((s) => {
                      const num = parseInt(s.id.slice(1), 10);
                      const hasAudio = recordedSteps.has(s.id);
                      return (
                        <button
                          key={s.id}
                          className={`instruction-audio-item${hasAudio ? " instruction-audio-item--recorded" : ""}`}
                          onClick={() => setAudioDialogStep({ id: s.id, num, text: s.text })}
                        >
                          <span className="instruction-audio-num">{num}</span>
                          <span className="instruction-audio-text">
                            {s.text.length > 55 ? s.text.slice(0, 55) + "…" : s.text}
                          </span>
                          {hasAudio && <span className="instruction-audio-dot" aria-label="записано" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="param-row">
            <div className="param-label">Инструкция</div>
            <button
              className="link-btn"
              onClick={() => { setRecipeEdit(rawRecipe); setEditingRecipe(true); }}
            >
              Редактировать
            </button>
          </div>

        </div>

        <div className="params-start-phone">
          <Button fullWidth onClick={startSession}>Начать занятие</Button>
        </div>
      </div>

      {audioDialogStep && (
        <AudioRecordDialog
          topicId={topicId}
          textId={textId ?? ""}
          stepNum={audioDialogStep.num}
          stepText={audioDialogStep.text}
          onClose={() => setAudioDialogStep(null)}
          onSaved={(stepId) => {
            setRecordedSteps((prev) => new Set([...prev, stepId]));
            setAudioDialogStep(null);
          }}
          onDeleted={(stepId) => {
            setRecordedSteps((prev) => { const n = new Set(prev); n.delete(stepId); return n; });
            setAudioDialogStep(null);
          }}
        />
      )}

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
