import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";
import { DragOverlay, useDndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import { Coin, TenStack, PILE_LAYOUT } from "./CoinBlocks.jsx";
import { fitCoinBoard, lessonUnit } from "./coinLayout.js";
import { pluralTens, pluralOnes } from "./placeValueLabels.js";
import "./place_value.css";
import "./coins.css";
const CoinSizeContext = createContext(null);

export function CoinLesson({ title, target, result, recap, children, controls, feedback, solved = false, className = "" }) {
  const screen = useRef(null);
  const [unit, setUnit] = useState(1);
  const [coinSize, setCoinSize] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const { width, height } = screen.current.getBoundingClientRect();
      if (width && height) setUnit(lessonUnit(width, height));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(screen.current);
    return () => observer.disconnect();
  }, []);
  return <CoinSizeContext.Provider value={setCoinSize}><div ref={screen} style={{ "--cm-unit": `${unit}px`, "--coin-size": `${coinSize ?? 28 * unit}px` }} className={`pv-screen cb-screen cm-screen ${className}`}>
    <header className="cm-heading"><div className={`pv-question${solved ? " pv-question--correct" : ""}`}>{title}</div>
      {target !== undefined && <div className="cm-target">{target}</div>}</header>
    <div className="cm-body"><div className="cm-model">{children}</div><div className="cm-controls">
      {recap ? <div className="cm-result" role="status" aria-live="polite">
        <span className="cm-sr-only">{feedback}</span>
        {result !== undefined && <output aria-label="Ответ" className="cm-result-number">{result}</output>}
        <div className="cm-result-parts" aria-hidden="true">
          <div><strong>{recap.tens}</strong><span>{pluralTens(recap.tens)}</span></div>
          <span className="cm-result-plus">+</span>
          <div><strong>{recap.ones}</strong><span>{pluralOnes(recap.ones)}</span></div>
        </div>
      </div> : <div className="cm-feedback" role="status" aria-live="polite">{feedback}</div>}
      {controls}</div></div>
  </div></CoinSizeContext.Provider>;
}

function DraggableObject({ id, kind, disabled, onClick, children, className = "", label, style }) {
  const [coinSize, setCoinSize] = useState(28);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled, data: { kind, coinSize } });
  return <button type="button" ref={setNodeRef} className={`cm-object ${className}`} disabled={disabled}
    style={{ ...style, opacity: isDragging ? .35 : undefined }}
    onPointerDownCapture={(event) => {
      const visual = event.currentTarget.querySelector(".cb-coin, .cb-stack-coin");
      const width = visual && (parseFloat(getComputedStyle(visual).width) || visual.getBoundingClientRect().width);
      if (width) setCoinSize(width);
    }}
    {...attributes} {...listeners} aria-label={label} onClick={() => { if (!isDragging) onClick?.(); }}>{children}</button>;
}

// Only the object follows the pointer. Its source and caption stay in place;
// rendering outside the board also avoids clipping at panel boundaries.
export function CoinDragOverlay() {
  const { active } = useDndContext();
  return <DragOverlay dropAnimation={null} adjustScale={false} zIndex={500}>
    {active && <div className="cm-drag-object" style={{ "--coin-size": `${active.data.current?.coinSize || 28}px` }}>
      {active.data.current?.kind === "ten" ? <TenStack /> : <Coin />}
    </div>}
  </DragOverlay>;
}
function DropZone({ id, children }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <section ref={setNodeRef} className={`cm-zone${isOver ? " cm-zone--over" : ""}`}>{children}</section>;
}

