import { useState, useRef, useEffect, useCallback } from "react";
import { useSpeech } from "@/shared/hooks/useSpeech";

// Mode 2 "Назови действие": a hand brings an object onto the tray or takes
// one away, and the child names the ACTION (not the resulting state, which
// is mode 1's "больше/меньше"). The hand is the point of the mode — without
// an agent on screen "что сделали?" collapses into a relabelled mode 1.
//
// The verbs match the rest of the topic ladder ("Прибавь"/"Прибавили" in
// modes 3–5), so the child hears one word pair across all modes.

const VERB = { add: "Прибавили", subtract: "Убрали" };
const VERB_QUESTION = { add: "Сколько прибавили?", subtract: "Сколько убрали?" };
const NUMBER_WORDS = ["ноль", "один", "два", "три", "четыре", "пять"];
const TRIP_MOVE_MS = 700;
const SHAPES = ["circle", "square", "triangle"];

function numberWord(n) {
  return NUMBER_WORDS[n] ?? String(n);
}

const SKIN = "#f6c9a8";
const SKIN_LINE = "#d49a78";

// Back of a hand, fingers pointing down; fingertips end at y≈120 of a
// 100-wide coordinate box, the sleeve runs off the top (negative y).
function HandShapes({ grip }) {
  return (
    <>
      <rect x="27" y="-40" width="46" height="66" rx="12" fill="#86b4e6" />
      <rect x="25" y="18" width="50" height="12" rx="6" fill="#6a9fd8" />
      <path d="M29 28 H71 V66 Q71 80 58 82 H42 Q29 80 29 66 Z" fill={SKIN} stroke={SKIN_LINE} strokeWidth="3" strokeLinejoin="round" />
      {grip ? (
        <>
          {/* fingers bent over the object, thumb closing from the side */}
          <rect x="31" y="66" width="11" height="34" rx="5.5" fill={SKIN} stroke={SKIN_LINE} strokeWidth="3" />
          <rect x="41.5" y="68" width="11" height="40" rx="5.5" fill={SKIN} stroke={SKIN_LINE} strokeWidth="3" />
          <rect x="52" y="68" width="11" height="38" rx="5.5" fill={SKIN} stroke={SKIN_LINE} strokeWidth="3" />
          <rect x="62" y="66" width="10" height="30" rx="5" fill={SKIN} stroke={SKIN_LINE} strokeWidth="3" />
          <path d="M32 44 Q16 62 24 112" fill="none" stroke={SKIN_LINE} strokeWidth="14" strokeLinecap="round" />
          <path d="M32 44 Q16 62 24 112" fill="none" stroke={SKIN} strokeWidth="8" strokeLinecap="round" />
        </>
      ) : (
        <>
          {/* open hand: fingers straight and slightly spread */}
          <rect x="28" y="66" width="11" height="40" rx="5.5" fill={SKIN} stroke={SKIN_LINE} strokeWidth="3" transform="rotate(6 33 66)" />
          <rect x="40" y="68" width="11" height="50" rx="5.5" fill={SKIN} stroke={SKIN_LINE} strokeWidth="3" transform="rotate(2 45 68)" />
          <rect x="51" y="68" width="11" height="48" rx="5.5" fill={SKIN} stroke={SKIN_LINE} strokeWidth="3" transform="rotate(-2 56 68)" />
          <rect x="62" y="66" width="10" height="38" rx="5" fill={SKIN} stroke={SKIN_LINE} strokeWidth="3" transform="rotate(-7 67 66)" />
          <path d="M31 44 Q12 58 10 88" fill="none" stroke={SKIN_LINE} strokeWidth="14" strokeLinecap="round" />
          <path d="M31 44 Q12 58 10 88" fill="none" stroke={SKIN} strokeWidth="8" strokeLinecap="round" />
        </>
      )}
    </>
  );
}

function Hand({ grip }) {
  // The CSS lines the bottom edge (fingertips) up with the top part of the
  // carried object.
  return (
    <svg className="name-action__hand-svg" viewBox="0 0 100 120" aria-hidden="true">
      <HandShapes grip={grip} />
    </svg>
  );
}

