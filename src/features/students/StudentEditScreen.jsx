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
async function resizeToDataUrl(file, maxSize = 400) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const size = Math.min(s, maxSize);
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = url;
  });
}

const LANGS = [
  { value: "",   label: "Не задан" },
  { value: "ru", label: "Русский"  },
  { value: "en", label: "English"  },
];

const SEXES = [
  { value: "",  label: "Не указан" },
  { value: "m", label: "Мальчик"   },
  { value: "f", label: "Девочка"   },
];

function AdultAddForm({ onConfirm, onCancel }) {
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const photoRef  = useRef(null);
  const cameraRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setPhoto(await resizeToDataUrl(file, 200));
    setLoading(false);
  }

  function confirm() {
    if (name.trim()) onConfirm({ id: generateId(), name: name.trim(), photo });
  }

  return (
    <div className="se-adult-add-form">
      <div className="se-adult-add-form__row">
        {photo ? (
          <img src={photo} className="se-adult-add-form__preview" onClick={() => cameraRef.current?.click()} alt="" />
        ) : (
          <div className="se-adult-add-form__photo-btns">
            <button type="button" className="se-adult-add-form__photo-btn" onClick={() => cameraRef.current?.click()} disabled={loading}>
              {loading ? "…" : "📷"}
            </button>
            <button type="button" className="se-adult-add-form__photo-btn" onClick={() => photoRef.current?.click()} disabled={loading}>
              🖼
            </button>
          </div>
        )}
        <input
          className="se-adult-add-form__input"
          type="text"
          placeholder="Имя (Мама, Папа, …)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirm()}
          autoFocus
        />
        <input ref={cameraRef} type="file" accept="image/*" capture="user" style={{ display: "none" }} onChange={handleFile} />
        <input ref={photoRef}  type="file" accept="image/*"               style={{ display: "none" }} onChange={handleFile} />
      </div>
      <div className="se-adult-add-form__actions">
        <Button variant="secondary" onClick={onCancel}>Отмена</Button>
        <Button variant="primary" onClick={confirm} disabled={!name.trim()}>Добавить</Button>
      </div>
    </div>
  );
}

