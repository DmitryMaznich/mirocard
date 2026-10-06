import { useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Coin, TenStack } from "./CoinBlocks.jsx";
import "./place_value.css";
import "./coins.css";

export function CoinLesson({ title, target, children, controls, feedback, solved = false, className = "" }) {
  return <div className={`pv-screen cb-screen cm-screen ${className}`}>
    <header className="cm-heading"><div className={`pv-question${solved ? " pv-question--correct" : ""}`}>{title}</div>
      {target !== undefined && <div className="cm-target">{target}</div>}</header>
    <div className="cm-body"><div className="cm-model">{children}</div>{controls && <div className="cm-controls">{controls}</div>}</div>
    <div className="cm-feedback" role="status" aria-live="polite">{feedback}</div>
  </div>;
}

function DraggableObject({ id, kind, disabled, onClick, children, className = "", label }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled, data: { kind } });
  return <button type="button" ref={setNodeRef} className={`cm-object ${className}`} disabled={disabled}
    style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? .4 : undefined, zIndex: isDragging ? 10 : undefined }}
    {...attributes} {...listeners} aria-label={label} onClick={() => { if (!isDragging) onClick?.(); }}>{children}</button>;
}
function DropZone({ id, children }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <section ref={setNodeRef} className={`cm-zone${isOver ? " cm-zone--over" : ""}`}>{children}</section>;
}

export function CoinBoard({ tens, ones, boardRef, selected, onSelect, dragStacks = false, onStackClick,
  disabled = false, pendingStack, pendingCoins = [], groupable = false, focus, counted = [], onCount, dropZones = false, wideOnes = false }) {
  const zone = (kind, objects) => <>
    <h2 className="pv-zone-label">{kind === "tens" ? "Десятки" : "Единицы"}</h2>
    <div className={kind === "tens" ? "cm-stacks" : "cm-coins"}>{objects.map((id, i) => {
      const stack = kind === "tens", key = `${kind}:${id}`;
      const pending = stack ? pendingStack === id : pendingCoins.includes(id);
      const props = { "data-stack-id": stack ? id : undefined, "data-coin-id": stack ? undefined : id };
      const cls = `${pending ? " cm-pending" : ""}${selected === key ? " cm-selected" : ""}${counted.includes(key) ? " cm-counted" : ""}`;
      const label = stack ? `Десяток ${i + 1}` : `Монета ${i + 1}`;
      const click = () => { if (onCount) onCount(key); else if (onSelect) onSelect(key); else onStackClick?.(id); };
      const content = stack ? <TenStack /> : <Coin groupable={groupable && i < 10} />;
      return <div key={id} className={`cm-object-wrap${cls}`} {...props}>
        {stack && dragStacks
          ? <DraggableObject id={`stack-${id}`} kind="ten" disabled={disabled} label={label} onClick={click}>{content}</DraggableObject>
          : onSelect || onCount
            ? <button type="button" className="cm-object" disabled={disabled} aria-label={label} aria-pressed={selected === key || counted.includes(key)} onClick={click}>{content}</button>
            : <div className="cm-object">{content}</div>}
      </div>;
    })}</div>
  </>;
  return <div ref={boardRef} className={`cm-board pv-zones${wideOnes ? " cm-board--wide-ones" : ""}${focus ? ` cm-board--focus-${focus}` : ""}`} aria-label="Модель числа">
    {dropZones ? <DropZone id="cm-tens">{zone("tens", tens)}</DropZone> : <section className="cm-zone">{zone("tens", tens)}</section>}
    {dropZones ? <DropZone id="cm-ones">{zone("ones", ones)}</DropZone> : <section className="cm-zone">{zone("ones", ones)}</section>}
  </div>;
}

export function CoinSource({ kind, disabled, onAdd }) {
  return <DraggableObject id={`source-${kind}`} kind={kind} disabled={disabled} className="cm-source" label={kind === "ten" ? "Взять десяток" : "Взять монету"} onClick={() => onAdd(kind)}>
    {kind === "ten" ? <TenStack /> : <Coin />}<span>{kind === "ten" ? "Взять десяток" : "Взять монету"}</span>
  </DraggableObject>;
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
