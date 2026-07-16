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
function Workspace({ placed, formingStack, groupableCount, errorZones, solved, numeric, onRemoveOne, onGroup, onRemoveTen, stacksAreaRef, looseAreaRef }) {
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
              <div
                key={i}
                className={formingStack && i === placed.tens - 1 ? "cb-ten-stack-pending" : undefined}
                onClick={onRemoveTen}
              >
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
  const [formingStack, setFormingStack] = useState(false);
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

  // Each of the 10 grouped coins gets its own ghost that flies from where
  // that specific coin was actually sitting to a slot in the forming
  // stack, launched with a short stagger — a visible sequence of coins
  // arriving one after another, not one shape resizing in place.
  //
  // The landing spot is measured from the REAL new TenStack, not guessed:
  // .cb-stacks-area is flex-wrap, so a hardcoded "Nth column" formula
  // drifts from where the stack actually wraps to once there are enough
  // of them. So the tens count (and ones count) update immediately —
  // React mounts the new TenStack at its true flex position right away —
  // but it stays hidden (formingStack + .cb-ten-stack-pending, see
  // Workspace) until every ghost has actually arrived, then it's
  // revealed. The counter text is deliberately still held back by one
  // during this window (see the JSX below) so "N десятков" doesn't tick
  // up before the coins visibly land.
  function handleGroup() {
    if (placed.ones < 10) return;
    const looseCoinEls = Array.from(looseAreaRef.current.querySelectorAll(".cb-coin")).slice(0, 10);
    if (looseCoinEls.length < 10) return;

    const froms = looseCoinEls.map((el) => rectCenter(el.getBoundingClientRect()));

    setFormingStack(true);
    setPlaced((p) => ({ ones: p.ones - 10, tens: p.tens + 1 }));

    requestAnimationFrame(() => {
      const stackEls = stacksAreaRef.current.querySelectorAll(".cb-ten-stack");
      const newStackEl = stackEls[stackEls.length - 1];
      const rect = newStackEl.getBoundingClientRect();
      // Reverse-engineer one coin's height from the whole stack's rendered
      // height: 10 coins overlapping by the same ratio as .cb-stack-coin's
      // own margin-top (-7 out of a 12-tall coin, i.e. each added coin
      // contributes a 5/12 sliver) — see coins.css.
      const coinHeight = rect.height / (1 + 9 * (5 / 12));
      const discPitch = coinHeight * (5 / 12);
      const landX = rect.left + rect.width / 2;
      const landBaseY = rect.bottom - coinHeight / 2;

      let remaining = froms.length;
      froms.forEach((from, i) => {
        const to = { x: landX, y: landBaseY - i * discPitch };
        const dx = to.x - from.x;
        const dy = to.y - from.y;

        const ghost = document.createElement("div");
        ghost.className = "cb-coin-fly-ghost";
        ghost.style.left = `${from.x}px`;
        ghost.style.top = `${from.y}px`;
        document.body.appendChild(ghost);

        const anim = ghost.animate(
          [
            { transform: "translate(-50%, -50%) scale(1) rotate(0deg)", offset: 0 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.85) rotate(10deg)`, offset: 1 },
          ],
          { duration: 260, delay: i * 45, easing: "cubic-bezier(.35,.6,.4,1)", fill: "forwards" },
        );
        anim.onfinish = () => {
          ghost.remove();
          remaining -= 1;
          if (remaining === 0) {
            setFormingStack(false);
          }
        };
      });
    });
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
          formingStack={formingStack}
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
            {placed.tens - (formingStack ? 1 : 0)} {pluralTens(placed.tens - (formingStack ? 1 : 0))}
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
