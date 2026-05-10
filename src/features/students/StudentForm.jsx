import { useState } from "react";
import Button from "@/shared/components/Button";
import { isValidYoutubeUrl, fetchYoutubeTitle, getVideoUrl } from "@/shared/utils/format";

const LANGUAGES = [
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
];

// Normalise stored entries: accept both plain strings and {url,title} objects
function normaliseVideos(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) =>
    typeof v === "string" ? { url: v, title: null } : { url: v.url ?? "", title: v.title ?? null }
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
  const [error,      setError]      = useState("");

  function handleSave() {
    if (!name.trim()) { setError("Введите имя ученика"); return; }
    onSave({
      name:            name.trim(),
      comment:         comment.trim(),
      primaryLanguage: lang || null,
      rewardVideos:    videos,
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
