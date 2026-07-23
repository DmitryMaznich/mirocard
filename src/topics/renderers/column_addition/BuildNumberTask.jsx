import { useRef, useState } from "react";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useSpeech } from "@/shared/hooks/useSpeech";
import { Coin, TenStack, PILE_LAYOUT } from "./CoinBlocks.jsx";
import { pluralTens, pluralOnes, pluralCoins } from "./placeValueLabels.js";
import { useFitOneLine } from "./textFit.js";
import "./place_value.css";
import "./coins.css";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

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

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="pv-check-icon" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Same checklist-row-doubles-as-confirm-button idiom as fingers_count's
// ChecklistItem (FingersCountTask.jsx) — kept as a separate copy with its
// own pv-checklist-* classes rather than a shared component so the two
// families' visuals stay independently tunable. `clickable=false` is for
// the two "Сколько...?" rows: they tick themselves off once the numpad
// gets the right digit, not from a tap on the row.
function ChecklistItem({ text, state, onTap, textRef, fontSize, clickable = true }) {
  const done = state === "done";
  const wrong = state === "wrong";
  const interactive = clickable && !done;
  return (
    <div
      className={`pv-checklist-item${done ? " is-done" : ""}${wrong ? " is-wrong" : ""}${!clickable ? " is-pending" : ""}`}
      onClick={interactive ? onTap : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <span className="pv-checklist-box">{done && <CheckIcon />}</span>
      <span ref={textRef} className="pv-checklist-text" style={fontSize ? { fontSize } : undefined}>
        {text}
      </span>
    </div>
  );
}

// The target number used to live in its own huge standalone pv-number
// display above the checklist, duplicating what row 1's instruction text
// already said ("Собери 23 монеты"). Folding it into the instruction
// itself (highlighted by colour, not by an oversized nested span — that
// would throw off useFitOneLine's own width measurement) removes that
// duplication instead of just shrinking one of the two copies.
function withHighlightedNumber(text, number) {
  const numStr = String(number);
  const idx = text.indexOf(numStr);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="pv-checklist-number">{numStr}</span>
      {text.slice(idx + numStr.length)}
    </>
  );
}

