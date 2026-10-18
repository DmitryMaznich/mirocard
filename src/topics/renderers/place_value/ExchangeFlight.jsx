import { useEffect, useLayoutEffect, useState } from "react";

// «Плюс и минус через десяток / сотню» on the «Таблица»: the exchange is not
// just a crossed-out digit, it is shown with the scheme's own pieces.
//  split (borrowing): the big piece (a hundred's square / a ten's stick) leaves
//    its column, flies over to the next one and falls apart into ten small
//    pieces there (ten sticks / ten dots);
//  merge (carrying): ten small pieces gather over a column into one big piece
//    and it flies over to the next column.
// Only when it is over does the table show the crossed digit and the number
// over the column (onDone). Positions come from the two table cells.
const STEP_MS = { appear: 350, fly: 750, spread: 450, hold: 700 };
const FLIGHT_MS = STEP_MS.appear + STEP_MS.fly + STEP_MS.spread + STEP_MS.hold;

export default function ExchangeFlight({ boardRef, fromRef, toRef, mode, Big, Small, onDone }) {
  const [at, setAt] = useState(null);
  const [phase, setPhase] = useState(0);
  useLayoutEffect(() => {
    const board = boardRef.current?.getBoundingClientRect();
    const from = fromRef.current?.getBoundingClientRect();
    const to = toRef.current?.getBoundingClientRect();
    if (!board || !from || !to) return;
    const center = (r) => ({ x: r.left - board.left + r.width / 2, y: r.top - board.top + r.height / 2 });
    setAt({ from: center(from), to: center(to) });
  }, [boardRef, fromRef, toRef]);
  useEffect(() => {
    const times = [STEP_MS.appear, STEP_MS.appear + STEP_MS.fly, STEP_MS.appear + STEP_MS.fly + STEP_MS.spread, FLIGHT_MS];
    const timers = times.map((ms, i) => setTimeout(() => (i < 3 ? setPhase(i + 1) : onDone()), ms));
    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!at) return null;
  const split = mode === "split";
  // split: 0 big at «from» · 1 big flying · 2 big at «to», small spread out · 3 hold
  // merge: 0 small spread at «from» · 1 small gathered → big · 2 big flying · 3 big at «to»
  const bigAt = split ? (phase === 0 ? at.from : at.to) : (phase < 2 ? at.from : at.to);
  const bigShown = split ? phase < 2 : phase >= 1;
  const smallAt = split ? at.to : at.from;
  const smallSpread = split ? phase >= 2 : phase === 0;
  return <div className="xf-layer" aria-hidden="true">
    <span className={`xf-big${bigShown ? "" : " xf-gone"}`} style={{ left: bigAt.x, top: bigAt.y }}><Big /></span>
    {Array.from({ length: 10 }, (_, i) => <span key={i} className={`xf-small${smallSpread ? "" : " xf-gone"}`}
      style={{ left: smallAt.x + (smallSpread ? (i - 4.5) * 12 : 0), top: smallAt.y - (smallSpread ? 34 : 0) }}><Small /></span>)}
  </div>;
}

// «Хватает?» answered wrong: no ready-made explanation — the child compares the
// two numbers himself (they light up in the table), then answers again.
// onCompare(right): whether he picked the bigger number («Поровну» if equal).
export function EnoughChoice({ top, bottom, compared, comparing, onChoose, onCompare }) {
  if (comparing) {
    const answer = top === bottom ? "equal" : Math.max(top, bottom);
    const options = [...new Set([top, bottom])].sort((a, b) => a - b);
    return <div className="xb-compare">
      <div className="xb-compare-ask">Что больше: {top} или {bottom}?</div>
      <div className="xb-choice">
        {options.map((v) => <button key={v} type="button" className="xb-choice-btn" onClick={() => onCompare(v === answer)}>{v}</button>)}
        <button type="button" className="xb-choice-btn" onClick={() => onCompare(answer === "equal")}>Поровну</button>
      </div>
    </div>;
  }
  return <div className="xb-choice">
    {compared && <div className="xb-compared">{top} {top > bottom ? ">" : top < bottom ? "<" : "="} {bottom}</div>}
    <button type="button" className="xb-choice-btn" onClick={() => onChoose(true)}>Хватает</button>
    <button type="button" className="xb-choice-btn" onClick={() => onChoose(false)}>Не хватает</button>
  </div>;
}
