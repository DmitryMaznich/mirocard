import { useState } from "react";

// Shown once every item has been dictated. Never shown during the session itself (see
// DictationView.jsx) -- this is the FIRST point the answer appears on screen at all, since
// automatic checking is impossible here (the child writes on paper, the app never sees it).
// The adult compares this list against the notebook by eye.
export default function DictationReviewScreen({ task, onClose }) {
  const items = task?.items ?? [];
  const level = task?.level ?? "letters";
  const [showRewardStub, setShowRewardStub] = useState(false);

  return (
    <div className="propis-dictation-stage">
      <button type="button" className="propis-ctrl-btn propis-dictation-close" onClick={onClose} aria-label="Закрыть">✕</button>

      <div className="propis-dictation-review">
        <div className="propis-dictation-review-header">
          <div className="propis-dictation-review-title">Диктант окончен</div>
          <p className="propis-dictation-review-hint">
            Сверьте с тетрадью — вот всё, что прозвучало, по порядку.
          </p>
        </div>

        <div className={`propis-dictation-review-list propis-dictation-review-list--${level}`}>
          {items.map((it, i) => (
            level === "texts" ? (
              <div key={it.key} className="propis-dictation-review-text">
                <span className="propis-dictation-review-index">{i + 1}</span>
                <p className="propis-dictation-review-text-body">{it.display}</p>
              </div>
            ) : (
              <div key={it.key} className="propis-dictation-review-chip">{it.display}</div>
            )
          ))}
        </div>

        <div className="propis-dictation-review-footer">
          {showRewardStub ? (
            // PIN-gated video-reward unlock is its own follow-up step, not built yet -- see
            // docs/propis.md. Left visibly unfinished rather than faking a working flow.
            <p className="propis-dictation-review-stub-note">
              PIN-подтверждение видео-награды будет добавлено отдельным шагом.
            </p>
          ) : task?.videoRewardEnabled ? (
            <button type="button" className="propis-dictation-next" onClick={() => setShowRewardStub(true)}>
              ✓ Всё верно
            </button>
          ) : (
            <button type="button" className="propis-dictation-next" onClick={onClose}>
              Готово
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
