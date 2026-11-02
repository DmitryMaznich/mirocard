import { useEffect, useLayoutEffect, useRef, useState } from "react";

// «Всем хватает?» (compare_enough): everyday one-to-one. Characters stand in
// the top row, their objects lie in the bottom row; every tap on an object
// puts it to the next character who has none. When the shorter side runs
// out, whoever is left without (or whatever is left over) lights up and the
// sentence says it: «Стульев не хватает. Одному не хватает стула».
//
// order "check" (default, the easier step): the child just matches and the
// answer shows itself — learning without errors. order "answer": first a
// guess by eye («Хватает» / «Не хватает»), then the matching checks it. A
// wrong guess is recorded (onMistake) but nothing is retried: the matching
// itself shows the truth, and the task is then done like any other.
//
// The scene is built from sprites of the topic (media/enough/*.webp), so the
// count on screen is always the task's count.

function useTopicFiles(paths, topicId, loadTopicFileUrl) {
  const key = paths.join("|");
  const [urls, setUrls] = useState({});
  useEffect(() => {
    let cancelled = false;
    const blobs = [];
    Promise.all([...new Set(paths)].map((path) =>
      Promise.resolve(loadTopicFileUrl ? loadTopicFileUrl(topicId, path) : path)
        .then((url) => { if (url?.startsWith("blob:")) blobs.push(url); return [path, url]; })
        .catch(() => [path, null])))
      .then((entries) => {
        if (cancelled) { blobs.forEach((u) => URL.revokeObjectURL(u)); return; }
        setUrls(Object.fromEntries(entries));
      });
    return () => { cancelled = true; blobs.forEach((u) => URL.revokeObjectURL(u)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, topicId, loadTopicFileUrl]);
  return urls;
}

// Where a matched object sits inside its character's box (see ENOUGH_SETS.place).
function placedStyle(place) {
  const size = `${place.size * 100}%`;
  const style = { width: size, left: `${50 - place.size * 50}%`, zIndex: place.front ? 2 : 0 };
  if (place.anchor === "top") style.top = `${place.dy * 100}%`;
  else if (place.anchor === "center") { style.top = "50%"; style.transform = `translateY(calc(-50% + ${place.dy * 100}%))`; }
  else style.bottom = `${-place.dy * 100}%`;
  return style;
}

export default function CompareEnough({ task, topicId, loadTopicFileUrl, onCorrect, onMistake, onAdvance }) {
  const urls = useTopicFiles([...task.whoSprites, task.thingSprite], topicId, loadTopicFileUrl);
  const [guess, setGuess] = useState(null);          // "yes" | "no" | null
  const [owner, setOwner] = useState(() => Array(task.things).fill(-1)); // owner[thing] = character index, -1 still in the row
  const reportedRef = useRef(false);
  const movingRef = useRef(null);                    // { thing, from: DOMRect } for the glide
  const placedRefs = useRef([]);

  const placedCount = owner.filter((o) => o >= 0).length;
  const done = placedCount === Math.min(task.who, task.things);
  const canMatch = task.order !== "answer" || guess !== null;
  const cols = Math.max(task.who, task.things);

  useEffect(() => {
    if (done && !reportedRef.current) {
      reportedRef.current = true;
      onCorrect(task.conceptId, null);
    }
  }, [done, onCorrect, task.conceptId]);

  // Glide: the object is drawn at its new place right away, then animated
  // from where it was tapped.
  useLayoutEffect(() => {
    const moving = movingRef.current;
    if (!moving) return;
    movingRef.current = null;
    const el = placedRefs.current[moving.thing];
    if (!el?.animate) return;
    const to = el.getBoundingClientRect();
    const dx = moving.from.left + moving.from.width / 2 - (to.left + to.width / 2);
    const dy = moving.from.top + moving.from.height / 2 - (to.top + to.height / 2);
    el.animate([{ transform: `${el.style.transform || ""} translate(${dx}px, ${dy}px)` }, { transform: el.style.transform || "none" }],
      { duration: 420, easing: "cubic-bezier(.3,.8,.3,1)" });
  }, [owner]);

  function tapThing(i, e) {
    if (!canMatch || done || owner[i] >= 0) return;
    movingRef.current = { thing: i, from: e.currentTarget.getBoundingClientRect() };
    setOwner((prev) => { const next = [...prev]; next[i] = placedCount; return next; });
  }

  function answer(value) {
    if (guess !== null) return;
    setGuess(value);
    if ((value === "yes") !== task.enough) onMistake?.(task.conceptId, null);
  }

  const guessRight = guess !== null && (guess === "yes") === task.enough;
  const board = (
    <div className="enough-board">
      <div className="enough-row enough-row--who" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {task.whoSprites.map((path, w) => {
          const thing = owner.indexOf(w);
          return (
            <div key={w} className={`enough-who${done && w >= task.things ? " enough-who--without" : ""}`}>
              {urls[path] && <img className="enough-who-img" src={urls[path]} alt="" draggable={false}
                style={task.whoSize && task.whoSize !== 1 ? { width: `${task.whoSize * 100}%`, height: `${task.whoSize * 100}%` } : undefined} />}
              {thing >= 0 && urls[task.thingSprite] && (
                <img ref={(el) => { placedRefs.current[thing] = el; }} className="enough-placed" style={placedStyle(task.place)}
                  src={urls[task.thingSprite]} alt="" draggable={false} />
              )}
            </div>
          );
        })}
      </div>
      <div className="enough-row enough-row--things" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {owner.map((o, i) => (
          <button key={i} type="button" className={`enough-thing${done && o < 0 ? " enough-thing--spare" : ""}`}
            disabled={!canMatch || done || o >= 0} onClick={(e) => tapThing(i, e)}
            style={{ visibility: o >= 0 ? "hidden" : "visible" }} aria-label={`Предмет ${i + 1}`}>
            {urls[task.thingSprite] && <img src={urls[task.thingSprite]} alt="" draggable={false} />}
          </button>
        ))}
      </div>
    </div>
  );

  if (done) {
    return (
      <button type="button" className="session-full-tap cfn-result-tap compare-body enough-body" onClick={(e) => { e.stopPropagation(); onAdvance?.(); }}>
        <div className="compare-instruction">{task.instruction}</div>
        {board}
        <div className="compare-verdict cfn-verdict-reveal">{task.verdictText}</div>
      </button>
    );
  }

  return (
    <div className="compare-body enough-body">
      <div className="compare-instruction">{task.instruction}</div>
      {board}
      {task.order === "answer" && (
        <div className="cfn-options enough-options">
          <button type="button" disabled={guess !== null}
            className={`cfn-btn${guess === "yes" ? (guessRight ? " cfn-btn--correct" : " cfn-btn--wrong") : ""}`}
            onClick={() => answer("yes")}>Хватает</button>
          <button type="button" disabled={guess !== null}
            className={`cfn-btn${guess === "no" ? (guessRight ? " cfn-btn--correct" : " cfn-btn--wrong") : ""}`}
            onClick={() => answer("no")}>Не хватает</button>
        </div>
      )}
      <div className="enough-hint">
        {canMatch ? (task.order === "answer" ? `Проверь. ${task.tapHint}` : task.tapHint) : "Как думаешь? Ответь, потом проверим"}
      </div>
    </div>
  );
}
