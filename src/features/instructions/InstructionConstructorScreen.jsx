import { useEffect, useState, useRef } from "react";
import { useAppStore } from "@/core/store";
import {
  getUserInstructions, addInstruction, updateInstruction, deleteInstruction, pullUserInstructionsFromServer,
} from "./instructionsApi";
import { validateInstructionDraft } from "./instructionValidation";
import { uploadInstructionPhoto } from "./instructionPhotoUpload";
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
  const [steps, setSteps] = useState([{ text: "", photo: null }]);
  const [uploadingSteps, setUploadingSteps] = useState(() => new Set());
  const [photoErrors, setPhotoErrors] = useState({});
  const photoInputRefs = useRef([]);
  const [loaded, setLoaded] = useState(!isEditing);
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    (async () => {
      await pullUserInstructionsFromServer().catch(() => {});
      const all = await getUserInstructions();
      if (cancelled) return;
      const existing = all.find((i) => i.id === instructionConstructorId);
      if (existing) {
        setTitle(existing.title);
        setEmoji(existing.emoji);
        setSteps(existing.steps.length ? existing.steps : [{ text: "", photo: null }]);
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [isEditing, instructionConstructorId]);

  function updateStepText(index, value) {
    setSteps((s) => s.map((step, i) => (i === index ? { ...step, text: value } : step)));
  }

  function setStepPhoto(index, photo) {
    setSteps((s) => s.map((step, i) => (i === index ? { ...step, photo } : step)));
  }

  function addStep() {
    setSteps((s) => [...s, { text: "", photo: null }]);
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

  async function handlePhotoSelect(index, file) {
    if (!file) return;
    setUploadingSteps((s) => new Set(s).add(index));
    setPhotoErrors((e) => ({ ...e, [index]: null }));
    try {
      const url = await uploadInstructionPhoto(file);
      setStepPhoto(index, url);
    } catch {
      setPhotoErrors((e) => ({ ...e, [index]: "Не удалось загрузить фото" }));
    } finally {
      setUploadingSteps((s) => {
        const next = new Set(s);
        next.delete(index);
        return next;
      });
    }
  }

  function exit() {
    setScreen("home");
  }

  async function handleSave() {
    const { valid, errors: validationErrors } = validateInstructionDraft({ title, steps });
    setErrors(validationErrors);
    if (!valid) return;
    setSaving(true);
    const cleanSteps = steps
      .map((s) => ({ text: s.text.trim(), photo: s.photo }))
      .filter((s) => s.text);
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
                <div className="cn-step-main">
                  <textarea
                    className="cn-step-text"
                    value={step.text}
                    onChange={(e) => updateStepText(i, e.target.value)}
                    placeholder="Что нужно сделать на этом шаге?"
                  />
                  <div className="cn-step-photo">
                    {step.photo ? (
                      <div className="cn-step-photo__preview">
                        <img src={step.photo} alt="" />
                        <button
                          type="button"
                          className="cn-step-photo__remove"
                          onClick={() => setStepPhoto(i, null)}
                          aria-label="Удалить фото"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="cn-step-photo__add"
                        onClick={() => photoInputRefs.current[i]?.click()}
                        disabled={uploadingSteps.has(i)}
                        aria-label="Добавить фото"
                      >
                        {uploadingSteps.has(i) ? "…" : "📷"}
                      </button>
                    )}
                    <input
                      ref={(el) => { photoInputRefs.current[i] = el; }}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        handlePhotoSelect(i, file);
                      }}
                    />
                  </div>
                  {photoErrors[i] && (
                    <div className="cn-error">
                      {photoErrors[i]}{" "}
                      <button
                        type="button"
                        className="cn-step-photo__retry"
                        onClick={() => photoInputRefs.current[i]?.click()}
                      >
                        Повторить
                      </button>
                    </div>
                  )}
                </div>
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
        <Button variant="primary" onClick={handleSave} disabled={saving || uploadingSteps.size > 0}>Сохранить</Button>
      </div>
    </div>
  );
}
