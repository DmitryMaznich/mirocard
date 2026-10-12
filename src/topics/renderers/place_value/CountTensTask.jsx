import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { numberWords, pluralHundreds, pluralTens } from "./placeValueLabels.js";
import { playNumber, playPhrase } from "./numberAudio.js";
import "./place_value.css";
import "./group_ten.css";
import "./count_tens.css";

// «Считаем десятками»: the hundred as the count of tens going on — 80, 90,
// 100, 110 — not as «the first digit». Two columns, «Сотни» and «Десятки»;
// «+1 десяток» adds a stick and the number grows by ten, spoken in the owner's
// voice. The tenth stick doesn't let the count go on: the button becomes
// «Сложи сотню», and the folding into a green square is the child's own
// move (never 11 tens in the column — that is the «1010» mistake).
// «Смотри и считай» (task "count") counts a short stretch across a hundred;
// «Какое число дальше?» (task "next") asks for the next number with the two
// mistakes that matter among the choices (91 / 900 after 90, 1010 after 100).
// See docs/place-value-methodology.md, «Считаем десятками».

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

// Plays clips one after another (numbers and phrases), stoppable as a whole.
function usePlayer() {
  const current = useRef(null);
  useEffect(() => () => current.current?.stop(), []);
  return {
    async run(steps) {
      current.current?.stop();
      let cancelled = false;
      let clip = null;
      const run = { stop: () => { cancelled = true; clip?.stop(); } };
      current.current = run;
      for (const step of steps) {
        if (cancelled) return false;
        if (typeof step === "number") await new Promise((r) => setTimeout(r, step));
        else { clip = step(); await clip.done; }
      }
      return !cancelled;
    },
    stop() { current.current?.stop(); },
  };
}

const cap = (s) => `${s[0].toUpperCase()}${s.slice(1)}`;
// «сто тридцать · 1 сотня и 3 десятка»
function caption(n) {
  const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10;
  const parts = [...(h ? [`${h} ${pluralHundreds(h)}`] : []), ...(t || !h ? [`${t} ${pluralTens(t)}`] : [])];
  return `${numberWords(n)} · ${parts.join(" и ")}`;
}

function Digits({ n }) {
  const s = String(n);
  const kinds = ["hundreds", "tens", "ones"].slice(3 - s.length);
  return [...s].map((d, i) => <span key={i} className={`ct-d--${kinds[i]}`}>{d}</span>);
}

// A hundred: ten tens side by side in a green square. `lit` < 10 is the square
// being built while the sticks fold into it.
function Square({ lit = 10 }) {
  return <div className={`ct-square${lit < 10 ? " ct-square--building" : ""}`}>
    {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < lit ? "ct-stripe" : "ct-stripe ct-stripe--off"} />)}
  </div>;
}

function Board({ hundreds, sticks, building = null, gone = 0, fresh = false, ghost = false }) {
  return <div className={`ct-board${hundreds > 4 ? " ct-board--many" : ""}`}>
    <section className="ct-card ct-card--hundreds">
      <h3 className="sg-head sg-head--hundreds">Сотни</h3>
      <div className="ct-squares">
        {Array.from({ length: hundreds }, (_, i) => <Square key={i} />)}
        {building !== null && <Square lit={building} />}
      </div>
    </section>
    <section className="ct-card ct-card--tens">
      <h3 className="sg-head sg-head--tens">Десятки</h3>
      <div className="ct-sticks">
        {Array.from({ length: sticks }, (_, i) => <span key={i}
          className={`ct-stick${i < gone ? " ct-stick--gone" : ""}${fresh && i === sticks - 1 ? " ct-stick--new" : ""}`} />)}
        {ghost && <span className="ct-stick ct-stick--ghost" />}
      </div>
    </section>
  </div>;
}

export default function CountTensTask(props) {
  return props.task.task === "next" ? <NextNumber {...props} /> : <CountAlong {...props} />;
}

