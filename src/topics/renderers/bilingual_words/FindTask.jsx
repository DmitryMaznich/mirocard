import { useEffect, useRef, useState } from "react";
import SpeakerTile from "./SpeakerTile";
import CardImage from "./CardImage";
import { useSpeakers, PAIR_GAP_MS } from "./useSpeakers";

// Steps В–Д «Найди». The word sounds (В: home then school; Г, Д: school only),
// the child taps a picture. Prompts escalate while nothing is tapped, each
// after the adult's delay: 1 — the Slovenian word again, 2 — the Russian word
// from home, 3 — the right picture grows and the others fade.
// A wrong tap is never punished with a buzz: the picture fades, the right one
// is shown and the pair «voda — вода» sounds; the child then taps it.
// Answered alone (or after only a repeat) it counts as correct; after the
// Russian prompt, the highlight or a mistake it counts as assisted.
const REPEAT = 1;
const RUSSIAN = 2;
const HIGHLIGHT = 3;

function Star() {
  return (
    <svg className="bw-star" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" fill="#f59e0b" />
    </svg>
  );
}

export default function FindTask({ task, topicId, playTopicFile, onCorrect, onStreakReset }) {
  const { card, options, audioOrder, promptDelaySec } = task;
  const { speaking, startRun } = useSpeakers(topicId, playTopicFile);
  const [phase, setPhase] = useState("stimulus"); // stimulus | await | busy | reveal | correct
  const [level, setLevel] = useState(0);
  const [faded, setFaded] = useState(() => new Set());
  const levelRef = useRef(0);
  const errorsRef = useRef(0);
  const phaseRef = useRef("stimulus");

  const goPhase = (next) => { phaseRef.current = next; setPhase(next); };
  const raiseLevel = (next) => {
    levelRef.current = Math.max(levelRef.current, next);
    setLevel(levelRef.current);
  };

  // The stimulus.
  useEffect(() => {
    const run = startRun();
    (async () => {
      if (audioOrder === "ru_sl") {
        if (!(await run.say("ru", card))) return;
        if (!(await run.pause(PAIR_GAP_MS))) return;
      }
      if (!(await run.say("sl", card))) return;
      if (phaseRef.current === "stimulus") goPhase("await");
    })();
  }, [card, audioOrder, startRun]);

  // The next prompt, when the child has not tapped for a while.
  useEffect(() => {
    if (phase !== "await" || level >= HIGHLIGHT) return undefined;
    const timer = window.setTimeout(async () => {
      const next = levelRef.current + 1;
      raiseLevel(next);
      goPhase("busy");
      const run = startRun();
      const done = await run.say(next === REPEAT || next === HIGHLIGHT ? "sl" : "ru", card);
      if (done && phaseRef.current === "busy") goPhase("await");
    }, Math.max(1, promptDelaySec) * 1000);
    return () => window.clearTimeout(timer);
  }, [phase, level, promptDelaySec, card, startRun]);

  async function sayPair(run) {
    if (!(await run.say("sl", card))) return false;
    if (!(await run.pause(300))) return false;
    return run.say("ru", card);
  }

  async function answerCorrect() {
    goPhase("correct");
    const assisted = errorsRef.current > 0 || levelRef.current >= RUSSIAN;
    const run = startRun();
    if (!(await sayPair(run))) return;
    if (!(await run.pause(400))) return;
    onCorrect?.(task.conceptId, card.id, assisted ? { assisted: true } : undefined);
  }

  async function answerWrong(option) {
    errorsRef.current += 1;
    setFaded(new Set(options.filter((o) => !o.isTarget).map((o) => o.card.id)));
    onStreakReset?.(task.conceptId, option.card.id);
    goPhase("reveal");
    await sayPair(startRun());
  }

  function handleTap(option) {
    if (phaseRef.current === "correct") return;
    if (option.isTarget) { answerCorrect(); return; }
    if (phaseRef.current === "reveal" || faded.has(option.card.id)) return;
    answerWrong(option);
  }

  // School: the Slovenian word again. Home (when Russian is only a prompt):
  // the child asked for the Russian word — that is the same help as prompt 2.
  async function replay(lang) {
    if (phaseRef.current === "correct") return;
    if (lang === "ru" && audioOrder === "sl") raiseLevel(RUSSIAN);
    const resume = phaseRef.current === "reveal" ? "reveal" : "await";
    goPhase("busy");
    const done = await startRun().say(lang, card);
    if (done && phaseRef.current === "busy") goPhase(resume);
  }

  const showAnswer = phase === "reveal" || level >= HIGHLIGHT;
  const homeState = speaking === "ru" ? "speaking" : audioOrder === "sl" ? "hint" : "idle";

  return (
    <div className="session-body bw-stage">
      <SpeakerTile side="home" state={homeState} onTap={() => replay("ru")} />
      <SpeakerTile side="school" state={speaking === "sl" ? "speaking" : "idle"} onTap={() => replay("sl")} />
      <div className={`bw-options bw-options--${options.length}`}>
        {options.map((option) => {
          const isFaded = faded.has(option.card.id) || (showAnswer && !option.isTarget) || (phase === "correct" && !option.isTarget);
          const classes = [
            "bw-opt",
            isFaded ? "bw-opt--faded" : "",
            option.isTarget && showAnswer && phase !== "correct" ? "bw-opt--hint" : "",
            option.isTarget && phase === "correct" ? "bw-opt--correct" : "",
          ].filter(Boolean).join(" ");
          return (
            <button
              key={option.card.id}
              type="button"
              className={classes}
              aria-label={option.card.word?.sl ?? option.card.conceptId}
              onClick={(event) => { event.stopPropagation(); handleTap(option); }}
            >
              <CardImage topicId={topicId} card={option.card} />
              {option.isTarget && phase === "correct" && <Star />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
