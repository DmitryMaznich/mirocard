import { useRef, useState } from "react";
import { useDrag } from "./useDrag";
import { Picture, useWordVoice, wait } from "./voice";

// Lotto «Буквы на картинки» — the owner's board game on screen: a 3×3 board of
// pictures and transparent letter cards; each card goes onto the picture whose
// word starts with that letter. A picture says its word when tapped. A right
// card settles into the picture's corner (the picture stays visible), a wrong
// one turns red and comes back.
export default function LottoTask({ task, topicId, playTopicFile, onCorrect, onStreakReset }) {
  const { play, playing } = useWordVoice({ topicId, playTopicFile });
  const [placed, setPlaced] = useState(() => ({})); // wordId → letter
  const [wrong, setWrong] = useState(null); // { wordId, letter }
  const [done, setDone] = useState(false);
  const errors = useRef(0);

  async function drop(letter, wordId) {
    if (done || !wordId || placed[wordId]) return;
    const word = task.board.find((w) => w.id === wordId);
    if (word?.firstLetter !== letter) {
      errors.current += 1;
      onStreakReset?.(task.conceptId, task.pairs[0].wordId);
      setWrong({ wordId, letter });
      await wait(800);
      setWrong(null);
      return;
    }
    const next = { ...placed, [wordId]: letter };
    setPlaced(next);
    play(word);
    if (Object.keys(next).length === task.pairs.length) {
      setDone(true);
      await wait(1600);
      onCorrect?.(task.conceptId, task.pairs[0].wordId, errors.current ? { assisted: true } : undefined);
    }
  }

  const drag = useDrag({ onDrop: (payload, target) => drop(payload.letter, target) });
  const left = task.pairs.filter((p) => !placed[p.wordId]);

  return (
    <div className="session-body pa-stage pa-stage--lotto">
      <div className="pa-prompt">Положи букву на картинку</div>
      <div className="pa-lotto">
        {task.board.map((w) => {
          const mine = placed[w.id];
          const bad = wrong?.wordId === w.id;
          return (
            <Picture
              key={w.id}
              topicId={topicId}
              word={w}
              playing={playing === w.id}
              onTap={play}
              className={`pa-lotto__pic${mine ? " pa-lotto__pic--ok" : ""}${bad ? " pa-lotto__pic--bad" : ""}`}
              data-drop={!mine && !done ? w.id : undefined}
            >
              {mine && <span className="pa-card pa-card--placed">{mine}</span>}
              {bad && <span className="pa-card pa-card--bad">{wrong.letter}</span>}
            </Picture>
          );
        })}
      </div>
      <div className="pa-tray">
        {done
          ? <span className="pa-done">✓</span>
          : left.map((p) => (
            <span
              key={p.letter}
              className={`pa-card${drag.dragging?.letter === p.letter ? " pa-card--lifted" : ""}`}
              onPointerDown={(e) => drag.start(e, { letter: p.letter })}
            >
              {p.letter}
            </span>
          ))}
      </div>
      {drag.ghost && (
        <div className="pa-ghost" style={{ left: drag.ghost.x, top: drag.ghost.y }}>
          <span className="pa-card pa-card--drag">{drag.ghost.payload.letter}</span>
        </div>
      )}
    </div>
  );
}
