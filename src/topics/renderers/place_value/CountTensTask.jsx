import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { numberWords, pluralHundreds, pluralTens } from "./placeValueLabels.js";
import { holdSpeech, playNumber, playPhrase } from "./numberAudio.js";
import { useSpeechGuard } from "./useSpeechGuard.js";
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
// «Считаем назад» (task "back") is the mirror: the square unfolds into
// ten sticks. «Какое число перед?» (task "prev") asks the reverse question.
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
      // Taps wait for the whole run (phrase, pause, number).
      const release = holdSpeech();
      const run = { stop: () => { cancelled = true; clip?.stop(); release(); } };
      current.current = run;
      for (const step of steps) {
        if (cancelled) return false;
        if (typeof step === "number") await new Promise((r) => setTimeout(r, step));
        else { clip = step(); await clip.done; }
      }
      release();
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

function Board({ hundreds, sticks, building = null, gone = 0, fresh = false, ghost = false, ghostLast = false, empty = false }) {
  return <div className={`ct-board${hundreds > 4 ? " ct-board--many" : ""}`}>
    <section className="ct-card ct-card--hundreds">
      <h3 className="sg-head sg-head--hundreds">Сотни</h3>
      <div className="ct-squares">
        {Array.from({ length: hundreds }, (_, i) => <Square key={i} />)}
        {building !== null && <Square lit={building} />}
      </div>
    </section>
    <section className={`ct-card ct-card--tens${empty ? " ct-card--empty" : ""}`}>
      <h3 className="sg-head sg-head--tens">Десятки</h3>
      <div className="ct-sticks">
        {Array.from({ length: sticks }, (_, i) => <span key={i}
          className={`ct-stick${i < gone ? " ct-stick--gone" : ""}${fresh && i === sticks - 1 ? " ct-stick--new" : ""}${ghostLast && i === sticks - 1 ? " ct-stick--ghost" : ""}`} />)}
        {ghost && <span className="ct-stick ct-stick--ghost" />}
      </div>
    </section>
  </div>;
}

export default function CountTensTask(props) {
  if (props.task.task === "next") return <NextNumber {...props} />;
  if (props.task.task === "back") return <CountBack {...props} />;
  if (props.task.task === "prev") return <PrevNumber {...props} />;
  return <CountAlong {...props} />;
}

const ASK_PAUSE_MS = 1500;
const FOLD_STEP_MS = 110;

