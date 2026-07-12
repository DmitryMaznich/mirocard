import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { getUserInstructions, addInstruction, updateInstruction, deleteInstruction } from "./instructionsApi";
import { validateInstructionDraft } from "./instructionValidation";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import Button from "@/shared/components/Button";
import "./instructions.css";

const EMOJI_CHOICES = ["🎒", "🧦", "🪥", "🛏️", "🧸", "🧽", "🧥", "🍽️", "📚", "🧴"];

export default function InstructionConstructorScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const instructionConstructorId = useAppStore((s) => s.instructionConstructorId);
  const isEditing = !!instructionConstructorId;

  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState(EMOJI_CHOICES[0]);
  const [steps, setSteps] = useState([""]);
  const [loaded, setLoaded] = useState(!isEditing);
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    getUserInstructions().then((all) => {
      if (cancelled) return;
      const existing = all.find((i) => i.id === instructionConstructorId);
      if (existing) {
        setTitle(existing.title);
        setEmoji(existing.emoji);
        setSteps(existing.steps.length ? existing.steps : [""]);
      }
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [isEditing, instructionConstructorId]);

  function updateStep(index, value) {
    setSteps((s) => s.map((step, i) => (i === index ? value : step)));
  }

  function addStep() {
    setSteps((s) => [...s, ""]);
  }

  function removeStep(index) {
    setSteps((s) => (s.length > 1 ? s.filter((_, i) => i !== index) : s));
  }

  function moveStep(index, direction) {
    setSteps((s) => {
      const target = index + direction;
      if (target < 0 || target >= s.length) return s;
      const next = [...s];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function exit() {
    setScreen("home");
  }

  async function handleSave() {
    const { valid, errors: validationErrors } = validateInstructionDraft({ title, steps });
    setErrors(validationErrors);
    if (!valid) return;
    setSaving(true);
    const cleanSteps = steps.map((s) => s.trim()).filter(Boolean);
    try {
      if (isEditing) {
        await updateInstruction(instructionConstructorId, { title: title.trim(), emoji, steps: cleanSteps });
      } else {
        await addInstruction({ title: title.trim(), emoji, steps: cleanSteps });
      }
      exit();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await deleteInstruction(instructionConstructorId);
    exit();
  }

  if (!loaded) {
    return <div className="screen instruction-constructor"><div className="home-tab-loading">Загрузка…</div></div>;
  }

  return (
    <div className="screen instruction-constructor">
      <div className="screen-header">
        <button className="back-btn" onClick={exit}><BackArrowIcon /></button>
        <h1 className="screen-title">{isEditing ? "Редактировать инструкцию" : "Новая инструкция"}</h1>
      </div>
      <div className="cn-scroll">
        <div className="cn-field">
          <label>Значок</label>
          <div className="cn-emoji-row">
            {EMOJI_CHOICES.map((e) => (
              <button
                type="button"
                key={e}
                className={`cn-emoji-pick${emoji === e ? " cn-emoji-pick--selected" : ""}`}
                onClick={() => setEmoji(e)}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="cn-field">
          <label>Название</label>
          <input
            className="cn-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например, Собираем портфель"
          />
          {errors.title && <div className="cn-error">{errors.title}</div>}
        </div>
        <div className="cn-field">
          <label>Шаги</label>
          <div className="cn-steps">
            {steps.map((step, i) => (
              <div className="cn-step-row" key={i}>
                <div className="cn-step-arrows">
                  <button type="button" disabled={i === 0} onClick={() => moveStep(i, -1)} aria-label="Сдвинуть вверх">↑</button>
                  <button type="button" disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)} aria-label="Сдвинуть вниз">↓</button>
                </div>
                <div className="cn-step-num">{i + 1}</div>
                <textarea
                  className="cn-step-text"
                  value={step}
                  onChange={(e) => updateStep(i, e.target.value)}
                  placeholder="Что нужно сделать на этом шаге?"
                />
                <button
                  type="button"
                  className="cn-step-del"
                  onClick={() => removeStep(i)}
                  aria-label="Удалить шаг"
                  disabled={steps.length === 1}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {errors.steps && <div className="cn-error">{errors.steps}</div>}
          <button type="button" className="cn-add-step" onClick={addStep}>+ Добавить шаг</button>
        </div>
      </div>
      <div className="cn-foot">
        {isEditing && (
          confirmDelete ? (
            <>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Отмена</Button>
              <Button variant="danger" onClick={handleDelete}>Точно удалить</Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>Удалить</Button>
          )
        )}
        <Button variant="primary" onClick={handleSave} disabled={saving}>Сохранить</Button>
      </div>
    </div>
  );
}