// Picture for the answer cards: the same hand as in the scene holding an
// object over a tray with an empty place. "Прибавили" — the hand is low,
// about to put the object in, and loops downward; "Убрали" — the hand is
// high, the object already lifted out, and loops upward. Speed marks on the
// side the hand came from keep the direction readable with reduced motion.
const ICON_HAND_SCALE = 0.4;

function ActionIcon({ kind }) {
  const add = kind === "add";
  const dotY = add ? 64 : 40;
  // fingertips (y=120 in hand units) overlap the top of the object (r=10)
  const handTop = dotY - 6 - 120 * ICON_HAND_SCALE;
  return (
    <svg className={`name-action__icon name-action__icon--${kind}`} viewBox="0 -22 120 130" aria-hidden="true">
      <rect x="4" y="78" width="112" height="28" rx="12" fill="#fff" stroke="#b8d9d4" strokeWidth="3" />
      <circle cx="24" cy="92" r="10" fill="#4a9b8f" />
      <circle cx="50" cy="92" r="10" fill="#4a9b8f" />
      <circle cx="84" cy="92" r="10" fill="none" stroke="#9cc3bd" strokeWidth="2.5" strokeDasharray="4 4" />
      <g className="name-action__icon-hand">
        <g stroke="#9cc3bd" strokeWidth="3.5" strokeLinecap="round">
          {add ? (
            <>
              <line x1="62" y1="4" x2="62" y2="24" />
              <line x1="106" y1="4" x2="106" y2="24" />
            </>
          ) : (
            <>
              <line x1="62" y1="54" x2="62" y2="72" />
              <line x1="106" y1="54" x2="106" y2="72" />
            </>
          )}
        </g>
        <circle cx="84" cy={dotY} r="10" fill="#4a9b8f" />
        <svg
          x={84 - 50 * ICON_HAND_SCALE}
          y={handTop - 40 * ICON_HAND_SCALE}
          width={100 * ICON_HAND_SCALE}
          height={160 * ICON_HAND_SCALE}
          viewBox="0 -40 100 160"
          overflow="visible"
        >
          <HandShapes grip />
        </svg>
      </g>
    </svg>
  );
}

