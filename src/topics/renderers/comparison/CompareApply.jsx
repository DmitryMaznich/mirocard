import { useEffect, useRef, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

const SIGN_CHAR    = { less: "<", equal: "=", more: ">" };
const SIGN_OPTIONS = [
  { value: "less",  label: "Меньше", sign: "<" },
  { value: "equal", label: "Равно",  sign: "=" },
  { value: "more",  label: "Больше", sign: ">" },
];

// Earlier versions of this stage asked the child to find a number
// satisfying an open condition ("? > 36") in one shot — a jump straight to
// searching for an unknown, several rungs harder than anything earlier in
// the ladder. Live feedback: a child who reliably signs two GIVEN numbers
// (~90% of the time) still went blank facing that abstraction. This
// decomposes the search into the skill he already has — judge ONE
// candidate against the task's reference number at a time, using the exact
// same sign-picking mechanic as CompareFirstNumber's own MultiMode — and
// only reveals which candidate satisfies the original question as a
// summary once every pair is judged, tying the drilled skill back to it
// instead of asking for a fresh guess.
function GenerateStage({ task, onCorrect, onMistake, onAdvance, playFeedback }) {
  const items = task.options.map((n) => ({
    left: n,
    question: n === task.value ? "equal" : n < task.value ? "less" : "more",
  }));
  // engine.js guarantees exactly one option satisfies task.op (see
  // generateApplyGenerateTask) — this is that one, revealed in the summary.
  const matchIdx = items.findIndex((it) => it.question === task.op);

  const [answers,    setAnswers]    = useState(() => Array(items.length).fill(null));
  const [focusIndex, setFocusIndex] = useState(0);
  const [wrongFlash, setWrongFlash] = useState(-1);
  const allDone = focusIndex >= items.length;
  const doneRef = useRef(false);

  function handleSign(value) {
    if (doneRef.current) return;
    const item = items[focusIndex];
    if (value !== item.question) {
      setWrongFlash(focusIndex);
      onMistake?.(task.conceptId, null);
      window.setTimeout(() => setWrongFlash(-1), 420);
      return;
    }
    playFeedback?.("correct");
    const next = [...answers];
    next[focusIndex] = value;
    setAnswers(next);
    const nextFocus = focusIndex + 1;
    setFocusIndex(nextFocus);
    if (nextFocus >= items.length) {
      doneRef.current = true;
      onCorrect(task.conceptId, null);
    }
  }

  function signClass(i) {
    const b = "cfn-multi-sign";
    if (wrongFlash === i)   return `${b} ${b}--wrong`;
    if (answers[i] != null) return `${b} ${b}--done`;
    if (focusIndex === i)   return `${b} ${b}--active`;
    return b;
  }

  return (
    <>
      <div className="cfn-multi" style={{ "--multi-count": items.length }}>
        {items.map((item, i) => (
          <div key={i} className={`cfn-multi-row${focusIndex === i ? " cfn-multi-row--active" : ""}`}>
            <div className="cfn-multi-num">{item.left}</div>
            <div className={signClass(i)}>
              {answers[i] != null ? SIGN_CHAR[answers[i]] : focusIndex === i ? "?" : ""}
            </div>
            <div className="cfn-multi-num">{task.value}</div>
          </div>
        ))}
      </div>
      {allDone ? (
        <button type="button" className="apply-multi-summary" onClick={(e) => { e.stopPropagation(); onAdvance(); }}>
          Значит, <strong>{task.op === "more" ? "больше" : "меньше"} {task.value}</strong> — это число {items[matchIdx].left}!
        </button>
      ) : (
        <>
          <div className="cfn-multi-divider" />
          <div className="cfn-options">
            {SIGN_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" className="cfn-btn" onClick={() => handleSign(opt.value)}>
                <span className="cfn-btn-sign">{opt.sign}</span>
                <span className="cfn-btn-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </>
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

export default function CompareApply({ task, onCorrect, onIncorrect, onMistake, onAdvance, playFeedback }) {
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
        <GenerateStage task={task} onCorrect={onCorrect} onMistake={onMistake} onAdvance={onAdvance} playFeedback={playFeedback} />
      )}
    </div>
  );
}
