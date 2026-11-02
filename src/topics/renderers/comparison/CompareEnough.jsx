import { useEffect, useLayoutEffect, useRef, useState } from "react";

// «Всем хватает?» — the hardest cards of «Сравни в жизни» (an option of that
// mode). Characters stand in the top row, their objects lie in the bottom
// row; every tap on an object gives it to the next character who has none.
//
// The child answers one question, «Всем детям хватает стульев?» — Хватает /
// Не хватает; the «почему» (детей больше, чем стульев) is the adult's to say,
// prompted by a small line under the sentence (see ENOUGH_SETS in engine.js).
// order "check": the child matches first, then answers — everything is in
// sight, so a wrong answer just shakes, counts as a mistake (onMistake) and
// is answered again. order "answer": the answer first, by eye — a wrong one
// is marked and counted, not retried — then the matching shows the truth.
// The card counts (onCorrect) once the matching is done and the answer given.
//
// The scene is built from sprites of the topic (media/enough/*.webp), so the
// count on screen is always the card's count.

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

// The steps of one card, in order.
function stepsFor(order) {
  return order === "answer" ? ["enough", "match"] : ["match", "enough"];
}

export default function CompareEnough({ task, topicId, loadTopicFileUrl, onCorrect, onMistake, onAdvance }) {
  const urls = useTopicFiles([...task.whoSprites, task.thingSprite], topicId, loadTopicFileUrl);
  const steps = stepsFor(task.order);
  const [stepIdx, setStepIdx] = useState(0);
  const [owner, setOwner] = useState(() => Array(task.things).fill(-1)); // owner[thing] = character index, -1 still in the row
  const [picked, setPicked] = useState({});          // { enough: "yes"|"no" } — the given answer
  const [shake, setShake] = useState(null);          // the button value shaking after a wrong answer
  const reportedRef = useRef(false);
  const movingRef = useRef(null);                    // { thing, from: DOMRect } for the glide
  const placedRefs = useRef([]);

  const step = steps[stepIdx] ?? "done";
  const done = step === "done";
  const placedCount = owner.filter((o) => o >= 0).length;
  const matched = placedCount === Math.min(task.who, task.things);
  const showOutcome = matched;                       // who is without / what is spare lights up once matched
  const cols = Math.max(task.who, task.things);
  const right = { enough: task.enough ? "yes" : "no" };

  useEffect(() => {
    if (done && !reportedRef.current) {
      reportedRef.current = true;
      onCorrect(task.conceptId, null);
    }
  }, [done, onCorrect, task.conceptId]);

  // The last object placed ends the matching step.
  useEffect(() => {
    if (step === "match" && matched) {
      const t = window.setTimeout(() => setStepIdx((i) => i + 1), 450);
      return () => clearTimeout(t);
    }
  }, [step, matched]);

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
    if (step !== "match" || matched || owner[i] >= 0) return;
    movingRef.current = { thing: i, from: e.currentTarget.getBoundingClientRect() };
    setOwner((prev) => { const next = [...prev]; next[i] = placedCount; return next; });
  }

  function answer(question, value) {
    if (step !== question || picked[question] !== undefined) return;
    if (value === right[question]) {
      setPicked((p) => ({ ...p, [question]: value }));
      window.setTimeout(() => setStepIdx((i) => i + 1), 350);
      return;
    }
    onMistake?.(task.conceptId, null);
    if (task.order === "answer") {
      // By eye, before the check: the guess stays marked and the card goes on;
      // the matching will show how it really is.
      setPicked((p) => ({ ...p, [question]: value }));
      window.setTimeout(() => setStepIdx((i) => i + 1), 600);
    } else {
      setShake(value);
      window.setTimeout(() => setShake(null), 400);
    }
  }

  function optionClass(question, value) {
    const given = picked[question];
    if (shake === value && step === question) return "cfn-btn cfn-btn--wrong";
    if (given === value) return `cfn-btn ${given === right[question] ? "cfn-btn--correct" : "cfn-btn--wrong-kept"}`;
    return "cfn-btn";
  }

  const board = (
    <div className="enough-board">
      <div className="enough-row enough-row--who" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {task.whoSprites.map((path, w) => {
          const thing = owner.indexOf(w);
          return (
            <div key={w} className={`enough-who${showOutcome && w >= task.things ? " enough-who--without" : ""}`}>
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
          <button key={i} type="button" className={`enough-thing${showOutcome && o < 0 ? " enough-thing--spare" : ""}`}
            disabled={step !== "match" || matched || o >= 0} onClick={(e) => tapThing(i, e)}
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
        <div className="compare-instruction">{task.enoughQuestion}</div>
        {board}
        <div className="compare-verdict cfn-verdict-reveal">{task.verdictText}</div>
        {task.whyText && <div className="enough-why">{task.whyText}</div>}
      </button>
    );
  }

  const heading = step === "match" ? task.matchHint : task.enoughQuestion;
  return (
    <div className="compare-body enough-body">
      <div className="compare-instruction">{heading}</div>
      {board}
      {step === "enough" && (
        <div className="cfn-options enough-options">
          <button type="button" className={optionClass("enough", "yes")} onClick={() => answer("enough", "yes")}>Хватает</button>
          <button type="button" className={optionClass("enough", "no")} onClick={() => answer("enough", "no")}>Не хватает</button>
        </div>
      )}
      {step === "match" && task.order === "answer" && <div className="enough-hint">Теперь проверь</div>}
    </div>
  );
}
