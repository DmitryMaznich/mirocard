import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { modelPieces, SchemeHundred, SchemeOne, SchemeTen } from "./CoinBlocks.jsx";
import { numberWords, pluralHundreds, pluralOnes, pluralTens } from "./placeValueLabels.js";
import { AnswerField, Keypad, useAutoCheck, useTypedAnswer } from "./FieldPad.jsx";
import "./place_value.css";
import "./coins.css";
import "./exchange.css";
import "./group_ten.css";
import "./table.css";
import "./build.css";
import "./hundreds.css";

// Three-digit numbers (setting «Числа: до 1000») for «Какое это число?» and
// «Собери число», on every picture: coins (a hundred is a plate of ten stacks,
// up to 599 — more plates don't fit a phone and teach nothing new), the
// scheme (square, stick, dot), the table and the bare number. Own screens so
// the tuned two-digit ones stay untouched. The hard spots this is built
// around: the placeholder zero (305, 340) and the hundreds' names (двести,
// триста, пятьсот). See docs/place-value-methodology.md, «Сотни».

export const PLACES = [
  { key: "hundreds", name: "Сотни", plural: pluralHundreds },
  { key: "tens", name: "Десятки", plural: pluralTens },
  { key: "ones", name: "Единицы", plural: pluralOnes },
];
const cap = (s) => `${s[0].toUpperCase()}${s.slice(1)}`;
const split = (n) => ({ hundreds: Math.floor(n / 100), tens: Math.floor(n / 10) % 10, ones: n % 10 });

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
const SIZES = { phone: [18, 9], tablet: [30, 14], wide: [34, 16] };
// On a phone the three columns (plates, stacks, coins) must fit the width:
// they take ≈ 11.8 coin sizes + 170px (headers, gaps, paddings), so 18px
// pieces need ~380px and shrink with a narrower phone.
const sizeVars = (mode) => (mode === "phone"
  ? { "--coin-size": "min(18px, calc((100vw - 170px) / 11.8))", "--plate-coin": "min(9px, calc((100vw - 170px) / 23.6))" }
  : { "--coin-size": `${SIZES[mode][0]}px`, "--plate-coin": `${SIZES[mode][1]}px` });

const head = (key) => <h3 className={`sg-head sg-head--${key}`}>{PLACES.find((p) => p.key === key).name}</h3>;

// The model in three zones; `render(key, i)` draws one piece.
function Zones({ counts, view, renderPiece }) {
  const { One, Ten, Hundred } = modelPieces(view);
  const piece = { hundreds: Hundred, tens: Ten, ones: One };
  return PLACES.map(({ key }) => <div key={key} className={`hd-zone hd-zone--${key}`}>
    {key === "ones"
      ? Array.from({ length: Math.ceil(counts.ones / 10) }, (_, b) => <div key={b} className="px-coin-block">
        {Array.from({ length: Math.min(10, counts.ones - b * 10) }, (_, j) => renderPiece(key, b * 10 + j, piece[key]))}
      </div>)
      : Array.from({ length: counts[key] }, (_, i) => renderPiece(key, i, piece[key]))}
  </div>);
}

// «Схема» + «Обучение»: the three digits fly from their fields into the number
// (see IdentifyNumberTask's two-digit bridge).
function useDigitFlight(screenRef, flying, onDone) {
  useEffect(() => {
    if (!flying) return undefined;
    const screen = screenRef.current;
    const from = PLACES.map(({ key }) => screen?.querySelector(`.fp-field--${key} .fp-value`));
    const to = screen?.querySelector(".fp-field--total .fp-value");
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (still || !to || from.some((el) => !el)) { onDone(); return undefined; }
    const target = to.getBoundingClientRect(), size = getComputedStyle(to).fontSize;
    const ghosts = from.map((el, i) => {
      const r = el.getBoundingClientRect();
      const ghost = document.createElement("span");
      ghost.className = `id-fly tb-digit--${PLACES[i].key}`;
      ghost.textContent = el.textContent;
      ghost.style.fontSize = size;
      document.body.append(ghost);
      const animation = ghost.animate([
        { transform: `translate(${r.left + r.width / 2}px, ${r.top + r.height / 2}px) translate(-50%, -50%) scale(.6)` },
        { transform: `translate(${target.left + target.width * (0.3 + 0.2 * i)}px, ${target.top + target.height / 2}px) translate(-50%, -50%)` },
      ], { duration: 800, delay: 300, easing: "ease-in-out", fill: "both" });
      return { ghost, animation };
    });
    ghosts[2].animation.onfinish = () => { ghosts.forEach((g) => g.ghost.remove()); onDone(); };
    return () => ghosts.forEach((g) => { g.animation.cancel(); g.ghost.remove(); });
  }, [flying]); // eslint-disable-line react-hooks/exhaustive-deps
}

