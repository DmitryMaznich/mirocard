import { useState, useRef } from "react";
import Button from "@/shared/components/Button";
import { isValidYoutubeUrl, fetchYoutubeTitle, getVideoUrl, getInitials } from "@/shared/utils/format";

const LANGUAGES = [
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
];

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

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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
      const sx = (img.width  - s) / 2;
      const sy = (img.height - s) / 2;
      ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.src = url;
  });
}

function AdultAvatar({ adult, size = 40 }) {
  if (adult.photo) {
    return (
      <img
        src={adult.photo}
        alt={adult.name}
        style={{
          width: size, height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size,
      borderRadius: "50%",
      background: "#d1fae5",
      color: "#1b6b62",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: size * 0.38,
      flexShrink: 0,
    }}>
      {getInitials(adult.name)}
    </div>
  );
}

export default function StudentForm({ initial, onSave, onCancel }) {
  const [name,       setName]       = useState(initial?.name    ?? "");
  const [comment,    setComment]    = useState(initial?.comment ?? "");
  const [lang,       setLang]       = useState(initial?.primaryLanguage ?? "");
  const [videos,     setVideos]     = useState(() => normaliseVideos(initial?.rewardVideos));
  const [videoInput, setVideoInput] = useState("");
  const [videoError, setVideoError] = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [adults,     setAdults]     = useState(() => normaliseAdults(initial?.closeAdults));
  const [addingAdult, setAddingAdult] = useState(false);
  const [newAdultName, setNewAdultName] = useState("");
  const [newAdultPhoto, setNewAdultPhoto] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [error, setError] = useState("");
  const photoInputRef   = useRef(null);
  const cameraInputRef  = useRef(null);

  function handleSave() {
    if (!name.trim()) { setError("Введите имя ученика"); return; }
    onSave({
      name:            name.trim(),
      comment:         comment.trim(),
      primaryLanguage: lang || null,
      rewardVideos:    videos,
      closeAdults:     adults,
    });
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

  function removeVideo(idx) {
    setVideos((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handlePhotoFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    const dataUrl = await resizeToDataUrl(file, 200);
    setNewAdultPhoto(dataUrl);
    setPhotoLoading(false);
  }

  function confirmAddAdult() {
    if (!newAdultName.trim()) return;
    setAdults((prev) => [...prev, { id: generateId(), name: newAdultName.trim(), photo: newAdultPhoto }]);
    setNewAdultName("");
    setNewAdultPhoto(null);
    setAddingAdult(false);
  }

  function cancelAddAdult() {
    setNewAdultName("");
    setNewAdultPhoto(null);
    setAddingAdult(false);
  }

  function removeAdult(id) {
    setAdults((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="student-form">
      <input
        className="auth-input"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Имя ученика"
        autoFocus
      />
      <textarea
        className="student-form__comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Комментарий (необязательно)"
        rows={3}
      />
      <div className="student-form__lang-label">Основной язык</div>
      <div className="student-form__lang-group">
        <button
          type="button"
          className={`lang-btn ${lang === "" ? "lang-btn--active" : ""}`}
          onClick={() => setLang("")}
        >
          Не задан
        </button>
        {LANGUAGES.map((l) => (
          <button
            key={l.value}
            type="button"
            className={`lang-btn ${lang === l.value ? "lang-btn--active" : ""}`}
            onClick={() => setLang(l.value)}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* ── Близкие взрослые ── */}
      <div className="student-form__section-label">Близкие взрослые</div>
      <div className="student-form__section-hint">Используются как подлежащие в Пазле предложений</div>

      {adults.map((adult) => (
        <div key={adult.id} className="close-adult-row">
          <AdultAvatar adult={adult} size={40} />
          <span className="close-adult-row__name">{adult.name}</span>
          <button className="icon-btn icon-btn--danger" onClick={() => removeAdult(adult.id)}>✕</button>
        </div>
      ))}

      {addingAdult ? (
        <div className="close-adult-add-form">
          <div className="close-adult-add-form__photo-row">
            <div className="close-adult-add-form__photo-btns">
              {newAdultPhoto ? (
                <img
                  src={newAdultPhoto}
                  alt=""
                  className="close-adult-add-form__preview"
                  onClick={() => cameraInputRef.current?.click()}
                />
              ) : (
                <>
                  <button
                    type="button"
                    className="close-adult-add-form__photo-btn"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={photoLoading}
                    title="Камера"
                  >
                    {photoLoading ? "…" : "📷"}
                  </button>
                  <button
                    type="button"
                    className="close-adult-add-form__photo-btn close-adult-add-form__photo-btn--gallery"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={photoLoading}
                    title="Галерея"
                  >
                    🖼
                  </button>
                </>
              )}
            </div>
            <input
              className="auth-input close-adult-add-form__name-input"
              type="text"
              placeholder="Имя (Мама, Папа, …)"
              value={newAdultName}
              onChange={(e) => setNewAdultName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmAddAdult()}
              autoFocus
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              style={{ display: "none" }}
              onChange={handlePhotoFile}
            />
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handlePhotoFile}
            />
          </div>
          <div className="close-adult-add-form__actions">
            <Button variant="secondary" onClick={cancelAddAdult}>Отмена</Button>
            <Button variant="primary" onClick={confirmAddAdult} disabled={!newAdultName.trim()}>
              Добавить
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="close-adult-add-btn"
          onClick={() => setAddingAdult(true)}
        >
          + Добавить взрослого
        </button>
      )}

      {/* ── Видео-награды ── */}
      <div className="student-form__section-label">Видео-награды</div>
      <div className="student-form__section-hint">Показываются при достижении порога успеха</div>

      {videos.map((v, idx) => (
        <div key={idx} className="reward-url-row">
          <div className="reward-url-row__info">
            {v.title
              ? <span className="reward-url-row__title">▶ {v.title}</span>
              : <span className="reward-url-row__text">{getVideoUrl(v)}</span>
            }
          </div>
          <button className="icon-btn icon-btn--danger" onClick={() => removeVideo(idx)}>✕</button>
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

      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onCancel}>Отмена</Button>
        <Button variant="primary" onClick={handleSave}>Сохранить</Button>
      </div>
    </div>
  );
}
