import { useLayoutEffect, useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { modelPieces } from "./CoinBlocks.jsx";
import { BuildHundreds } from "./HundredsTasks.jsx";
import { BuildTableTask, NumberLevelTask } from "./TableTasks.jsx";
import { placeValuePhrase, numberWords, pluralTens } from "./placeValueLabels.js";
import "./place_value.css";
import "./coins.css";
import "./exchange.css";
import "./group.css";
import "./build.css";

// «Собери число» — turn a number into a model. The number is given in digits
// («47») or in words («сорок семь»); the child takes ready stacks and loose
// coins (one tap = one ten / one coin, a tap on a placed item takes it back)
// and presses «Проверить». No grouping of loose coins here (that's «Сложи по
// десять») and no «here are ten» highlight: ten loose coins instead of a stack
// is the child's own mistake to notice. See docs/place-value-methodology.md,
// режим 3.

const MAX_TENS = 9;
const MAX_ONES = 19;

// «Таблица» has its own screen (TableTasks.jsx); coins and the scheme share this one.
export default function BuildNumberTask(props) {
  if (props.task.target?.hundreds !== undefined) return <BuildHundreds {...props} />;
  return props.task.view === "table" ? <BuildTableTask {...props} />
    : props.task.view === "number" ? <NumberLevelTask {...props} /> : <BuildNumberTaskModel {...props} />;
}

function BuildNumberTaskModel({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const teaching = task.supportMode !== "independent";
  const words = task.prompt === "words";
  const scheme = task.view === "scheme";
  const { One, Ten } = modelPieces(task.view);
  const [tens, setTens] = useState(0);
  const [ones, setOnes] = useState(0);
  const [solved, setSolved] = useState(false);
  const [note, setNote] = useState("");
  const [shake, setShake] = useState(false);
  const [coinSize, setCoinSize] = useState(44);
  const [narrow, setNarrow] = useState(false);
  const mainRef = useRef(null);

  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return undefined;
    const measure = () => {
      const { width, height } = main.getBoundingClientRect();
      if (!width || !height) return;
      const isNarrow = width < 640;
      const size = isNarrow
        ? Math.min((width - 50) / 6.4, (height - 200) / 9, 40)
        : Math.min((width - 170) / 17.8, (height - 60) / 5.6, 52);
      setNarrow(isNarrow);
      setCoinSize(Math.max(20, size));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    return () => observer.disconnect();
  }, []);

  const edit = (fn) => { if (solved) return; fn(); setNote(""); };
  function check() {
    if (solved) return;
    const { target } = task;
    if (tens === target.tens && ones === target.ones) { setSolved(true); setNote(""); return; }
    let message = "Проверь число ещё раз.";
    if (teaching) {
      if (tens > 0 && tens !== target.tens && tens === target.ones && ones === target.tens) {
        message = `Ты положил ${tens} ${pluralTens(tens)} — это ${numberWords(tens * 10)}. А нужно ${numberWords(task.number)}.`;
      } else if (ones > 9) {
        message = scheme ? "Отдельных точек больше девяти. Десять точек — это сколько десятков?" : "Отдельных монет больше девяти. Десять монет — это сколько десятков?";
      } else if (tens !== target.tens) {
        message = "Проверь десятки.";
      } else {
        message = "Проверь единицы.";
      }
    }
    setNote(message);
    setShake(true);
    setTimeout(() => setShake(false), 450);
    onMistake?.(task.conceptId, task.cardId); onFlashIncorrect?.();
  }

  const blocks = Math.ceil(ones / 10);
  return <div className={`pv-screen px-screen gt-screen bn-screen${narrow ? " gt-screen--narrow" : ""}`} style={{ "--coin-size": `${coinSize}px` }}>
    <header className="gt-task bn-task">
      <span className="bn-ask">Собери число</span>
      <span className={`bn-target${words ? " bn-target--words" : ""}`}>{words ? numberWords(task.number) : task.number}</span>
    </header>
    <div className="gt-main bn-main" ref={mainRef}>
      <div className={`bn-zones${shake ? " bn-zones--wrong" : ""}`}>
        <section className="px-zone px-zone--tens">
          <h3>Десятки</h3>
          <div className="px-stacks">
            {Array.from({ length: tens }, (_, i) => <button type="button" key={i} className="px-stack bn-placed" aria-label={`Убрать десяток ${i + 1}`}
              disabled={solved} onClick={() => edit(() => setTens((t) => t - 1))}><Ten /></button>)}
          </div>
        </section>
        <section className="px-zone px-zone--ones">
          <h3>Единицы</h3>
          <div className="px-coins">
            {Array.from({ length: blocks }, (_, b) => <div key={b} className="px-coin-block">
              {Array.from({ length: Math.min(10, ones - b * 10) }, (_, j) => <button type="button" key={j} className="px-coin bn-placed"
                aria-label={`Убрать ${scheme ? "точку" : "монету"} ${b * 10 + j + 1}`} disabled={solved} onClick={() => edit(() => setOnes((o) => o - 1))}><One /></button>)}
            </div>)}
          </div>
        </section>
      </div>
      {!solved && <aside className="bn-side">
        <div className="bn-source">
          <h3>Возьми</h3>
          <div className="bn-source-row">
            <button type="button" className="bn-take" aria-label="Взять десяток" disabled={tens >= MAX_TENS}
              onClick={() => edit(() => setTens((t) => Math.min(MAX_TENS, t + 1)))}><Ten />{!scheme && <span>1 десяток</span>}</button>
            <button type="button" className="bn-take" aria-label={scheme ? "Взять точку" : "Взять монету"} disabled={ones >= MAX_ONES}
              onClick={() => edit(() => setOnes((o) => Math.min(MAX_ONES, o + 1)))}><One />{!scheme && <span>1 монету</span>}</button>
          </div>
        </div>
        <p className="bn-caption">{`Нажми на десяток или ${scheme ? "точку" : "монету"} в зоне, чтобы убрать`}</p>
      </aside>}
    </div>
    <div className="px-bottom">
      {!solved ? <>
        {note && <div className="px-note" role="status">{note}</div>}
        <Button disabled={!tens && !ones} onClick={check}>Проверить</Button>
        <button type="button" className="px-undo" disabled={!tens && !ones} onClick={() => edit(() => { setTens(0); setOnes(0); })}>Сначала</button>
      </> : <div className="px-done" role="status">
        <span className="gt-number">{task.number}</span>
        <div className="px-say">{placeValuePhrase(task.number)}</div>
        <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>
      </div>}
    </div>
  </div>;
}
