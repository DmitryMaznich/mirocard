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

export function PairTask({ task, mode, onAdvance }) {
  const { card } = task;
  const isTrap = Boolean(mode?.twins?.[card.sl]);
  return (
    <div className="session-body lb-stage">
      <div className="lb-pair">
        <div className="lb-pair__col">
          <span className="lb-label lb-label--ru">ПО-РУССКИ</span>
          <div className="lb-card lb-card--ru lb-card--big">{card.ru}</div>
        </div>
        <span className="lb-eq">=</span>
        <div className="lb-pair__col">
          <span className="lb-label lb-label--sl">PO SLOVENSKO</span>
          <div className={`lb-card lb-card--sl lb-card--big lb-appear${isTrap ? " lb-card--trap" : ""}`}>
            {card.sl}
            {isTrap && <TrapTag />}
          </div>
        </div>
      </div>
      <button type="button" className="lb-next" onClick={(event) => { event.stopPropagation(); onAdvance?.(); }}>Дальше</button>
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
