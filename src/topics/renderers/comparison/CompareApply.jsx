import { useEffect, useRef, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import DrawingSignPad from "./DrawingSignPad";

// Tap one of a few concrete number tiles that fits the spoken constraint —
// a closed choice, not free number entry. See engine.js's
// generateApplyGenerateTask for why. The task is framed as an inequality
// with a blank ("? > 36") rather than a bare icon+number card: it's the
// same sign-between-numbers metaphor the earlier ladder steps (CompareSign,
// CompareEvaluate) already taught, so the child reads this as "finish the
// comparison" instead of decoding a new layout.
//
// "Нужна подсказка?" doesn't open a separate screen — it turns each tile
// in place into its own tiny "N [draw a sign] 46" example, using
// CompareDrawSign's own DrawingSignPad/recognizeSign (the child's own
// real-world technique: write both numbers, draw the sign between them,
// the skill he already has, rather than searching for an unknown). Every
// tile is independently checked against its own true relationship to
// task.value; getting a non-answer tile right just marks it done — only
// drawing the correct sign on the tile that actually satisfies task.op
// submits the task's answer, exactly as if it had been tapped.
function GenerateStage({ task, answered, onAnswer, playFeedback }) {
  const [pickedIdx, setPickedIdx] = useState(-1);
  const [wrongIdx, setWrongIdx] = useState(-1);
  const [isCorrectPick, setIsCorrectPick] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hintDone, setHintDone] = useState(() => Array(task.options.length).fill(false));
  const [hintShakeIdx, setHintShakeIdx] = useState(-1);

  const matchIdx = task.options.findIndex((n) => (task.op === "more" ? n > task.value : n < task.value));

  function tapOption(n, idx) {
    if (answered) return;
    setPickedIdx(idx);
    const isCorrect = task.op === "more" ? n > task.value : n < task.value;
    setIsCorrectPick(isCorrect);
    if (!isCorrect) {
      setWrongIdx(idx);
      window.setTimeout(() => setWrongIdx(-1), 350);
    }
    onAnswer(isCorrect);
  }

  function handleHintSign(idx, n, sign, clearCanvas) {
    if (answered) return;
    const correctSign = n === task.value ? "=" : n < task.value ? "<" : ">";
    if (sign !== correctSign) {
      setHintShakeIdx(idx);
      window.setTimeout(() => setHintShakeIdx(-1), 400);
      window.setTimeout(() => clearCanvas(), 800);
      return;
    }
    playFeedback?.("correct");
    if (idx === matchIdx) {
      // This tile's sign doesn't just match its own pair — it satisfies
      // the task's actual condition, so drawing it here IS the answer,
      // same as tapping the tile would have been.
      setPickedIdx(idx);
      setIsCorrectPick(true);
      onAnswer(true);
      return;
    }
    setHintDone((prev) => prev.map((v, i) => (i === idx ? true : v)));
  }

  const hintActive = showHint && !answered;

  return (
    <>
      <div className="apply-ineq" aria-label={task.promptText}>
        <div className={`apply-ineq-blank${isCorrectPick ? " apply-ineq-blank--correct" : ""}`} aria-hidden="true">
          {isCorrectPick ? task.options[pickedIdx] : "?"}
        </div>
        <div className="apply-ineq-sign" aria-hidden="true">{task.op === "more" ? ">" : "<"}</div>
        <div className="apply-ineq-value" aria-hidden="true">{task.value}</div>
      </div>
      <div className="apply-choice-grid">
        {task.options.map((n, i) => (
          <div key={i} className="apply-choice-cell">
            {hintActive ? (
              <div className={`apply-hint-tile${hintDone[i] ? " apply-hint-tile--done" : ""}`}>
                <div className="apply-hint-tile-num">{n}</div>
                <DrawingSignPad
                  taskKey={`${task.conceptId}-hinttile-${i}`}
                  onSignRecognized={(sign, clearCanvas) => handleHintSign(i, n, sign, clearCanvas)}
                  disabled={hintDone[i]}
                  shake={hintShakeIdx === i}
                />
                <div className="apply-hint-tile-num">{task.value}</div>
              </div>
            ) : (
              <button
                type="button"
                className={[
                  "apply-choice-btn",
                  pickedIdx === i && isCorrectPick && "apply-choice-btn--placed",
                  wrongIdx === i && "apply-choice-btn--wrong",
                ].filter(Boolean).join(" ")}
                disabled={answered}
                onClick={() => tapOption(n, i)}
              >
                {n}
              </button>
            )}
          </div>
        ))}
      </div>
      {/* Spells out the connection between the blank above and the tiles
          below in words, not just proximity — mirrors OrderStage's own
          "перетащи число в нужное место" caption for the same reason: two
          separate white cards with a gap between them didn't read as
          "pick one of these to complete that" on their own. Always
          rendered (not just outside the hint) — .compare-body centers its
          content vertically, so showing/hiding this line used to shift
          the whole card + grid up and down every time the hint toggled. */}
      <div className="apply-choice-caption">{hintActive ? "нарисуй знак на каждой плитке" : "выбери число вместо «?»"}</div>
      {!answered && (
        <button type="button" className="apply-hint-btn" onClick={() => setShowHint((v) => !v)}>
          {showHint ? "Скрыть" : "Подсказка"}
        </button>
      )}
    </>
  );
}

