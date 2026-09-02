import { useState } from "react";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Button from "@/shared/components/Button";
import { ForwardArrowIcon, BackspaceIcon } from "@/shared/components/ArrowIcons";
import { Coin, TenStack } from "./CoinBlocks.jsx";
import { useFitLongestOneLine } from "./textFit.js";
import "./place_value.css";
import "./coins.css";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
const DRAG_TEXT = "Перетащи десяток к единицам";
const ASK_TEXT = "Сколько теперь единиц?";
const DONE_TEXT = "Готово!";

// The one ten-stack a child can actually act on is otherwise pixel-for-
// pixel identical to the static stacks beside it. The halo + idle bob
// (pv-ten-stack--hint, coins.css) is what makes it read as interactive at
// all — the same visual language build_number already uses for its
// pickable pile coin (.cb-pile-coin--top), needed even more here since a
// touch screen has no hover state to fall back on. Both switch off while
// actually dragging — nothing left to hint at once it's already picked up.
function DraggableTenStack({ id }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, data: { kind: "ten" } });
  const hintClass = isDragging ? "" : " pv-ten-stack--hint";
  return (
    <div
      ref={setNodeRef}
      className={`pv-ten-stack--draggable${hintClass}`}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 10 : "auto" }}
      {...listeners}
      {...attributes}
    >
      <TenStack />
    </div>
  );
}

// Must be a child of <DndContext>, not a sibling call in the component that renders
// <DndContext> itself — useDroppable() only registers with the nearest DndContext
// ancestor found via React context, which doesn't exist yet while the parent's own
// render body is still executing.
function Zones({ tens, ones, exchanged, initialOnes }) {
  const { setNodeRef, isOver } = useDroppable({ id: "pv-ones-zone" });
  return (
    <div className="pv-zones">
      <div className="pv-zone">
        <div className="pv-zone-label">ДЕСЯТКИ</div>
        <div className="pv-zone-body">
          {Array.from({ length: tens }, (_, i) =>
            !exchanged && i === tens - 1 ? (
              <DraggableTenStack key={i} id={`ten-${i}`} />
            ) : (
              <TenStack key={i} />
            )
          )}
        </div>
      </div>

      {/* Points which way the drag actually needs to go — without it,
          nothing on screen says the stack belongs in the OTHER zone once
          picked up. Gone once exchanged: nothing left to point at. */}
      {!exchanged && (
        <div className="pv-regroup-arrow" aria-hidden="true">
          <ForwardArrowIcon size={22} />
        </div>
      )}

      <div className={`pv-zone${isOver ? " pv-zone--drag-over" : ""}`} ref={setNodeRef}>
        <div className="pv-zone-label">ЕДИНИЦЫ</div>
        <div className="pv-zone-body">
          {Array.from({ length: ones }, (_, i) => {
            const isNew = exchanged && i >= initialOnes;
            return (
              <div
                key={i}
                className={isNew ? "pv-cube-pop" : undefined}
                style={isNew ? { animationDelay: `${(i - initialOnes) * 45}ms` } : undefined}
              >
                <Coin />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Always exactly two digits: the post-exchange ones total (task.after.ones)
// is initial ones (1-9, or 0) + 10, so it's always in 10-19 — never a
// single-digit or padded case the way identify_number's whole-number guess
// can be. One shared frame, not two separate slots, for the same reason as
// identify_number: this is one number, not two independent answers.
function NumberFrame({ state, digits }) {
  const cls = (state ?? "").split(" ").filter(Boolean).map((s) => ` pv-number-frame--${s}`).join("");
  return (
    <div className={`pv-number-frame${cls}`}>
      <span className="pv-number-cell">{digits[0] ?? "?"}</span>
      <span className="pv-number-cell">{digits[1] ?? "?"}</span>
    </div>
  );
}

export default function RegroupTenTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  // drag: perform the exchange (the physical demonstration).
  // answer: report how many units it actually produced — this is the part
  // that makes the mode an assessed task rather than just a drag gesture;
  // dragging alone has no way to be gotten wrong. The post-exchange coins
  // stay fully visible while answering (same as build_number's own
  // readback step) — counting them is itself a legitimate way to arrive
  // at the answer, not a loophole.
  // done: correct, show the confirmed before/after equation.
  const [phase, setPhase] = useState("drag");
  const [tens, setTens] = useState(task.initial.tens);
  const [ones, setOnes] = useState(task.initial.ones);
  const [numberInput, setNumberInput] = useState([]);
  const [wrong, setWrong] = useState(false);
  const exchanged = phase !== "drag";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  function handleDragEnd({ over }) {
    if (!over || over.id !== "pv-ones-zone" || tens < 1 || phase !== "drag") return;
    setTens((t) => t - 1);
    setOnes((o) => o + 10);
    setPhase("answer");
  }

  function handleDigit(d) {
    if (phase !== "answer" || wrong) return;
    const next = [...numberInput, d];
    setNumberInput(next);
    if (next.length < 2) return;
    const guess = Number(next.join(""));
    if (guess === task.after.ones) {
      setPhase("done");
    } else {
      setWrong(true);
      onMistake?.(task.conceptId, task.cardId);
      onFlashIncorrect?.();
      setTimeout(() => setWrong(false), 500);
      setTimeout(() => setNumberInput([]), 500);
    }
  }

  function handleBackspace() {
    if (phase !== "answer" || wrong || numberInput.length === 0) return;
    setNumberInput((prev) => prev.slice(0, -1));
  }

  function handleContinue() {
    onCorrect(task.conceptId, task.cardId);
  }

  function frameState() {
    if (phase === "done") return "correct";
    if (wrong) return "shake";
    return undefined;
  }

  const questionText = phase === "drag" ? DRAG_TEXT : phase === "answer" ? ASK_TEXT : DONE_TEXT;
  const { ref: questionRef, fontSize: questionFontSize } = useFitLongestOneLine([DRAG_TEXT, ASK_TEXT, DONE_TEXT], { max: 45, min: 13 });

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="pv-screen cb-screen">
        <div className={`pv-question${phase === "done" ? " pv-question--correct" : ""}`}>
          <span ref={questionRef} style={{ fontSize: questionFontSize }}>{questionText}</span>
        </div>

        <Zones tens={tens} ones={ones} exchanged={exchanged} initialOnes={task.initial.ones} />

        {phase === "answer" && (
          <div className="pv-guess-row">
            <NumberFrame state={frameState()} digits={numberInput} />
            <button
              type="button"
              className="pv-backspace-btn"
              onClick={handleBackspace}
              disabled={wrong || numberInput.length === 0}
              aria-label="Стереть цифру"
            >
              <BackspaceIcon />
            </button>
          </div>
        )}

        <div className="pv-spacer" />

        {phase === "answer" && (
          <div className="pv-numpad">
            {DIGITS.map((d) => (
              <button key={d} className="pv-numkey" onClick={() => handleDigit(d)}>
                {d}
              </button>
            ))}
          </div>
        )}

        {/* Kept as a deliberate exception to "auto-advance like
            build_number": the point of this mode is for the child to see
            and read the before/after equation, not to be swept past it. */}
        {phase === "done" && (
          <div className="pv-result-panel">
            <div className="pv-result-line">
              {task.initial.tens * 10} + {task.initial.ones} = {task.number}
            </div>
            <div className="pv-result-line pv-result-line--sum">
              {task.after.tens * 10} + {task.after.ones} = {task.number}
            </div>
            <Button variant="secondary" onClick={handleContinue}>Далее →</Button>
          </div>
        )}
      </div>
    </DndContext>
  );
}
