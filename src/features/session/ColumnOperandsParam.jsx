// «Числа в примере» for «Столбик — Тренажёр» (2026-11-15, owner's design):
// the setting is drawn as the column — two rows of 3 cells, the sign, the
// line, an example under it. Every cell of both rows works the same way:
//   an empty cell — the number grows to it;
//   a marked cell — 0 there if a 0 can stand there, otherwise the cell goes
//   off (the leading digit of a number is never 0); a 0 tapped again — back
//   to any digit.
// Either number may be the longer (25 + 326). No row captions, no notebook
// grid, no extra buttons on the cells (owner: one gesture, one meaning).
// Value: { top, topZeros, bottom, bottomZeros } — engine.js normalizeOperands.

import { useMemo, useState } from "react";
import { normalizeOperands, operandsExample, operandsSwappedFor } from "@/topics/renderers/column_addition/engine.js";
import "./columnOperandsParam.css";

const CELLS = 3;

export function tapCell(o, row, place) {
  const digits = o[row];
  const zerosKey = row === "top" ? "topZeros" : "bottomZeros";
  if (place >= digits) return normalizeOperands({ ...o, [row]: place + 1 });
  if (place === digits - 1) return digits > 1 ? normalizeOperands({ ...o, [row]: place }) : o;
  const zeros = o[zerosKey].includes(place) ? o[zerosKey].filter((p) => p !== place) : [...o[zerosKey], place];
  return normalizeOperands({ ...o, [zerosKey]: zeros });
}

function CellRow({ row, digits, zeros, gridRow, onTap, label }) {
  const cells = [];
  for (let place = CELLS - 1; place >= 0; place--) {
    const on = place < digits;
    const zero = on && zeros.includes(place);
    cells.push(
      <button
        key={place}
        type="button"
        className={["cop-cell", on ? "cop-cell--on" : "", zero ? "cop-cell--zero" : ""].filter(Boolean).join(" ")}
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

export default function ColumnOperandsParam({ label, value, operation, carryMode, onChange, labelNode }) {
  const o = normalizeOperands(value);
  const [seed, setSeed] = useState(0);
  const op = operation === "subtract" ? "subtract" : operation === "mixed" ? (seed % 2 ? "subtract" : "add") : "add";
  const sign = op === "subtract" ? "−" : "+";
  const key = JSON.stringify(o);
  const example = useMemo(
    () => operandsExample(o, op, carryMode ?? "none"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, op, carryMode, seed],
  );
  const hasZeros = o.topZeros.length + o.bottomZeros.length > 0;
  const tap = (row, place) => onChange(tapCell(o, row, place));
  const swapped = (operation === "subtract" || operation === "mixed") && operandsSwappedFor(o, "subtract");

  return (
    <div className="param-row param-row--block cop" aria-label={label}>
      {labelNode}
      <div className="cop-column">
        <CellRow row="top" label="Верхнее число" digits={o.top} zeros={o.topZeros} gridRow={1} onTap={tap} />
        <span className="cop-sign" style={{ gridRow: 2, gridColumn: 1 }}>{sign}</span>
        <CellRow row="bottom" label="Нижнее число" digits={o.bottom} zeros={o.bottomZeros} gridRow={2} onTap={tap} />
        <span className="cop-line" style={{ gridRow: 3, gridColumn: `1 / ${CELLS + 2}` }} />
      </div>
      <div className="cop-example">
        <span>Например:</span>
        <span className="cop-example__numbers">{example ? `${example.top} ${example.operation === "subtract" ? "−" : "+"} ${example.bottom}` : "—"}</span>
        <button type="button" className="cop-again" onClick={() => setSeed((s) => s + 1)}>↻ Другой</button>
      </div>
      {swapped && <div className="cop-note">В вычитании большее число встанет сверху: числа поменяются местами.</div>}
      {example?.relaxed && (
        <div className="cop-note">
          {op === "subtract" ? "С займом" : "С переносом"} такие числа не бывают без нового разряда — примеры будут без {op === "subtract" ? "займа" : "переноса"}.
        </div>
      )}
      {hasZeros && (
        <div className="cop-actions">
          {/* was a «Любое (без нулей)» checkbox — it couldn't be unchecked (what
              would «not any» be?) and read as broken; now a plain action */}
          <button type="button" className="cop-clear" onClick={() => onChange(normalizeOperands({ ...o, topZeros: [], bottomZeros: [] }))}>
            Убрать нули
          </button>
        </div>
      )}
      <div className="cop-hint">Пустая клетка — число до неё. Ещё раз — 0 в ней, а где 0 стоять не может (первая цифра), клетка выключается.</div>
    </div>
  );
}