// Box/font size as a percentage of the slot's OWN column width (via `cqi` —
// each .apply-order-slot is its own size-container, one equal-width grid
// column of N; see .apply-order-slots in comparison.css) at the smallest
// and largest slot in the staircase. Every slot in between is a linear
// interpolation of these two. Sizing against the column's own width rather
// than the viewport means this needs no separate math per count (3–5,
// picked in ParamsScreen) — N columns already divide the available row
// width evenly, so a bigger N shrinks every slot automatically.
const SLOT_BOX_PCT  = [58, 100]; // cqi
const SLOT_FONT_PCT = [26, 42];  // cqi

function lerp(a, b, t) { return a + (b - a) * t; }

// `t` is this slot's position from 0 (smallest, leftmost) to 1 (largest,
// rightmost) — see the comment on .apply-order-slots in comparison.css.
function slotSizeStyle(t) {
  return {
    width: `clamp(52px, ${lerp(...SLOT_BOX_PCT, t)}cqi, 220px)`,
    fontSize: `clamp(18px, ${lerp(...SLOT_FONT_PCT, t)}cqi, 84px)`,
  };
}

// One slot the child can drop a tile into. `value` is the number already
// placed here (from `placement`), or null while empty. `t` grows the box
// itself (see slotSizeStyle) instead of an ordinal "1st/2nd/3rd" label —
// see the comment on .apply-order-slots in comparison.css.
function OrderSlot({ slotIdx, t, value, wrong }) {
  const { isOver, setNodeRef } = useDroppable({ id: `apply-slot-${slotIdx}`, data: { slotIdx } });
  // A one-shot "settle" bounce the instant this slot goes from empty to
  // filled — tracked locally (not derived from props) because the slot
  // itself never remounts across a drop, only its `value` prop changes.
  const [popping, setPopping] = useState(false);
  const wasFilled = useRef(value != null);
  useEffect(() => {
    if (value != null && !wasFilled.current) {
      setPopping(true);
      const timer = window.setTimeout(() => setPopping(false), 300);
      wasFilled.current = true;
      return () => clearTimeout(timer);
    }
    wasFilled.current = value != null;
  }, [value]);
  const cls = [
    "apply-order-slot-drop",
    value != null && "apply-order-slot-drop--correct",
    isOver && value == null && !wrong && "apply-order-slot-drop--over",
    wrong && "apply-order-slot-drop--wrong",
    popping && "apply-order-slot-drop--pop",
  ].filter(Boolean).join(" ");
  return (
    <div className="apply-order-slot">
      <div ref={setNodeRef} className={cls} style={slotSizeStyle(t)}>{value ?? "?"}</div>
    </div>
  );
}

// One draggable number tile sitting in the tray, before it's been placed.
// Sized to match the SMALLEST staircase slot exactly (slotSizeStyle(0), the
// same t=0 the leftmost slot uses) — a flat size for every tile, not one
// that grows as its neighbors get dragged away. The tray's own column
// count is fixed at the task's original tile count (see OrderStage), so
// this cell is the same width as a slot's cell and the two end up pixel-
// identical, not just proportionally similar.
function OrderTile({ idx, value, disabled }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `apply-tile-${idx}`,
    data: { idx },
    disabled,
  });
  return (
    <div className="apply-order-cell">
      <div
        ref={setNodeRef}
        className="apply-order-tile"
        style={{
          ...slotSizeStyle(0),
          transform: CSS.Translate.toString(transform),
          opacity: isDragging ? 0.35 : 1,
          transition: isDragging ? "none" : "transform 0.15s ease",
          cursor: disabled ? "default" : "grab",
          // Staggered "dealing" entrance, once per fresh task mount — see
          // the .apply-order-tile animation in comparison.css.
          animationDelay: `${idx * 40}ms`,
        }}
        {...listeners}
        {...attributes}
      >
        {value}
      </div>
    </div>
  );
}

