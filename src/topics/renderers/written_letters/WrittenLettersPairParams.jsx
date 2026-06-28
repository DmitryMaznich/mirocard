import HandwrittenLetter from "./HandwrittenLetter";

const OPTIONS = [
  { value: "upper", stim: "А", target: "а", arrow: "→" },
  { value: "lower", stim: "а", target: "А", arrow: "→" },
  { value: "mix",   stim: "А", target: "а", arrow: "⇄" },
];

const PREVIEW_SIZE = 44;

export default function WrittenLettersPairParams({ params, onChange }) {
  const showCase   = params.show_case   ?? "upper";
  const secondStep = params.second_step ?? false;

  return (
    <div className="wl-pp">
      <div className="wl-pp-section-label">Задача</div>
      <div className="wl-pp-cards">
        {OPTIONS.map((opt) => {
          const active = showCase === opt.value;
          return (
            <button
              key={opt.value}
              className={`wl-pp-card${active ? " wl-pp-card--active" : ""}`}
              onClick={() => onChange({ ...params, show_case: opt.value })}
            >
              <div className="wl-pp-card__preview">
                <HandwrittenLetter letter={opt.stim} size={PREVIEW_SIZE} bare />
                <span className="wl-pp-card__arrow">{opt.arrow}</span>
                <HandwrittenLetter letter={opt.target} size={PREVIEW_SIZE} bare />
              </div>
              <div className="wl-pp-card__check" aria-hidden>
                {active && <span className="wl-pp-card__check-icon">✓</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="wl-pp-section-label wl-pp-section-label--gap">Дополнительно</div>
      <button
        className={`wl-pp-toggle${secondStep ? " wl-pp-toggle--on" : ""}`}
        onClick={() => onChange({ ...params, second_step: !secondStep })}
      >
        <div className="wl-pp-toggle__switch">
          <div className="wl-pp-toggle__thumb" />
        </div>
        <div className="wl-pp-toggle__body">
          <span className="wl-pp-toggle__title">Какая это буква?</span>
          <span className="wl-pp-toggle__hint">После пары — 4 печатных варианта на выбор</span>
        </div>
      </button>
    </div>
  );
}
