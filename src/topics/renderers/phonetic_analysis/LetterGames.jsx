import { useRef, useState } from "react";
import { wait } from "./voice";

// «Найди букву»: the letter is shown, find it among 3 or 6. A wrong tap shakes
// and fades; the right one turns green.
export function FindLetterTask({ task, onCorrect, onStreakReset }) {
  const [faded, setFaded] = useState(() => new Set());
  const [shake, setShake] = useState(null);
  const [done, setDone] = useState(null);
  const errors = useRef(0);
  async function tap(i) {
    if (done !== null || faded.has(i)) return;
    if (task.options[i] === task.letter) {
      setDone(i);
      await wait(900);
      onCorrect?.(task.conceptId, task.conceptId, errors.current ? { assisted: true } : undefined);
      return;
    }
    errors.current += 1;
    onStreakReset?.(task.conceptId, task.conceptId);
    setShake(i);
    setFaded((prev) => new Set(prev).add(i));
    window.setTimeout(() => setShake(null), 450);
  }
  return (
    <div className="session-body pa-stage">
      <div className="pa-prompt">Найди букву</div>
      <div className="pa-plate pa-plate--big">{task.letter}</div>
      <div className={`pa-options pa-options--${task.options.length > 4 ? 3 : task.options.length}`}>
        {task.options.map((l, i) => (
          <button
            key={i}
            type="button"
            className={`pa-tile pa-tile--option${done === i ? " pa-tile--ok" : ""}${faded.has(i) ? " pa-tile--faded" : ""}${shake === i ? " pa-tile--shake pa-tile--bad" : ""}`}
            onClick={(e) => { e.stopPropagation(); tap(i); }}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

// «Найди все»: a 5×5 field; circles above count what is left to find.
export function FindAllTask({ task, onCorrect, onStreakReset }) {
  const [found, setFound] = useState(() => new Set());
  const [shake, setShake] = useState(null);
  const errors = useRef(0);
  async function tap(i) {
    if (found.has(i) || found.size === task.total) return;
    if (task.field[i] !== task.letter) {
      errors.current += 1;
      onStreakReset?.(task.conceptId, task.conceptId);
      setShake(i);
      window.setTimeout(() => setShake(null), 450);
      return;
    }
    const next = new Set(found).add(i);
    setFound(next);
    if (next.size === task.total) {
      await wait(900);
      onCorrect?.(task.conceptId, task.conceptId, errors.current ? { assisted: true } : undefined);
    }
  }
  return (
    <div className="session-body pa-stage">
      <div className="pa-plate">{task.letter}</div>
      <div className="pa-counter">
        {Array.from({ length: task.total }, (_, i) => <i key={i} className={i < found.size ? "on" : ""} />)}
      </div>
      <div className="pa-field">
        {task.field.map((l, i) => (
          <button
            key={i}
            type="button"
            className={`pa-field__cell${found.has(i) ? " pa-field__cell--found" : ""}${shake === i ? " pa-tile--shake pa-field__cell--bad" : ""}`}
            onClick={(e) => { e.stopPropagation(); tap(i); }}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NeedMoreTask({ task, onAdvance }) {
  return (
    <div className="session-body pa-stage pa-stage--center">
      <p className="pa-need-more">{task.text}</p>
      <button type="button" className="pa-btn" onClick={(e) => { e.stopPropagation(); onAdvance?.(); }}>Понятно</button>
    </div>
  );
}