export default function BuildNumberTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  // collect: drag out exactly task.number loose coins (grouping into tens
  // is allowed along the way, freely, same as before) -> confirm.
  // group: finish grouping everything groupable (no more full ten left
  // loose) -> confirm.
  // answerTens / answerOnes: report back what was actually built, one
  // digit each, via the shared numpad — this is the step that was missing
  // before: the old single "ГОТОВО" button re-checked both piles at once
  // with no per-step guidance and no way to tell a child which side was
  // wrong.
  const [phase, setPhase] = useState("collect");
  const [placed, setPlaced] = useState({ tens: 0, ones: 0 });
  const [formingStack, setFormingStack] = useState(false);
  const [unformingStack, setUnformingStack] = useState(false);
  const [errorZones, setErrorZones] = useState({ tens: false, ones: false });
  const [capacityFlash, setCapacityFlash] = useState({ tens: false, ones: false });
  const [rowWrong, setRowWrong] = useState({ collect: false, group: false, tens: false, ones: false });
  const { speak } = useSpeech();
  const stacksAreaRef = useRef(null);
  const looseAreaRef = useRef(null);

  // Tied to THIS task's own target instead of a flat constant: a flat 19
  // used to block reaching a target of 20+ entirely if a child preferred
  // not to group early. Still deliberately generous PAST the target (not
  // capped exactly at it) — capping right at the right answer would double
  // as revealing it, which this app's other training modes never do; this
  // is only a safety net against an unsupervised child dragging in
  // hundreds of coins, not a referee for wrong answers (the checklist
  // confirms already handle that).
  const onesCeiling = task.number + 5;
  const tensCeiling = Math.ceil(task.number / 10) + 2;

  // Only "collect" may change the TOTAL (drag in / remove a loose coin);
  // grouping/ungrouping stays available through "group" too (pure
  // 10-for-1 conversion, so the total the child already confirmed never
  // silently drifts once they've moved past collecting).
  const canAdjustTotal = phase === "collect";
  const canGroup = phase === "collect" || phase === "group";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  function flashCapacity(side) {
    setCapacityFlash((c) => ({ ...c, [side]: true }));
    setTimeout(() => setCapacityFlash((c) => ({ ...c, [side]: false })), 400);
  }

  function handleDragEnd({ over }) {
    if (!over || !canAdjustTotal) return;
    if (placed.ones >= onesCeiling) {
      flashCapacity("ones");
      return;
    }
    setErrorZones({ tens: false, ones: false });
    setPlaced((p) => ({ ...p, ones: p.ones + 1 }));
  }

  function removeOne() {
    if (!canAdjustTotal) return;
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
    if (!canGroup) return;
    if (placed.ones < 10 || formingStack || unformingStack) return;
    if (placed.tens >= tensCeiling) {
      flashCapacity("tens");
      return;
    }
    const looseCoinEls = Array.from(looseAreaRef.current.querySelectorAll(".cb-coin")).slice(0, 10);
    if (looseCoinEls.length < 10) return;

    speak("Десять единиц — это один десяток!");

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
    if (!canGroup) return;
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

  function flashRowWrong(key, extra) {
    setRowWrong((w) => ({ ...w, [key]: true }));
    if (extra) extra(true);
    onMistake?.(task.conceptId, task.cardId);
    onFlashIncorrect?.();
    setTimeout(() => {
      setRowWrong((w) => ({ ...w, [key]: false }));
      if (extra) extra(false);
    }, 500);
  }

  function confirmCollect() {
    const total = placed.ones + placed.tens * 10;
    if (total !== task.number) {
      flashRowWrong("collect", (on) => setErrorZones({ tens: on, ones: on }));
      return;
    }
    setPhase("group");
  }

  function confirmGroup() {
    if (placed.ones >= 10) {
      flashRowWrong("group", (on) => setErrorZones((z) => ({ ...z, ones: on })));
      return;
    }
    setPhase("answerTens");
  }

  function handleTensDigit(d) {
    if (phase !== "answerTens") return;
    if (d === task.target.tens) {
      speak("Верно!");
      setPhase("answerOnes");
    } else {
      flashRowWrong("tens");
    }
  }

  function handleOnesDigit(d) {
    if (phase !== "answerOnes") return;
    if (d === task.target.ones) {
      speak(`Верно! ${task.target.tens} ${pluralTens(task.target.tens)} и ${task.target.ones} ${pluralOnes(task.target.ones)}!`);
      setPhase("done");
      setTimeout(() => onCorrect(task.conceptId, task.cardId), 900);
    } else {
      flashRowWrong("ones");
    }
  }

  const groupableCount = canGroup && placed.ones >= 10 ? 10 : 0;
  const collectText = `Собери ${task.number} ${pluralCoins(task.number)}`;
  const collectContent = withHighlightedNumber(collectText, task.number);

  // Every row gets its own fit call, all sharing the same 45px ceiling
  // (3x the old compact 15px row) — a completed row keeps the same size
  // instead of shrinking away just because it's no longer the active one.
  const { ref: collectRef, fontSize: collectFontSize } = useFitOneLine(collectText, { max: 45, min: 20 });
  const { ref: groupRef, fontSize: groupFontSize } = useFitOneLine("Собери десятки", { max: 45, min: 20 });
  const { ref: tensRef, fontSize: tensFontSize } = useFitOneLine("Сколько десятков?", { max: 45, min: 20 });
  const { ref: onesRef, fontSize: onesFontSize } = useFitOneLine("Сколько единиц?", { max: 45, min: 20 });

  const tensDisplay = placed.tens - (formingStack ? 1 : 0);
  const onesDisplay = placed.ones - (unformingStack ? 10 : 0);
  const building = canGroup; // collect or group — the piles are still being worked on

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="pv-screen cb-screen">
        <div className="pv-checklist">
          <ChecklistItem
            text={collectContent}
            state={phase === "collect" ? (rowWrong.collect ? "wrong" : "active") : "done"}
            onTap={phase === "collect" ? confirmCollect : undefined}
            textRef={collectRef}
            fontSize={collectFontSize}
          />
          {phase !== "collect" && (
            <ChecklistItem
              text="Собери десятки"
              state={phase === "group" ? (rowWrong.group ? "wrong" : "active") : "done"}
              onTap={phase === "group" ? confirmGroup : undefined}
              textRef={groupRef}
              fontSize={groupFontSize}
            />
          )}
          {(phase === "answerTens" || phase === "answerOnes" || phase === "done") && (
            <ChecklistItem
              text="Сколько десятков?"
              state={phase === "answerTens" ? (rowWrong.tens ? "wrong" : "active") : "done"}
              clickable={false}
              textRef={tensRef}
              fontSize={tensFontSize}
            />
          )}
          {(phase === "answerOnes" || phase === "done") && (
            <ChecklistItem
              text="Сколько единиц?"
              state={phase === "answerOnes" ? (rowWrong.ones ? "wrong" : "active") : "done"}
              clickable={false}
              textRef={onesRef}
              fontSize={onesFontSize}
            />
          )}
        </div>

        {/* Centers the coin zone in whatever vertical space is left between
            the checklist and the pile/numpad below, rather than it sitting
            right under the checklist — flex:1 both absorbs the leftover
            space AND (via justify-content) splits it evenly above/below.
            The raised .pv-*-mat panels (here, the tray, and the numpad)
            all share one "card" treatment so none of them read as bare
            content floating on the background grid. */}
        <div className="pv-workspace-center">
          <div className="pv-workspace-mat">
            <Workspace
              placed={placed}
              formingStack={formingStack}
              unformingStack={unformingStack}
              groupableCount={groupableCount}
              errorZones={errorZones}
              capacityFlash={capacityFlash}
              solved={phase === "done"}
              numeric={task.numericBlocks}
              onRemoveOne={removeOne}
              onGroup={handleGroup}
              onRemoveTen={handleUngroup}
              stacksAreaRef={stacksAreaRef}
              looseAreaRef={looseAreaRef}
            />

            {building && (
              <div className="pv-zones" style={{ flex: 0 }}>
                <div style={{ flex: 1 }} className="pv-zone-counter">
                  {tensDisplay} {pluralTens(tensDisplay)}
                </div>
                <div style={{ flex: 1 }} className="pv-zone-counter">
                  {onesDisplay} {pluralOnes(onesDisplay)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fully unmounted (not just opacity-hidden) once collecting is
            over — an opacity-hidden tray would still reserve its layout
            space, leaving a dead gap between the workspace and whatever
            renders below it (the numpad) for the rest of the task. */}
        {phase === "collect" && (
          <div className="pv-tray-mat">
            <div className="pv-tray">
              <PileSource />
            </div>
            <div className="pv-caption">тяни монету из кучи</div>
          </div>
        )}

        {(phase === "answerTens" || phase === "answerOnes") && (
          <div className="pv-numpad-mat">
            <div className="pv-numpad">
              {DIGITS.map((d) => (
                <button
                  key={d}
                  className="pv-numkey"
                  onClick={() => (phase === "answerTens" ? handleTensDigit(d) : handleOnesDigit(d))}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
}
