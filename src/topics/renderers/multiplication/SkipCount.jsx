// Ступень 2 «Считаем группами» — docs/multiplication-methodology.md, «Ступень 2».
import { useMemo, useState } from "react";
import { layout, seededRng, skipChoices, skipCountExercise } from "./mechanics.js";
import { lessonLevel, recordResult } from "./levelStore.js";
import { Group, Top } from "./shared.jsx";
import { BANANA_POS, msg, useTimers } from "./lesson.js";

export default function SkipCount({ task, sessionId, student, soundEnabled, interactionDisabled, onCorrect, onStreakReset }) {
  const lesson = useMemo(() => lessonLevel({ sessionId, modeId: task.type, studentId: student?.id, param: task.level }), [sessionId, task, student?.id]);
  const level = lesson.level;
  const rng = useMemo(() => seededRng(task.seed), [task]);
  const ex = useMemo(() => skipCountExercise(level, rng), [level, rng]);
  const [idx, setIdx] = useState(0);
  const [totals, setTotals] = useState([]);
  const [choices, setChoices] = useState(null);   // [{ value, off, wrong }]
  const [counting, setCounting] = useState(null); // index of the group being counted on, and how far
  const [errors, setErrors] = useState(0);
  const [done, setDone] = useState(false);
  const [say, setSay] = useState(msg(task, "skip.prompt", { size: ex.size }));
  const later = useTimers();
  const fading = level === "C" || level === "D";

  function tap(i) {
    if (done || interactionDisabled || i !== idx || choices) return;
    if (level === "R") return place(i);
    setChoices(skipChoices(level, ex.size, i, rng).map((value) => ({ value })));
  }
  function choose(c) {
    if (interactionDisabled || c.off) return;
    const total = ex.size * (idx + 1);
    if (c.value === total) { setChoices(null); setCounting(null); return place(idx); }
    setErrors((e) => e + 1);
    onStreakReset?.(task.conceptId, task.cardId);
    // no red: the chosen number just goes quiet, the items are counted on from the last total
    setChoices((list) => list.map((x) => (x === c ? { ...x, off: true } : x)));
    // досчёт: предметы этой группы помечаются числами от прошлого итога
    const prev = ex.size * idx;
    setSay(idx === 0 ? msg(task, "skip.countFirst") : msg(task, "skip.countOn", { prev, size: ex.size }));
    for (let k = 1; k <= ex.size; k++) later(() => setCounting({ group: idx, upTo: k, from: prev }), 450 * (k - 1));
  }
  function place(i) {
    const total = ex.size * (i + 1);
    const nextTotals = [...totals, total];
    setTotals(nextTotals);
    setIdx(i + 1);
    if (i + 1 < ex.groups) { setSay(String(total)); return; }
    setDone(true);
    setSay(msg(task, "skip.done", { total, size: ex.size, times: msg(task, `times.${ex.groups}`) }));
    recordResult({ sessionId, modeId: task.type, studentId: student?.id }, { clean: errors === 0, down: errors >= 2 });
    onCorrect(task.conceptId, task.cardId);
  }

  const points = ex.kind === "banana" ? BANANA_POS[ex.size] : layout(ex.size);
  return (
    <>
      <Top task={task} text={say} soundEnabled={soundEnabled} finished={done} />
      <div className={`mul-table${done ? " mul-table--good" : ""}`} style={{ "--hf": ".56" }}>
        <div className="mul-row" style={{ "--n": ex.groups }}>
          {Array.from({ length: ex.groups }, (_, i) => {
            const placed = i < totals.length;
            const latest = i === totals.length - 1;
            // the group to tap next rises above the table; placed ones stay as they are, with their total above
            const next = !done && i === idx;
            const totalCls = placed ? (latest || done ? "mul-total" : fading ? "mul-total mul-total--old mul-total--hidden" : "mul-total mul-total--old") : "mul-total";
            return (
              <div className="mul-col" key={i}>
                <span className={totalCls}>{placed ? totals[i] : ""}</span>
                <Group button kind={ex.kind} count={ex.size} size={260} className={next ? "mul-group--lift" : ""} onClick={() => tap(i)}
                  aria-label={msg(task, "aria.group", { n: i + 1 })}>
                  {counting?.group === i && points && points.slice(0, counting.upTo).map(([x, y], k) => (
                    <span key={k} className="mul-count" style={{ left: `${x}%`, top: `${y}%` }}>{counting.from + k + 1}</span>
                  ))}
                </Group>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mul-shelf">
        {choices?.map((c) => (
          <button key={c.value} type="button" className={`mul-btn${c.off ? " mul-btn--quiet" : ""}`} disabled={c.off} onClick={() => choose(c)}>{c.value}</button>
        ))}
      </div>
    </>
  );
}
