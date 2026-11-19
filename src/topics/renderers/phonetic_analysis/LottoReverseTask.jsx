import { useRef, useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { useDrag } from "./useDrag";
import { Picture, useWordVoice, wait } from "./voice";

// Lotto «Картинки на буквы» — the lotto turned round: a 3×3 board of letters
// (one per picture, a letter may repeat — squares are told apart by index) and
// the pictures in the tray; each picture goes onto a letter its word starts with.
// A tap on a picture says its word. A right picture settles into the letter's
// square (the letter moves to the corner), a wrong one turns the square red and
// stays in the tray.
export default function LottoReverseTask({ task, topicId, playTopicFile, onCorrect, onStreakReset }) {
  const { play, playing } = useWordVoice({ topicId, playTopicFile });
  const [placed, setPlaced] = useState(() => ({})); // square index → word
  const [wrong, setWrong] = useState(null); // square index
  const [done, setDone] = useState(false);
  const errors = useRef(0);

  async function drop(wordId, target) {
    if (done || target == null) return;
    const square = Number(target);
    const letter = task.letters[square];
    if (placed[square]) return;
    const word = task.pictures.find((w) => w.id === wordId);
    if (!word) return;
    if (word.firstLetter !== letter) {
      errors.current += 1;
      onStreakReset?.(task.conceptId, word.id);
      setWrong(square);
      await wait(800);
      setWrong(null);
      return;
    }
    const next = { ...placed, [square]: word };
    setPlaced(next);
    play(word);
    if (Object.keys(next).length === task.letters.length) {
      setDone(true);
      await wait(1600);
      onCorrect?.(task.conceptId, task.pairs[0].wordId, errors.current ? { assisted: true } : undefined);
    }
  }

  const drag = useDrag({
    onDrop: (payload, target) => drop(payload.wordId, target),
    onTap: (payload) => play(task.pictures.find((w) => w.id === payload.wordId)),
  });
  const placedIds = new Set(Object.values(placed).map((w) => w.id));
  const lifted = drag.ghost ? task.pictures.find((w) => w.id === drag.ghost.payload.wordId) : null;

  return (
    <div className="session-body pa-stage pa-stage--lotto">
      <div className="pa-prompt">Положи картинку на букву</div>
      <div className="pa-lotto-area"><div className="pa-lotto-play">
      <div className="pa-rlotto">
        {task.letters.map((L, i) => {
          const mine = placed[i];
          return (
            <div
              key={i}
              className={`pa-rlotto__cell${mine ? " pa-rlotto__cell--ok" : ""}${wrong === i ? " pa-rlotto__cell--bad" : ""}`}
              data-drop={!mine && !done ? String(i) : undefined}
            >
              {mine ? <PlacedPicture topicId={topicId} word={mine} letter={L} /> : L}
            </div>
          );
        })}
      </div>
      {/* The deck keeps a slot for every picture, so nothing jumps as they are laid out. */}
      <div className="pa-lotto-tray">
        {task.pictures.map((w) => (placedIds.has(w.id) ? <span key={w.id} className="pa-lotto-slot" /> : (
          <div key={w.id} className="pa-lotto-slot" onPointerDown={(e) => drag.start(e, { wordId: w.id })}>
            <Picture
              topicId={topicId}
              word={w}
              playing={playing === w.id}
              className={`pa-rlotto__thumb${drag.dragging?.wordId === w.id ? " pa-rlotto__thumb--lifted" : ""}`}
            />
          </div>
        )))}
      </div>
      </div></div>
      {lifted && (
        <div className="pa-ghost" style={{ left: drag.ghost.x, top: drag.ghost.y }}>
          <GhostPicture topicId={topicId} word={lifted} />
        </div>
      )}
    </div>
  );
}

function PlacedPicture({ topicId, word, letter }) {
  const url = useTopicFile(topicId, word.image);
  return (
    <>
      {url ? <img src={url} alt="" draggable={false} /> : <span className="pa-pic__emoji">{word.emoji}</span>}
      <span className="pa-card pa-card--placed">{letter}</span>
    </>
  );
}

function GhostPicture({ topicId, word }) {
  const url = useTopicFile(topicId, word.image);
  return <div className="pa-rlotto__ghost">{url ? <img src={url} alt="" /> : <span className="pa-pic__emoji">{word.emoji}</span>}</div>;
}
