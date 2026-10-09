import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { Coin, TenStack } from "./CoinBlocks.jsx";
import { useCoinExchange } from "./useCoinExchange.js";
import { AnswerField, Keypad, useTypedAnswer } from "./FieldPad.jsx";
import TenFrame from "./TenFrame.jsx";
import "./place_value.css";
import "./coins.css";
import "./exchange.css";
import "./group_ten.css";
import "./exchange_ten.css";

// «Плюс и минус через десяток»: 32 − 4 or 38 + 4 worked out on coins. The
// screen is the one of «Собери десяток»: stacks of ten on the left, the
// ten-frame on the right — and the frame holds the ones. Because the frame
// takes ten coins at most, the child works the school way, «по частям»:
//  − take coins out of the frame (they go into the «−4» tray); when the frame
//    is empty and more must go, tap a stack — it opens into the frame as ten
//    coins (32 − 2 = 30, then 30 − 2 = 28);
//  + take coins from the «+4» tray into the frame; a full frame is tapped and
//    becomes a stack, exactly as in «Собери десяток» (38 + 2 = 40, 40 + 2 = 42).
// A stack opens only into an empty frame and only while more must go, so a
// needless exchange can't happen; about half of the tasks need none at all
// (generateExchangeTask). Then the child types the result. In «Обучение» a
// hand shows the next move after a pause. See docs/place-value-methodology.md,
// режим 4.

const HAND_DELAY_MS = 5000;
const WIDE_ANSWER = 320; // px, the answer column on a landscape tablet

function initialModel(task) {
  return {
    tens: Array.from({ length: task.start.tens }, (_, i) => `t${i}`),
    frame: Array.from({ length: task.start.ones }, (_, i) => `o${i}`),
    tray: task.op === "get" ? Array.from({ length: task.k }, (_, i) => `g${i}`) : [],
    moved: 0, // − coins taken out; + coins brought in
    serial: 0,
  };
}

