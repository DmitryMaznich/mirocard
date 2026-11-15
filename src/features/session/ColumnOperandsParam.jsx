import { useMemo, useState } from "react";
import { normalizeOperands, operandsExample } from "@/topics/renderers/column_addition/engine.js";
import "./columnOperandsParam.css";

// «Числа в примере» for «Столбик — Тренажёр» (2026-11-15, mockup
// docs/mockups/column-addition/2026-11-15-operands-cells-b.html): the setting
// is drawn as the column itself — two rows of 3 cells, the sign, the line.
//   empty cell → the number grows to it;
//   marked cell → 0 there (again → any digit);
//   the leftmost marked cell → removes it.
// Under the line — an example of what the child gets. No row captions and no
// notebook grid (owner: this is the adult's screen, the example says enough).
// Value: { top, topZeros, bottom, bottomZeros } — engine.js normalizeOperands.

const CELLS = 3;

function tapCell(o, row, place) {
  const digits = row === "top" ? o.top : o.bottom;
  const zerosKey = row === "top" ? "topZeros" : "bottomZeros";
  const max = row === "top" ? CELLS : o.top;
  if (place >= max) return o;
  if (place >= digits) return normalizeOperands({ ...o, [row]: place + 1 });
  if (place === digits - 1) return normalizeOperands({ ...o, [row]: Math.max(1, place) });
  const zeros = o[zerosKey].includes(place) ? o[zerosKey].filter((p) => p !== place) : [...o[zerosKey], place];
  return normalizeOperands({ ...o, [zerosKey]: zeros });
}

function CellRow({ row, digits, zeros, max, gridRow, onTap, label }) {
  const cells = [];
  for (let place = CELLS - 1; place >= 0; place--) {
    const on = place < digits;
    const zero = on && zeros.includes(place);
    const off = place >= max;
    cells.push(
      <button
        key={place}
        type="button"
        className={["cop-cell", on ? "cop-cell--on" : "", zero ? "cop-cell--zero" : "", off ? "cop-cell--off" : ""].filter(Boolean).join(" ")}
        style={{ gridRow, gridColumn: 2 + (CELLS - 1 - place) }}
        disabled={off}
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

  return (
    <div className="param-row param-row--block cop" aria-label={label}>
      {labelNode}
      <div className="cop-column">
        <CellRow row="top" label="Верхнее число" digits={o.top} zeros={o.topZeros} max={CELLS} gridRow={1} onTap={tap} />
        <span className="cop-sign" style={{ gridRow: 2, gridColumn: 1 }}>{sign}</span>
        <CellRow row="bottom" label="Нижнее число" digits={o.bottom} zeros={o.bottomZeros} max={o.top} gridRow={2} onTap={tap} />
        <span className="cop-line" style={{ gridRow: 3, gridColumn: `1 / ${CELLS + 2}` }} />
      </div>
      <div className="cop-example">
        <span>Например:</span>
        <span className="cop-example__numbers">{example ? `${example.top} ${example.operation === "subtract" ? "−" : "+"} ${example.bottom}` : "—"}</span>
        <button type="button" className="cop-again" onClick={() => setSeed((s) => s + 1)}>↻ Другой</button>
      </div>
      {example?.relaxed && (
        <div className="cop-note">
          {op === "subtract" ? "С займом" : "С переносом"} такие числа не бывают без нового разряда — примеры будут без {op === "subtract" ? "займа" : "переноса"}.
        </div>
      )}
      <div className="cop-actions">
        <button
          type="button"
          role="checkbox"
          aria-checked={!hasZeros}
          className={`cop-check${hasZeros ? "" : " cop-check--on"}`}
          onClick={() => onChange(normalizeOperands({ ...o, topZeros: [], bottomZeros: [] }))}
        >
          <span className="cop-check__box" aria-hidden="true" />
          Любое (без нулей)
        </button>
      </div>
      <div className="cop-hint">Пустая клетка — число до неё. Отмеченная — 0 в ней, ещё раз — любая цифра. Левая — убрать.</div>
    </div>
  );
}
