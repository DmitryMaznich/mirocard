import { useState, useRef } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { pushOp } from "@/core/syncApi";
import Button from "@/shared/components/Button";
import { isValidYoutubeUrl, fetchYoutubeTitle, getVideoUrl, getInitials } from "@/shared/utils/format";

function generateStudentId() {
  return "student_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function normaliseVideos(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) =>
    typeof v === "string" ? { url: v, title: null } : { url: v.url ?? "", title: v.title ?? null }
  );
}

function normaliseAdults(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((a) => ({ id: a.id, name: a.name ?? "", photo: a.photo ?? null }));
}

async function resizeToDataUrl(file, size = 200) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      const s = Math.min(img.width, img.height);
      const sx = (img.width - s) / 2;
      const sy = (img.height - s) / 2;
      ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.src = url;
  });
}

function AdultRow({ adult, onRemove }) {
  return (
    <div className="se-adult-row">
      {adult.photo ? (
        <img src={adult.photo} alt={adult.name} className="se-adult-row__photo" />
      ) : (
        <div className="se-adult-row__initials">{getInitials(adult.name)}</div>
      )}
      <span className="se-adult-row__name">{adult.name}</span>
      <button className="icon-btn icon-btn--danger" onClick={onRemove}>✕</button>
    </div>
  );
}

function AddAdultForm({ onConfirm, onCancel }) {
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const photoInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const dataUrl = await resizeToDataUrl(file, 200);
    setPhoto(dataUrl);
    setLoading(false);
  }

  return (
    <div className="se-add-adult">
      <div className="se-add-adult__photo-row">
        {photo ? (
          <img
            src={photo}
            alt=""
            className="se-add-adult__preview"
            onClick={() => cameraInputRef.current?.click()}
          />
        ) : (
          <div className="se-add-adult__photo-btns">
            <button
              type="button"
              className="se-add-adult__photo-btn"
              onClick={() => cameraInputRef.current?.click()}
              disabled={loading}
            >
              {loading ? "…" : "📷"}
            </button>
            <button
              type="button"
              className="se-add-adult__photo-btn"
              onClick={() => photoInputRef.current?.click()}
              disabled={loading}
            >
              🖼
            </button>
          </div>
        )}
        <input
          className="auth-input se-add-adult__name-input"
          type="text"
          placeholder="Имя (Мама, Папа, …)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onConfirm({ id: generateId(), name: name.trim(), photo })}
          autoFocus
        />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="user" style={{ display: "none" }} onChange={handleFile} />
        <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
      </div>
      <div className="se-add-adult__actions">
        <Button variant="secondary" onClick={onCancel}>Отмена</Button>
        <Button
          variant="primary"
          onClick={() => name.trim() && onConfirm({ id: generateId(), name: name.trim(), photo })}
          disabled={!name.trim()}
        >
          Добавить
        </Button>
      </div>
    </div>
  );
}

