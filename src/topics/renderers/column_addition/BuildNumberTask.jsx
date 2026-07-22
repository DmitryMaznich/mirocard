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
function Workspace({ placed, formingStack, unformingStack, groupableCount, errorZones, capacityFlash, solved, numeric, onRemoveOne, onGroup, onRemoveTen, stacksAreaRef, looseAreaRef }) {
  const { setNodeRef, isOver } = useDroppable({ id: "cb-workspace" });
  const pendingOnesStart = unformingStack ? placed.ones - 10 : Infinity;
  return (
    <div className="pv-zones">
      <div
        ref={setNodeRef}
        className={`pv-zone${solved ? " pv-zone--correct" : ""}${isOver ? " pv-zone--drag-over" : ""}`}
      >
        <div className="cb-zone-split">
          <div
            className={`cb-stacks-area${errorZones.tens ? " cb-area--error" : ""}${capacityFlash.tens ? " cb-area--capacity" : ""}`}
            ref={stacksAreaRef}
          >
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
          <div
            className={`cb-loose-area${errorZones.ones ? " cb-area--error" : ""}${capacityFlash.ones ? " cb-area--capacity" : ""}`}
            ref={looseAreaRef}
          >
            {Array.from({ length: placed.ones }, (_, i) => {
              const pending = i >= pendingOnesStart;
              return (
                <div
                  key={i}
                  className={pending ? "cb-coin-pending" : undefined}
                  onClick={pending ? undefined : (i < groupableCount ? onGroup : onRemoveOne)}
                >
                  <Coin numeric={numeric} groupable={i < groupableCount} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function rectCenter(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// A generous safety ceiling, not a per-task one: capping loose/stacked
// coins exactly at the target would double as revealing the answer (the
// zone would visibly "stop accepting" right at the correct count), which
// this app's other training modes deliberately never do. ONES_CEILING is
// a flat number since maxOnes never exceeds 9 by design, so 19 is already
// generous for every task; the tens ceiling is relative to the session's
// own maxTens (task.maxTens) so a deliberately-larger configured range
// never gets blocked as "too many". Both exist only to catch an
// unsupervised child dragging hundreds of coins in — not to referee
// ordinary wrong answers, which ГОТОВО already handles.
const ONES_CEILING = 19;

// One flying coin ghost: appended to document.body, animated from `from`
// to `to` in screen coordinates, removed and `onArrive()` called once it
// lands. Shared by the group (10 loose coins -> 1 stack) and ungroup (1
// stack -> 10 loose coins) animations — same visual, opposite direction.
function flyCoinGhost(from, to, delayMs, onArrive) {
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
    { duration: 260, delay: delayMs, easing: "cubic-bezier(.35,.6,.4,1)", fill: "forwards" },
  );
  anim.onfinish = () => {
    ghost.remove();
    onArrive();
  };
}

export default function BuildNumberTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const [placed, setPlaced] = useState({ tens: 0, ones: 0 });
  const [formingStack, setFormingStack] = useState(false);
  const [unformingStack, setUnformingStack] = useState(false);
  const [errorZones, setErrorZones] = useState({ tens: false, ones: false });
  const [capacityFlash, setCapacityFlash] = useState({ tens: false, ones: false });
  const [solved, setSolved] = useState(false);
  const { speak } = useSpeech();
  const stacksAreaRef = useRef(null);
  const looseAreaRef = useRef(null);
  const tensCeiling = (task.maxTens ?? 3) + 2;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  function flashCapacity(side) {
    setCapacityFlash((c) => ({ ...c, [side]: true }));
    setTimeout(() => setCapacityFlash((c) => ({ ...c, [side]: false })), 400);
  }

  function handleDragEnd({ over }) {
    if (!over) return;
    if (placed.ones >= ONES_CEILING) {
      flashCapacity("ones");
      return;
    }
    setErrorZones({ tens: false, ones: false });
    setPlaced((p) => ({ ...p, ones: p.ones + 1 }));
  }

  function removeOne() {
    setPlaced((p) => ({ ...p, ones: Math.max(0, p.ones - 1) }));
  }

  // One coin's height/pitch within a rendered 10-coin TenStack, derived
  // from the stack's own bounding rect: 10 coins overlapping by the same
  // ratio as .cb-stack-coin's margin-top (-7 out of a 12-tall coin, i.e.
  // each added coin contributes a 5/12 sliver) — see coins.css.
  function stackCoinMetrics(rect) {
    const coinHeight = rect.height / (1 + 9 * (5 / 12));
    return { coinHeight, discPitch: coinHeight * (5 / 12) };
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
    if (placed.ones < 10 || formingStack || unformingStack) return;
    if (placed.tens >= tensCeiling) {
      flashCapacity("tens");
      return;
    }
    const looseCoinEls = Array.from(looseAreaRef.current.querySelectorAll(".cb-coin")).slice(0, 10);
    if (looseCoinEls.length < 10) return;

    const froms = looseCoinEls.map((el) => rectCenter(el.getBoundingClientRect()));

    setFormingStack(true);
    setPlaced((p) => ({ ones: p.ones - 10, tens: p.tens + 1 }));

    requestAnimationFrame(() => {
      const stackEls = stacksAreaRef.current.querySelectorAll(".cb-ten-stack");
      const newStackEl = stackEls[stackEls.length - 1];
      const rect = newStackEl.getBoundingClientRect();
      const { coinHeight, discPitch } = stackCoinMetrics(rect);
      const landX = rect.left + rect.width / 2;
      const landBaseY = rect.bottom - coinHeight / 2;

      let remaining = froms.length;
      froms.forEach((from, i) => {
        const to = { x: landX, y: landBaseY - i * discPitch };
        flyCoinGhost(from, to, i * 45, () => {
          remaining -= 1;
          if (remaining === 0) setFormingStack(false);
        });
      });
    });
  }

  // Mirror of handleGroup: tapping a stack breaks it back into 10 loose
  // coins that fly out to their real slots in the loose area, peeling off
  // top-first (the apex coin departs first). Same hidden-until-arrived
  // trick, in reverse — the loose area already has the 10 new coins
  // mounted (React needs their real flex-wrapped positions to animate
  // to), but they stay invisible via .cb-coin-pending until they land.
  function handleUngroup(e) {
    if (placed.tens <= 0 || formingStack || unformingStack) return;
    const stackEl = e.currentTarget;
    const rect = stackEl.getBoundingClientRect();
    const { coinHeight, discPitch } = stackCoinMetrics(rect);
    const originX = rect.left + rect.width / 2;
    const originBaseY = rect.bottom - coinHeight / 2;
    const froms = Array.from({ length: 10 }, (_, i) => ({ x: originX, y: originBaseY - (9 - i) * discPitch }));

    setUnformingStack(true);
    setPlaced((p) => ({ tens: p.tens - 1, ones: p.ones + 10 }));

    requestAnimationFrame(() => {
      const newCoinEls = Array.from(looseAreaRef.current.querySelectorAll(".cb-coin")).slice(-10);
      let remaining = newCoinEls.length;
      newCoinEls.forEach((el, i) => {
        const to = rectCenter(el.getBoundingClientRect());
        flyCoinGhost(froms[i], to, i * 45, () => {
          remaining -= 1;
          if (remaining === 0) setUnformingStack(false);
        });
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
      onFlashIncorrect?.();
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
          unformingStack={unformingStack}
          groupableCount={groupableCount}
          errorZones={errorZones}
          capacityFlash={capacityFlash}
          solved={solved}
          numeric={task.numericBlocks}
          onRemoveOne={removeOne}
          onGroup={handleGroup}
          onRemoveTen={handleUngroup}
          stacksAreaRef={stacksAreaRef}
          looseAreaRef={looseAreaRef}
        />

        <div className="pv-zones" style={{ flex: 0 }}>
          <div style={{ flex: 1 }} className="pv-zone-counter">
            {placed.tens - (formingStack ? 1 : 0)} {pluralTens(placed.tens - (formingStack ? 1 : 0))}
          </div>
          <div style={{ flex: 1 }} className="pv-zone-counter">
            {placed.ones - (unformingStack ? 10 : 0)} {pluralOnes(placed.ones - (unformingStack ? 10 : 0))}
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
