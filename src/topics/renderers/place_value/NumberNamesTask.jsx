import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { numberWords } from "./placeValueLabels.js";
import { playNumber } from "./numberAudio.js";
import "./place_value.css";
import "./group_ten.css";
import "./names.css";

// «Названия чисел» → «Услышь и выбери»: the number is spoken (the owner's
// recorded voice, numberAudio.js), the child taps it among three written
// numbers. The wrong options are the ones that sound alike — 19 / 90,
// 12 / 20, 20 / 200, 13 / 30, swapped digits, the zero in the wrong place —
// because that is what a child with weak phonemic hearing confuses. In
// «Обучение» a wrong tap plays the name of what was tapped and then the right
// one again: the two words heard back to back are the lesson.
// See docs/place-value-methodology.md, «Названия чисел».

function useScreenMode() {
  const ref = useRef(null);
  const [mode, setMode] = useState("phone");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const { clientWidth: W, clientHeight: H } = el;
      if (W && H) setMode(W >= 900 && W > H * 1.15 ? "wide" : W < 600 ? "phone" : "tablet");
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, mode];
}

export default function NumberNamesTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const teaching = task.supportMode !== "independent";
  const n = task.number;
  const [ref, mode] = useScreenMode();
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState([]);
  const [note, setNote] = useState("");
  const [playing, setPlaying] = useState(false);
  const player = useRef(null);

  const play = async (...numbers) => {
    player.current?.stop();
    setPlaying(true);
    let cancelled = false;
    const stopper = { stop: () => { cancelled = true; current?.stop(); } };
    let current = null;
    player.current = stopper;
    for (const value of numbers) {
      if (cancelled) break;
      current = playNumber(value);
      await current.done;
      if (cancelled) break;
      await new Promise((r) => setTimeout(r, 350));
    }
    if (player.current === stopper) setPlaying(false);
  };
  // Speak the number as soon as the task shows; stop when it goes away.
  useEffect(() => { play(n); return () => player.current?.stop(); }, [n]); // eslint-disable-line react-hooks/exhaustive-deps

  function choose(value) {
    if (solved || wrong.includes(value)) return;
    if (value === n) { setSolved(true); setNote(""); player.current?.stop(); setPlaying(false); return; }
    setWrong((w) => [...w, value]);
    onMistake?.(task.conceptId, task.cardId); onFlashIncorrect?.();
    if (teaching) {
      setNote(`${value} — это «${numberWords(value)}». А звучало другое число. Послушай ещё раз.`);
      play(value, n);
    } else {
      setNote("Послушай ещё раз.");
      play(n);
    }
  }

  return <div ref={ref} className={`pv-screen nn-screen nn-screen--${mode}`}>
    <div className="nn-inner">
      <h2 className="sg-title">Услышь и выбери число</h2>
      <button type="button" className={`nn-listen${playing ? " nn-listen--on" : ""}`} aria-label="Послушать" onClick={() => play(n)}>
        <span aria-hidden="true">🔊</span>
      </button>
      <div className="nn-options">
        {task.options.map((value) => {
          const state = solved && value === n ? " nn-option--right" : wrong.includes(value) ? " nn-option--wrong" : "";
          return <button type="button" key={value} className={`nn-option${state}`} disabled={solved || wrong.includes(value)} onClick={() => choose(value)}>{value}</button>;
        })}
      </div>
      <div className="sg-status nn-status" role="status">
        {solved ? <span className="sg-status-say">{`${n} — ${numberWords(n)}`}</span>
          : note ? <span className="sg-status-note">{note}</span> : null}
      </div>
      <div className="sg-slot nn-slot">
        {solved && <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>}
      </div>
    </div>
  </div>;
}
