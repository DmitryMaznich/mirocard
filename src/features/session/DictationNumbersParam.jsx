// «Числа в примере» of «Слушай и посчитай» (operation_audio, owner, 2026-11-25; mockup
// docs/mockups/addition-subtraction/2026-11-25-dictation-settings.html). The example is drawn
// as two numbers of two cells, like «Столбик — Тренажёр» (ColumnOperandsParam), but a tap on a
// cell opens a picker under the cells — «любая», 0–9, «нет» — and the second tap picks: any
// state in two taps, all of them in sight. The column's own cells are not changed (owner: not
// carried over to the column for now). Under the cells — an example as the child will hear it;
// ▶ plays it with the lesson's own recordings.
// Value: { top: { tens, units }, bottom: { tens, units } } — dictation.js.

import { useEffect, useMemo, useRef, useState } from "react";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import {
  dictationPlan,
  drawDictationExample,
  normalizeDictationNumbers,
} from "@/topics/renderers/addition_subtraction/dictation.js";
import { audioKeyUrl, numberToWords, SIGN_WORDS, taskAudioItems } from "@/topics/renderers/addition_subtraction/audioNumbers.js";
import { useAudioSequence } from "@/topics/renderers/addition_subtraction/useAudioSequence.js";
import CellDigitPicker, { CellLegend, SIGN_OPTIONS, SignGlyph, useCellText, useSignText } from "./CellDigitPicker.jsx";
import "./columnOperandsParam.css";
import "./dictationNumbersParam.css";

const ROWS = ["top", "bottom"];
const PLACES = ["tens", "units"];

function seededRandom(seed) {
  let a = (seed * 2654435761 + 1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function optionDisabled(place, value) {
  return (place === "tens" && value === 0) || (place === "units" && value === "none");
}

// The sign is a cell too (2026-11-26): «+», «−» or «любой» — `onOperationChange`.
export default function DictationNumbersParam({ label, labelNode, value, operation = "add", crossTen = "none", onChange, onOperationChange }) {
  const { t } = useUiTranslation();
  const limitOp = operation === "subtract" ? "subtract" : "add";
  const numbers = normalizeDictationNumbers(value, limitOp);
  const key = JSON.stringify(numbers);
  // switching to «−» drops the tens of a second number longer than the first — save it as shown
  useEffect(() => {
    if (JSON.stringify(value ?? null) !== key) onChange(numbers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const [editing, setEditing] = useState(null);
  const [seed, setSeed] = useState(1);
  const rootRef = useRef(null);
  useEffect(() => {
    if (!editing) return undefined;
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setEditing(null); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [editing]);

  const plan = useMemo(() => dictationPlan({ numbers, operation, crossTen }), [key, operation, crossTen]); // eslint-disable-line react-hooks/exhaustive-deps
  const example = useMemo(() => drawDictationExample(plan, seededRandom(seed)), [plan, seed]);
  const { isPlaying, play } = useAudioSequence();

  const signText = useSignText();
  const exampleSign = example?.operation === "subtract" ? "−" : "+";
  const lockedBottomTens = limitOp === "subtract" && numbers.top.tens === "none";
  const cellText = useCellText();
  const pick = (v) => {
    const next = { ...numbers, [editing.row]: { ...numbers[editing.row], [editing.place]: v } };
    setEditing(null);
    onChange(normalizeDictationNumbers(next, limitOp));
  };

  const note = plan.empty ? t("dictation.empty")
    : plan.single ? t("cells.single")
    : Object.keys(plan.relaxed).length ? Object.entries(plan.relaxed).map(([op, cross]) => t(`dictation.relaxed.${op}.${cross}`)).join(" ")
    : null;

  return (
    <div className="param-row param-row--block cop dnp" aria-label={label} ref={rootRef}>
      {labelNode}
      <div className="cop-body">
        <div className="cop-column dnp-column">
          {ROWS.map((row, r) => [
            row === "bottom" && (
              <button
                key="sign"
                type="button"
                className={["cop-sign", "cop-sign-cell", operation === "subtract" ? "cop-sign-cell--minus" : "", editing?.row === "sign" ? "cop-cell--editing" : ""].filter(Boolean).join(" ")}
                style={{ gridRow: 2, gridColumn: 1 }}
                aria-label={t("dictation.cellState", { cell: t("cells.sign"), value: signText(operation) })}
                aria-expanded={editing?.row === "sign"}
                onClick={() => setEditing(editing?.row === "sign" ? null : { row: "sign" })}
              >
                <SignGlyph op={operation} />
              </button>
            ),
            ...PLACES.map((place, p) => {
              const v = numbers[row][place];
              const off = row === "bottom" && place === "tens" && lockedBottomTens;
              const isEditing = editing?.row === row && editing?.place === place;
              return (
                <button
                  key={`${row}-${place}`}
                  type="button"
                  disabled={off}
                  className={[
                    "cop-cell",
                    v === "any" ? "cop-cell--on" : "",
                    typeof v === "number" ? "cop-cell--fixed" : "",
                    off ? "cop-cell--off" : "",
                    isEditing ? "cop-cell--editing" : "",
                  ].filter(Boolean).join(" ")}
                  style={{ gridRow: r + 1, gridColumn: p + 2 }}
                  aria-label={t("dictation.cellState", { cell: t(`dictation.cell.${row}.${place}`), value: cellText(v) })}
                  aria-expanded={isEditing}
                  onClick={() => setEditing(isEditing ? null : { row, place })}
                >
                  {typeof v === "number" ? v : ""}
                </button>
              );
            }),
          ])}
          <span className="cop-line" style={{ gridRow: 3, gridColumn: "1 / 4" }} />
        </div>
        <CellLegend />
      </div>

      {editing?.row === "sign" && (
        <CellDigitPicker
          title={t("cells.sign")}
          options={SIGN_OPTIONS}
          text={signText}
          current={operation}
          onPick={(v) => { setEditing(null); onOperationChange?.(v); }}
          onClose={() => setEditing(null)}
        />
      )}
      {editing && editing.row !== "sign" && (
        <CellDigitPicker
          title={t(`dictation.cell.${editing.row}.${editing.place}`)}
          current={numbers[editing.row][editing.place]}
          isDisabled={(v) => optionDisabled(editing.place, v)}
          onPick={pick}
          onClose={() => setEditing(null)}
        />
      )}

      <div className="dnp-example">
        <div className="dnp-example__label">{t("dictation.willHear")}</div>
        <div className="dnp-example__said">
          {example ? (
            <>
              «{numberToWords(example.start)} {SIGN_WORDS[example.operation]} {numberToWords(example.delta)}»
              <small>{example.start} {exampleSign} {example.delta} = {example.result}</small>
            </>
          ) : "—"}
        </div>
        <button
          type="button"
          className={`dnp-play${isPlaying ? " dnp-play--playing" : ""}`}
          aria-label={t("dictation.listen")}
          disabled={!example}
          onClick={() => play(taskAudioItems(example).map(({ key: k, tight }) => ({ url: audioKeyUrl(k), tight })))}
        >▶</button>
        <button type="button" className="cop-again" aria-label={t("dictation.another")} onClick={() => setSeed((s) => s + 1)}>↻</button>
      </div>
      {note && <div className="cop-note">{note}</div>}
    </div>
  );
}
