// Ступень 0 «Поровну?» — docs/multiplication-methodology.md, «Ступень 0»; look: docs/multiplication-design-brief.md.
import { useMemo, useState } from "react";
import { equalExercise, scatter, seededRng } from "./mechanics.js";
import { lessonLevel, recordResult } from "./levelStore.js";
import { Group, Rows, Top } from "./shared.jsx";
import { msg } from "./lesson.js";

export default function EqualCheck({ task, sessionId, student, soundEnabled, interactionDisabled, onCorrect, onStreakReset }) {
  const lesson = useMemo(() => lessonLevel({ sessionId, modeId: task.type, studentId: student?.id, param: task.level }), [sessionId, task, student?.id]);
  const level = lesson.level;
  const ex = useMemo(() => {
    const rng = seededRng(task.seed);
    const e = equalExercise(level, task.equal, rng);
    return { ...e, equal: e.counts[0] === e.counts[1], positions: e.counts.map((n) => (e.scatter ? scatter(n, rng) : null)) };
  }, [task, level]);
  // R: rows are there from the start (a prompt inside the task); otherwise they appear after an answer.
  const [rows, setRows] = useState(level === "R" ? "plain" : null);
  const [answered, setAnswered] = useState(null);
  const [firstTry, setFirstTry] = useState(true);
  const [say, setSay] = useState(msg(task, "equal.prompt"));

  function answer(saidEqual) {
    if (answered || interactionDisabled) return;
    if (saidEqual === ex.equal) {
      setAnswered(saidEqual ? "eq" : "ne");
      if (level === "R" || lesson.rowsAlways || !firstTry) setRows("judge");
      setSay(ex.equal ? msg(task, "equal.yes", { n: ex.counts[0] }) : msg(task, "equal.no"));
      recordResult({ sessionId, modeId: task.type, studentId: student?.id }, { clean: firstTry, down: !firstTry });
      onCorrect(task.conceptId, task.cardId);
    } else {
      // No red, no shaking: the screen shows how to find the answer, the question stays.
      setFirstTry(false);
      setRows("judge");
      setSay(msg(task, "equal.look"));
      onStreakReset?.(task.conceptId, task.cardId);
    }
  }

  const btn = (id) => `mul-btn mul-btn--word${answered === id ? " mul-btn--chosen" : answered ? " mul-btn--quiet" : ""}`;
  return (
    <>
      <Top task={task} text={say} soundEnabled={soundEnabled} finished={Boolean(answered)} />
      <div className={`mul-table${rows ? " mul-table--small" : ""}${answered ? " mul-table--good" : ""}`} style={{ "--hf": ".72" }}>
        <div className="mul-row" style={{ "--n": 2 }}>
          {ex.counts.map((n, i) => (
            <Group key={i} count={n} positions={ex.positions[i]} className={rows === "judge" ? "mul-group--quiet" : ""}
              aria-label={msg(task, "aria.group", { n: i + 1 })} />
          ))}
        </div>
        {rows && <Rows key={rows} counts={ex.counts} judge={rows === "judge"} />}
      </div>
      <div className="mul-shelf">
        <button type="button" className={btn("eq")} onClick={() => answer(true)}>{msg(task, "equal.answer.equal")}</button>
        <button type="button" className={btn("ne")} onClick={() => answer(false)}>{msg(task, "equal.answer.notEqual")}</button>
      </div>
    </>
  );
}
