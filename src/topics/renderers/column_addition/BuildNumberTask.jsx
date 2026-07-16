import { useRef, useState } from "react";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Button from "@/shared/components/Button";
import { useSpeech } from "@/shared/hooks/useSpeech";
import { Coin, TenStack, PILE_LAYOUT } from "./CoinBlocks.jsx";
import { pluralTens, pluralOnes } from "./placeValueLabels.js";
import "./place_value.css";
import "./coins.css";

// Every coin in the pyramid is its own draggable (not just the apex), so a
// child can pull any coin out of the heap. Each keeps rendering at its
// fixed spot after a drag ends (nothing is removed from PILE_LAYOUT), so
// the pile always looks the same regardless of how many coins were
// dragged from it — the same "infinite supply" trick as the tray items
// before this mode had a heap at all. The idle bob (apex only) is dropped
// while THAT coin is being dragged so dnd-kit's translate and the bob
// keyframe's own transform don't fight over the element's `transform`.
function PileCoin({ id, x, y, r, top }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, data: { kind: "coin" } });
  return (
    <div
      ref={setNodeRef}
      className={`cb-pile-drag cb-pile-coin${top && !isDragging ? " cb-pile-coin--top" : ""}`}
      style={{
        left: `calc(${x} * var(--cb-scale, 1px))`,
        top: `calc(${y} * var(--cb-scale, 1px))`,
        transform: `rotate(${r}deg)${transform ? " " + CSS.Translate.toString(transform) : ""}`,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : "auto",
      }}
      {...listeners}
      {...attributes}
    />
  );
}

function PileSource() {
  return (
    <div className="cb-pile-wrap">
      {PILE_LAYOUT.map((coin, i) => (
        <PileCoin key={i} id={`coin-pile-${i}`} {...coin} />
      ))}
    </div>
  );
}

// Must be a child of <DndContext>, not a sibling call in the component that renders
// <DndContext> itself — useDroppable() only registers with the nearest DndContext
// ancestor found via React context, which doesn't exist yet while the parent's own
// render body is still executing.
function Workspace({ placed, groupableCount, errorZones, solved, numeric, onRemoveOne, onGroup, onRemoveTen, stacksAreaRef, looseAreaRef }) {
  const { setNodeRef, isOver } = useDroppable({ id: "cb-workspace" });
  return (
    <div className="pv-zones">
      <div
        ref={setNodeRef}
        className={`pv-zone${solved ? " pv-zone--correct" : ""}${isOver ? " pv-zone--drag-over" : ""}`}
      >
        <div className="cb-zone-split">
          <div className={`cb-stacks-area${errorZones.tens ? " cb-area--error" : ""}`} ref={stacksAreaRef}>
            {Array.from({ length: placed.tens }, (_, i) => (
              <div key={i} onClick={onRemoveTen}>
                <TenStack numeric={numeric} />
              </div>
            ))}
          </div>
          <div className={`cb-loose-area${errorZones.ones ? " cb-area--error" : ""}`} ref={looseAreaRef}>
            {Array.from({ length: placed.ones }, (_, i) => (
              <div key={i} onClick={i < groupableCount ? onGroup : onRemoveOne}>
                <Coin numeric={numeric} groupable={i < groupableCount} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function rectCenter(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export default function BuildNumberTask({ task, onCorrect, onMistake }) {
  const [placed, setPlaced] = useState({ tens: 0, ones: 0 });
  const [errorZones, setErrorZones] = useState({ tens: false, ones: false });
  const [solved, setSolved] = useState(false);
  const { speak } = useSpeech();
  const stacksAreaRef = useRef(null);
  const looseAreaRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  function handleDragEnd({ over }) {
    if (!over) return;
    setErrorZones({ tens: false, ones: false });
    setPlaced((p) => ({ ...p, ones: p.ones + 1 }));
  }

  function removeOne() {
    setPlaced((p) => ({ ...p, ones: Math.max(0, p.ones - 1) }));
  }

  function removeTen() {
    setPlaced((p) => ({ ...p, tens: Math.max(0, p.tens - 1) }));
  }

  function handleGroup() {
    if (placed.ones < 10) return;
    const looseRect = looseAreaRef.current.getBoundingClientRect();
    const stacksRect = stacksAreaRef.current.getBoundingClientRect();
    const from = rectCenter(looseRect);
    const to = { x: stacksRect.left + 24 + (placed.tens % 4) * 46, y: stacksRect.bottom - 30 };

    setPlaced((p) => ({ ...p, ones: p.ones - 10 }));

    const ghost = document.createElement("div");
    ghost.className = "cb-stack-ghost";
    ghost.style.left = `${from.x}px`;
    ghost.style.top = `${from.y}px`;
    for (let i = 0; i < 10; i++) {
      const c = document.createElement("div");
      c.className = "cb-stack-coin";
      ghost.appendChild(c);
    }
    document.body.appendChild(ghost);

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const anim = ghost.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.9) rotate(0deg)", offset: 0 },
        { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 40}px)) scale(1.05) rotate(-6deg)`, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(3deg)`, offset: 1 },
      ],
      { duration: 550, easing: "cubic-bezier(.3,.6,.4,1)" },
    );
    anim.onfinish = () => {
      ghost.remove();
      setPlaced((p) => ({ ...p, tens: p.tens + 1 }));
    };
  }

  function handleDone() {
    const okTens = placed.tens === task.target.tens;
    const okOnes = placed.ones === task.target.ones;
    if (okTens && okOnes) {
      speak("Верно!");
      setSolved(true);
    } else {
      setErrorZones({ tens: !okTens, ones: !okOnes });
      onMistake?.(task.conceptId, task.cardId);
    }
  }

  function handleContinue() {
    onCorrect(task.conceptId, task.cardId);
  }

  const groupableCount = placed.ones >= 10 ? 10 : 0;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="pv-screen cb-screen">
        <div className="pv-instruction">Собери число</div>
        <div className="pv-number">{task.number}</div>

        <Workspace
          placed={placed}
          groupableCount={groupableCount}
          errorZones={errorZones}
          solved={solved}
          numeric={task.numericBlocks}
          onRemoveOne={removeOne}
          onGroup={handleGroup}
          onRemoveTen={removeTen}
          stacksAreaRef={stacksAreaRef}
          looseAreaRef={looseAreaRef}
        />

        <div className="pv-zones" style={{ flex: 0 }}>
          <div style={{ flex: 1 }} className="pv-zone-counter">
            {placed.tens} {pluralTens(placed.tens)}
          </div>
          <div style={{ flex: 1 }} className="pv-zone-counter">
            {placed.ones} {pluralOnes(placed.ones)}
          </div>
        </div>

        <div className="pv-spacer" />

        <div className="pv-tray">
          <PileSource />
        </div>
        <div className="pv-caption">тяни монету из кучи</div>

        <div className="pv-footer">
          {solved ? (
            <Button variant="secondary" onClick={handleContinue}>Далее →</Button>
          ) : (
            <Button variant="primary" onClick={handleDone}>ГОТОВО</Button>
          )}
        </div>
      </div>
    </DndContext>
  );
}
