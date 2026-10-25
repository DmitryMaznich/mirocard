import { useRef, useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

function WordImage({ topicId, word }) {
  const url = useTopicFile(topicId, word?.image);
  return url ? <img src={url} alt="" draggable={false} /> : <span className="lb-img-loading" />;
}

// Shared by every choice task: a wrong tap fades that option (no buzz) and
// highlights the right one; the child then taps it, and that counts as help.
function useChoice(options, onRight) {
  const [faded, setFaded] = useState(() => new Set());
  const [hint, setHint] = useState(false);
  const [done, setDone] = useState(null);
  const errors = useRef(0);
  const tap = (index, onWrong) => {
    if (done !== null || faded.has(index)) return;
    if (options[index].ok) {
      setDone(index);
      onRight(errors.current === 0);
      return;
    }
    errors.current += 1;
    setFaded((prev) => new Set(prev).add(index));
    setHint(true);
    onWrong?.();
  };
  const classFor = (index) => [
    "lb-opt",
    done !== null && done !== index ? "lb-opt--faded" : "",
    faded.has(index) ? "lb-opt--faded lb-opt--shake" : "",
    done === index ? "lb-opt--correct" : "",
    done === null && hint && options[index].ok ? "lb-opt--hint" : "",
  ].filter(Boolean).join(" ");
  return { tap, classFor };
}

function report(onCorrect, conceptId, cardId, alone) {
  onCorrect?.(conceptId, cardId, alone ? undefined : { assisted: true });
}

function TrapTag() {
  return <span className="lb-trap-tag">ЛОВУШКА</span>;
}

// Fixed places for the whole topic: home (Russian) on the left, school
// (Slovenian) on the right. The labels are Russian on purpose: the child
// reads Russian, not Slovenian yet.
function HomeIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M6 23 24 8l18 15" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 20v20h26V20" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
      <rect x="20" y="28" width="8" height="12" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function SchoolIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 4v8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 4h9l-2 3 2 3h-9" fill="currentColor" />
      <path d="M8 22 24 12l16 10" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 21v19h26V21" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
      <rect x="15" y="25" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="28" y="25" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="21" y="32" width="6" height="8" rx="1" fill="currentColor" />
    </svg>
  );
}

function PlaceLabel({ side }) {
  const home = side === "ru";
  return (
    <span className={`lb-place lb-place--${side}`}>
      <span className="lb-place__icon">{home ? <HomeIcon /> : <SchoolIcon />}</span>
      <span>{home ? "Дома" : "В школе"}</span>
      <span className="lb-place__lang">{home ? "по-русски" : "по-словенски"}</span>
    </span>
  );
}

// The child moves on by tapping the new (Slovenian) letter, so the eye and the
// finger end on it; «Дальше» stays small, for the adult.
export function PairTask({ task, mode, onAdvance }) {
  const { card } = task;
  const isTrap = Boolean(mode?.twins?.[card.sl]);
  const [tapped, setTapped] = useState(false);
  const next = async (event) => {
    event.stopPropagation();
    if (tapped) return;
    setTapped(true);
    await wait(500);
    onAdvance?.();
  };
  return (
    <div className="session-body lb-stage">
      <div className="lb-pair">
        <div className="lb-pair__col">
          <PlaceLabel side="ru" />
          <div className="lb-card lb-card--ru lb-card--big">{card.ru}</div>
        </div>
        <span className="lb-eq">=</span>
        <div className="lb-pair__col">
          <PlaceLabel side="sl" />
          <button
            type="button"
            aria-label={card.sl}
            className={`lb-card lb-card--sl lb-card--big lb-card--tap lb-appear${isTrap ? " lb-card--trap" : ""}${tapped ? " lb-card--tapped" : ""}`}
            onClick={next}
          >
            {card.sl}
          </button>
        </div>
      </div>
      <button type="button" className="lb-skip" onClick={(event) => { event.stopPropagation(); onAdvance?.(); }}>Дальше</button>
    </div>
  );
}