export default function NameActionTask({ task, onCorrect, onIncorrect, playFeedback, soundEnabled }) {
  const shape = SHAPES.includes(task.shape) ? task.shape : "circle";
  const isVoice = task.answerMode === "voice";
  const [railCount, setRailCount] = useState(task.start);
  const [hiddenIndex, setHiddenIndex] = useState(-1);
  const [hand, setHand] = useState({ x: 0, y: 0, visible: false, grip: false, carrying: false, instant: true });
  const [dotSize, setDotSize] = useState(null);
  // "demo" → "verb" → ("count") → "done"; the scene only keeps the tall
  // hand zone above the tray while the hand is actually moving.
  const [phase, setPhase] = useState("demo");
  const [verbSolved, setVerbSolved] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const sceneRef = useRef(null);
  const railRef = useRef(null);
  const timersRef = useRef([]);
  const { speak, cancel } = useSpeech();

  const clearSequence = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const schedule = useCallback((callback, delay) => {
    const timer = setTimeout(callback, delay);
    timersRef.current.push(timer);
    return timer;
  }, []);

  const say = useCallback((text) => {
    if (soundEnabled) speak(text, { rate: 0.82 });
  }, [soundEnabled, speak]);

  const measureSlot = useCallback((index) => {
    const scene = sceneRef.current;
    const slot = railRef.current?.children[index];
    if (!scene || !slot) return null;
    const sceneRect = scene.getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();
    return {
      x: slotRect.left + slotRect.width / 2 - sceneRect.left,
      y: slotRect.top + slotRect.height / 2 - sceneRect.top,
      size: slotRect.width * 0.76,
    };
  }, []);

  // One trip of the hand. Returns the time the next trip may start.
  const scheduleTrip = useCallback((slotIndex, countBefore, t0) => {
    const add = task.operation === "add";
    let entry = null;

    schedule(() => {
      const slot = measureSlot(slotIndex);
      if (!slot) return;
      entry = slot;
      setDotSize(slot.size);
      // "Add" arrives from above the tray already carrying the object;
      // "remove" comes down with an empty open hand. Both move vertically so
      // the hand never leaves the stage sideways on narrow phones.
      setHand({ x: slot.x, y: -slot.size * 0.4, visible: false, grip: add, carrying: add, instant: true });
    }, t0);
    schedule(() => {
      if (!entry) return;
      setHand({ x: entry.x, y: entry.y, visible: true, grip: add, carrying: add, instant: false });
    }, t0 + 60);
    schedule(() => {
      if (add) {
        setRailCount(countBefore + 1);
        setHand((h) => ({ ...h, grip: false, carrying: false }));
      } else {
        setHiddenIndex(slotIndex);
        setHand((h) => ({ ...h, grip: true, carrying: true }));
      }
    }, t0 + 60 + TRIP_MOVE_MS + 220);
    schedule(() => {
      if (!entry) return;
      setHand((h) => ({ ...h, x: entry.x, y: -entry.size * 0.4 }));
    }, t0 + 60 + TRIP_MOVE_MS + 520);
    schedule(() => {
      setHand((h) => ({ ...h, visible: false }));
      if (!add) {
        setRailCount(countBefore - 1);
        setHiddenIndex(-1);
      }
    }, t0 + 60 + TRIP_MOVE_MS * 2 + 380);
    return t0 + 60 + TRIP_MOVE_MS * 2 + 700;
  }, [measureSlot, schedule, task.operation]);

  const startSequence = useCallback(({ keepVerb = false } = {}) => {
    clearSequence();
    cancel();
    setPhase("demo");
    setFeedback(null);
    setRailCount(task.start);
    setHiddenIndex(-1);
    setHand((h) => ({ ...h, visible: false, instant: true }));
    if (!keepVerb) setVerbSolved(false);

    schedule(() => say(`Было ${numberWord(task.start)}.`), 80);
    // Leave the tall hand zone time to open (CSS transition) before the
    // first slot is measured.
    let t = 1500;
    let count = task.start;
    for (let trip = 0; trip < task.delta; trip += 1) {
      const slotIndex = task.operation === "add" ? count : count - 1;
      t = scheduleTrip(slotIndex, count, t);
      count += task.operation === "add" ? 1 : -1;
    }
    schedule(() => {
      if (keepVerb) {
        setPhase("count");
        say(VERB_QUESTION[task.operation]);
      } else {
        setPhase("verb");
        say(isVoice ? "Что сделали? Скажи." : "Что сделали?");
      }
    }, t + 300);
  }, [cancel, clearSequence, isVoice, say, schedule, scheduleTrip, task.delta, task.operation, task.start]);

  useEffect(() => {
    const startTimer = schedule(() => startSequence(), 0);
    return () => {
      clearTimeout(startTimer);
      clearSequence();
      cancel();
    };
  }, [cancel, clearSequence, schedule, startSequence]);

  function finish() {
    setPhase("done");
    playFeedback?.("correct");
    const amount = task.countStep ? ` ${numberWord(task.delta)}` : "";
    say(`Правильно. ${VERB[task.operation]}${amount}. Было ${numberWord(task.start)}, стало ${numberWord(task.result)}.`);
    // Let the full "было — стало" phrase play before the session moves on
    // (unmounting cancels speech).
    schedule(() => onCorrect(task.conceptId, task.cardId), soundEnabled ? 3200 : 900);
  }

  function handleVerb(value) {
    if (phase !== "verb" || feedback) return;
    if (value !== task.operation) {
      setFeedback({ step: "verb", value, kind: "wrong" });
      say("Посмотри ещё раз.");
      onIncorrect(task.conceptId, task.cardId);
      schedule(() => startSequence(), 1100);
      return;
    }
    setFeedback({ step: "verb", value, kind: "correct" });
    if (!task.countStep) {
      finish();
      return;
    }
    schedule(() => {
      setVerbSolved(true);
      setFeedback(null);
      setPhase("count");
      say(VERB_QUESTION[task.operation]);
    }, 700);
  }

  function handleCount(value) {
    if (phase !== "count" || feedback) return;
    if (value !== task.delta) {
      setFeedback({ step: "count", value, kind: "wrong" });
      say("Посчитай ещё раз.");
      onIncorrect(task.conceptId, task.cardId);
      // Show the trips again so the child can count them, then ask only
      // "сколько?" — the verb is already named.
      schedule(() => startSequence({ keepVerb: true }), 1100);
      return;
    }
    setFeedback({ step: "count", value, kind: "correct" });
    finish();
  }

  function handleAdultRetry() {
    onIncorrect(task.conceptId, task.cardId);
    startSequence();
  }

  const handDot = dotSize ?? 48;
  const expectedPhrase = `«${VERB[task.operation]}${task.countStep ? ` ${numberWord(task.delta)}` : ""}»`;
  const asking = phase === "verb" || phase === "count" || phase === "done";

  return (
    <div className="operation-stage operation-stage--observe operation-stage--name-action">
      <div className="observe-change name-action">
        <div
          ref={sceneRef}
          className={`name-action__scene${phase === "demo" ? "" : " name-action__scene--settled"}`}
          style={{ "--na-dot": `${handDot}px` }}
        >
          <div
            className={`name-action__hand${hand.visible ? " name-action__hand--visible" : ""}${hand.instant ? " name-action__hand--instant" : ""}`}
            style={{ transform: `translate(${hand.x}px, ${hand.y}px)` }}
            aria-hidden="true"
          >
            {hand.carrying && <span className={`name-action__carried observe-change__dot observe-change__dot--${shape}`} />}
            <Hand grip={hand.grip} />
          </div>
          <div className="name-action__tray">
            <div
              ref={railRef}
              className="observe-change__rail"
              style={{ "--observe-slots": task.maxNumber }}
              aria-label={`Количество: ${railCount}`}
            >
              {Array.from({ length: task.maxNumber }, (_, index) => (
                <div key={index} className="observe-change__slot">
                  {index < railCount && (
                    <span className={`observe-change__dot observe-change__dot--${shape}${index === hiddenIndex ? " name-action__dot--taken" : ""}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {!isVoice && (
          <div className="observe-change__controls">
            <button
              type="button"
              className="observe-change__repeat"
              onClick={() => startSequence({ keepVerb: verbSolved })}
              disabled={phase === "done"}
              aria-label="Показать ещё раз"
            >↻</button>
          </div>
        )}

        <p className={`name-action__prompt${asking ? " name-action__prompt--visible" : ""}`}>
          {phase === "count" || (phase === "done" && task.countStep)
            ? VERB_QUESTION[task.operation]
            : isVoice ? "Что сделали? Скажи!" : "Что сделали?"}
        </p>

        {isVoice ? (
          <div className={`name-action__adult${asking && phase !== "done" ? " name-action__adult--visible" : ""}`} aria-hidden={!asking}>
            <div className="name-action__adult-text">
              Для взрослого — ребёнок сказал:
              <strong>{expectedPhrase}</strong>
            </div>
            <button type="button" className="name-action__adult-btn name-action__adult-btn--retry" onClick={handleAdultRetry} disabled={phase !== "verb"} aria-label="Нет, показать ещё раз">↻</button>
            <button type="button" className="name-action__adult-btn name-action__adult-btn--ok" onClick={finish} disabled={phase !== "verb"} aria-label="Да, сказал верно">✓</button>
          </div>
        ) : (
          <div
            className={`observe-change__answer-area${asking ? " observe-change__answer-area--visible" : ""}`}
            aria-hidden={!asking}
          >
            {phase === "count" || (phase === "done" && task.countStep) ? (
              <div className="name-action__count-step">
                <div className="name-action__count">
                  {task.countOptions.map((n) => {
                    const state = feedback?.step === "count" && feedback.value === n ? feedback.kind : null;
                    return (
                      <button
                        key={n}
                        type="button"
                        className={`observe-change__answer name-action__answer${state === "correct" ? " observe-change__answer--correct" : ""}${state === "wrong" ? " name-action__answer--wrong" : ""}`}
                        onClick={() => handleCount(n)}
                        disabled={phase !== "count" || Boolean(feedback)}
                      >{n}</button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="observe-change__answers">
                {["add", "subtract"].map((value) => {
                  const state = feedback?.step === "verb" && feedback.value === value ? feedback.kind : null;
                  return (
                    <button
                      key={value}
                      type="button"
                      className={`observe-change__answer name-action__answer name-action__answer--verb${state === "correct" ? " observe-change__answer--correct" : ""}${state === "wrong" ? " name-action__answer--wrong" : ""}`}
                      onClick={() => handleVerb(value)}
                      disabled={phase !== "verb" || Boolean(feedback)}
                      aria-label={VERB[value]}
                    >
                      <ActionIcon kind={value} />
                      <span>{VERB[value]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