export default function ExchangeTenTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const give = task.op === "give";
  const teaching = task.supportMode !== "independent";
  const sign = give ? "−" : "+";
  const [model, setModel] = useState(() => initialModel(task));
  const [phase, setPhase] = useState("act");
  const [note, setNote] = useState("");
  const [hint, setHint] = useState(null);
  const [hand, setHand] = useState(null);
  const typed = useTypedAnswer();
  const [coinSize, setCoinSize] = useState(32);
  const [mode, setMode] = useState("phone");
  const appliedSize = useRef(32);
  appliedSize.current = coinSize;
  const screenRef = useRef(null);
  const innerRef = useRef(null);
  const boardRef = useRef(null);
  const exchange = useCoinExchange(boardRef);

  // Room in the stack store for every stack the task can have.
  const maxStacks = Math.max(1, task.start.tens, Math.floor(task.result / 10));
  const stackCols = Math.min(5, maxStacks), stackRows = Math.ceil(maxStacks / 5);
  const left = task.k - model.moved;
  const frameFull = model.frame.length === 10;
  const actionDone = left === 0 && !frameFull;
  const done = phase === "done";

  // One coin size per task, fitted on the real layout (see GroupTenTask).
  useLayoutEffect(() => {
    const screen = screenRef.current, inner = innerRef.current;
    if (!screen || !inner) return undefined;
    const measure = () => {
      const W = screen.clientWidth, H = screen.clientHeight;
      if (!W || !H) return;
      const next = W >= 900 && W > H * 1.15 ? "wide" : W < 600 ? "phone" : "tablet";
      if (next !== mode) { setMode(next); return; }
      const cap = mode === "phone" ? 44 : 64;
      const cs = getComputedStyle(screen);
      const bw = W - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - (mode === "wide" ? WIDE_ANSWER + 32 : 0);
      const byWidth = Math.min((bw - 52) / (stackCols * 1.3 + 6.8), (bw - 40) / (Math.max(task.k, 5) * 1.25));
      const room = H - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const fits = (c) => { screen.style.setProperty("--coin-size", `${c}px`); return inner.offsetHeight <= room; };
      let lo = 14, hi = Math.max(14, Math.min(cap, byWidth));
      if (fits(hi)) lo = hi;
      else for (let i = 0; i < 9; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
      screen.style.setProperty("--coin-size", `${appliedSize.current}px`);
      setCoinSize(Math.floor(lo * 10) / 10);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(screen);
    return () => observer.disconnect();
  }, [mode, stackCols, stackRows, task.k]);

  // «Обучение»: after a pause, a hand shows the next move.
  const idleReason = !teaching || phase !== "act" || exchange.busy ? null
    : give ? (left > 0 ? (model.frame.length ? "take" : "break") : null)
      : frameFull ? "full" : left > 0 ? "bring" : null;
  useEffect(() => {
    setHint(null);
    if (!idleReason) return undefined;
    const timer = setTimeout(() => setHint(idleReason), HAND_DELAY_MS);
    return () => clearTimeout(timer);
  }, [idleReason, model]);
  useLayoutEffect(() => {
    const screen = screenRef.current;
    if (!hint || !screen) { setHand(null); return; }
    const origin = screen.getBoundingClientRect();
    const at = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2 - origin.left + screen.scrollLeft, y: r.top + r.height / 2 - origin.top + screen.scrollTop }; };
    const q = (sel) => screen.querySelector(sel);
    const move = (fromEl, toEl) => {
      if (!fromEl || !toEl) return null;
      const a = at(fromEl), b = at(toEl);
      return { kind: "move", ...a, dx: b.x - a.x, dy: b.y - a.y };
    };
    const tap = (el) => (el ? { kind: "tap", ...at(el) } : null);
    const frameCoins = screen.querySelectorAll(".sg-frame .px-tf button.px-coin");
    setHand(hint === "take" ? move(frameCoins[frameCoins.length - 1], q(".xt-tray .px-slot"))
      : hint === "bring" ? move(q(".xt-tray button.px-coin"), q(".sg-frame .px-tf-slot"))
        : hint === "break" ? tap(q(".sg-stacks .xt-stack:last-child"))
          : hint === "full" ? tap(q(".px-tf--ready")) : null);
  }, [hint, coinSize]);

  function change(update) {
    if (phase !== "act" || exchange.busy) return;
    setModel(update);
    setNote("");
    setHint(null);
  }
  // −: a coin out of the frame, into the tray.
  function takeOut(id) {
    if (!give || left === 0) return;
    change((m) => ({ ...m, frame: m.frame.filter((x) => x !== id), moved: m.moved + 1 }));
  }
  // +: a coin from the tray into the frame (only while the frame has room).
  function bringIn() {
    if (give || left === 0 || frameFull) return;
    change((m) => ({ ...m, tray: m.tray.slice(1), frame: [...m.frame, m.tray[0]], moved: m.moved + 1 }));
  }
  // −: a stack opens into the empty frame as ten coins.
  function breakStack(stackId) {
    if (!give || phase !== "act" || exchange.busy || left === 0 || model.frame.length) return;
    const coinIds = Array.from({ length: 10 }, (_, i) => `b${model.serial}-${i}`);
    const apply = (m) => ({ ...m, tens: m.tens.filter((x) => x !== stackId), frame: coinIds, serial: m.serial + 1 });
    const started = exchange.start({ direction: "ungroup", stackId, coinIds, commit: () => { setModel(apply); setHint(null); } });
    if (!started) change(apply);
  }
  // +: the full frame becomes a stack, as in «Собери десяток».
  function closeFrame() {
    if (give || phase !== "act" || exchange.busy || !frameFull) return;
    const stackId = `n${model.serial}`;
    const coinIds = model.frame;
    const apply = (m) => ({ ...m, frame: [], tens: [...m.tens, stackId], serial: m.serial + 1 });
    const started = exchange.start({ direction: "group", stackId, coinIds, commit: () => { setModel(apply); setHint(null); } });
    if (!started) change(apply);
  }
  // Once every coin has moved (and no full frame waits), the answer.
  useEffect(() => { if (phase === "act" && actionDone && !exchange.busy) setPhase("answer"); }, [phase, actionDone, exchange.busy]);

  function enter() {
    if (!typed.digits || phase !== "answer") return;
    if (Number(typed.digits) === task.result) { typed.reset(); setPhase("done"); setNote(""); return; }
    typed.fail();
    setNote(teaching ? "Посчитай стопки и монеты в рамке ещё раз." : "Проверь число ещё раз.");
    onMistake?.(task.conceptId, task.cardId); onFlashIncorrect?.();
  }

  const answering = phase !== "act";
  const show = answering ? " sg-show" : "";
  const hintText = {
    take: "Убери монету из рамки — нажми на неё.",
    break: "В рамке пусто, а убрать нужно ещё. Нажми на стопку — она рассыпется в рамку.",
    bring: "Перенеси монету в рамку — нажми на неё.",
    full: "Рамка полная — нажми на неё, и монеты станут стопкой.",
  }[hint];
  const status = done ? null : note ? <span className="sg-status-note">{note}</span>
    : hintText ? <span className="sg-status-hint">{hintText}</span> : null;
  const canBreak = give && left > 0 && !model.frame.length && phase === "act" && !exchange.busy;

  return <div ref={screenRef} className={`pv-screen sg-screen sg-screen--${mode} xt-screen`}
    style={{ "--coin-size": `${coinSize}px`, "--sg-stack-cols": stackCols, "--sg-stack-rows": stackRows, "--sg-answer-w": `${WIDE_ANSWER}px`, "--xt-k": task.k }}>
    <div className="sg-inner" ref={innerRef}>
      <h2 className="sg-title xt-example">
        <span>{task.number}</span> <span className={`xt-sign xt-sign--${task.op}`}>{sign}</span> <span>{task.k}</span> <span>=</span> <span className="xt-q">{done ? task.result : "?"}</span>
      </h2>
      <div className="sg-board xt-board" ref={boardRef}>
        <section className="sg-card sg-bench">
          <h3 className="sg-head sg-head--tens"><span className="sg-chip" />Десятки</h3>
          <h3 className="sg-head sg-head--ones"><span className="sg-chip" />Единицы</h3>
          <div className="sg-stacks">
            {model.tens.map((id, i) => <button type="button" key={id} data-stack-id={id}
              className={`xt-stack px-stack-wrap${exchange.pendingStack === id ? " px-pending" : ""}${canBreak ? " xt-stack--open" : ""}`}
              aria-label={`Десяток ${i + 1}`} disabled={!canBreak} onClick={() => breakStack(id)}><TenStack /></button>)}
          </div>
          <div className="sg-frame">
            <TenFrame coinIds={model.frame} pendingIds={exchange.pendingCoins} onReturn={takeOut} onClose={closeFrame} tapToClose closable={!give}
              disabled={phase !== "act" || exchange.busy || (give ? left === 0 : !frameFull)} glow={hint === "full"} />
          </div>
        </section>
        {/* Once the action is done the tray fades (its place stays): the
            question is about what is left on the board, not what was moved. */}
        <section className={`sg-card xt-tray xt-tray--${task.op}${answering ? " xt-tray--gone" : ""}`} aria-hidden={answering}>
          <span className="xt-tray-label">{sign}{task.k}</span>
          <div className="xt-slots">
            {Array.from({ length: task.k }, (_, i) => {
              if (give) return i < model.moved
                ? <span key={i} className="px-coin px-coin--static xt-gone" aria-label={`Убрана монета ${i + 1}`}><Coin /></span>
                : <span key={i} className="px-slot" />;
              const id = model.tray[i - model.moved];
              return i < model.moved ? <span key={i} className="px-slot xt-slot--empty" />
                : <button type="button" key={id} className="px-coin" aria-label="Монета из лотка" disabled={phase !== "act" || exchange.busy || frameFull}
                  onClick={bringIn}><Coin /></button>;
            })}
          </div>
        </section>
      </div>
      <div className="sg-answer">
        <div className={`sg-num sg-reveal${show}`}>
          <AnswerField label={give ? "Сколько осталось?" : "Сколько стало?"} tone="total" big ok={done} active={phase === "answer"} wrong={typed.wrong}
            value={done ? task.result : phase === "answer" ? typed.digits : ""} />
        </div>
        <div className="sg-status" role="status">{status}</div>
        <div className="sg-slot">
          {done ? <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>
            : <div className={`sg-reveal${show}`}><Keypad off={phase !== "answer"} typed={typed} onEnter={enter} grid={mode !== "phone"} /></div>}
        </div>
      </div>
    </div>
    {hand && <div className={`sg-hand sg-hand--${hand.kind}`} aria-hidden="true"
      style={{ left: hand.x, top: hand.y, "--dx": `${hand.dx ?? 0}px`, "--dy": `${hand.dy ?? 0}px` }}>
      {hand.kind === "move" && <span className="sg-hand-coin"><Coin /></span>}
      {hand.kind === "tap" && <span className="sg-hand-ripple" />}
      <span className="sg-hand-finger">👆</span>
    </div>}
  </div>;
}