// Drag a tile from the tray into one of the labeled slots — a physical
// sort, not a tap-in-order sequence. Any slot can be filled first; each
// drop is checked against its own position in `task.sorted`, so the child
// decides where a number goes rather than always picking "the next one".
function OrderStage({ task, answered, onAnswer }) {
  // placement[tileIdx] = slotIdx once placed, else null.
  const [placement, setPlacement] = useState(() => Array(task.numbers.length).fill(null));
  const [wrongSlotIdx, setWrongSlotIdx] = useState(-1);
  const [activeIdx, setActiveIdx] = useState(-1);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  function handleDragStart({ active }) {
    setActiveIdx(active.data.current.idx);
  }

  function handleDragEnd({ active, over }) {
    setActiveIdx(-1);
    if (!over || answered) return;
    const tileIdx = active.data.current.idx;
    const slotIdx = over.data.current.slotIdx;
    if (placement.includes(slotIdx)) return; // slot already filled — no-op, tile snaps back

    if (task.sorted[slotIdx] !== task.numbers[tileIdx]) {
      setWrongSlotIdx(slotIdx);
      window.setTimeout(() => setWrongSlotIdx(-1), 350);
      onAnswer(false);
      return;
    }

    const next = [...placement];
    next[tileIdx] = slotIdx;
    setPlacement(next);
    if (next.every((v) => v !== null)) onAnswer(true);
  }

  const complete = placement.every((v) => v !== null);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveIdx(-1)}>
      <div
        className={`apply-order-slots${complete ? " apply-order-slots--celebrate" : ""}`}
        style={{ gridTemplateColumns: `repeat(${task.sorted.length}, 1fr)` }}
      >
        {task.sorted.map((_, slotIdx) => {
          const tileIdx = placement.indexOf(slotIdx);
          // Box size must track the MAGNITUDE of the number that belongs in
          // this slot, not raw left-to-right position — task.sorted[0] is
          // the smallest value in "asc" mode but the largest in "desc"
          // mode (engine.js reverses it), so slot 0's box size flips too.
          const raw = task.sorted.length > 1 ? slotIdx / (task.sorted.length - 1) : 0;
          const t = task.direction === "desc" ? 1 - raw : raw;
          return (
            <OrderSlot
              key={slotIdx}
              slotIdx={slotIdx}
              t={t}
              value={tileIdx >= 0 ? task.numbers[tileIdx] : null}
              wrong={wrongSlotIdx === slotIdx}
            />
          );
        })}
      </div>
      <div className="apply-order-tray" style={{ gridTemplateColumns: `repeat(${task.numbers.length}, 1fr)` }}>
        {task.numbers.map((n, idx) => placement[idx] === null
          ? <OrderTile key={idx} idx={idx} value={n} disabled={answered} />
          // A placed tile leaves its own cell in place (not removed from the
          // grid) so the tiles still in the tray keep their original spot
          // and size instead of drifting/growing to fill the gap.
          : <div key={idx} className="apply-order-cell" />
        )}
      </div>
      <div className="apply-order-tray-caption">перетащи число в нужное место</div>
      <DragOverlay dropAnimation={null}>
        {activeIdx >= 0 ? <div className="apply-order-tile apply-order-tile--overlay">{task.numbers[activeIdx]}</div> : null}
      </DragOverlay>
    </DndContext>
  );
}

export default function CompareApply({ task, onCorrect, onIncorrect, playFeedback }) {
  const [answered, setAnswered] = useState(false);

  function handleAnswer(isCorrect) {
    if (answered) return;
    setAnswered(true);
    if (isCorrect) onCorrect(task.conceptId, null);
    else onIncorrect(task.conceptId, null);
  }

  return (
    <div className="compare-body compare-body--apply">
      <div className="apply-kicker">{task.instruction}</div>
      {task.taskType === "order" ? (
        <OrderStage task={task} answered={answered} onAnswer={handleAnswer} />
      ) : (
        <GenerateStage task={task} answered={answered} onAnswer={handleAnswer} playFeedback={playFeedback} />
      )}
    </div>
  );
}
