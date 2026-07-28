import { useLayoutEffect, useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { Coin, TenStack } from "./CoinBlocks.jsx";
import { hintDirectionFor } from "./placeValueLabels.js";
import { useFitOneLine } from "./textFit.js";
import "./place_value.css";
import "./coins.css";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

function AnswerSlot({ state, value, hint, slotRef }) {
  const cls = (state ?? "").split(" ").filter(Boolean).map((s) => ` pv-answer-slot--${s}`).join("");
  return (
    <div ref={slotRef} className={`pv-answer-slot${cls}`}>
      {value ?? "?"}
      {hint && <div className="pv-answer-hint">{hint === "more" ? "Больше ↑" : "Меньше ↓"}</div>}
    </div>
  );
}

function rectCenter(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// One flying digit ghost: appended to document.body, animated from `from`
// to `to` in screen coordinates via the Web Animations API, removed and
// `onArrive()` called once it lands — same technique as BuildNumberTask's
// coin-fly-ghost (flyCoinGhost), applied here to the two confirmed digits
// merging into one number once "Сколько единиц?" is answered correctly.
function flyDigitGhost(from, to, text, delayMs, onArrive) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  const ghost = document.createElement("div");
  ghost.className = "pv-digit-ghost";
  ghost.textContent = text;
  ghost.style.left = `${from.x}px`;
  ghost.style.top = `${from.y}px`;
  document.body.appendChild(ghost);

  const anim = ghost.animate(
    [
      { transform: "translate(-50%, -50%) scale(1)", offset: 0 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`, offset: 1 },
    ],
    { duration: 380, delay: delayMs, easing: "cubic-bezier(.35,.6,.4,1)", fill: "forwards" },
  );
  anim.onfinish = () => {
    ghost.remove();
    onArrive();
  };
}

export default function IdentifyNumberTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  // answerTens -> answerOnes -> done. No collect/group phase here (unlike
  // build_number): the tens/ones blocks are already laid out for the child
  // to read, not assembled by them first.
  const [phase, setPhase] = useState("answerTens");
  const [rowWrong, setRowWrong] = useState({ tens: false, ones: false, number: false });
  const [hintDirection, setHintDirection] = useState({ tens: null, ones: null, number: null });
  // The child's in-progress two-digit guess for "Какое это число?" (phase
  // answerNumber) — an array of typed digit strings, max length 2. Not
  // checked against the target until both are in, mirroring the
  // accumulate-then-validate pattern column_addition's own "copy" mode
  // (index.jsx's handleDigit) already uses for its multi-digit answer.
  const [numberInput, setNumberInput] = useState([]);
  // merging: the two real AnswerSlots are hidden and their digits are
  // flying (as ghosts) toward the merged-number spot. merged: the ghosts
  // have arrived and the real two-digit number is shown in their place.
  // Two separate flags (not one) because the real slots must fade out
  // BEFORE the ghosts are measured/spawned, and the merged number must
  // only pop in AFTER both ghosts land — they're never true at once, but
  // collapsing them into one enum wouldn't save anything here.
  const [merging, setMerging] = useState(false);
  const [merged, setMerged] = useState(false);
  const tensSlotRef = useRef(null);
  const onesSlotRef = useRef(null);
  const mergedRef = useRef(null);
  const mergedTensRef = useRef(null);
  const mergedOnesRef = useRef(null);
  const zonesRef = useRef(null);
  // Overrides --cb-scale (normally just a width-based clamp on .cb-screen,
  // 1px on phones up to 2px on tablets) for the coin zones ONLY, so that
  // however many tens/ones a task has (up to 9 and 9 — 0-9 is maxOnes'
  // whole range, and generateIdentifyNumberTask draws tens from the same
  // 1-9 range), and however tall the device actually is, the wrapped
  // TenStack/Coin grid always fits the space .pv-zones is flexed to fill
  // (see .pv-zones--flex-fit in place_value.css) instead of clipping or
  // forcing the screen to scroll.
  const [zoneScale, setZoneScale] = useState(1);

  // Estimates the row count each zone needs at the AMBIENT (unshrunk)
  // scale, then solves for the scale that fits that many rows into the
  // real measured height — a one-pass approximation, not an iterative
  // solver: shrinking a zone can only ever let MORE items fit per row
  // (never fewer), so estimating row count at the larger, ambient scale
  // is always a safe upper bound. The constants below are copied from
  // coins.css's own values (.cb-stack-coin/.cb-coin widths, .cb-ten-stack's
  // padding-top, .pv-zone-body's 14px gap — itself NOT scaled by
  // --cb-scale, inherited unchanged from the pre-coins .pv-zone-body rule)
  // and place_value.css (.pv-zone's 8px vertical padding, .pv-zone-label's
  // ~22px including its own margin) rather than measured live, since the
  // zone is often empty of any *other* sibling to measure against at the
  // moment this needs to run.
  useLayoutEffect(() => {
    const el = zonesRef.current;
    if (!el) return;

    const GAP = 14; // .pv-zone-body's own gap, between items inside one zone
    const ZONES_GAP = 10; // .pv-zones' gap, between the two zone boxes themselves
    const ZONE_CHROME = 40; // 8px*2 padding + ~22px label+margin, rounded up as a safety margin
    const TEN_STACK_W = 34;
    const TEN_STACK_H = 63; // padding-top(6) + first coin(12) + 9 more at a 5px visible sliver each
    const COIN = 30;

    function neededScale(count, itemW, itemH, zoneWidth, availH, ambientScale) {
      if (count === 0) return 2;
      const perRow = Math.max(1, Math.floor((zoneWidth + GAP) / (itemW * ambientScale + GAP)));
      const rows = Math.ceil(count / perRow);
      const fitsAlready = rows * itemH * ambientScale + (rows - 1) * GAP + ZONE_CHROME <= availH;
      if (fitsAlready) return ambientScale;
      return Math.max(0.45, (availH - ZONE_CHROME - (rows - 1) * GAP) / (rows * itemH));
    }

    function compute() {
      const availH = el.clientHeight;
      const availW = el.clientWidth;
      if (availH === 0 || availW === 0) return;

      // Mirrors .cb-screen's own --cb-scale: clamp(1px, 100vw/400, 2px).
      const ambientScale = Math.min(2, Math.max(1, window.innerWidth / 400));
      const zoneWidth = (availW - ZONES_GAP) / 2 - 12; // two zones, .pv-zones' own gap, each zone's 6px*2 padding

      const sTens = neededScale(task.model.tens, TEN_STACK_W, TEN_STACK_H, zoneWidth, availH, ambientScale);
      const sOnes = neededScale(task.model.ones, COIN, COIN, zoneWidth, availH, ambientScale);
      setZoneScale(Math.min(sTens, sOnes));
    }

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [task.model.tens, task.model.ones]);

  // Same shape as BuildNumberTask's flashRowWrong, minus the zone-error
  // callback build_number needs for its drag/drop error zones — this mode
  // only ever flashes a checklist row + its answer slot.
  function flashRowWrong(key, direction) {
    setRowWrong((w) => ({ ...w, [key]: true }));
    setHintDirection((h) => ({ ...h, [key]: direction }));
    onMistake?.(task.conceptId, task.cardId);
    onFlashIncorrect?.();
    setTimeout(() => setRowWrong((w) => ({ ...w, [key]: false })), 500);
    setTimeout(() => setHintDirection((h) => ({ ...h, [key]: null })), 1300);
  }

  // Fires once "Сколько единиц?" is answered correctly: a brief pause on
  // the two confirmed-correct digits, then they fly toward each other and
  // land as one two-digit number — see the approved design in
  // docs/superpowers/specs (place-value visual unification follow-up).
  // Each ghost targets its OWN digit's real position inside the merged
  // number (mergedTensRef / mergedOnesRef — two separate spans, not the
  // shared container's center) — aiming both at one shared center point
  // made them land exactly on top of each other, a visible collide-then-
  // snap-apart glitch the instant the real "23" replaced them. Same
  // "measure the real thing, don't guess" rule flyCoinGhost follows for
  // its own landing spot. Doesn't call onCorrect itself — advancing is now
  // a deliberate tap on "Далее →" (see handleContinue), not an automatic
  // timeout, so the child has as long as they want to look at the result.
  function playMergeAnimation() {
    const tensEl = tensSlotRef.current;
    const onesEl = onesSlotRef.current;
    const targetTensEl = mergedTensRef.current;
    const targetOnesEl = mergedOnesRef.current;
    if (!tensEl || !onesEl || !targetTensEl || !targetOnesEl) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMerging(true);
      setMerged(true);
      return;
    }

    const tensRect = tensEl.getBoundingClientRect();
    const onesRect = onesEl.getBoundingClientRect();
    const targetTensRect = targetTensEl.getBoundingClientRect();
    const targetOnesRect = targetOnesEl.getBoundingClientRect();

    setMerging(true);

    let arrived = 0;
    function onArrive() {
      arrived += 1;
      if (arrived === 2) setMerged(true);
    }
    flyDigitGhost(rectCenter(tensRect), rectCenter(targetTensRect), String(task.model.tens), 0, onArrive);
    flyDigitGhost(rectCenter(onesRect), rectCenter(targetOnesRect), String(task.model.ones), 60, onArrive);
  }

  function handleDigit(d) {
    if (phase === "answerTens") {
      if (d === task.model.tens) {
        setPhase("answerOnes");
      } else {
        flashRowWrong("tens", hintDirectionFor(d, task.model.tens));
      }
      return;
    }
    if (phase === "answerOnes") {
      if (d === task.model.ones) {
        setPhase("answerNumber");
      } else {
        flashRowWrong("ones", hintDirectionFor(d, task.model.ones));
      }
      return;
    }
    if (phase === "answerNumber") {
      const next = [...numberInput, d];
      setNumberInput(next);
      if (next.length < 2) return;
      const guess = Number(next.join(""));
      if (guess === task.model.tens * 10 + task.model.ones) {
        setPhase("done");
        // A short beat on the confirmed-correct digits before they merge —
        // long enough to register "that's right", short enough to still
        // feel like one continuous moment.
        setTimeout(playMergeAnimation, 180);
      } else {
        // Whole-number guess, not a single digit — no directional hint
        // here (unlike tens/ones), just shake and let the child retry.
        // Keeps the wrong guess visible for the same 500ms shake window
        // flashRowWrong already uses elsewhere before clearing it, so the
        // child can see what they typed was wrong, not just a blank flash.
        flashRowWrong("number");
        setTimeout(() => setNumberInput([]), 500);
      }
    }
  }

  function handleContinue() {
    onCorrect(task.conceptId, task.cardId);
  }

  const tensDone = phase === "answerOnes" || phase === "answerNumber" || phase === "done";
  const onesDone = phase === "answerNumber" || phase === "done";
  const tensAnswer = {
    value: tensDone ? task.model.tens : null,
    state: tensDone ? "filled correct" : rowWrong.tens ? "shake" : phase === "answerTens" ? "active" : undefined,
    hint: hintDirection.tens,
  };
  const onesAnswer = {
    value: onesDone ? task.model.ones : null,
    state: onesDone ? "filled correct" : rowWrong.ones ? "shake" : phase === "answerOnes" ? "active" : undefined,
    hint: hintDirection.ones,
  };

  // Guess-row slot state: mirrors tensAnswer/onesAnswer's own single-branch
  // ternary style (never combines "filled" and "shake" on one slot) — a
  // typed-but-unconfirmed digit reads as provisionally filled (blue), a
  // wrong final pair reads as shake (red) regardless of what was typed.
  function numberSlotState(idx) {
    if (rowWrong.number) return "shake";
    return numberInput[idx] != null ? "filled" : undefined;
  }

  // A checklist was overkill for a two-step question: the digit landing in
  // its own slot (above the matching ДЕСЯТКИ/ЕДИНИЦЫ zone) is already the
  // confirmation, so this is just the current prompt — text swaps in
  // place, not a growing list of rows. useFitOneLine re-fits on its own
  // whenever `text` changes (it's in the hook's own dependency array), so
  // one call handles all three phases.
  const questionText = phase === "answerTens" ? "Сколько десятков?"
    : phase === "answerOnes" ? "Сколько единиц?"
    : phase === "answerNumber" ? "Какое это число?"
    : "Правильно!";
  const { ref: questionRef, fontSize: questionFontSize } = useFitOneLine(questionText, { max: 40, min: 16 });

  return (
    <div className="pv-screen cb-screen">
      <div className="pv-instruction">Какое это число?</div>

      <div className={`pv-question${phase === "done" ? " pv-question--correct" : ""}`}>
        <span ref={questionRef} style={{ fontSize: questionFontSize }}>{questionText}</span>
      </div>

      {/* Split into two zone-width columns so each slot centers over its
          own zone below, right under the questions — not a compact pair
          centered on the screen. The merge animation depends on this too:
          the two digits need real horizontal separation to visibly travel
          toward each other once "Сколько единиц?" is answered. */}
      <div className="pv-answer-row pv-answer-row--split">
        <div className="pv-answer-col">
          <AnswerSlot
            slotRef={tensSlotRef}
            state={merging ? "hidden" : tensAnswer.state}
            value={tensAnswer.value}
            hint={tensAnswer.hint}
          />
        </div>
        <div className="pv-answer-col">
          <AnswerSlot
            slotRef={onesSlotRef}
            state={merging ? "hidden" : onesAnswer.state}
            value={onesAnswer.value}
            hint={onesAnswer.hint}
          />
        </div>
        {/* Always rendered with its final text (not just once merged) so
            each digit's real, laid-out position is measurable the moment
            the merge starts — same "measure the real thing, don't guess"
            rule as flyDigitGhost's targets above. Two separate spans (not
            one text node) so each incoming ghost can target its OWN
            digit's spot, landing them adjacent rather than on top of each
            other. --visible is what actually reveals it. */}
        <div ref={mergedRef} className={`pv-merged-number${merged ? " pv-merged-number--visible" : ""}`}>
          <span ref={mergedTensRef}>{task.model.tens}</span><span ref={mergedOnesRef}>{task.model.ones}</span>
        </div>
      </div>

      {/* The third question ("Какое это число?") — the child types the full
          two-digit number here. Rendered as its own row BELOW the tens/ones
          answer row (not overlaid on top of it like .pv-merged-number),
          because unlike the merge animation's target spot — which only
          becomes visible once the tens/ones slots are simultaneously hidden
          — the tens/ones slots stay visibly confirmed (green) throughout
          this phase, so an overlaid guess row would sit right on top of
          them. */}
      {phase === "answerNumber" && (
        <div className="pv-guess-row">
          <AnswerSlot state={numberSlotState(0)} value={numberInput[0] ?? null} />
          <AnswerSlot state={numberSlotState(1)} value={numberInput[1] ?? null} />
        </div>
      )}

      {/* Zone highlight (cb-area--focus) marks which side the currently-
          asked question refers to — same pulse AnswerSlot's own "active"
          state uses, so the question, the zone, and where to type the
          answer are all visually tied together. */}
      <div ref={zonesRef} className="pv-zones pv-zones--flex-fit" style={{ "--cb-scale": `${zoneScale}px` }}>
        <div className={`pv-zone${tensAnswer.state === "active" ? " cb-area--focus" : ""}${phase === "answerNumber" || phase === "done" ? " pv-zone--correct" : ""}`}>
          <div className="pv-zone-label">ДЕСЯТКИ</div>
          <div className="pv-zone-body">
            {Array.from({ length: task.model.tens }, (_, i) => (
              <TenStack key={i} />
            ))}
          </div>
        </div>
        <div className={`pv-zone${onesAnswer.state === "active" ? " cb-area--focus" : ""}${phase === "answerNumber" || phase === "done" ? " pv-zone--correct" : ""}`}>
          <div className="pv-zone-label">ЕДИНИЦЫ</div>
          <div className="pv-zone-body">
            {Array.from({ length: task.model.ones }, (_, i) => (
              <Coin key={i} />
            ))}
          </div>
        </div>
      </div>

      {/* The numpad stays up (disabled) through the merge animation itself
          — swapping it for the button only once `merged` settles avoids a
          layout jump mid-flight, since the button is much shorter than the
          5x2 numpad grid. Advancing is a deliberate tap now, not a timer:
          the child sets the pace for how long they look at the result. */}
      {merged ? (
        <div className="pv-footer">
          <Button variant="secondary" onClick={handleContinue}>Далее →</Button>
        </div>
      ) : (
        <div className="pv-numpad">
          {DIGITS.map((d) => (
            <button key={d} className="pv-numkey" onClick={() => handleDigit(d)} disabled={phase === "done"}>
              {d}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
