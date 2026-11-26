// The digit picker of the number cells (owner, 2026-11-25/26): a tap on a cell opens it under the
// cells — «любая», 0–9, «нет» — and the second tap picks; every state is in sight, two taps at
// most. Shared by «Числа в примере» of «Слушай и посчитай» (DictationNumbersParam) and of
// «Столбик» / «Реши в столбик» (ColumnOperandsParam).
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import "./cellDigitPicker.css";

export const CELL_OPTIONS = ["any", 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, "none"];

export function useCellText() {
  const { t } = useUiTranslation();
  return (v) => (v === "any" ? t("cells.any") : v === "none" ? t("cells.none") : String(v));
}

export default function CellDigitPicker({ title, current, isDisabled = () => false, onPick, onClose }) {
  const { t } = useUiTranslation();
  const cellText = useCellText();
  return (
    <div className="cdp-picker" role="group" aria-label={title}>
      <div className="cdp-picker__head">
        <span>{title}</span>
        <button type="button" className="cdp-picker__close" aria-label={t("cells.close")} onClick={onClose}>×</button>
      </div>
      <div className="cdp-picker__grid">
        {CELL_OPTIONS.map((v) => (
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
        ))}
      </div>
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
