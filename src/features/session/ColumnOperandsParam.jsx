// «Числа в примере» for «Столбик — Тренажёр» (2026-11-15, owner's design):
// the setting is drawn as the column — two rows of 3 cells, the sign, the
// line, an example under it. Since 2026-11-26 (owner: the same as «Слушай и
// посчитай») a tap on any cell opens a picker under the cells — «любая», 0–9,
// «нет» — and the second tap picks (CellDigitPicker). A value over an empty
// cell grows the number to it, «нет» cuts the number below it; the leading
// digit is never 0 and the units are always there (those options go dim).
// With «+» and «Микс» either number may be the longer (25 + 326) — in a mix
// the subtraction examples cut the bottom to the top's length on their own;
// with «−» the bottom is no longer than the top — its extra cells go dim and
// don't take a tap. The cells are shared with «Реши в столбик» of «Контрольные
// по математике» (math_tests/Inspector.jsx): one setting, one look.
// Value: { top, topZeros, topFixed?, bottom, bottomZeros, bottomFixed? } — engine.js normalizeOperands.

import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeOperands, operandCell, operandsExample, operandsSingle, setOperandCell } from "@/topics/renderers/column_addition/engine.js";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import CellDigitPicker, { CellLegend, useCellText } from "./CellDigitPicker.jsx";
import "./columnOperandsParam.css";

const CELLS = 3;

// What the picker offers for a cell: no 0 where it would lead the number, no «нет» for the units.
export function cellOptionDisabled(o, row, place, value) {
  if (value === "none") return place === 0;
  if (value === 0) return place >= o[row] - 1;
  return false;
}

function OperandCells({ o, sign, limitOp, onChange }) {
  const { t } = useUiTranslation();
  const cellText = useCellText();
  const [editing, setEditing] = useState(null);
  const rootRef = useRef(null);
  useEffect(() => {
    if (!editing) return undefined;
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setEditing(null); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [editing]);

  const cellName = (row, place) => t(`column.cell.${row}.${place}`);
  const rowCells = (row, gridRow, max) => {
    const out = [];
    for (let place = CELLS - 1; place >= 0; place--) {
      const v = operandCell(o, row, place);
      const off = place >= max;
      const isEditing = editing?.row === row && editing?.place === place;
      out.push(
        <button
          key={`${row}-${place}`}
          type="button"
          disabled={off}
          className={[
            "cop-cell",
            v === "any" ? "cop-cell--on" : "",
            v === 0 ? "cop-cell--on cop-cell--zero" : "",
            typeof v === "number" && v > 0 ? "cop-cell--fixed" : "",
            off ? "cop-cell--off" : "",
            isEditing ? "cop-cell--editing" : "",
          ].filter(Boolean).join(" ")}
          style={{ gridRow, gridColumn: 2 + (CELLS - 1 - place) }}
          aria-label={t("dictation.cellState", { cell: cellName(row, place), value: cellText(v) })}
          aria-expanded={isEditing}
          onClick={() => setEditing(isEditing ? null : { row, place })}
        >
          {typeof v === "number" ? v : ""}
        </button>
      );
    }
    return out;
  };

  return (
    <div className="cop-cells" ref={rootRef}>
      <div className="cop-body">
        <div className="cop-column">
          {rowCells("top", 1, CELLS)}
          <span className="cop-sign" style={{ gridRow: 2, gridColumn: 1 }}>{sign}</span>
          {rowCells("bottom", 2, limitOp === "add" ? CELLS : o.top)}
          <span className="cop-line" style={{ gridRow: 3, gridColumn: `1 / ${CELLS + 2}` }} />
        </div>
        <CellLegend />
      </div>
      {editing && (
        <CellDigitPicker
          title={cellName(editing.row, editing.place)}
          current={operandCell(o, editing.row, editing.place)}
          isDisabled={(v) => cellOptionDisabled(o, editing.row, editing.place, v)}
          onPick={(v) => { const { row, place } = editing; setEditing(null); onChange(setOperandCell(o, row, place, v, limitOp)); }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// `operation`: "add" | "subtract" | "mixed" — only «−» limits the bottom number.
export function ColumnOperandCells({ value, operation, onChange }) {
  const limitOp = operation === "subtract" ? "subtract" : "add";
  const o = normalizeOperands(value, limitOp);
  const sign = operation === "subtract" ? "−" : operation === "add" ? "+" : "±";
  return <OperandCells o={o} sign={sign} limitOp={limitOp} onChange={onChange} />;
}

export default function ColumnOperandsParam({ label, value, operation, carryMode, onChange, labelNode }) {
  const { t } = useUiTranslation();
  const limitOp = operation === "subtract" ? "subtract" : "add";
  const o = normalizeOperands(value, limitOp);
  // switching to «−» cuts a longer bottom — keep the saved value the same as shown
  const shownKey = JSON.stringify(o);
  useEffect(() => {
    if (JSON.stringify(normalizeOperands(value)) !== shownKey) onChange(o);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownKey]);
  const [seed, setSeed] = useState(0);
  const op = operation === "subtract" ? "subtract" : operation === "mixed" ? (seed % 2 ? "subtract" : "add") : "add";
  const sign = op === "subtract" ? "−" : "+";
  const key = JSON.stringify(o);
  const example = useMemo(
    () => operandsExample(o, op, carryMode ?? "none"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, op, carryMode, seed],
  );

  return (
    <div className="param-row param-row--block cop" aria-label={label}>
      {labelNode}
      <OperandCells o={o} sign={sign} limitOp={limitOp} onChange={onChange} />
      <div className="cop-example">
        <span>Например:</span>
        <span className="cop-example__numbers">{example ? `${example.top} ${example.operation === "subtract" ? "−" : "+"} ${example.bottom}` : "—"}</span>
        <button type="button" className="cop-again" aria-label="Другой пример" onClick={() => setSeed((s) => s + 1)}>↻</button>
      </div>
      {operandsSingle(o) && <div className="cop-note">{t("cells.single")}</div>}
      {example?.relaxed && (
        <div className="cop-note">
          {t(`column.relaxed.${op === "subtract" ? "borrow" : "carry"}.${carryMode === "carry" ? "never" : "always"}`)}
        </div>
      )}
    </div>
  );
}
