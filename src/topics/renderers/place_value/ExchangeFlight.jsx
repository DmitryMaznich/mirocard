import { useEffect, useLayoutEffect, useState } from "react";

// «Плюс и минус через десяток / сотню» on the «Таблица»: the exchange shown
// with the scheme, right in the table — the link to the scheme modes. The
// top number's digits turn into their pieces (7 hundreds → 7 squares, 1 ten →
// 1 stick), then:
//  split (borrowing): one big piece moves over to the next column and falls
//    apart there into ten small ones (7 squares, 1 stick → 6 squares, 11 sticks);
//  merge (carrying): ten small pieces gather into one big piece and it moves
//    over to the next column (13 sticks → 3 sticks, and a square to the hundreds).
// Then the pieces turn back into digits — the table shows the crossed digit
// and the numbers over the columns (onDone). Placed over the two columns' top
// cells, from their cells' positions.
const PHASE_MS = [450, 850, 650, 1400]; // pieces appear · one moves · it splits / lands · look
const FLY_MS = PHASE_MS[1];

export default function ExchangeFlight({ boardRef, bigRef, smallRef, overRef, mode, bigCount, smallCount, Big, Small, onDone }) {
  const [at, setAt] = useState(null);
  const [phase, setPhase] = useState(0);
  useLayoutEffect(() => {
    const board = boardRef.current?.getBoundingClientRect();
    const big = bigRef.current?.getBoundingClientRect();
    const small = smallRef.current?.getBoundingClientRect();
    const over = overRef.current?.getBoundingClientRect();
    if (!board || !big || !small || !over) return;
    const cx = (r) => r.left - board.left + r.width / 2;
    const width = Math.max(60, Math.abs(cx(small) - cx(big)) - 8);
    const top = over.top - board.top;
    setAt({ big: cx(big), small: cx(small), width, top, height: Math.max(big.bottom, small.bottom) - over.top });
  }, [boardRef, bigRef, smallRef, overRef]);
  useEffect(() => {
    let elapsed = 0;
    const timers = PHASE_MS.map((ms, i) => { elapsed += ms; return setTimeout(() => (i < 3 ? setPhase(i + 1) : onDone()), elapsed); });
    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!at) return null;
  const split = mode === "split";
  // What each column holds in this phase, as groups: the pieces it had, and
  // the ten (or the one big piece) just made / about to leave — on its own
  // row, so it reads as «1 and 10», not as 11 loose sticks.
  const bigGroups = split ? [phase === 0 ? bigCount : bigCount - 1, 0] : [bigCount, phase >= 2 ? 1 : 0];
  const smallGroups = split ? [smallCount, phase >= 2 ? 10 : 0] : [smallCount - 10, phase === 0 ? 10 : 0];
  const flyer = phase === 1;
  const area = (x, cls, children) => <div className={`xf-area ${cls}`} style={{ left: x - at.width / 2, top: at.top, width: at.width, minHeight: at.height }}>{children}</div>;
  const group = (n, Piece, cls) => n > 0 && <span className={`xf-group ${cls}`}>{Array.from({ length: n }, (_, i) => <span key={i} className="xf-piece"><Piece /></span>)}</span>;
  const pieces = ([had, ten], Piece) => <>{group(had, Piece, "")}{group(ten, Piece, split ? "xf-group--new" : "xf-group--ten")}</>;
  const from = split ? at.big : at.small, to = split ? at.small : at.big;
  return <div className="xf-layer" aria-hidden="true">
    {area(at.big, "xf-area--big", pieces(bigGroups, Big))}
    {area(at.small, "xf-area--small", pieces(smallGroups, Small))}
    {/* The one big piece on its way: from its column to the other. */}
    <span className={`xf-flyer${flyer ? " xf-flyer--go" : ""}`}
      style={{ left: flyer ? to : from, top: at.top + at.height / 2, transitionDuration: `${FLY_MS - 100}ms`, opacity: flyer ? 1 : 0 }}><Big /></span>
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
