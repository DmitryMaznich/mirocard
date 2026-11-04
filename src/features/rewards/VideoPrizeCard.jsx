import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { rewardText as text } from "./rewardText.js";
import "./rewards.css";

// «Видеоприз» — the one standard block of video-prize settings for a lesson (owner, 2026-11-04: «три
// разных слова — видеонаграда, видеоприз, видео — и всё на разных плашках… сделаем типовым во всём
// приложении»). One plate, one word: the prize on/off, how many right answers in a row earn it, and
// whether it is also offered at the end of the lesson, and «Строгий подсчёт» for this lesson (per topic,
// owner 2026-11-04: «как и было»); under them what a mistake burns — the student's rule, shown, changed
// in the student card with the prize's duration. Rows a screen does not use are left out (`showSeries`, `showAtEnd`). Uses the settings
// screen's own classes (.param-plate / .param-row / .param-toggle / .enum-btn).

function Label({ label, info, onShowInfo }) {
  return (
    <div className="param-label-wrap">
      <span className="param-label">{label}</span>
      {info && onShowInfo && (
        <button
          type="button"
          className="param-info-btn"
          aria-label={`Пояснение: ${label}`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onShowInfo({ title: label, text: info }); }}
        >
          i
        </button>
      )}
    </div>
  );
}

function Switch({ on, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`param-toggle ${on ? "param-toggle--on" : ""}`}
      disabled={disabled}
      onClick={() => onChange(!on)}
    />
  );
}

export default function VideoPrizeCard({
  enabled, onEnabled,
  showSeries = true, answersPerStar = 1, onAnswersPerStar,
  showAtEnd = false, atEnd = false, onAtEnd,
  showStrict = false, strict = true, onStrict,
  rules = null, note = null, onShowInfo,
}) {
  useUiTranslation();
  const off = !enabled;
  return (
    <div className="param-plate video-prize-card" aria-label={text("prize")}>
      <div className="param-row video-prize-card__head">
        <Label label={text("prize")} info={text("prizeInfo")} onShowInfo={onShowInfo} />
        <Switch on={enabled} onChange={onEnabled} label={text("prize")} />
      </div>

      {showSeries && (
        <div className={`param-row${off ? " param-row--disabled" : ""}`}>
          <Label label={text("series")} info={text("seriesInfo")} onShowInfo={onShowInfo} />
          <div className="param-enum-group">
            {[1, 2, 3].map((n) => (
              <button key={n} type="button" className={`enum-btn ${answersPerStar === n ? "enum-btn--active" : ""}`} disabled={off} onClick={() => onAnswersPerStar?.(n)}>
                {5 * n}
              </button>
            ))}
          </div>
        </div>
      )}

      {showAtEnd && (
        <div className={`param-row${off ? " param-row--disabled" : ""}`}>
          <Label label={text("atEnd")} info={text("atEndInfo")} onShowInfo={onShowInfo} />
          <Switch on={atEnd} onChange={onAtEnd} label={text("atEnd")} disabled={off} />
        </div>
      )}

      {showStrict && (
        <div className={`param-row${off ? " param-row--disabled" : ""}`}>
          <Label label={text("strict")} info={text("strictInfo")} onShowInfo={onShowInfo} />
          <Switch on={strict} onChange={onStrict} label={text("strict")} disabled={off} />
        </div>
      )}

      {(rules || note) && (
        <div className="param-row video-prize-card__foot">
          {note && <span>{note}</span>}
          {rules && (
            <span>
              {text("loss")}: <strong>{text(rules.lossMode === "all" ? "all" : "one").toLowerCase()}</strong>
              {". "}{text("lossWhere")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
