import { useMemo, useState } from "react";
import { normalizeOperands, operandsExample } from "@/topics/renderers/column_addition/engine.js";
import "./columnOperandsParam.css";

// «Числа в примере» for «Столбик — Тренажёр» (2026-11-15, mockup
// docs/mockups/column-addition/2026-11-15-operands-cells-b.html): the setting
// is drawn as the column itself — two rows of 3 cells, the sign, the line.
//   empty cell → the number grows to it;
//   marked cell → 0 there (again → any digit);
//   the leading cell takes no 0 — a tap shakes it and says so; its «×»
//   removes it (2026-11-15: a silent «tap the left cell to remove» read as
//   «the zero doesn't work»).
// Under the line — an example of what the child gets. No row captions and no
// notebook grid (owner: this is the adult's screen, the example says enough).
// Value: { top, topZeros, bottom, bottomZeros } — engine.js normalizeOperands.

const CELLS = 3;

// The smallest numbers the trainer takes: a two-digit top, a one-digit bottom.
const MIN_DIGITS = { top: 2, bottom: 1 };

// empty cell → the number grows to it; a marked cell → 0 there or back; the
// leading cell takes no 0 (a number doesn't start with one) — its own «×»
// removes it.
function tapCell(o, row, place) {
  const digits = o[row];
  const zerosKey = row === "top" ? "topZeros" : "bottomZeros";
  const max = row === "top" ? CELLS : o.top;
  if (place >= max) return o;
  if (place >= digits) return normalizeOperands({ ...o, [row]: place + 1 });
  if (place === digits - 1) return o;
  const zeros = o[zerosKey].includes(place) ? o[zerosKey].filter((p) => p !== place) : [...o[zerosKey], place];
  return normalizeOperands({ ...o, [zerosKey]: zeros });
}

function CellRow({ row, digits, zeros, max, gridRow, onTap, onRemove, shaking, label }) {
  const cells = [];
  for (let place = CELLS - 1; place >= 0; place--) {
    const on = place < digits;
    const zero = on && zeros.includes(place);
    const off = place >= max;
    const lead = on && place === digits - 1;
    const removable = lead && digits > MIN_DIGITS[row];
    cells.push(
      <div key={place} className="cop-slot" style={{ gridRow, gridColumn: 2 + (CELLS - 1 - place) }}>
        <button
          type="button"
          className={[
            "cop-cell",
            on ? "cop-cell--on" : "",
            lead ? "cop-cell--lead" : "",
            zero ? "cop-cell--zero" : "",
            off ? "cop-cell--off" : "",
            shaking === `${row}:${place}` ? "cop-cell--shake" : "",
          ].filter(Boolean).join(" ")}
          disabled={off}
          aria-label={`${label}, ${["единицы", "десятки", "сотни"][place]}: ${zero ? "ноль" : on ? "цифра" : "пусто"}`}
          onClick={() => onTap(row, place)}
        >
          {zero ? "0" : ""}
        </button>
        {removable && (
          <button type="button" className="cop-remove" aria-label={`${label}: убрать цифру`} onClick={() => onRemove(row)}>×</button>
        )}
      </div>
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
  const [shaking, setShaking] = useState(null);
  const tap = (row, place) => {
    if (place === o[row] - 1) {
      setShaking(`${row}:${place}`);
      setTimeout(() => setShaking(null), 1600);
      return;
    }
    onChange(tapCell(o, row, place));
  };
  const remove = (row) => onChange(normalizeOperands({ ...o, [row]: o[row] - 1 }));

  return (
    <div className="param-row param-row--block cop" aria-label={label}>
      {labelNode}
      <div className="cop-column">
        <CellRow row="top" label="Верхнее число" digits={o.top} zeros={o.topZeros} max={CELLS} gridRow={1} onTap={tap} onRemove={remove} shaking={shaking} />
        <span className="cop-sign" style={{ gridRow: 2, gridColumn: 1 }}>{sign}</span>
        <CellRow row="bottom" label="Нижнее число" digits={o.bottom} zeros={o.bottomZeros} max={o.top} gridRow={2} onTap={tap} onRemove={remove} shaking={shaking} />
        <span className="cop-line" style={{ gridRow: 3, gridColumn: `1 / ${CELLS + 2}` }} />
      </div>
      <div className="cop-example">
        <span>Например:</span>
        <span className="cop-example__numbers">{example ? `${example.top} ${example.operation === "subtract" ? "−" : "+"} ${example.bottom}` : "—"}</span>
        <button type="button" className="cop-again" onClick={() => setSeed((s) => s + 1)}>↻ Другой</button>
      </div>
      {shaking && <div className="cop-note">Число не начинается с нуля — эту цифру можно только убрать (×).</div>}
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
      <div className="cop-hint">Пустая клетка — число до неё. Отмеченная — 0 в ней, ещё раз — любая цифра. × — убрать цифру.</div>
    </div>
  );
}
