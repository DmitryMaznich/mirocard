// Ступень 0 «Поровну?» — docs/multiplication-methodology.md, «Ступень 0»; look: docs/multiplication-design-brief.md.
// Owner, 2026-11-27: the question names what is compared («На тарелках поровну?»), no voice, no rows
// one-to-one after the answer — the answer itself is written large on the table instead.
import { useMemo, useState } from "react";
import { equalExercise, scatter, seededRng } from "./mechanics.js";
import { lessonLevel, recordResult } from "./levelStore.js";
import { Group, Top } from "./shared.jsx";
import { msg } from "./lesson.js";

export default function EqualCheck({ task, sessionId, student, interactionDisabled, onCorrect, onStreakReset }) {
  const lesson = useMemo(() => lessonLevel({ sessionId, modeId: task.type, studentId: student?.id, param: task.level }), [sessionId, task, student?.id]);
  const level = lesson.level;
  const ex = useMemo(() => {
    const rng = seededRng(task.seed);
    const e = equalExercise(level, task.equal, rng);
    return { ...e, equal: e.counts[0] === e.counts[1], positions: e.counts.map((n) => (e.scatter ? scatter(n, rng) : null)) };
  }, [task, level]);
  const [answered, setAnswered] = useState(null);
  const [firstTry, setFirstTry] = useState(true);
  const [say, setSay] = useState(msg(task, "equal.prompt"));

  function answer(saidEqual) {
    if (answered || interactionDisabled) return;
    if (saidEqual === ex.equal) {
      setAnswered(saidEqual ? "eq" : "ne");
      setSay(msg(task, "equal.prompt"));
      recordResult({ sessionId, modeId: task.type, studentId: student?.id }, { clean: firstTry, down: !firstTry });
      onCorrect(task.conceptId, task.cardId);
    } else {
      // No red, no shaking, nothing new on the table: «посмотри ещё раз» and the same question again.
      setFirstTry(false);
      setSay(msg(task, "equal.look"));
      onStreakReset?.(task.conceptId, task.cardId);
    }
  }

  const verdict = answered && msg(task, answered === "eq" ? "equal.answer.equal" : "equal.answer.notEqual");
  const btn = (id) => `mul-btn mul-btn--word${answered === id ? " mul-btn--chosen" : answered ? " mul-btn--quiet" : ""}`;
  return (
    <>
      <Top task={task} text={say} finished={Boolean(answered)} />
      <div className={`mul-table${answered ? " mul-table--good" : ""}`} style={{ "--hf": ".72" }}>
        <div className="mul-row" style={{ "--n": 2 }}>
          {ex.counts.map((n, i) => (
            <Group key={i} count={n} positions={ex.positions[i]} aria-label={msg(task, "aria.group", { n: i + 1 })} />
          ))}
        </div>
        {verdict && <div className="mul-verdict" data-testid="mul-verdict">{verdict}</div>}
      </div>
      <div className="mul-shelf">
        <button type="button" className={btn("eq")} onClick={() => answer(true)}>{msg(task, "equal.answer.equal")}</button>
        <button type="button" className={btn("ne")} onClick={() => answer(false)}>{msg(task, "equal.answer.notEqual")}</button>
      </div>
    </>
  );
}