export function CoinBoard({ tens, ones, boardRef, selected, onSelect, dragStacks = false, onStackClick,
  disabled = false, pendingStack, pendingCoins = [], groupable = false, onGroup, focus, counted = [], onCount, dropZones = false, wideOnes = false }) {
  const localRef = useRef(null);
  const setSize = useContext(CoinSizeContext);
  useLayoutEffect(() => {
    const board = localRef.current;
    const measure = () => {
      const { width, height } = board.getBoundingClientRect();
      const unit = parseFloat(getComputedStyle(board).getPropertyValue("--cm-unit")) || 1;
      if (width && height) setSize?.(fitCoinBoard({ width, height, unit }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    return () => observer.disconnect();
  }, [setSize]);
  const zone = (kind, objects) => <>
    <h2 className="pv-zone-label">{kind === "tens" ? "Десятки" : "Единицы"}</h2>
    <div className={kind === "tens" ? "cm-stacks" : "cm-coins"} onClick={(event) => {
      if (kind === "ones" && groupable && !disabled && event.target === event.currentTarget) onGroup?.();
    }}>{objects.map((id, i) => {
      const stack = kind === "tens", key = `${kind}:${id}`;
      const pending = stack ? pendingStack === id : pendingCoins.includes(id);
      const props = { "data-stack-id": stack ? id : undefined, "data-coin-id": stack ? undefined : id };
      const cls = `${pending ? " cm-pending" : ""}${selected === key ? " cm-selected" : ""}${counted.includes(key) ? " cm-counted" : ""}`;
      const label = stack ? `Десяток ${i + 1}` : `Монета ${i + 1}`;
      const groupMember = !stack && groupable && i < 10;
      const click = () => { if (groupMember && onGroup) onGroup(); else if (onCount) onCount(key); else if (onSelect) onSelect(key); else onStackClick?.(id); };
      const content = stack ? <TenStack /> : <Coin groupable={groupMember} />;
      return <div key={id} className={`cm-object-wrap${cls}`} {...props}>
        {stack && dragStacks
          ? <DraggableObject id={`stack-${id}`} kind="ten" disabled={disabled} label={label} onClick={click}>{content}</DraggableObject>
          : onSelect || onCount
            ? <button type="button" className="cm-object" disabled={disabled} aria-label={label} aria-pressed={selected === key || counted.includes(key)} onClick={click}>{content}</button>
            : <div className="cm-object">{content}</div>}
      </div>;
    })}</div>
  </>;
  return <div ref={(node) => { localRef.current = node; if (boardRef) boardRef.current = node; }}
    className={`cm-board pv-zones${wideOnes ? " cm-board--wide-ones" : ""}${groupable ? " cm-board--groupable" : ""}${focus ? ` cm-board--focus-${focus}` : ""}`} aria-label="Модель числа">
    {dropZones ? <DropZone id="cm-tens">{zone("tens", tens)}</DropZone> : <section className="cm-zone">{zone("tens", tens)}</section>}
    {dropZones ? <DropZone id="cm-ones">{zone("ones", ones)}</DropZone> : <section className="cm-zone">{zone("ones", ones)}</section>}
  </div>;
}

export function CoinSource({ kind, disabled, onAdd }) {
  return <div className="cm-source">
    {kind === "ten" ? <DraggableObject id="source-ten" kind="ten" disabled={disabled} className="cm-source-stack" label="Взять десяток" onClick={() => onAdd(kind)}><TenStack /></DraggableObject>
      : <div className="cm-pile">{PILE_LAYOUT.map(({ x, y, r }, i) => <DraggableObject key={i} id={i === 14 ? "source-coin" : `source-coin-${i}`} kind="coin" disabled={disabled}
        className="cm-pile-coin" label="Взять монету" style={{ left: `calc(${x} * var(--cm-pile-unit))`, top: `calc(${y} * var(--cm-pile-unit))`, rotate: `${r}deg` }} onClick={() => onAdd(kind)}><Coin /></DraggableObject>)}</div>}
    <span>{kind === "ten" ? "Взять десяток" : "Взять монету"}</span>
  </div>;
}

export function CoinAnswer({ onSubmit, disabled = false, maxDigits = 2, label = "Ответ" }) {
  const [digits, setDigits] = useState("");
  const [wrong, setWrong] = useState(false);
  return <div className="cm-answer">
    <div className="pv-guess-row"><output aria-label={label} className={`pv-number-frame${wrong ? " pv-number-frame--shake" : ""}`}>{digits || "?"}</output>
      <button type="button" className="pv-backspace-btn" aria-label="Стереть цифру" disabled={disabled || !digits.length} onClick={() => { setDigits((s) => s.slice(0, -1)); setWrong(false); }}>⌫</button></div>
    <div className="pv-numpad">{[1,2,3,4,5,6,7,8,9,0].map((d) => <button type="button" key={d} className="pv-numkey" disabled={disabled} onClick={() => { if (digits.length < maxDigits) { setDigits((s) => s + d); setWrong(false); } }}>{d}</button>)}</div>
    <button type="button" className="btn btn-primary cm-primary" disabled={disabled || !digits.length} onClick={() => setWrong(!onSubmit(Number(digits)))}>Проверить</button>
  </div>;
}