const ASK_PAUSE_MS = 1500;
const FOLD_STEP_MS = 110;

function CountAlong({ task, onCorrect }) {
  const teaching = task.supportMode !== "independent";
  const [ref, mode] = useScreenMode();
  const player = usePlayer();
  const [value, setValue] = useState(task.start);
  // idle — the number is shown; ask — a stick was added, the number waits so
  // the child can say it first («Обучение»); full — ten sticks, waiting for
  // «Сложи сотню»; folding — the sticks go into the square one by one.
  const [phase, setPhase] = useState("idle");
  const [folded, setFolded] = useState(0);
  const [justFolded, setJustFolded] = useState(false);
  const [taps, setTaps] = useState(0);
  const [visited, setVisited] = useState([task.start]);
  const done = value >= task.end && phase === "idle";

  // Ten sticks are shown as the old hundreds + 10 tens until they're folded.
  const pending = phase === "full" || phase === "folding";
  const hundreds = Math.floor(value / 100) - (pending ? 1 : 0);
  const sticks = pending ? 10 : Math.floor(value / 10) % 10;

  function reveal(n) {
    setPhase("idle");
    setVisited((v) => [...v, n]);
    player.run([() => playNumber(n)]);
  }

  async function add() {
    if (phase !== "idle" || done) return;
    const n = value + 10;
    setValue(n);
    setJustFolded(false);
    setTaps((t) => t + 1);
    if (n % 100 === 0) {
      setPhase("full");
      player.run([() => playPhrase("full")]);
      return;
    }
    if (!teaching) { reveal(n); return; }
    setPhase("ask");
    // «Сколько стало?» on the first two taps; after that just the pause.
    const finished = await player.run([...(taps < 2 ? [() => playPhrase("ask")] : []), ASK_PAUSE_MS]);
    if (finished) reveal(n);
  }

  async function fold() {
    if (phase !== "full") return;
    player.stop();
    setPhase("folding");
    for (let i = 1; i <= 10; i++) {
      await new Promise((r) => setTimeout(r, FOLD_STEP_MS));
      setFolded(i);
    }
    await new Promise((r) => setTimeout(r, FOLD_STEP_MS * 2));
    setFolded(0);
    setPhase("idle");
    setJustFolded(true);
    setVisited((v) => [...v, value]);
    // «Десять десятков — это сотня», then the number on its own: «сто» is
    // never heard in the same breath as «десять» (сто десять / сто десятков).
    player.run([() => playPhrase("fold"), 400, () => playNumber(value)]);
  }

  const hidden = phase !== "idle";
  const status = done && !justFolded
    ? <span className="sg-status-say ct-chain-say">{visited.map((n, i) => <span key={i} className={n % 100 === 0 && n ? "ct-chain-hundred" : ""}>{i ? " · " : ""}{n}</span>)}</span>
    : justFolded ? <span className="ct-fold-say">10 десятков = 1 сотня</span>
      : phase === "full" || phase === "folding" ? <span className="sg-status-note">10 десятков! Сложи сотню.</span>
        : value === task.start && taps === 0 ? <span className="sg-status-hint">Нажимай «+1 десяток» и считай.</span> : null;

  return <div ref={ref} className={`pv-screen ct-screen ct-screen--${mode}`}>
    <div className="ct-inner">
      <h2 className="sg-title">Считаем десятками</h2>
      <Board hundreds={hundreds} sticks={sticks} building={phase === "folding" ? folded : null} gone={phase === "folding" ? folded : 0}
        fresh={phase === "ask" || (phase === "idle" && taps > 0 && !justFolded)} />
      <div className={`ct-number${hidden ? " ct-number--hidden" : ""}`} aria-live="polite">{hidden ? "?" : <Digits n={value} />}</div>
      <div className="ct-caption">{hidden ? " " : value === 0 ? "ноль" : caption(value)}</div>
      <div className="sg-status ct-status" role="status">{status}</div>
      <div className="ct-slot">
        {done ? <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>
          : pending ? <button type="button" className="ct-btn ct-btn--fold" disabled={phase === "folding"} onClick={fold}>Сложи сотню</button>
            : <button type="button" className="ct-btn" disabled={phase !== "idle"} onClick={add}><span className="ct-btn-stick" />+1 десяток</button>}
      </div>
    </div>
  </div>;
}

