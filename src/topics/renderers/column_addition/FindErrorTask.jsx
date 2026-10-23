import { useLayoutEffect, useRef, useState } from "react";
import DigitKeypad from "./DigitKeypad.jsx";
import { useTapButtonSize } from "./useTapButtonSize.js";
import "./tapKeyboard.css";
import "./column_addition.css";

// «Найди ошибку»: a column already solved, with one wrong digit in the answer
// (engine.js, generateFindErrorTask). The child taps the wrong digit — a tap
// on a right one says so and asks to check another place — then types the
// right digit; a wrong digit gets a question about that place, not the
// answer. At the end one line names the mistake. The keypad's place is kept
// from the start, so nothing moves when it shows.

const PLACE = ["единицы", "десятки", "сотни"];

function digitAt(n, i) {
  return Math.floor(n / 10 ** i) % 10;
}

// A formula never breaks across lines.
const nb = (text) => text.replace(/ /g, "\u00a0");

// The question for the right digit, by the kind of mistake.
function digitHint(task) {
  const i = task.wrongPlace;
  const t = digitAt(task.top, i), b = digitAt(task.bottom, i);
  if (task.errorType === "carry") return `В разряде «${PLACE[i - 1]}» получилось больше 9 — 1 переходит сюда. ${nb(`${t} + ${b} + 1 = ?`)}`;
  if (task.errorType === "reduce") {
    // 535 − 178: the tens lent to the ones (3 → 2) and then borrow themselves.
    const left = t - 1;
    return left < b
      ? `Отсюда заняли для разряда «${PLACE[i - 1]}»: было ${t}, стало ${left}. ${left} меньше ${b} — занимаем и тут: ${nb(`${left + 10} − ${b} = ?`)}`
      : `Отсюда заняли для разряда «${PLACE[i - 1]}»: было ${t}, стало ${left}. ${nb(`${left} − ${b} = ?`)}`;
  }
  if (task.errorType === "zero") return "В десятках был 0: заняли у сотен, 0 стал 10, один отдали единицам — осталось 9. Сколько будет?";
  return `Посчитай ${PLACE[i]} ещё раз.`;
}

const ERROR_NAME = {
  carry: "Ошибка была такая: забыли перенос.",
  reduce: "Ошибка была такая: забыли, что из этого разряда заняли.",
  zero: "Ошибка была такая: ноль, через который заняли, не стал девяткой.",
  calc: "Ошибка была такая: ошиблись в счёте.",
};

export default function FindErrorTask({ task, onCorrect, onMistake }) {
  const rootRef = useRef(null);
  const columnRef = useRef(null);
  const [cell, setCell] = useState(56);
  const [found, setFound] = useState(false);
  const [fixed, setFixed] = useState(false);
  const [note, setNote] = useState("");
  const [shake, setShake] = useState(null);
  const bs = useTapButtonSize(44);

  const width = String(task.result).length;
  const cols = Math.max(width, String(task.top).length) + 1;

  useLayoutEffect(() => {
    function compute() {
      const el = rootRef.current;
      if (!el) return;
      setCell(Math.max(36, Math.min(76, Math.floor((el.clientWidth - 48) / (cols + 2)), Math.floor(el.clientHeight / 11))));
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [cols]);

  // A notebook: the background cells are the column's cells — every digit
  // sits in one (same as the trainer).
  useLayoutEffect(() => {
    const screen = rootRef.current, column = columnRef.current;
    if (!screen || !column) return;
    const lr = column.getBoundingClientRect();
    for (const el of [screen, screen.parentElement]) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      el.style.backgroundSize = `${cell}px ${cell}px`;
      el.style.backgroundPosition = `${((lr.left - r.left) % cell + cell) % cell}px ${((lr.top - r.top) % cell + cell) % cell}px`;
    }
  }, [cell, found, fixed, note]);

  function mistake(key, text) {
    setShake(key);
    setTimeout(() => setShake(null), 450);
    setNote(text);
    onMistake?.();
  }

  function tapDigit(i) {
    if (found) return;
    if (i === task.wrongPlace) { setFound(true); setNote(""); return; }
    mistake(`d${i}`, `Эта цифра верная: ${PLACE[i]} посчитаны правильно. Проверь другой разряд.`);
  }

  function typeDigit(d) {
    if (!found || fixed) return;
    if (d === digitAt(task.result, task.wrongPlace)) { setFixed(true); setNote(ERROR_NAME[task.errorType]); return; }
    mistake("fix", digitHint(task));
  }

  const px = (n) => `${n}px`;
  const cellStyle = { width: px(cell), height: px(cell), fontSize: px(Math.round(cell * 0.8)) };
  const row = (n, sign) => {
    const digits = String(n).padStart(cols - 1, " ").split("");
    return <div className="cfe-row">
      <span className="cfe-cell cfe-sign" style={cellStyle}>{sign ? <span className="col-slant">{sign}</span> : null}</span>
      {digits.map((ch, j) => <span key={j} className="cfe-cell" style={cellStyle}>{ch.trim() ? <span className="col-slant">{ch}</span> : null}</span>)}
    </div>;
  };
  const answer = String(task.shown).padStart(cols - 1, " ").split("");

  return (
    <div className="col-screen cfe-screen" ref={rootRef}>
      <h2 className="cfe-title">Найди ошибку</h2>
      <div className="cfe-ask">{fixed ? "Верно!" : found ? "Какая цифра должна быть?" : "Нажми на неверную цифру ответа"}</div>
      <div className="cfe-column" ref={columnRef} style={{ marginTop: px(cell) }}>
        {row(task.top, null)}
        {row(task.bottom, task.operation === "add" ? "+" : "−")}
        <div className="cfe-line" style={{ top: px(cell * 2), width: px(cell * cols) }} />
        <div className="cfe-row">
          <span className="cfe-cell" style={cellStyle} />
          {answer.map((ch, j) => {
            const i = answer.length - 1 - j;
            if (!ch.trim()) return <span key={j} className="cfe-cell" style={cellStyle} />;
            const isWrong = found && i === task.wrongPlace;
            const shown = isWrong && fixed ? digitAt(task.result, i) : ch;
            return <button key={j} type="button" disabled={found}
              className={["cfe-cell", "cfe-answer", isWrong ? (fixed ? "cfe-answer--fixed" : "cfe-answer--wrong") : "", shake === `d${i}` ? "cfe-answer--shake" : "", isWrong && shake === "fix" ? "cfe-answer--shake" : ""].filter(Boolean).join(" ")}
              style={cellStyle} aria-label={`Цифра ${ch}: ${PLACE[i]}`} onClick={() => tapDigit(i)}>
              <span className="col-slant">{shown}</span>
            </button>;
          })}
        </div>
      </div>
      <div className="cfe-note" role="status">{note}</div>
      <div className="cfe-bottom">
        {fixed
          ? <button type="button" className="cfe-next" onClick={() => onCorrect?.()}>Далее →</button>
          : <div className="col-tap-kb" style={found ? undefined : { visibility: "hidden", pointerEvents: "none" }}><DigitKeypad onDigit={typeDigit} bs={bs} /></div>}
      </div>
    </div>
  );
}
