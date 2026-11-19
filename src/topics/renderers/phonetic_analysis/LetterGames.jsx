import { useEffect, useRef, useState } from "react";
import { wait } from "./voice";

// The shown letter or syllable is voiced when the task appears and on a tap
// (task.sound — the deck's recording; a letter or syllable without one is silent).
function useUnitVoice(task, topicId, playTopicFile) {
  const say = () => { if (task.sound && playTopicFile) playTopicFile(topicId, task.sound); };
  useEffect(() => { const t = window.setTimeout(say, 350); return () => window.clearTimeout(t); }, [task.taskId]); // eslint-disable-line react-hooks/exhaustive-deps
  return say;
}
const wide = (text) => (text?.length > 1 ? " pa-syl" : "");

// «Найди букву»: the letter is shown, find it among 3 or 6. A wrong tap shakes
// and fades; the right one turns green.
export function FindLetterTask({ task, topicId, playTopicFile, onCorrect, onStreakReset }) {
  const say = useUnitVoice(task, topicId, playTopicFile);
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
      <div className="pa-prompt">{task.letter.length > 1 ? "Найди слог" : "Найди букву"}</div>
      <button type="button" className={`pa-plate pa-plate--big${wide(task.letter)}`} onClick={(e) => { e.stopPropagation(); say(); }}>{task.letter}</button>
      <div className={`pa-options pa-options--${task.options.length > 4 ? 3 : task.options.length}`}>
        {task.options.map((l, i) => (
          <button
            key={i}
            type="button"
            className={`pa-tile pa-tile--option${wide(l)}${done === i ? " pa-tile--ok" : ""}${faded.has(i) ? " pa-tile--faded" : ""}${shake === i ? " pa-tile--shake pa-tile--bad" : ""}`}
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
export function FindAllTask({ task, topicId, playTopicFile, onCorrect, onStreakReset }) {
  const say = useUnitVoice(task, topicId, playTopicFile);
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
      <button type="button" className={`pa-plate${wide(task.letter)}`} onClick={(e) => { e.stopPropagation(); say(); }}>{task.letter}</button>
      <div className="pa-counter">
        {Array.from({ length: task.total }, (_, i) => <i key={i} className={i < found.size ? "on" : ""} />)}
      </div>
      <div className={`pa-field${wide(task.letter)}`} style={{ gridTemplateColumns: `repeat(${task.cols ?? 5}, 1fr)` }}>
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
