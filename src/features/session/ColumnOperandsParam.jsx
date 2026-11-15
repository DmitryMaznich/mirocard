import { useMemo, useState } from "react";
import { normalizeOperands, operandsExample } from "@/topics/renderers/column_addition/engine.js";
import "./columnOperandsParam.css";

// «Числа в примере» for «Столбик — Тренажёр» (2026-11-15): each number of the
// column chosen on its own — how many digits, and what kind — with a live
// example in the column next to it, instead of a row of abbreviations
// («2-зн. + 1-зн.», «Круглые дес.», …). Value: { top, topKind, bottom,
// bottomKind } (column_addition/engine.js → normalizeOperands).

const WIDTHS = [
  { value: 1, label: "1 цифра" },
  { value: 2, label: "2 цифры" },
  { value: 3, label: "3 цифры" },
];

const KINDS = {
  any: { label: "Любое", sample: (w) => ({ 1: "7", 2: "34", 3: "347" })[w] },
  round: { label: "Круглое", sample: (w) => ({ 2: "40", 3: "340" })[w] },
  zero: { label: "С нулём", sample: () => "305" },
};

function Segments({ options, value, onChange, ariaLabel }) {
  return (
    <div className="cop-segments" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={`cop-seg${value === opt.value ? " cop-seg--on" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          <span className="cop-seg__label">{opt.label}</span>
          {opt.sample ? <span className="cop-seg__sample">{opt.sample}</span> : null}
        </button>
      ))}
    </div>
  );
}

function NumberChoice({ title, widths, kinds, digits, kind, onDigits, onKind }) {
  return (
    <div className="cop-number">
      <div className="cop-number__title">{title}</div>
      <Segments
        ariaLabel={`${title}: сколько цифр`}
        options={widths.map((w) => ({ value: w.value, label: w.label }))}
        value={digits}
        onChange={onDigits}
      />
      {kinds.length > 1 && (
        <Segments
          ariaLabel={`${title}: какое`}
          options={kinds.map((k) => ({ value: k, label: KINDS[k].label, sample: KINDS[k].sample(digits) }))}
          value={kind}
          onChange={onKind}
        />
      )}
    </div>
  );
}

function ColumnPreview({ example, sign }) {
  const cols = String(example.top).length;
  const rows = [String(example.top), String(example.bottom)];
  return (
    <div className="cop-preview__column" style={{ gridTemplateColumns: `repeat(${cols + 1}, 1fr)` }}>
      {rows.map((n, r) => [
        r === 1 ? <span key="sign" className="cop-preview__sign" style={{ gridRow: 2, gridColumn: 1 }}>{sign}</span> : null,
        ...n.split("").map((d, i) => (
          <span key={`${r}-${i}`} className="cop-preview__digit" style={{ gridRow: r + 1, gridColumn: cols + 1 - (n.length - 1 - i) }}>{d}</span>
        )),
      ])}
      <span className="cop-preview__line" style={{ gridColumn: `1 / ${cols + 2}` }} />
    </div>
  );
}

export default function ColumnOperandsParam({ label, value, operation, carryMode, onChange, labelNode }) {
  const o = normalizeOperands(value);
  const [seed, setSeed] = useState(0);
  const op = operation === "subtract" ? "subtract" : operation === "mixed" ? (seed % 2 ? "subtract" : "add") : "add";
  const example = useMemo(
    () => operandsExample(o, op, carryMode ?? "none"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [o.top, o.topKind, o.bottom, o.bottomKind, op, carryMode, seed],
  );
  const set = (patch) => onChange(normalizeOperands({ ...o, ...patch }));

  const topKinds = o.top === 3 ? ["any", "round", "zero"] : ["any", "round"];
  const bottomKinds = o.bottom >= 2 ? ["any", "round"] : ["any"];

  return (
    <div className="param-row param-row--block cop" aria-label={label}>
      {labelNode}
      <div className="cop__body">
        <div className="cop__choices">
          <NumberChoice
            title="Верхнее число"
            widths={WIDTHS.filter((w) => w.value >= 2)}
            kinds={topKinds}
            digits={o.top}
            kind={o.topKind}
            onDigits={(top) => set({ top })}
            onKind={(topKind) => set({ topKind })}
          />
          <NumberChoice
            title="Нижнее число"
            widths={WIDTHS.filter((w) => w.value <= o.top)}
            kinds={bottomKinds}
            digits={o.bottom}
            kind={o.bottomKind}
            onDigits={(bottom) => set({ bottom })}
            onKind={(bottomKind) => set({ bottomKind })}
          />
        </div>
        <div className="cop-preview">
          <div className="cop-preview__caption">Например</div>
          {example ? <ColumnPreview example={example} sign={example.operation === "subtract" ? "−" : "+"} /> : null}
          <button type="button" className="cop-preview__again" onClick={() => setSeed((s) => s + 1)}>
            ↻ Другой
          </button>
        </div>
      </div>
      {example?.relaxed && (
        <div className="cop__note">
          {op === "subtract" ? "С займом" : "С переносом"} таких примеров не бывает без нового разряда — будут без {op === "subtract" ? "займа" : "переноса"}.
        </div>
      )}
    </div>
  );
}
