import { useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { Coin, TenStack } from "./CoinBlocks.jsx";
import { hintDirectionFor, placeValueSentence } from "./placeValueLabels.js";
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

      {/* The outer flex-fit div grows to fill whatever vertical space is
          left (used by .pv-recap-fit below) but never SHRINKS the zones
          to fit — no scale computation happens here anymore, coins/stacks
          render at the same ambient --cb-scale every other place-value
          screen uses. If the two zones (plus everything above them) are
          taller than the viewport, .pv-screen's own overflow-y:auto
          scrolls the whole page rather than squeezing the coins smaller.
          align-items:flex-start pins the (equal-height, see .pv-zones-row
          below) pair to the top of that space, it doesn't stretch them to
          fill it. No zone highlight during answerTens/answerOnes anymore —
          only the answer slot itself (AnswerSlot's own "active" pulse)
          marks which question is current, the coin zones stay neutral. */}
      <div className="pv-zones pv-zones--flex-fit">
        {/* Equal-height pair: align-items:stretch here (not on the outer
            flex-fit div) makes the two zones match each other's height —
            a TenStack is naturally taller than a single Coin, so ДЕСЯТКИ
            and ЕДИНИЦЫ would otherwise end at different heights even
            though each is always exactly one un-wrapped row now (see
            .pv-zone-body's flex-wrap:nowrap). This inner row is itself
            only as tall as that content needs (not stretched to the
            outer's full available height). */}
        <div className="pv-zones-row">
          <div className={`pv-zone${phase === "answerNumber" || phase === "done" ? " pv-zone--correct" : ""}`}>
            <div className="pv-zone-label">ДЕСЯТКИ</div>
            <div className="pv-zone-body">
              {Array.from({ length: task.model.tens }, (_, i) => (
                <TenStack key={i} />
              ))}
            </div>
          </div>
          <div className={`pv-zone${phase === "answerNumber" || phase === "done" ? " pv-zone--correct" : ""}`}>
            <div className="pv-zone-label">ЕДИНИЦЫ</div>
            <div className="pv-zone-body">
              {Array.from({ length: task.model.ones }, (_, i) => (
                <Coin key={i} />
              ))}
            </div>
          </div>
        </div>

        {/* Closes the loop back from the assembled number to the tens/ones
            it came from — read aloud together by the child and the adult
            (no TTS on this screen, by design). Lives inside the same
            flex-fit box the zones do (not a sibling after it) because the
            leftover room below the zones IS inside that box — this just
            claims the space .pv-zones-row doesn't use instead of leaving
            it blank. Only appears once merged (not the instant
            phase becomes "done"), same gate .pv-merged-number itself
            uses, so it doesn't show up while the digits are still
            mid-flight. */}
        {merged && (
          <div className="pv-recap-fit">
            <div className="pv-recap">{placeValueSentence(task.model.tens, task.model.ones, task.number)}</div>
          </div>
        )}
      </div>

      {/* The third question ("Какое это число?") — the child types the full
          two-digit number here, below the coin zones (not between the
          tens/ones answer row and the zones — that used to push the zones
          down away from their answer slots whenever this phase was
          active). */}
      {phase === "answerNumber" && (
        <div className="pv-guess-row">
          <AnswerSlot state={numberSlotState(0)} value={numberInput[0] ?? null} />
          <AnswerSlot state={numberSlotState(1)} value={numberInput[1] ?? null} />
        </div>
      )}

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