function NextNumber({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const teaching = task.supportMode !== "independent";
  const n = task.number;
  const right = n + 10;
  const [ref, mode] = useScreenMode();
  const player = usePlayer();
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState([]);
  const [note, setNote] = useState("");
  const [support, setSupport] = useState(false);
  const chain = [n - 20, n - 10, n].filter((x) => x >= 0);

  // The count is heard before the question: «семьдесят, восемьдесят, девяносто…»
  useEffect(() => {
    player.run(chain.flatMap((x, i) => (i ? [350, () => playNumber(x)] : [() => playNumber(x)])));
  }, [n]); // eslint-disable-line react-hooks/exhaustive-deps

  function hint(v) {
    if (!teaching) return "Посчитай ещё раз.";
    if (v === n + 1) return `${v} — это ${n} и 1 единица. А мы прибавляем десяток.`;
    if (v === 900 && n === 90) return "900 — это девятьсот, 9 сотен. А у нас 9 десятков и ещё один десяток.";
    if (n % 100 === 0) {
      const h = n / 100;
      return `В числе ${v} четыре цифры. ${cap(numberWords(right))} — это ${h} ${pluralHundreds(h)} и 1 десяток: три цифры.`;
    }
    return `${v} — это ${n} и ещё 1 сотня. А мы прибавляем 1 десяток.`;
  }
  function choose(v) {
    if (solved || wrong.includes(v)) return;
    if (v === right) {
      setSolved(true); setNote("");
      player.run([() => playNumber(right)]);
      return;
    }
    setWrong((w) => [...w, v]);
    setNote(hint(v));
    if (teaching) setSupport(true);
    onMistake?.(task.conceptId, task.cardId); onFlashIncorrect?.();
  }

  // After the answer the board shows the next number; across a hundred the
  // ten sticks are already folded into the square.
  const shown = solved ? right : n;
  const crossing = right % 100 === 0;
  return <div ref={ref} className={`pv-screen ct-screen ct-screen--${mode}`}>
    <div className="ct-inner">
      <h2 className="sg-title">Какое число дальше?</h2>
      <div className="ct-chain">{chain.map((x, i) => <span key={x}>{i ? " · " : ""}{x === n ? <b>{x}</b> : x}</span>)}<span> · {solved ? <b className="ct-chain-right">{right}</b> : "?"}</span></div>
      <Board hundreds={Math.floor(shown / 100)} sticks={Math.floor(shown / 10) % 10} ghost={support && !solved && !crossing} fresh={solved && !crossing} />
      <div className="ct-ask">{n} и ещё 1 десяток — это…</div>
      <div className="ct-options">
        {task.options.map((v) => <button type="button" key={v} disabled={solved || wrong.includes(v)}
          className={`ct-option${solved && v === right ? " ct-option--right" : ""}${wrong.includes(v) ? " ct-option--wrong" : ""}`}
          onClick={() => choose(v)}>{v}</button>)}
      </div>
      <div className="sg-status ct-status" role="status">
        {solved ? <span className="sg-status-say">{crossing ? `10 десятков = 1 сотня. ${n} и ещё десяток — ${right}, ${numberWords(right)}.` : `${n} и ещё десяток — ${right}, ${numberWords(right)}.`}</span>
          : note ? <span className="sg-status-note">{note}{support && crossing ? " Десять десятков — это сотня." : ""}</span> : null}
      </div>
      <div className="ct-slot">{solved && <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>}</div>
    </div>
  </div>;
}