function CountAlong({ task, onCorrect }) {
  const teaching = task.supportMode !== "independent";
  const [ref, mode] = useScreenMode();
  const player = usePlayer();
  const { guard } = useSpeechGuard();
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

  return <div ref={ref} className={`pv-screen ct-screen ct-screen--${mode}`} {...guard}>
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

// «Считаем назад»: «−1 десяток» takes a stick away. At a round hundred there
// are no tens left: the tap finds the column empty («Десятков нет. Разложи
// сотню.»), and the child unfolds the square into ten sticks — the number
// stays the same (100 is still 100, now as 10 десятков), and only then the
// count goes on: 90. The mirror of folding, and the base of borrowing.
function CountBack({ task, onCorrect }) {
  const teaching = task.supportMode !== "independent";
  const [ref, mode] = useScreenMode();
  const player = usePlayer();
  const { guard } = useSpeechGuard();
  const [value, setValue] = useState(task.start);
  // idle / ask as in CountAlong; empty — «−1» found no tens, waiting for
  // «Разложи сотню»; unfolding — the square's stripes go out as sticks appear.
  const [phase, setPhase] = useState("idle");
  // The last hundred is shown as 10 sticks (after unfolding, until the next «−1»).
  const [split, setSplit] = useState(false);
  const [unfolded, setUnfolded] = useState(0);
  const [taps, setTaps] = useState(0);
  const [visited, setVisited] = useState([task.start]);
  const done = value <= task.end && phase === "idle";

  const opened = split || phase === "unfolding";
  const hundreds = Math.floor(value / 100) - (opened ? 1 : 0);
  const sticks = phase === "unfolding" ? unfolded : split ? 10 : Math.floor(value / 10) % 10;

  function reveal(n) {
    setPhase("idle");
    setVisited((v) => [...v, n]);
    player.run([() => playNumber(n)]);
  }

  async function take() {
    if (phase !== "idle" || done) return;
    if (!split && value % 100 === 0) {
      setPhase("empty");
      player.run([() => playPhrase("empty")]);
      return;
    }
    const n = value - 10;
    setValue(n);
    setSplit(false);
    setTaps((t) => t + 1);
    if (!teaching) { reveal(n); return; }
    setPhase("ask");
    const finished = await player.run([...(taps < 2 ? [() => playPhrase("ask")] : []), ASK_PAUSE_MS]);
    if (finished) reveal(n);
  }

  async function unfold() {
    if (phase !== "empty") return;
    player.stop();
    setUnfolded(0);
    setPhase("unfolding");
    for (let i = 1; i <= 10; i++) {
      await new Promise((r) => setTimeout(r, FOLD_STEP_MS));
      setUnfolded(i);
    }
    await new Promise((r) => setTimeout(r, FOLD_STEP_MS * 2));
    setSplit(true);
    setPhase("idle");
    // The number doesn't change — only how it is laid out.
    player.run([() => playPhrase("unfold")]);
  }

  const h = Math.floor(value / 100);
  const splitCaption = `${numberWords(value)} · ${h > 1 ? `${h - 1} ${pluralHundreds(h - 1)} и ` : ""}10 десятков`;
  const hidden = phase === "ask";
  const status = done
    ? <span className="sg-status-say ct-chain-say">{visited.map((n, i) => <span key={i} className={n % 100 === 0 && n ? "ct-chain-hundred" : ""}>{i ? " · " : ""}{n}</span>)}</span>
    : split ? <span className="ct-fold-say">1 сотня = 10 десятков</span>
      : phase === "empty" || phase === "unfolding" ? <span className="sg-status-note">Десятков нет. Разложи сотню.</span>
        : taps === 0 ? <span className="sg-status-hint">Нажимай «−1 десяток» и считай назад.</span> : null;

  return <div ref={ref} className={`pv-screen ct-screen ct-screen--${mode}`} {...guard}>
    <div className="ct-inner">
      <h2 className="sg-title">Считаем назад</h2>
      <Board hundreds={hundreds} sticks={sticks} building={phase === "unfolding" ? 10 - unfolded : null}
        ghost={phase === "ask"} empty={phase === "empty"} />
      <div className={`ct-number${hidden ? " ct-number--hidden" : ""}`} aria-live="polite">{hidden ? "?" : <Digits n={value} />}</div>
      <div className="ct-caption">{hidden ? " " : value === 0 ? "ноль" : split ? splitCaption : caption(value)}</div>
      <div className="sg-status ct-status" role="status">{status}</div>
      <div className="ct-slot">
        {done ? <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>
          : phase === "empty" || phase === "unfolding"
            ? <button type="button" className="ct-btn ct-btn--fold" disabled={phase === "unfolding"} onClick={unfold}>Разложи сотню</button>
            : <button type="button" className="ct-btn" disabled={phase !== "idle"} onClick={take}><span className="ct-btn-stick" />−1 десяток</button>}
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
  const { guard } = useSpeechGuard();
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
  return <div ref={ref} className={`pv-screen ct-screen ct-screen--${mode}`} {...guard}>
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
        {solved ? null
          : note ? <span className="sg-status-note">{note}{support && crossing ? " Десять десятков — это сотня." : ""}</span> : null}
      </div>
      <div className="ct-slot">{solved && <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>}</div>
    </div>
  </div>;
}

// «Какое число перед?» — the reverse question, after «Считаем назад»:
// «120 · 110 · 100 · ?» counted down, then «100 без одного десятка — это…».
// The choices: the right one, a unit taken instead of a ten (99 — the main
// mistake) and a hundred taken instead (0 after 100, 10 after 110). In
// «Обучение» a mistake shows the ten to take as a dashed stick; at a round
// hundred the square is shown unfolded into ten sticks first.
function PrevNumber({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const teaching = task.supportMode !== "independent";
  const n = task.number;
  const right = n - 10;
  const [ref, mode] = useScreenMode();
  const player = usePlayer();
  const { guard } = useSpeechGuard();
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState([]);
  const [note, setNote] = useState("");
  const [support, setSupport] = useState(false);
  const chain = [n + 20, n + 10, n];
  const crossing = n % 100 === 0;

  useEffect(() => {
    player.run(chain.flatMap((x, i) => (i ? [350, () => playNumber(x)] : [() => playNumber(x)])));
  }, [n]); // eslint-disable-line react-hooks/exhaustive-deps

  function hint(v) {
    if (!teaching) return "Посчитай ещё раз.";
    if (v === n - 1) return `${v} — это ${n} без 1 единицы. А убираем 1 десяток.`;
    return `${v} — это ${n} без 1 сотни. А убираем 1 десяток.`;
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

  // Support at a round hundred: the last hundred laid out as ten sticks, the
  // one to take dashed — the same move as «Разложи сотню».
  const opened = support && crossing && !solved;
  const shown = solved ? right : n;
  const board = opened ? { hundreds: n / 100 - 1, sticks: 10 } : { hundreds: Math.floor(shown / 100), sticks: Math.floor(shown / 10) % 10 };
  return <div ref={ref} className={`pv-screen ct-screen ct-screen--${mode}`} {...guard}>
    <div className="ct-inner">
      <h2 className="sg-title">Какое число перед?</h2>
      <div className="ct-chain">{chain.map((x, i) => <span key={x}>{i ? " · " : ""}{x === n ? <b>{x}</b> : x}</span>)}<span> · {solved ? <b className="ct-chain-right">{right}</b> : "?"}</span></div>
      <Board {...board} ghostLast={support && !solved} />
      <div className="ct-ask">{n} без одного десятка — это…</div>
      <div className="ct-options">
        {task.options.map((v) => <button type="button" key={v} disabled={solved || wrong.includes(v)}
          className={`ct-option${solved && v === right ? " ct-option--right" : ""}${wrong.includes(v) ? " ct-option--wrong" : ""}`}
          onClick={() => choose(v)}>{v}</button>)}
      </div>
      <div className="sg-status ct-status" role="status">
        {solved ? null
          : note ? <span className="sg-status-note">{note}{opened ? " Сотня — это 10 десятков." : ""}</span> : null}
      </div>
      <div className="ct-slot">{solved && <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>}</div>
    </div>
  </div>;
}
