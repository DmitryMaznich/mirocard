// Ступень 3 «Сложение → умножение» — docs/multiplication-methodology.md, «Ступень 3».
// Order of the numbers and the sign come from the content package (school convention
// of the lesson language): ru «3 × 4» = по 3, 4 раза; sl «4 · 3», en «4 × 3».
import { useMemo, useState } from "react";
import { recordOrder, seededRng, sumExercise } from "./mechanics.js";
import { lessonLevel, recordResult } from "./levelStore.js";
import { Group, Say } from "./shared.jsx";
import { itemImage, msg, useTimers } from "./lesson.js";

const STEP_MS = 700;

export default function SumToProduct({ task, sessionId, student, soundEnabled, interactionDisabled, onCorrect, onMistake }) {
  const lesson = useMemo(() => lessonLevel({ sessionId, modeId: task.type, studentId: student?.id, param: task.level }), [sessionId, task, student?.id]);
  const level = lesson.level;
  const ex = useMemo(() => sumExercise(level, seededRng(task.seed)), [task, level]);
  const builds = level === "R" || level === "A";
  const [idx, setIdx] = useState(0);
  const [timesShown, setTimesShown] = useState(0);
  const [record, setRecord] = useState(!builds);
  const [asks, setAsks] = useState(ex.asks ?? []);
  const [marks, setMarks] = useState({});           // role -> "good" | "bad"
  const [filled, setFilled] = useState(false);
  const [offChoices, setOffChoices] = useState([]);
  const [light, setLight] = useState(null);         // { role, step }
  const [errors, setErrors] = useState(0);
  const [done, setDone] = useState(false);
  const later = useTimers();
  const total = ex.size * ex.groups;
  const parts = recordOrder(task.notation.order, ex.size, ex.groups);
  const formula = msg(task, "sum.formula", { size: ex.size, times: msg(task, `times.${ex.groups}`), a: parts[0].value, b: parts[1].value, total });
  const askKey = (prefix, role) => `${prefix}.${role}.${ex.kind}`;
  const initialSay = builds ? msg(task, "sum.prompt") : level === "C" ? msg(task, askKey("sum.which", ex.hide)) : msg(task, askKey("sum.ask", ex.asks[0]));
  const [say, setSay] = useState(initialSay);

  function finish() {
    setDone(true);
    recordResult({ sessionId, modeId: task.type, studentId: student?.id }, { clean: errors === 0, down: errors >= 2 });
    onCorrect(task.conceptId, task.cardId);
  }
  function showRecord() {
    setRecord(true);
    if (level === "R") { setSay(formula); finish(); }
    else setSay(msg(task, askKey("sum.ask", ex.asks[0])));
  }
  function tap(i) {
    if (!builds || interactionDisabled || i !== idx || record) return;
    const next = i + 1;
    setIdx(next);
    setSay(String(ex.size * next));
    if (next < ex.groups) return;
    // под каждым слагаемым — какой это раз; последний номер становится числом групп
    for (let k = 1; k <= ex.groups; k++) later(() => { setTimesShown(k); setSay(msg(task, `times.${k}`)); }, STEP_MS * k);
    later(showRecord, STEP_MS * (ex.groups + 1) + 400);
  }
  function glow(role) {
    setLight({ role, step: 0 });
    later(() => setLight(null), role === "size" ? 1200 : 250 * ex.groups + 900);
  }
  function pointAt(role) {
    if (done || interactionDisabled || !asks.length) return;
    const want = asks[0];
    if (role === want) {
      setMarks((m) => ({ ...m, [role]: "good" }));
      glow(role);
      const rest = asks.slice(1);
      setAsks(rest);
      later(() => {
        if (rest.length) setSay(msg(task, askKey("sum.ask", rest[0])));
        else { setSay(formula); finish(); }
      }, 1300);
    } else {
      setErrors((e) => e + 1);
      onMistake?.(task.conceptId, task.cardId);
      setMarks((m) => ({ ...m, [role]: "bad" }));
      later(() => setMarks((m) => ({ ...m, [role]: m[role] === "bad" ? undefined : m[role] })), 600);
      glow(want);
    }
  }
  function choose(value) {
    if (done || interactionDisabled || offChoices.includes(value)) return;
    const right = ex.hide === "size" ? ex.size : ex.groups;
    glow(ex.hide);
    if (value === right) { setFilled(true); setSay(formula); finish(); return; }
    setErrors((e) => e + 1);
    onMistake?.(task.conceptId, task.cardId);
    setOffChoices((o) => [...o, value]);
  }

  const groupLit = (i) => {
    if (!light) return "";
    if (light.role === "size") return i === 0 ? " mul-group--glow mul-group--bump" : "";
    return " mul-group--glow";
  };
  const item = ex.kind === "egg" ? <span className="mul-mini-egg" /> : <img src={itemImage(ex.kind)} alt="" draggable={false} />;
  const container = ex.kind === "egg" ? <span className="mul-mini-box" /> : <span className="mul-mini-plate" />;
  const hintsOn = level !== "C";
  const factor = (part, key) => {
    const hidden = level === "C" && !filled && part.role === ex.hide;
    const tappable = (level === "A" || level === "B") && !done;
    const mark = marks[part.role];
    return (
      <span className="mul-factor" key={key}>
        {hidden
          ? <span className="mul-num mul-num--slot" data-role={part.role}>{part.value}</span>
          : <button type="button" data-role={part.role} className={`mul-num${tappable ? " mul-num--tap" : ""}${mark ? ` mul-num--${mark}` : ""}`} onClick={() => pointAt(part.role)}>{part.value}</button>}
        {hintsOn && (
          <span className={`mul-hint${level === "B" ? " mul-hint--faded" : ""}`}>
            {Array.from({ length: part.value }, (_, k) => <span key={k} style={{ display: "contents" }}>{part.role === "size" ? item : container}</span>)}
          </span>
        )}
      </span>
    );
  };

  return (
    <>
      <Say task={task} text={say} soundEnabled={soundEnabled} />
      <div className="mul-mat" style={{ "--hf": ".34" }}>
        <div className="mul-row" style={{ "--n": ex.groups }}>
          {Array.from({ length: ex.groups }, (_, i) => (
            <Group key={i} button kind={ex.kind} count={ex.size} size={200}
              className={`${builds && i < idx ? "mul-group--ok" : ""}${builds && !record && i === idx ? " mul-group--next" : ""}${groupLit(i)}`}
              onClick={() => tap(i)} aria-label={msg(task, "aria.group", { n: i + 1 })} />
          ))}
        </div>
        {builds && (
          <div className={`mul-sum${record ? " mul-sum--gone" : ""}`} data-testid="mul-sum">
            {Array.from({ length: idx }, (_, i) => (
              <span key={i} style={{ display: "contents" }}>
                {i > 0 && <span className="mul-term">+</span>}
                <span className="mul-term"><span>{ex.size}</span>{i < timesShown && <span className="mul-times">{i + 1}</span>}</span>
              </span>
            ))}
            {idx === ex.groups && <><span className="mul-term">=</span><span className="mul-term">{total}</span></>}
          </div>
        )}
        {record && (
          <div className="mul-record" data-testid="mul-record">
            {factor(parts[0], "a")}<span>{task.notation.sign}</span>{factor(parts[1], "b")}<span>=</span><span>{total}</span>
          </div>
        )}
      </div>
      <div className="mul-answers">
        {level === "C" && !done && ex.choices.map((v) => (
          <button key={v} type="button" className={`mul-btn${offChoices.includes(v) ? " mul-btn--wrong mul-btn--off" : ""}`} onClick={() => choose(v)}>{v}</button>
        ))}
      </div>
    </>
  );
}