export default function StudentEditScreen() {
  const setScreen           = useAppStore((s) => s.setScreen);
  const students            = useAppStore((s) => s.students);
  const setStudents         = useAppStore((s) => s.setStudents);
  const editingStudentId    = useAppStore((s) => s.editingStudentId);

  const initial = editingStudentId ? (students.find((s) => s.id === editingStudentId) ?? null) : null;
  const isEdit  = !!initial;

  const [name,         setName]         = useState(initial?.name ?? "");
  const [comment,      setComment]      = useState(initial?.comment ?? "");
  const [lang,         setLang]         = useState(initial?.primaryLanguage ?? "");
  const [sex,          setSex]          = useState(initial?.sex ?? "");
  const [photo,        setPhoto]        = useState(initial?.photo ?? null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [videos,       setVideos]       = useState(() => normaliseVideos(initial?.rewardVideos));
  const [videoInput,   setVideoInput]   = useState("");
  const [videoError,   setVideoError]   = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [adults,       setAdults]       = useState(() => normaliseAdults(initial?.closeAdults));
  const [addingAdult,  setAddingAdult]  = useState(false);
  const [nameError,    setNameError]    = useState("");
  const [confirmDel,   setConfirmDel]   = useState(false);
  const [saving,       setSaving]       = useState(false);

  const studentPhotoRef = useRef(null);

  function goBack() { setScreen("students"); }

  async function handleStudentPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    setPhoto(await resizeToDataUrl(file, 400));
    setPhotoLoading(false);
  }

  async function handleSave() {
    if (!name.trim()) { setNameError("Введите имя ученика"); return; }
    setSaving(true);
    const data = {
      name: name.trim(), comment: comment.trim(),
      primaryLanguage: lang || null,
      sex: sex || null,
      photo: photo ?? null,
      rewardVideos: videos, closeAdults: adults,
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
    setVideoLoading(true); setVideoError("");
    const title = await fetchYoutubeTitle(url);
    setVideos((prev) => [...prev, { url, title }]);
    setVideoInput("");
    setVideoLoading(false);
  }

  const initials = name.trim() ? getInitials(name) : "?";

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={goBack}>←</button>
        <h1 className="screen-title">{isEdit ? initial.name : "Новый ученик"}</h1>
        <button className="se-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? "…" : "Сохранить"}
        </button>
      </div>

      <div className="se-body">
       <div className="se-col">

        {/* ── Профиль ── */}
        <div className="settings-section">
          <div className="se-profile-row">
            <button
              type="button"
              className="se-photo-btn"
              onClick={() => studentPhotoRef.current?.click()}
              title="Изменить фото"
            >
              {photo
                ? <img src={photo} className="se-photo-btn__img" alt="" />
                : <div className="se-photo-btn__initials">{photoLoading ? "…" : initials}</div>
              }
              <div className="se-photo-btn__cam">📷</div>
            </button>
            <input
              className="se-name-input"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(""); }}
              placeholder="Имя ученика"
              autoFocus={!isEdit}
            />
            <input
              ref={studentPhotoRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleStudentPhoto}
            />
          </div>
          {nameError && <div className="se-name-error">{nameError}</div>}
          <textarea
            className="se-comment-input"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Заметки, особенности, цели…"
            rows={3}
          />
        </div>

        {/* ── Пол ── */}
        <div className="settings-section">
          <div className="settings-section-title">Пол</div>
          {SEXES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`se-lang-row${sex === value ? " se-lang-row--active" : ""}`}
              onClick={() => setSex(value)}
            >
              {label}
              {sex === value && <span className="se-lang-check">✓</span>}
            </button>
          ))}
        </div>

        {/* ── Язык ── */}
        <div className="settings-section">
          <div className="settings-section-title">Язык</div>
          {LANGS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`se-lang-row${lang === value ? " se-lang-row--active" : ""}`}
              onClick={() => setLang(value)}
            >
              {label}
              {lang === value && <span className="se-lang-check">✓</span>}
            </button>
          ))}
        </div>

       </div>{/* /se-col left */}
       <div className="se-col">

        {/* ── Близкие взрослые ── */}
        <div className="settings-section">
          <div className="settings-section-title">Близкие взрослые</div>
          {adults.map((adult) => (
            <div key={adult.id} className="se-list-row">
              {adult.photo
                ? <img src={adult.photo} className="se-list-avatar" alt={adult.name} />
                : <div className="se-list-avatar se-list-avatar--initials">{getInitials(adult.name)}</div>
              }
              <span className="se-list-name">{adult.name}</span>
              <button className="se-list-remove" onClick={() => setAdults((p) => p.filter((a) => a.id !== adult.id))}>✕</button>
            </div>
          ))}
          {addingAdult
            ? <AdultAddForm
                onConfirm={(a) => { setAdults((p) => [...p, a]); setAddingAdult(false); }}
                onCancel={() => setAddingAdult(false)}
              />
            : <button type="button" className="se-add-row" onClick={() => setAddingAdult(true)}>
                + Добавить взрослого
              </button>
          }
        </div>

        {/* ── Видео-награды ── */}
        <div className="settings-section">
          <div className="settings-section-title">Видео-награды</div>
          {videos.map((v, idx) => (
            <div key={idx} className="se-list-row">
              <span className="se-video-icon">▶</span>
              <span className="se-list-name">{v.title || getVideoUrl(v)}</span>
              <button className="se-list-remove" onClick={() => setVideos((p) => p.filter((_, i) => i !== idx))}>✕</button>
            </div>
          ))}
          <div className="se-video-add-row">
            <input
              className="se-video-input"
              type="url"
              placeholder="https://youtu.be/…"
              value={videoInput}
              disabled={videoLoading}
              onChange={(e) => { setVideoInput(e.target.value); setVideoError(""); }}
              onKeyDown={(e) => e.key === "Enter" && addVideo()}
            />
            <button className="se-video-add-btn" onClick={addVideo} disabled={videoLoading}>
              {videoLoading ? "…" : "Добавить"}
            </button>
          </div>
          {videoError && <div className="form-error se-video-error">{videoError}</div>}
        </div>

        {/* ── Удаление ── */}
        {isEdit && (
          <div className="settings-section">
            {confirmDel ? (
              <div className="se-delete-confirm">
                <div className="se-delete-confirm__text">
                  Удалить <strong>{initial.name}</strong>?<br />
                  История сессий будет утеряна.
                </div>
                <div className="se-delete-confirm__actions">
                  <Button variant="secondary" onClick={() => setConfirmDel(false)}>Отмена</Button>
                  <Button variant="danger" onClick={handleDelete}>Удалить</Button>
                </div>
              </div>
            ) : (
              <button className="settings-danger-btn" onClick={() => setConfirmDel(true)}>
                Удалить ученика
              </button>
            )}
          </div>
        )}

       </div>{/* /se-col right */}
      </div>{/* /se-body */}
    </div>
  );
}
