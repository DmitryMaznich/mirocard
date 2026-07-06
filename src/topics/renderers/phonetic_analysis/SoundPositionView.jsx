import { useState, useCallback } from "react";
import WordPicture from "./WordPicture";

const PICTURE_SIZE = 150;

const ZONES = [
  { id: "start",  label: "Начало" },
  { id: "middle", label: "Середина" },
  { id: "end",    label: "Конец" },
];

export default function SoundPositionView({ task, topicId, onAdvance, onCorrect, onMistake }) {
  const [states, setStates] = useState({});
  const [done, setDone] = useState(false);

  const handleTap = useCallback((zoneId) => {
    if (done) return;
    if (zoneId === task.correctPosition) {
      setStates((s) => ({ ...s, [zoneId]: "correct" }));
      setDone(true);
      onCorrect?.(task.word, task.word);
      setTimeout(() => onAdvance?.(), 700);
    } else {
      setStates((s) => ({ ...s, [zoneId]: "wrong" }));
      onMistake?.(task.word, task.word);
      setTimeout(() => setStates((s) => ({ ...s, [zoneId]: null })), 800);
    }
  }, [done, task, onAdvance, onCorrect, onMistake]);

  return (
    <div className="pa-screen">
      <div className="pa-target-letter">{task.targetLetter}</div>
      <div className="pa-stimulus">
        <WordPicture topicId={topicId} path={task.image} emoji={task.emoji} size={PICTURE_SIZE} />
      </div>
      <div className="pa-zones">
        {ZONES.map((zone) => {
          const state = states[zone.id] ?? null;
          const cls = [
            "pa-zone",
            state === "correct" ? "pa-zone--correct" : "",
            state === "wrong"   ? "pa-zone--wrong"   : "",
            done ? "pa-zone--disabled" : "",
          ].filter(Boolean).join(" ");
          return (
            <button key={zone.id} className={cls} type="button" onClick={() => handleTap(zone.id)}>
              {zone.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
