import { useRef, useState } from "react";
import { useDrag } from "./useDrag";
import { Picture, useSayOnce, useWordVoice, wait } from "./voice";

// One screen for steps 1–6 (docs/letters-and-sounds.md): a picture, the sound
// scheme under it (one cell = one sound, Elkonin), and what the child puts in:
//   kind "chip"   — where is the sound (steps 1, 4, 5)
//   kind "letter" — which letter (steps 2, 3)
//   kind "all"    — every letter in order (step 6)
// After the answer the word's letters appear in the cells — the check by the
// written word. A wrong chip shows where the sound is, then the child moves it.
const PROMPT = {
  2: "С какой буквы?",
  3: "Какой буквой кончается?",
  6: "Собери слово",
};

export default function SchemeTask({ task, topicId, playTopicFile, onCorrect, onStreakReset }) {
  const { play, playing } = useWordVoice({ topicId, playTopicFile });
  useSayOnce(play, task.word);
  const n = task.letters.length;
  const soundIndex = task.kind === "chip" ? task.letters.indexOf(task.letter) : task.answer;
  const [phase, setPhase] = useState("play"); // play | right | explain
  const [chipAt, setChipAt] = useState(null); // "c0".."cN" | "bar"
  const [filled, setFilled] = useState(() => ({})); // cell → letter
  const [usedTiles, setUsedTiles] = useState(() => new Set());
  const [wrong, setWrong] = useState(null); // { cell, letter } | { cell }
  const [shake, setShake] = useState(null);
  const errors = useRef(0);
  const reveal = phase !== "play";

  async function finish() {
    setPhase("right");
    await wait(1700);
    onCorrect?.(task.conceptId, task.word.id, errors.current ? { assisted: true } : undefined);
  }

  async function miss(extra) {
    errors.current += 1;
    onStreakReset?.(task.conceptId, task.word.id);
    setWrong(extra);
    if (task.kind === "chip") {
      setPhase("explain");
      await wait(2400);
      setPhase("play");
      setChipAt(null);
    } else {
      await wait(750);
    }
    setWrong(null);
  }

  function placeChip(target) {
    if (phase !== "play" || !target) return;
    const right = target === (task.answer === "bar" ? "bar" : `c${task.answer}`);
    setChipAt(target);
    if (right) finish();
    else miss({ cell: target });
  }

  function placeLetter(tileIndex, target) {
    if (phase !== "play") return;
    const letter = task.tray[tileIndex];
    let cell;
    if (task.kind === "letter") cell = task.answer;
    else if (target) cell = Number(target.slice(1));
    else cell = [...Array(n).keys()].find((i) => !filled[i]);
    if (cell == null || filled[cell]) return;
    if (task.letters[cell] !== letter) {
      setShake(tileIndex);
      window.setTimeout(() => setShake(null), 450);
      miss({ cell, letter });
      return;
    }
    const next = { ...filled, [cell]: letter };
    setFilled(next);
    setUsedTiles((prev) => new Set(prev).add(tileIndex));
    if (task.kind === "letter" || Object.keys(next).length === n) finish();
  }

  const drag = useDrag({
    onDrop: (payload, target) => (payload.chip ? placeChip(target) : placeLetter(payload.tile, target)),
    onTap: (payload) => { if (!payload.chip) placeLetter(payload.tile, null); },
  });

  // "bar" — the first cell and a bar for the rest; "bar-end" — a bar, then the last cell.
  const barEnd = task.layout === "bar-end";
  const showCells = task.layout === "cells" || reveal;
  const closed = (i) => task.closed === "inner" && i > 0 && i < n - 1 && !reveal;
  const dropFor = (i) => {
    if (phase !== "play" || closed(i)) return undefined;
    if (task.kind === "letter") return i === task.answer ? `c${i}` : undefined;
    return `c${i}`;
  };

  function cellClass(i) {
    const cls = ["pa-cell"];
    if (closed(i)) cls.push("pa-cell--off");
    if (task.kind === "letter" && phase === "play" && i === task.answer) cls.push("pa-cell--slot");
    if (filled[i]) cls.push("pa-cell--ok");
    if (wrong?.cell === `c${i}` || wrong?.cell === i) cls.push("pa-cell--bad");
    if (wrong?.cell === "bar" && (barEnd ? i < n - 1 : i > 0)) cls.push("pa-cell--bad");
    if (phase === "right" && i === soundIndex && task.kind !== "all") cls.push("pa-cell--ok");
    if (phase === "explain" && i === soundIndex) cls.push("pa-cell--here");
    if (reveal && task.kind !== "all" && i !== soundIndex) cls.push("pa-cell--dim");
    return cls.join(" ");
  }

  function cellContent(i) {
    const chipHere = task.kind === "chip" && chipAt === `c${i}`;
    if (reveal) {
      return (
        <>
          <span className="pa-cell__letter">{task.letters[i]}</span>
          {chipHere && <span className={`pa-chip pa-chip--top${wrong ? " pa-chip--bad" : ""}`} />}
          {phase === "explain" && i === soundIndex && <span className="pa-cell__finger">👆</span>}
        </>
      );
    }
    if (filled[i]) return <span className="pa-cell__letter">{filled[i]}</span>;
    if (wrong?.cell === i && wrong.letter) return <span className="pa-cell__letter">{wrong.letter}</span>;
    if (chipHere) return <span className="pa-chip" />;
    return null;
  }

  return (
    <div className="session-body pa-stage">
      <div className="pa-head">
        {task.kind === "chip" && <div className="pa-plate">{task.letter}</div>}
        <Picture topicId={topicId} word={task.word} playing={playing === task.word.id} onTap={play} />
      </div>
      <div className="pa-prompt">
        {task.kind === "chip" ? <>Где звук <b>[{task.letter.toLowerCase()}]</b>?</> : PROMPT[task.step]}
      </div>

      <div className="pa-scheme-wrap">
        <div className="pa-scheme">
          {showCells
            ? task.letters.map((_, i) => (
              <div key={i} className={cellClass(i)} data-drop={dropFor(i)} onClick={() => task.kind === "chip" && placeChip(dropFor(i))}>{cellContent(i)}</div>
            ))
            : (
              <>
                {!barEnd && <div className={cellClass(0)} data-drop={dropFor(0)} onClick={() => task.kind === "chip" && placeChip(dropFor(0))}>{cellContent(0)}</div>}
                <div
                  className={`pa-cell pa-cell--bar${wrong?.cell === "bar" ? " pa-cell--bad" : ""}`}
                  data-drop={phase === "play" && task.kind === "chip" ? "bar" : undefined}
                  onClick={() => task.kind === "chip" && placeChip(phase === "play" ? "bar" : null)}
                >
                  {chipAt === "bar" && <span className="pa-chip" />}
                </div>
                {barEnd && <div className={cellClass(n - 1)} data-drop={dropFor(n - 1)} onClick={() => task.kind === "chip" && placeChip(dropFor(n - 1))}>{cellContent(n - 1)}</div>}
              </>
            )}
        </div>
        <div className="pa-arrow"><i /><b /></div>
      </div>

      <div className="pa-tray">
        {task.kind === "chip"
          ? (
            <span
              className={`pa-chip pa-chip--big${chipAt || drag.dragging ? " pa-chip--ghosted" : ""}`}
              onPointerDown={(e) => phase === "play" && !chipAt && drag.start(e, { chip: true })}
            />
          )
          : task.tray.map((letter, i) => (
            <button
              key={i}
              type="button"
              className={`pa-tile${usedTiles.has(i) || drag.dragging?.tile === i ? " pa-tile--used" : ""}${shake === i ? " pa-tile--shake" : ""}`}
              disabled={usedTiles.has(i) || phase !== "play"}
              onPointerDown={(e) => drag.start(e, { tile: i })}
            >
              {letter}
            </button>
          ))}
      </div>

      {drag.ghost && (
        <div className="pa-ghost" style={{ left: drag.ghost.x, top: drag.ghost.y }}>
          {drag.ghost.payload.chip ? <span className="pa-chip pa-chip--big" /> : <span className="pa-tile">{task.tray[drag.ghost.payload.tile]}</span>}
        </div>
      )}
    </div>
  );
}
