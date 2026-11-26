// The digit picker of the number cells (owner, 2026-11-25/26): a tap on a cell opens it under the
// cells — 0–9, «случайная», «нет» — and the second tap picks; every state is in sight, two taps at
// most. Shared by «Числа в примере» of «Слушай и посчитай» (DictationNumbersParam) and of
// «Столбик» / «Реши в столбик» (ColumnOperandsParam).
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import "./cellDigitPicker.css";

export const CELL_OPTIONS = ["any", 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, "none"];

export function useCellText() {
  const { t } = useUiTranslation();
  return (v) => (v === "any" ? t("cells.any") : v === "none" ? t("cells.none") : String(v));
}

// The sign cell (2026-11-26): «+», «−» or «случайный» (both, mixed) — the same picker, three options.
export const SIGN_OPTIONS = ["add", "subtract", "mixed"];
export const SIGN_GLYPH = { add: "+", subtract: "−", mixed: "±" };

// The sign drawn as strokes (owner, 2026-11-26): the handwriting font's «+» and «−» sit right of and
// above the middle of their box, so in a square cell they looked off-centre.
export function SignGlyph({ op }) {
  return (
    <svg className="cdp-sign-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {op === "mixed" ? (
        <>
          <path d="M12 4v11M6.5 9.5h11" />
          <path d="M6.5 19.5h11" />
        </>
      ) : op === "subtract" ? (
        <path d="M5.5 12h13" />
      ) : (
        <path d="M12 5.5v13M5.5 12h13" />
      )}
    </svg>
  );
}

export function useSignText() {
  const { t } = useUiTranslation();
  return (v) => (v === "mixed" ? t("cells.anySign") : SIGN_GLYPH[v]);
}

export default function CellDigitPicker({ title, current, options = CELL_OPTIONS, text, isDisabled = () => false, onPick, onClose }) {
  const { t } = useUiTranslation();
  const digitText = useCellText();
  const cellText = text ?? digitText;
  const isSign = options === SIGN_OPTIONS;
  const option = (v) => (
    <button
      key={String(v)}
      type="button"
      className={[
        "cdp-option",
        v === "any" ? "cdp-option--any" : v === "none" ? "cdp-option--none" : "",
        current === v ? "cdp-option--current" : "",
      ].filter(Boolean).join(" ")}
      disabled={isDisabled(v)}
      aria-pressed={current === v}
      onClick={() => onPick(v)}
    >
      {cellText(v)}
    </button>
  );
  return (
    <div className="cdp-picker" role="group" aria-label={title}>
      <div className="cdp-picker__head">
        <span>{title}</span>
        <button type="button" className="cdp-picker__close" aria-label={t("cells.close")} onClick={onClose}>×</button>
      </div>
      {isSign ? (
        // tiles the size of the cells (owner, 2026-11-26); «случайный» is «±» with a caption under it
        <div className="cdp-picker__signs">
          {options.map((v) => (
            <div key={v} className="cdp-sign">
              <button
                type="button"
                className={[
                  "cdp-option",
                  "cdp-option--sign",
                  v === "subtract" ? "cdp-option--minus" : "",
                  v === "mixed" ? "cdp-option--random" : "",
                  current === v ? "cdp-option--current" : "",
                ].filter(Boolean).join(" ")}
                aria-pressed={current === v}
                aria-label={cellText(v)}
                onClick={() => onPick(v)}
              >
                <SignGlyph op={v} />
              </button>
              {v === "mixed" && <small className="cdp-sign__caption" aria-hidden="true">{cellText(v)}</small>}
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* the digits as square tiles, five in a row; the two words under them, wide */}
          <div className="cdp-picker__digits">
            {options.filter((v) => typeof v === "number").map(option)}
          </div>
          <div className="cdp-picker__words">
            {options.filter((v) => typeof v !== "number").map(option)}
          </div>
        </>
      )}
    </div>
  );
}

// The legend next to the cells: what a cell's look means.
export function CellLegend() {
  const { t } = useUiTranslation();
  return (
    <ul className="cop-legend">
      <li><span className="cop-mini cop-mini--on" aria-hidden="true" /> {t("cells.legendAny")}</li>
      <li><span className="cop-mini cop-mini--fixed" aria-hidden="true">7</span> {t("cells.legendFixed")}</li>
      <li><span className="cop-mini" aria-hidden="true" /> {t("cells.legendNone")}</li>
    </ul>
  );
}