function LetterChoice({ task, stimulus, stimulusClass, options, optionClass, onCorrect, onStreakReset }) {
  const { tap, classFor } = useChoice(options, async (alone) => {
    await wait(1100);
    report(onCorrect, task.conceptId, task.card?.id ?? task.cardId, alone);
  });
  return (
    <div className="session-body lb-stage">
      <div className={`lb-card lb-card--mid ${stimulusClass}`}>{stimulus}</div>
      <div className="lb-opts">
        {options.map((option, index) => (
          <button
            key={`${option.text}-${index}`}
            type="button"
            className={`${classFor(index)} ${optionClass}`}
            aria-label={option.text}
            onClick={(event) => { event.stopPropagation(); tap(index, () => onStreakReset?.(task.conceptId, task.card?.id ?? task.cardId)); }}
          >
            {option.text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FindTask(props) {
  const { task } = props;
  const fromSl = task.dir !== "ru_sl";
  const options = task.options.map((card) => ({ text: fromSl ? card.ru : card.sl, ok: card.sl === task.card.sl }));
  return (
    <LetterChoice
      {...props}
      stimulus={fromSl ? task.card.sl : task.card.ru}
      stimulusClass={fromSl ? "lb-card--sl" : "lb-card--ru"}
      options={options}
      optionClass={fromSl ? "lb-opt--ru" : "lb-opt--sl"}
    />
  );
}

export function TrapTask(props) {
  const { task } = props;
  return (
    <LetterChoice
      {...props}
      stimulus={<>{task.card.sl}<TrapTag /></>}
      stimulusClass="lb-card--sl lb-card--trap"
      options={task.options}
      optionClass="lb-opt--ru"
    />
  );
}

export function SyllableTask(props) {
  const { task } = props;
  return <LetterChoice {...props} stimulus={task.syl} stimulusClass="lb-card--sl lb-card--wide" options={task.options} optionClass="lb-opt--ru lb-opt--wide" />;
}

// Words read alone, per child and word, on this device: the auto hint fades with it.
const readsKey = (student) => `letter-bridge:reads:${student?.id ?? "anon"}`;
function loadReads(student) {
  try { return JSON.parse(window.localStorage.getItem(readsKey(student)) ?? "{}"); } catch { return {}; }
}
function saveRead(student, wordId) {
  try {
    const reads = loadReads(student);
    reads[wordId] = (reads[wordId] ?? 0) + 1;
    window.localStorage.setItem(readsKey(student), JSON.stringify(reads));
  } catch { /* the hint simply stays brighter */ }
}

export function WordTask({ task, topicId, student, playTopicFile, onCorrect, onStreakReset }) {
  const [level] = useState(() => {
    if (task.hint !== "auto") return task.hint;
    const n = loadReads(student)[task.word.id] ?? 0;
    return n >= 4 ? "none" : n >= 2 ? "faint" : "bright";
  });
  const [revealed, setRevealed] = useState(false);
  const { tap, classFor } = useChoice(task.options, async (alone) => {
    setRevealed(true);
    if (alone) saveRead(student, task.word.id);
    await Promise.all([playTopicFile?.(topicId, task.word.audio), wait(900)]);
    report(onCorrect, task.conceptId, task.word.id, alone);
  });
  const opacity = revealed || level === "bright" ? 0.85 : level === "faint" ? 0.3 : 0;
  return (
    <div className="session-body lb-stage">
      <div className="lb-word">
        <div className="lb-card lb-card--sl lb-card--word">{task.word.sl}</div>
        <div className="lb-translit" style={{ opacity }}>{task.translit}</div>
      </div>
      <div className="lb-opts">
        {task.options.map((option, index) => (
          <button
            key={option.word.id}
            type="button"
            className={`${classFor(index)} lb-opt--pic`}
            aria-label={option.word.sl}
            onClick={(event) => { event.stopPropagation(); tap(index, () => onStreakReset?.(task.conceptId, option.word.id)); }}
          >
            <WordImage topicId={topicId} word={option.word} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function BuildTask({ task, topicId, playTopicFile, onCorrect, onStreakReset }) {
  const target = [...task.word.sl];
  const [filled, setFilled] = useState(0);
  const [used, setUsed] = useState(() => new Set());
  const [shaking, setShaking] = useState(null);
  const errors = useRef(0);

  async function tapTile(index) {
    if (filled >= target.length || used.has(index)) return;
    if (task.tiles[index] !== target[filled]) {
      errors.current += 1;
      setShaking(null);
      window.requestAnimationFrame(() => setShaking(index));
      onStreakReset?.(task.conceptId, task.word.id);
      return;
    }
    setUsed((prev) => new Set(prev).add(index));
    const next = filled + 1;
    setFilled(next);
    if (next === target.length) {
      await Promise.all([playTopicFile?.(topicId, task.word.audio), wait(900)]);
      report(onCorrect, task.conceptId, task.word.id, errors.current === 0);
    }
  }

  return (
    <div className="session-body lb-stage">
      <div className="lb-cue">
        <span className="lb-cue__img"><WordImage topicId={topicId} word={task.word} /></span>
        <div className="lb-card lb-card--ru lb-card--cue">{task.word.ru}</div>
      </div>
      <div className="lb-slots">
        {target.map((letter, index) => (
          <div key={index} className={`lb-slot${index < filled ? " lb-slot--filled" : ""}`}>{index < filled ? letter : ""}</div>
        ))}
      </div>
      <div className="lb-tray">
        {task.tiles.map((letter, index) => (
          <button
            key={index}
            type="button"
            className={`lb-tile${shaking === index ? " lb-tile--shake" : ""}`}
            disabled={used.has(index)}
            aria-label={letter}
            onClick={(event) => { event.stopPropagation(); tapTile(index); }}
          >
            {letter}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NeedMoreTask({ task, onAdvance }) {
  return (
    <div className="session-body lb-stage">
      <p className="lb-need-more">{task.text}</p>
      <button type="button" className="lb-next" onClick={(event) => { event.stopPropagation(); onAdvance?.(); }}>Понятно</button>
    </div>
  );
}
