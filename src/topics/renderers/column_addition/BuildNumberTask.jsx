import { useRef, useState } from "react";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Button from "@/shared/components/Button";
import { CheckmarkIcon, RefreshIcon } from "@/shared/components/ArrowIcons";
import { Coin, TenStack, PILE_LAYOUT } from "./CoinBlocks.jsx";
import { pluralCoins, hintDirectionFor, placeValueSentence } from "./placeValueLabels.js";
import { useFitLongestOneLine } from "./textFit.js";
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
function AnswerSlot({ show, state, value, hint }) {
  if (!show) return null;
  // `state` may carry more than one modifier word (e.g. "filled correct")
  // — each becomes its own pv-answer-slot--x class, not one bogus
  // "pv-answer-slot--filled correct" (a real bug caught while building the
  // visual mockup for this exact change, before it reached this file).
  const cls = (state ?? "").split(" ").filter(Boolean).map((s) => ` pv-answer-slot--${s}`).join("");
  return (
    <div className={`pv-answer-slot${cls}`}>
      {value ?? "?"}
      {hint && <div className="pv-answer-hint">{hint === "more" ? "Больше ↑" : "Меньше ↓"}</div>}
    </div>
  );
}

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
          <div className="cb-col cb-col--tens">
            <div className="pv-zone-label">Десятки</div>
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
          </div>
          <div className="cb-col cb-col--ones">
            <div className="pv-zone-label">Единицы</div>
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

// The target number used to live in its own huge standalone pv-number
// display above the checklist, duplicating what row 1's instruction text
// already said ("Собери 23 монеты"). Folding it into the instruction
// itself (highlighted by colour, not by an oversized nested span — that
// would throw off useFitLongestOneLine's own width measurement) removes that
// duplication instead of just shrinking one of the two copies.
function withHighlightedNumber(text, number) {
  const numStr = String(number);
  const idx = text.indexOf(numStr);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="pv-question-number">{numStr}</span>
      {text.slice(idx + numStr.length)}
    </>
  );
}

