import { useState, useCallback } from "react";
import HandwrittenLetter from "./HandwrittenLetter";
import PrintedLetter     from "./PrintedLetter";

const STIMULUS_SIZE = 130;
const OPTION_SIZE   = 80;

function Stimulus({ task }) {
  if (task.type === "match_print_to_written") {
    return (
      <div className="wl-stimulus">
        <div className="wl-letter-card">
          <PrintedLetter letter={task.stimulus.printed} size={STIMULUS_SIZE} />
        </div>
      </div>
    );
  }
  // match_written_to_print: show handwritten stimulus
  // match_pair:             show handwritten uppercase stimulus
  return (
    <div className="wl-stimulus">
      <div className="wl-letter-card wl-letter-card--lines">
        <HandwrittenLetter letter={task.stimulus.letter} size={STIMULUS_SIZE} />
      </div>
    </div>
  );
}

function Option({ opt, state, onTap, taskType }) {
  const cls = [
    "wl-option",
    state === "correct"  ? "wl-option--correct"  : "",
    state === "wrong"    ? "wl-option--wrong"     : "",
    state ? "wl-option--disabled" : "",
  ].filter(Boolean).join(" ");

  // match_written_to_print → show printed options
  // match_print_to_written / match_pair → show handwritten options
  const inner = taskType === "match_written_to_print"
    ? <PrintedLetter letter={opt.printed} size={OPTION_SIZE} />
    : <div className="wl-letter-card--lines" style={{ padding: "4px 8px", borderRadius: 8 }}>
        <HandwrittenLetter letter={opt.letter} size={OPTION_SIZE} />
      </div>;

  return (
    <button className={cls} onClick={onTap} type="button">
      {inner}
    </button>
  );
}

export default function MatchView({ task, onAdvance, onCorrect, onMistake }) {
  const [states, setStates] = useState({});
  const [done,   setDone]   = useState(false);

  const handleTap = useCallback((opt, idx) => {
    if (done) return;
    if (opt.isTarget) {
      setStates((s) => ({ ...s, [idx]: "correct" }));
      setDone(true);
      onCorrect?.(task.stimulus?.printed ?? task.stimulus?.letter ?? "?", "correct");
      setTimeout(() => onAdvance?.(), 700);
    } else {
      setStates((s) => ({ ...s, [idx]: "wrong" }));
      onMistake?.(task.stimulus?.printed ?? task.stimulus?.letter ?? "?", "wrong");
      setTimeout(() => setStates((s) => ({ ...s, [idx]: null })), 800);
    }
  }, [done, task, onAdvance, onCorrect, onMistake]);

  return (
    <div className="wl-screen">
      <Stimulus task={task} />
      <div className="wl-options">
        {(task.options ?? []).map((opt, i) => (
          <Option
            key={(opt.id ?? opt.letter) + i}
            opt={opt}
            state={states[i] ?? null}
            taskType={task.type}
            onTap={() => handleTap(opt, i)}
          />
        ))}
      </div>
    </div>
  );
}
