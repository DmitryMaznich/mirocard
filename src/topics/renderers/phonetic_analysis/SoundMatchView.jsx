import { useState, useCallback } from "react";
import WordPicture from "./WordPicture";

const PICTURE_SIZE = 150;

function BlankWord({ word, blankIndex }) {
  return (
    <div className="pa-blank-word">
      {word.split("").map((ch, i) => (
        <span key={i} className={i === blankIndex ? "pa-blank-slot" : "pa-blank-char"}>
          {i === blankIndex ? "_" : ch}
        </span>
      ))}
    </div>
  );
}

export default function SoundMatchView({ task, topicId, onAdvance, onCorrect, onMistake }) {
  const [states, setStates] = useState({});
  const [done, setDone] = useState(false);

  const handleTap = useCallback((opt, idx) => {
    if (done) return;
    if (opt.isTarget) {
      setStates((s) => ({ ...s, [idx]: "correct" }));
      setDone(true);
      onCorrect?.(task.word, task.word);
      setTimeout(() => onAdvance?.(), 700);
    } else {
      setStates((s) => ({ ...s, [idx]: "wrong" }));
      onMistake?.(task.word, task.word);
      setTimeout(() => setStates((s) => ({ ...s, [idx]: null })), 800);
    }
  }, [done, task, onAdvance, onCorrect, onMistake]);

  return (
    <div className="pa-screen">
      <div className="pa-stimulus">
        <WordPicture topicId={topicId} path={task.image} emoji={task.emoji} size={PICTURE_SIZE} />
        {task.type === "missing_letter" && (
          <BlankWord word={task.word} blankIndex={task.blankIndex} />
        )}
      </div>
      <div className="pa-options">
        {task.options.map((opt, i) => {
          const state = states[i] ?? null;
          const cls = [
            "pa-option",
            state === "correct" ? "pa-option--correct" : "",
            state === "wrong"   ? "pa-option--wrong"   : "",
            done ? "pa-option--disabled" : "",
          ].filter(Boolean).join(" ");
          return (
            <button key={opt.id + i} className={cls} type="button" onClick={() => handleTap(opt, i)}>
              {opt.letter}
            </button>
          );
        })}
      </div>
    </div>
  );
}