export default function BuildNumberTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  // collect: drag out exactly task.number loose coins (no grouping yet,
  // even past 10 — that only unlocks in the next step) -> confirm.
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
  const [hintDirection, setHintDirection] = useState({ tens: null, ones: null });
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

  // "collect" only changes the TOTAL (drag in / remove a loose coin) — no
  // grouping there, even if 10+ loose coins pile up, so the highlight and
  // the tens conversion don't appear until the child has actually
  // confirmed the count and moved to "group". Grouping/ungrouping is then
  // a pure 10-for-1 conversion, so the total the child already confirmed
  // never silently drifts.
  const canAdjustTotal = phase === "collect";
  const canGroup = phase === "group";

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
  // Workspace) until every ghost has actually arrived, then it's revealed.
  function handleGroup() {
    if (!canGroup) return;
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

  // `direction` is only ever passed for the two digit-answer rows
  // ("tens"/"ones") — "collect"/"group" calls omit it, and the hint state
  // update is skipped entirely for those (there's no single wrong "digit"
  // to give a direction for when the mistake is a coin total/grouping
  // mismatch). The hint clears on its own longer timer (1300ms) than the
  // row shake (500ms) — the shake is a quick flash, the hint needs to
  // actually be read.
  function flashRowWrong(key, extra, direction) {
    setRowWrong((w) => ({ ...w, [key]: true }));
    if (extra) extra(true);
    if (direction) setHintDirection((h) => ({ ...h, [key]: direction }));
    onMistake?.(task.conceptId, task.cardId);
    onFlashIncorrect?.();
    setTimeout(() => {
      setRowWrong((w) => ({ ...w, [key]: false }));
      if (extra) extra(false);
    }, 500);
    if (direction) {
      setTimeout(() => {
        setHintDirection((h) => ({ ...h, [key]: null }));
      }, 1300);
    }
  }

  function confirmCollect() {
    const total = placed.ones + placed.tens * 10;
    if (total !== task.number) {
      flashRowWrong("collect", (on) => setErrorZones({ tens: on, ones: on }));
      return;
    }
    setPhase("group");
  }

  // "Сначала" — for when the child loses count mid-drag: clears the loose
  // pile back to 0 without leaving "collect" (tens is always 0 here
  // already, canAdjustTotal only lets ones change during this phase), so
  // they can start counting the same target over again.
  function resetCollect() {
    setPlaced({ tens: 0, ones: 0 });
    setErrorZones({ tens: false, ones: false });
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
      setPhase("answerOnes");
    } else {
      flashRowWrong("tens", undefined, hintDirectionFor(d, task.target.tens));
    }
  }

  function handleOnesDigit(d) {
    if (phase !== "answerOnes") return;
    if (d === task.target.ones) {
      setPhase("done");
    } else {
      flashRowWrong("ones", undefined, hintDirectionFor(d, task.target.ones));
    }
  }

  function handleContinue() {
    onCorrect(task.conceptId, task.cardId);
  }

  const groupableCount = canGroup && placed.ones >= 10 ? 10 : 0;
  const collectText = `Перенеси ${task.number} ${pluralCoins(task.number)}`;
  const collectContent = withHighlightedNumber(collectText, task.number);

  // Only one instruction is ever visible at a time now (matching
  // IdentifyNumberTask.jsx's own pv-question). Fit once against whichever
  // of these five is widest (collectText is task-specific — its own length
  // varies with task.number/pluralCoins — the other four are fixed), not
  // the current one each time, so the font size doesn't grow/shrink as
  // phase swaps to a shorter/longer instruction.
  const questionText = phase === "collect" ? collectText
    : phase === "group" ? "Собери десятки"
    : phase === "answerTens" ? "Сколько десятков?"
    : phase === "answerOnes" ? "Сколько единиц?"
    : "Правильно!";
  const questionContent = phase === "collect" ? collectContent : questionText;
  const { ref: questionRef, fontSize: questionFontSize } = useFitLongestOneLine(
    [collectText, "Собери десятки", "Сколько десятков?", "Сколько единиц?", "Правильно!"],
    { max: 45, min: 13 }
  );

  const showAnswerSlots = phase === "answerTens" || phase === "answerOnes" || phase === "done";
  const tensDone = phase === "answerOnes" || phase === "done";
  const onesDone = phase === "done";
  const tensAnswer = {
    value: tensDone ? task.target.tens : null,
    state: tensDone ? "filled correct" : rowWrong.tens ? "shake" : phase === "answerTens" ? "active" : undefined,
    hint: hintDirection.tens,
  };
  const onesAnswer = {
    value: onesDone ? task.target.ones : null,
    state: onesDone ? "filled correct" : rowWrong.ones ? "shake" : phase === "answerOnes" ? "active" : undefined,
    hint: hintDirection.ones,
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="pv-screen cb-screen">
        <div className={`pv-question${phase === "done" ? " pv-question--correct" : ""}`}>
          <span ref={questionRef} style={{ fontSize: questionFontSize }}>{questionContent}</span>
        </div>

        {/* Top edge fixed right under the question, growing only downward
            as coins are added — flex:1 absorbs the leftover space between
            the question and the pile/numpad below without centering the
            mat inside it (see .pv-workspace-center's justify-content).
            The raised .pv-*-mat panels (here, the tray, and the numpad)
            all share one "card" treatment so none of them read as bare
            content floating on the background grid.

            No live "N десятков / M единиц" readout here (unlike the
            earlier version of this screen): the whole point of collecting
            and grouping is for the child to build a felt sense of the
            quantity by handling it, then read it back themselves at the
            end from the physical stacks/coins — a running digit counter
            would let them just watch it tick to the target instead of
            counting, and would already answer the question this screen
            asks moments later. fingers_count never showed one either
            (a hand's raised-finger count is read from the hand itself,
            not a number next to it) — this brings build_number in line
            with that. */}
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

            {/* Step 3's answer fields: a row of their own BELOW the coin
                zone's dashed border (not inside each column, above the
                fold) — same width split as the zone's own columns
                (.cb-col--tens/--ones reused directly) so each slot still
                lines up under its matching zone. */}
            {showAnswerSlots && (
              <div className="cb-answer-split">
                <div className="cb-col cb-col--tens">
                  <AnswerSlot show state={tensAnswer.state} value={tensAnswer.value} hint={tensAnswer.hint} />
                </div>
                <div className="cb-col cb-col--ones">
                  <AnswerSlot show state={onesAnswer.state} value={onesAnswer.value} hint={onesAnswer.hint} />
                </div>
              </div>
            )}
          </div>

          {/* Same .pv-recap-fit IdentifyNumberTask uses: claims whatever
              room the mat (now pinned to the top) doesn't use and centers
              the recap sentence inside it — "the space between the coins
              and the bottom of the screen", not squeezed right under the
              mat. */}
          {phase === "done" && (
            <div className="pv-recap-fit">
              <div className="pv-recap">{placeValueSentence(task.target.tens, task.target.ones, task.number)}</div>
            </div>
          )}
        </div>

        {/* Fully unmounted (not just opacity-hidden) once collecting is
            over — an opacity-hidden tray would still reserve its layout
            space, leaving a dead gap between the workspace and whatever
            renders below it (the numpad) for the rest of the task.
            "Сначала" (left) clears a miscounted pile back to 0 without
            leaving this phase; "Сделано" (right) is confirmCollect —
            the same check that used to live on a tap of the question
            text above, now a dedicated button instead so there isn't a
            second, less obvious way to confirm the same thing. */}
        {phase === "collect" && (
          <div className="pv-tray-mat">
            <div className="pv-tray-row">
              <Button variant="secondary" onClick={resetCollect} aria-label="Сначала">
                <RefreshIcon />
              </Button>
              <div className="pv-tray">
                <PileSource />
              </div>
              <div className={`pv-confirm-btn${rowWrong.collect ? " pv-confirm-btn--shake" : ""}`}>
                <Button variant="primary" onClick={confirmCollect} aria-label="Сделано">
                  <CheckmarkIcon />
                </Button>
              </div>
            </div>
            <div className="pv-caption">тяни монету из кучи</div>
          </div>
        )}

        {/* group has no pile to flank with buttons the way collect does —
            just the same "Сделано" confirm, centered at the bottom like
            IdentifyNumberTask/RegroupTenTask's own "Далее →" footer. No
            more tap-the-question here either, for the same reason collect
            dropped it: one obvious way to confirm, not two. */}
        {phase === "group" && (
          <div className="pv-footer">
            <div className={`pv-confirm-btn${rowWrong.group ? " pv-confirm-btn--shake" : ""}`}>
              <Button variant="primary" onClick={confirmGroup} aria-label="Сделано">
                <CheckmarkIcon />
              </Button>
            </div>
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

        {/* Used to auto-advance 900ms after the last correct digit — too
            fast to read the recap sentence above. Now a deliberate tap,
            same as identify_number/regroup_ten's own "Далее →". The recap
            itself lives inside .pv-workspace-center now (see above), not
            here — this stays a plain single-button footer, pinned at the
            true bottom same as group's "Сделано" footer. */}
        {phase === "done" && (
          <div className="pv-footer">
            <Button variant="secondary" onClick={handleContinue}>Далее →</Button>
          </div>
        )}
      </div>
    </DndContext>
  );
}
