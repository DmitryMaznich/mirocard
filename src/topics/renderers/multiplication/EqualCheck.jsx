// Ступень 0 «Поровну?» — docs/multiplication-methodology.md, «Ступень 0».
import { useMemo, useState } from "react";
import { equalExercise, scatter, seededRng } from "./mechanics.js";
import { lessonLevel, recordResult } from "./levelStore.js";
import { Group, Rows, Say } from "./shared.jsx";
import { msg, useTimers } from "./lesson.js";

export default function EqualCheck({ task, sessionId, student, soundEnabled, interactionDisabled, onCorrect, onMistake }) {
  const lesson = useMemo(() => lessonLevel({ sessionId, modeId: task.type, studentId: student?.id, param: task.level }), [sessionId, task, student?.id]);
  const level = lesson.level;
  const ex = useMemo(() => {
    const rng = seededRng(task.seed);
    const e = equalExercise(level, task.equal, rng);
    return { ...e, equal: e.counts[0] === e.counts[1], positions: e.counts.map((n) => (e.scatter ? scatter(n, rng) : null)) };
  }, [task, level]);
  const [rows, setRows] = useState(level === "R" ? "plain" : null);
  const [answered, setAnswered] = useState(null);
  const [wrong, setWrong] = useState(null);
  const [firstTry, setFirstTry] = useState(true);
  const [say, setSay] = useState(msg(task, "equal.prompt"));
  const later = useTimers();

  function answer(saidEqual) {
    if (answered || interactionDisabled) return;
    const right = saidEqual === ex.equal;
    if (right) {
      setAnswered(saidEqual ? "eq" : "ne");
      if (level === "R" || lesson.rowsAlways || !firstTry) setRows("judge");
      setSay(ex.equal ? msg(task, "equal.yes", { n: ex.counts[0] }) : msg(task, "equal.no"));
      recordResult({ sessionId, modeId: task.type, studentId: student?.id }, { clean: firstTry, down: !firstTry });
      onCorrect(task.conceptId, task.cardId);
    } else {
      setFirstTry(false);
      setRows("judge");
      setWrong(saidEqual ? "eq" : "ne");
      setSay(msg(task, "equal.look"));
      onMistake?.(task.conceptId, task.cardId);
      later(() => setWrong(null), 900);
    }
  }

  const max = Math.max(...ex.counts);
  const groupClass = (i) => rows === "judge" ? (ex.equal ? "mul-group--ok" : ex.counts[i] === max ? "mul-group--more" : "") : "";
  const btnClass = (id) => `mul-btn mul-btn--wide${answered === id ? " mul-btn--right" : answered ? " mul-btn--off" : ""}${wrong === id ? " mul-btn--wrong" : ""}`;
  return (
    <>
      <Say task={task} text={say} soundEnabled={soundEnabled} />
      <div className={`mul-mat${rows ? " mul-mat--small" : ""}`} style={{ "--hf": ".72" }}>
        <div className="mul-row" style={{ "--n": 2 }}>
          {ex.counts.map((n, i) => (
            <Group key={i} count={n} positions={ex.positions[i]} className={`${groupClass(i)}${rows === "judge" ? " mul-faded" : ""}`}
              aria-label={msg(task, "aria.group", { n: i + 1 })} />
          ))}
        </div>
        {rows && <Rows counts={ex.counts} judge={rows === "judge"} />}
      </div>
      <div className="mul-answers">
        <button type="button" className={btnClass("eq")} aria-label={msg(task, "equal.answer.equal")} onClick={() => answer(true)}>
          <span className="mul-sym">=</span><span className="mul-bars"><i style={{ height: 28 }} /><i style={{ height: 28 }} /></span>
        </button>
        <button type="button" className={btnClass("ne")} aria-label={msg(task, "equal.answer.notEqual")} onClick={() => answer(false)}>
          <span className="mul-sym">≠</span><span className="mul-bars"><i style={{ height: 32 }} /><i style={{ height: 14 }} /></span>
        </button>
      </div>
    </>
  );
}
