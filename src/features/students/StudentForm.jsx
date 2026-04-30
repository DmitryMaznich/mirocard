import { useState } from "react";
import Button from "@/shared/components/Button";

const LANGUAGES = [
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
];

export default function StudentForm({ initial, onSave, onCancel }) {
  const [name,    setName]    = useState(initial?.name    ?? "");
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [lang,    setLang]    = useState(initial?.primaryLanguage ?? "");
  const [error,   setError]   = useState("");

  function handleSave() {
    if (!name.trim()) {
      setError("Введите имя ученика");
      return;
    }
    onSave({
      name:            name.trim(),
      comment:         comment.trim(),
      primaryLanguage: lang || null,
    });
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
      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onCancel}>Отмена</Button>
        <Button variant="primary" onClick={handleSave}>Сохранить</Button>
      </div>
    </div>
  );
}