function coloredNumber(n) {
  return <span className="id-dig-pair">{String(n).split("").map((d, i) => <span key={i} className={`tb-digit--${PLACES[i].key}`}>{d}</span>)}</span>;
}

function totalHint(n, guess, teaching) {
  if (!teaching) return "Проверь число ещё раз.";
  const { hundreds: h, tens: t, ones: o } = split(n);
  if (guess > 999 || (t === 0 && guess === h * 10 + o) || (o === 0 && t === 0 && guess === h)) {
    return `${cap(numberWords(n))} — это ${h} ${pluralHundreds(h)}, ${t} ${pluralTens(t)} и ${o} ${pluralOnes(o)}. Сколько цифр нужно?`;
  }
  if (t === 0) return "Десятков нет — на их месте пишем 0.";
  if (o === 0 && guess === h * 10 + t) return "Единиц нет — на их месте пишем 0.";
  return "Сотни пишут первыми, потом десятки, потом единицы. Посчитай ещё раз.";
}

export function IdentifyHundreds({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const teaching = task.supportMode !== "independent";
  const view = task.view ?? "coins";
  const table = view === "table";
  const counts = task.model;
  const n = task.number;
  const steps = teaching && !table
    ? [...PLACES.map((p) => ({ key: p.key, label: p.name, expected: counts[p.key] })), { key: "total", label: "Какое это число?", expected: n }]
    : [{ key: "total", label: "Какое это число?", expected: n }];
  const bridge = view === "scheme" && teaching;
  const [ref, mode] = useScreenMode();
  const typed = useTypedAnswer(4); // «3005» for 305 is the mistake to catch
  const [step, setStep] = useState(0);
  const [note, setNote] = useState("");
  const [support, setSupport] = useState(false);
  const [flying, setFlying] = useState(false);
  const solved = step >= steps.length;
  const current = steps[step];
  useDigitFlight(ref, flying, () => { setFlying(false); setStep(steps.length); });

  function submit(guess) {
    if (solved || flying) return false;
    if (guess === current.expected) {
      setNote("");
      if (bridge && current.key === "ones") { setStep(step + 1); setFlying(true); } else setStep(step + 1);
      return true;
    }
    setNote(current.key === "total" ? totalHint(n, guess, teaching) : `Посчитай ${current.label.toLowerCase()} ещё раз.`);
    if (teaching && table) setSupport(true);
    onMistake?.(task.conceptId, task.cardId); onFlashIncorrect?.();
    return false;
  }
  const auto = !solved && !flying && current.key !== "total";
  useAutoCheck(typed, { auto, expected: solved ? "" : current.expected, submit });
  function enter() {
    if (!typed.digits || solved || flying) return;
    if (submit(Number(typed.digits))) typed.reset(); else typed.fail();
  }
  const field = (key, big) => {
    const i = steps.findIndex((s) => s.key === key);
    if (i < 0) return null;
    const s = steps[i], ok = step > i || (key === "total" && solved), active = !solved && !flying && i === step;
    const value = ok ? (key === "total" && bridge ? coloredNumber(n) : s.expected) : active ? typed.digits : "";
    return <AnswerField key={key} label={s.label} tone={key} big={big} bare={!big} ok={ok} active={active} wrong={typed.wrong} value={value} />;
  };
  const faded = bridge && (flying || solved);
  const { One, Ten } = { One: SchemeOne, Ten: SchemeTen };
  const status = solved ? null
    : note ? <span className="sg-status-note">{note}</span> : null;

  return <div ref={ref} className={`pv-screen sg-screen sg-screen--${mode} hd-screen${view === "scheme" ? " hd-scheme" : ""}`} style={{ ...sizeVars(mode), "--sg-answer-w": "320px" }}>
    <div className="sg-inner">
      <h2 className="sg-title">{table ? "Запиши число" : view === "scheme" ? "Какое число на схеме?" : "Сколько здесь монет?"}</h2>
      <div className="sg-board hd-board">
        {table
          ? <section className="sg-card tb-table hd-table">{PLACES.map(({ key }) => <div key={key} className={`tb-col tb-col--${key}`}>
            {head(key)}
            <div className={`tb-digit tb-digit--${key}`}>{counts[key]}</div>
            {support && <div className={`tb-support hd-support--${key}`} aria-hidden="true">
              {Array.from({ length: counts[key] }, (_, i) => (key === "hundreds" ? <SchemeHundred key={i} /> : key === "tens" ? <Ten key={i} /> : <One key={i} />))}
            </div>}
          </div>)}</section>
          : <section className={`sg-card hd-bench${faded ? " id-board--faded" : ""}`}>
            {PLACES.map(({ key }) => <div key={key} className="hd-headcell">{head(key)}</div>)}
            <Zones counts={counts} view={view} renderPiece={(key, i, Piece) => <span key={i} className="hd-piece"><Piece /></span>} />
            {teaching && PLACES.map(({ key }) => <div key={key} className="hd-fieldcell">{field(key)}</div>)}
          </section>}
      </div>
      <div className="sg-answer">
        <div className="sg-num">{field("total", true)}</div>
        <div className="sg-status" role="status">{status}</div>
        <div className="sg-slot">
          {solved ? <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>
            : <Keypad off={flying} typed={typed} onEnter={enter} grid={mode !== "phone"} canEnter={!auto} />}
        </div>
      </div>
    </div>
  </div>;
}

const MAX = { hundreds: 9, tens: 19, ones: 19 };

export function BuildHundreds({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const teaching = task.supportMode !== "independent";
  const view = task.view ?? "coins";
  const words = task.prompt === "words";
  const target = task.target;
  const n = task.number;
  const [ref, mode] = useScreenMode();
  const [note, setNote] = useState("");
  const [support, setSupport] = useState(false);
  const [solved, setSolved] = useState(false);
  const fail = (message) => {
    setNote(message);
    if (teaching) setSupport(true);
    onMistake?.(task.conceptId, task.cardId); onFlashIncorrect?.();
  };
  const done = <>
    <div className="sg-status" role="status">{solved ? null : note ? <span className="sg-status-note">{note}</span> : null}</div>
    {solved && <div className="sg-slot"><Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button></div>}
  </>;
  const shownNumber = words ? <div className="tb-target tb-target--words">{numberWords(n)}</div>
    : <div className="tb-target">{support ? coloredNumber(n) : n}</div>;

  // ── «Число»: read the places straight from the written number. ──
  const [qStep, setQStep] = useState(0);
  const [wrongChoice, setWrongChoice] = useState(null);
  const [questions] = useState(() => PLACES.map(({ key, name }) => {
    const right = target[key];
    const pool = [right, ...PLACES.filter((p) => p.key !== key).map((p) => target[p.key]), n, words && key !== "ones" ? right * (key === "hundreds" ? 100 : 10) : null, right + 1];
    const options = [...new Set(pool.filter((v) => v !== null))].slice(0, 3);
    if (!options.includes(right)) options[2] = right;
    for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [options[i], options[j]] = [options[j], options[i]]; }
    return { key, ask: `Сколько ${name === "Сотни" ? "сотен" : name === "Десятки" ? "десятков" : "единиц"} в числе?`, right, options };
  }));
  // ── «Таблица»: write the digits into the columns. ──
  const typed = useTypedAnswer(2);
  const [col, setCol] = useState(0);
  const tableAuto = view === "table" && !solved;
  useAutoCheck(typed, { auto: tableAuto, expected: tableAuto ? target[PLACES[col].key] : "", submit: (guess) => {
    const key = PLACES[col].key;
    if (guess === target[key]) { setNote(""); if (col === 2) setSolved(true); else setCol(col + 1); return true; }
    fail(teaching ? `Сколько ${key === "hundreds" ? "сотен" : key === "tens" ? "десятков" : "единиц"} в числе ${words ? numberWords(n) : n}?${target[key] === 0 ? " Если их нет — пишем 0." : ""}` : "Проверь ещё раз.");
    return false;
  } });
  // ── Coins / scheme: take plates, stacks and coins. ──
  const [built, setBuilt] = useState({ hundreds: 0, tens: 0, ones: 0 });
  const edit = (key, d) => { if (solved) return; setBuilt((b) => ({ ...b, [key]: Math.min(MAX[key], Math.max(0, b[key] + d)) })); setNote(""); };
  function check() {
    if (solved) return;
    if (PLACES.every(({ key }) => built[key] === target[key])) { setSolved(true); setNote(""); return; }
    const loose = view === "scheme" ? "точек" : "монет";
    fail(!teaching ? "Проверь число ещё раз."
      : built.ones > 9 ? `Отдельных ${loose} больше девяти. Десять ${loose} — это десяток.`
        : built.tens > 9 ? "Десятков больше девяти. Десять десятков — это сотня."
          : PLACES.find(({ key }) => built[key] !== target[key]).key === "hundreds" ? "Проверь сотни."
            : built.tens !== target.tens ? `Проверь десятки.${target.tens === 0 ? " В этом числе десятков нет." : ""}` : "Проверь единицы.");
  }

  if (view === "number") {
    const q = questions[qStep];
    const choose = (v) => {
      if (solved) return;
      if (v === q.right) { setWrongChoice(null); setNote(""); if (qStep === 2) setSolved(true); else setQStep(qStep + 1); return; }
      setWrongChoice(v);
      fail(!teaching ? "Проверь ещё раз." : v === n ? `${n} — это всё число. А ${q.ask.split(" ")[1]} в нём сколько?`
        : "Сотни — первая цифра, десятки — вторая, единицы — последняя.");
    };
    return <div ref={ref} className={`pv-screen sg-screen sg-screen--${mode} tb-screen nl-screen`} style={{ "--sg-answer-w": "340px" }}>
      <div className="sg-inner">
        <h2 className="sg-title">Какие разряды в числе?</h2>
        <div className="sg-board nl-board">
          {words ? shownNumber : <div className="nl-number">{String(n).split("").map((d, i) => <span key={i} className={`nl-place${teaching ? ` tb-digit--${PLACES[i].key}` : ""}`}>{d}</span>)}</div>}
          {support && <section className="sg-card tb-table hd-table pp-support" aria-hidden="true">{PLACES.map(({ key }) => <div key={key} className={`tb-col tb-col--${key}`}>{head(key)}<div className={`tb-digit tb-digit--${key}`}>{target[key]}</div></div>)}</section>}
        </div>
        <div className="sg-answer">
          {!solved && <div className="nl-ask">{q.ask}</div>}
          {!solved && <div className="sg-slot"><div className="nl-choices" key={qStep}>
            {q.options.map((v) => <button type="button" key={v} className={`xb-choice-btn nl-choice${wrongChoice === v ? " nl-choice--wrong" : ""}`} onClick={() => choose(v)}>{v}</button>)}
          </div></div>}
          {done}
        </div>
      </div>
    </div>;
  }

  if (view === "table") {
    return <div ref={ref} className={`pv-screen sg-screen sg-screen--${mode} tb-screen tb-screen--build`} style={{ "--sg-answer-w": "320px" }}>
      <div className="sg-inner">
        <h2 className="sg-title">Разложи по разрядам</h2>
        <div className="sg-board tb-build-board">
          {shownNumber}
          <section className="sg-card tb-table hd-table">{PLACES.map(({ key, name }, i) => <div key={key} className={`tb-col tb-col--${key}`}>
            {head(key)}
            <AnswerField label={name} tone={key} bare ok={col > i || solved} active={!solved && col === i} wrong={typed.wrong}
              value={col > i || solved ? target[key] : col === i ? typed.digits : ""} />
          </div>)}</section>
        </div>
        <div className="sg-answer">
          {done}
          {!solved && <div className="sg-slot"><Keypad typed={typed} onEnter={() => {}} grid={mode !== "phone"} canEnter={false} /></div>}
        </div>
      </div>
    </div>;
  }

  const { One, Ten, Hundred } = modelPieces(view);
  const scheme = view === "scheme";
  const takeLabel = { hundreds: "1 сотню", tens: "1 десяток", ones: "1 монету" };
  const takeAria = { hundreds: "Взять сотню", tens: "Взять десяток", ones: scheme ? "Взять точку" : "Взять монету" };
  const removeAria = { hundreds: "Убрать сотню", tens: "Убрать десяток", ones: scheme ? "Убрать точку" : "Убрать монету" };
  return <div ref={ref} className={`pv-screen sg-screen sg-screen--${mode} hd-screen hd-build${scheme ? " hd-scheme" : ""}`} style={sizeVars(mode)}>
    <div className="sg-inner">
      <h2 className="sg-title hd-ask">Собери число</h2>
      <div className="sg-board hd-board">
        {shownNumber}
        <section className="sg-card hd-bench">
          {PLACES.map(({ key }) => <div key={key} className="hd-headcell">{head(key)}</div>)}
          <Zones counts={built} view={view} renderPiece={(key, i, Piece) => <button type="button" key={i} className="hd-piece bn-placed"
            aria-label={`${removeAria[key]} ${i + 1}`} disabled={solved} onClick={() => edit(key, -1)}><Piece /></button>} />
        </section>
        {!solved && <div className="hd-take">
          {PLACES.map(({ key }) => {
            const Piece = { hundreds: Hundred, tens: Ten, ones: One }[key];
            return <button type="button" key={key} className="bn-take" aria-label={takeAria[key]} disabled={built[key] >= MAX[key]} onClick={() => edit(key, 1)}>
              <Piece />{!scheme && <span>{takeLabel[key]}</span>}
            </button>;
          })}
        </div>}
      </div>
      <div className="sg-answer">
        {done}
        {!solved && <div className="sg-slot hd-actions">
          <Button disabled={!built.hundreds && !built.tens && !built.ones} onClick={check}>Проверить</Button>
          <button type="button" className="px-undo" onClick={() => { setBuilt({ hundreds: 0, tens: 0, ones: 0 }); setNote(""); }}>Сначала</button>
        </div>}
      </div>
    </div>
  </div>;
}