export default function StudentEditScreen() {
  const setScreen          = useAppStore((s) => s.setScreen);
  const students           = useAppStore((s) => s.students);
  const setStudents        = useAppStore((s) => s.setStudents);
  const editingStudentId   = useAppStore((s) => s.editingStudentId);

  const initial  = editingStudentId ? students.find((s) => s.id === editingStudentId) ?? null : null;
  const isEdit   = !!initial;

  const [name,         setName]         = useState(initial?.name ?? "");
  const [comment,      setComment]      = useState(initial?.comment ?? "");
  const [lang,         setLang]         = useState(initial?.primaryLanguage ?? "");
  const [videos,       setVideos]       = useState(() => normaliseVideos(initial?.rewardVideos));
  const [videoInput,   setVideoInput]   = useState("");
  const [videoError,   setVideoError]   = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [adults,       setAdults]       = useState(() => normaliseAdults(initial?.closeAdults));
  const [addingAdult,  setAddingAdult]  = useState(false);
  const [error,        setError]        = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving,       setSaving]       = useState(false);

  function goBack() { setScreen("students"); }

  async function handleSave() {
    if (!name.trim()) { setError("Введите имя ученика"); return; }
    setSaving(true);
    const data = {
      name:            name.trim(),
      comment:         comment.trim(),
      primaryLanguage: lang || null,
      rewardVideos:    videos,
      closeAdults:     adults,
    };
    const db = await getDb();
    if (isEdit) {
      const updated = { ...initial, ...data, updatedAt: new Date().toISOString() };
      const next = students.map((s) => (s.id === initial.id ? updated : s));
      await kv.set(db, "students", next);
      setStudents(next);
      pushOp("student.upsert", updated);
    } else {
      const student = { id: generateStudentId(), ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const next = [...students, student];
      await kv.set(db, "students", next);
      setStudents(next);
      pushOp("student.upsert", student);
    }
    goBack();
  }

  async function handleDelete() {
    const db = await getDb();
    const next = students.filter((s) => s.id !== initial.id);
    await kv.set(db, "students", next);
    setStudents(next);
    pushOp("student.delete", { id: initial.id });
    goBack();
  }

  async function addVideo() {
    const url = videoInput.trim();
    if (!isValidYoutubeUrl(url)) { setVideoError("Неверная ссылка YouTube"); return; }
    setVideoLoading(true);
    setVideoError("");
    const title = await fetchYoutubeTitle(url);
    setVideos((prev) => [...prev, { url, title }]);
    setVideoInput("");
    setVideoLoading(false);
  }

  return (
    <div className="screen student-edit-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={goBack}>←</button>
        <h1 className="screen-title">{isEdit ? initial.name : "Новый ученик"}</h1>
        <button className="se-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? "…" : "Сохранить"}
        </button>
      </div>

      <div className="se-body">

        {/* ── Имя ── */}
        <div className="se-section">
          <div className="se-label">Имя</div>
          <input
            className="auth-input"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            placeholder="Имя ученика"
            autoFocus={!isEdit}
          />
          {error && <div className="form-error">{error}</div>}
        </div>

        {/* ── Комментарий ── */}
        <div className="se-section">
          <div className="se-label">Комментарий</div>
          <textarea
            className="student-form__comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Заметки о ребёнке, особенности, цели (необязательно)"
            rows={4}
          />
        </div>

        {/* ── Язык ── */}
        <div className="se-section">
          <div className="se-label">Основной язык</div>
          <div className="student-form__lang-group">
            <button type="button" className={`lang-btn${lang === "" ? " lang-btn--active" : ""}`} onClick={() => setLang("")}>Не задан</button>
            <button type="button" className={`lang-btn${lang === "ru" ? " lang-btn--active" : ""}`} onClick={() => setLang("ru")}>Русский</button>
            <button type="button" className={`lang-btn${lang === "en" ? " lang-btn--active" : ""}`} onClick={() => setLang("en")}>English</button>
          </div>
        </div>

        {/* ── Близкие взрослые ── */}
        <div className="se-section">
          <div className="se-label">Близкие взрослые</div>
          <div className="se-hint">Используются как подлежащие в Пазле предложений</div>
          {adults.map((adult) => (
            <AdultRow key={adult.id} adult={adult} onRemove={() => setAdults((prev) => prev.filter((a) => a.id !== adult.id))} />
          ))}
          {addingAdult ? (
            <AddAdultForm
              onConfirm={(adult) => { setAdults((prev) => [...prev, adult]); setAddingAdult(false); }}
              onCancel={() => setAddingAdult(false)}
            />
          ) : (
            <button type="button" className="se-add-btn" onClick={() => setAddingAdult(true)}>
              + Добавить взрослого
            </button>
          )}
        </div>

        {/* ── Видео-награды ── */}
        <div className="se-section">
          <div className="se-label">Видео-награды</div>
          <div className="se-hint">Показываются при достижении порога успеха</div>
          {videos.map((v, idx) => (
            <div key={idx} className="reward-url-row">
              <div className="reward-url-row__info">
                {v.title
                  ? <span className="reward-url-row__title">▶ {v.title}</span>
                  : <span className="reward-url-row__text">{getVideoUrl(v)}</span>}
              </div>
              <button className="icon-btn icon-btn--danger" onClick={() => setVideos((prev) => prev.filter((_, i) => i !== idx))}>✕</button>
            </div>
          ))}
          <div className="reward-url-add">
            <input
              className="auth-input reward-url-add__input"
              type="url"
              placeholder="https://youtu.be/..."
              value={videoInput}
              disabled={videoLoading}
              onChange={(e) => { setVideoInput(e.target.value); setVideoError(""); }}
              onKeyDown={(e) => e.key === "Enter" && addVideo()}
            />
            <Button variant="secondary" onClick={addVideo} disabled={videoLoading}>
              {videoLoading ? "…" : "Добавить"}
            </Button>
          </div>
          {videoError && <div className="form-error">{videoError}</div>}
        </div>

        {/* ── Удаление (только в режиме редактирования) ── */}
        {isEdit && (
          <div className="se-danger">
            {confirmDelete ? (
              <div className="se-danger__confirm">
                <div className="se-danger__confirm-text">
                  Удалить <strong>{initial.name}</strong>? История сессий будет утеряна.
                </div>
                <div className="se-danger__confirm-actions">
                  <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Отмена</Button>
                  <Button variant="danger" onClick={handleDelete}>Удалить</Button>
                </div>
              </div>
            ) : (
              <button className="se-danger__btn" onClick={() => setConfirmDelete(true)}>
                Удалить ученика
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
