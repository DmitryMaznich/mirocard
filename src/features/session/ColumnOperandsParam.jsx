// «Числа в примере» for «Столбик — Тренажёр» (2026-11-15, owner's design):
// the setting is drawn as the column — two rows of 3 cells, the sign, the
// line, an example under it. Every cell of both rows works the same way:
//   an empty cell — the number grows to it;
//   a marked cell — 0 there if a 0 can stand there, otherwise the cell goes
//   off (the leading digit of a number is never 0); a 0 tapped again — back
//   to any digit.
// With «+» and «Микс» either number may be the longer (25 + 326) — in a mix
// the subtraction examples cut the bottom to the top's length on their own;
// with «−» the bottom is no longer than the top — its extra cells go dim and
// don't take a tap. No row captions, no notebook grid, no extra buttons or notes (owner:
// one gesture, one meaning).
// Value: { top, topZeros, bottom, bottomZeros } — engine.js normalizeOperands.

import { useEffect, useMemo, useState } from "react";
import { normalizeOperands, operandsExample } from "@/topics/renderers/column_addition/engine.js";
import "./columnOperandsParam.css";

const CELLS = 3;

export function tapCell(o, row, place, operation = "add") {
  const digits = o[row];
  const zerosKey = row === "top" ? "topZeros" : "bottomZeros";
  if (row === "bottom" && operation !== "add" && place >= o.top) return o;
  const next = place >= digits ? { ...o, [row]: place + 1 }
    : place === digits - 1 ? (digits > 1 ? { ...o, [row]: place } : o)
    : { ...o, [zerosKey]: o[zerosKey].includes(place) ? o[zerosKey].filter((p) => p !== place) : [...o[zerosKey], place] };
  return normalizeOperands(next, operation);
}

function CellRow({ row, digits, zeros, max = CELLS, gridRow, onTap, label }) {
  const cells = [];
  for (let place = CELLS - 1; place >= 0; place--) {
    const on = place < digits;
    const zero = on && zeros.includes(place);
    const off = place >= max;
    cells.push(
      <button
        key={place}
        type="button"
        disabled={off}
        className={["cop-cell", on ? "cop-cell--on" : "", zero ? "cop-cell--zero" : "", off ? "cop-cell--off" : ""].filter(Boolean).join(" ")}
        style={{ gridRow, gridColumn: 2 + (CELLS - 1 - place) }}
        aria-label={`${label}, ${["единицы", "десятки", "сотни"][place]}: ${zero ? "ноль" : on ? "цифра" : "пусто"}`}
        onClick={() => onTap(row, place)}
      >
        {zero ? "0" : ""}
      </button>
    );
  }
  return cells;
}

// The cells and what a cell means — shared with the block panel of «Контрольные по математике»
// («Реши в столбик», math_tests/Inspector.jsx): one setting, one look.
function OperandCells({ o, sign, limitOp, onTap }) {
  return (
    <div className="cop-body">
      <div className="cop-column">
        <CellRow row="top" label="Верхнее число" digits={o.top} zeros={o.topZeros} gridRow={1} onTap={onTap} />
        <span className="cop-sign" style={{ gridRow: 2, gridColumn: 1 }}>{sign}</span>
        <CellRow row="bottom" label="Нижнее число" digits={o.bottom} zeros={o.bottomZeros} max={limitOp === "add" ? CELLS : o.top} gridRow={2} onTap={onTap} />
        <span className="cop-line" style={{ gridRow: 3, gridColumn: `1 / ${CELLS + 2}` }} />
      </div>
      {/* what a cell means, next to the cells (owner: states, not gestures) */}
      <ul className="cop-legend">
        <li><span className="cop-mini cop-mini--on" aria-hidden="true" /> любая цифра</li>
        <li><span className="cop-mini cop-mini--zero" aria-hidden="true">0</span> ноль</li>
        <li><span className="cop-mini" aria-hidden="true" /> разряда нет</li>
      </ul>
    </div>
  );
}

// `operation`: "add" | "subtract" | "mixed" — only «−» limits the bottom number.
export function ColumnOperandCells({ value, operation, onChange }) {
  const limitOp = operation === "subtract" ? "subtract" : "add";
  const o = normalizeOperands(value, limitOp);
  const sign = operation === "subtract" ? "−" : operation === "add" ? "+" : "±";
  return <OperandCells o={o} sign={sign} limitOp={limitOp} onTap={(row, place) => onChange(tapCell(o, row, place, limitOp))} />;
}

export default function ColumnOperandsParam({ label, value, operation, carryMode, onChange, labelNode }) {
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
  const tap = (row, place) => onChange(tapCell(o, row, place, limitOp));

  return (
    <div className="param-row param-row--block cop" aria-label={label}>
      {labelNode}
      <OperandCells o={o} sign={sign} limitOp={limitOp} onTap={tap} />
      <div className="cop-example">
        <span>Например:</span>
        <span className="cop-example__numbers">{example ? `${example.top} ${example.operation === "subtract" ? "−" : "+"} ${example.bottom}` : "—"}</span>
        <button type="button" className="cop-again" aria-label="Другой пример" onClick={() => setSeed((s) => s + 1)}>↻</button>
      </div>
      {example?.relaxed && (
        <div className="cop-note">
          {op === "subtract" ? "С займом" : "С переносом"} такие числа не бывают без нового разряда — примеры будут без {op === "subtract" ? "займа" : "переноса"}.
        </div>
      )}
    </div>
  );
}
