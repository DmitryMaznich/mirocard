import { useEffect, useLayoutEffect, useRef, useState } from "react";

// «Всем хватает?» — the hardest cards of «Сравни в жизни» (an option of that
// mode). Characters stand in the top row, their objects lie in the bottom
// row; every tap on an object gives it to the next character who has none.
//
// What moves is what the action names (task.mover, see ENOUGH_SETS): the
// chair to the child, the cup onto its saucer, the car into its garage.
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
  // pairs[k] = [character, object], in the order they were made. What moves
  // is what the action names (task.mover): «Дай каждому ребёнку стул» — the
  // chair goes to the child; «Поставь каждую чашку на блюдце» — the cup goes
  // down onto the saucer, and a cup left without one stays alone on top.
  const [pairs, setPairs] = useState([]);
  const [picked, setPicked] = useState({});          // { enough: "yes"|"no" } — the given answer
  const [shake, setShake] = useState(null);          // the button value shaking after a wrong answer
  const reportedRef = useRef(false);
  const movingRef = useRef(null);                    // { pair, from: DOMRect } for the glide
  const placedRefs = useRef([]);

  const moverIsWho = task.mover === "who";
  const step = steps[stepIdx] ?? "done";
  const done = step === "done";
  const matched = pairs.length === Math.min(task.who, task.things);
  const showOutcome = matched;                       // who is without / what is spare lights up once matched
  const cols = Math.max(task.who, task.things);
  const right = { enough: task.enough ? "yes" : "no" };
  const pairOfWho = (w) => pairs.findIndex(([pw]) => pw === w);
  const pairOfThing = (t) => pairs.findIndex(([, pt]) => pt === t);

  useEffect(() => {
    if (done && !reportedRef.current) {
      reportedRef.current = true;
      onCorrect(task.conceptId, null);
    }
  }, [done, onCorrect, task.conceptId]);

  // The last pair made ends the matching step.
  useEffect(() => {
    if (step === "match" && matched) {
      const t = window.setTimeout(() => setStepIdx((i) => i + 1), 450);
      return () => clearTimeout(t);
    }
  }, [step, matched]);

  // Glide: the moved picture is drawn at its new place right away, then
  // animated from where it was tapped.
  useLayoutEffect(() => {
    const moving = movingRef.current;
    if (!moving) return;
    movingRef.current = null;
    const el = placedRefs.current[moving.pair];
    if (!el?.animate) return;
    const to = el.getBoundingClientRect();
    const dx = moving.from.left + moving.from.width / 2 - (to.left + to.width / 2);
    const dy = moving.from.top + moving.from.height / 2 - (to.top + to.height / 2);
    el.animate([{ transform: `${el.style.transform || ""} translate(${dx}px, ${dy}px)` }, { transform: el.style.transform || "none" }],
      { duration: 420, easing: "cubic-bezier(.3,.8,.3,1)" });
  }, [pairs]);

  // A tap on a mover pairs it with the next partner still free, left to right.
  function tapMover(index, e) {
    if (step !== "match" || matched) return;
    if (moverIsWho ? pairOfWho(index) >= 0 : pairOfThing(index) >= 0) return;
    const usedPartners = new Set(pairs.map(([w, t]) => (moverIsWho ? t : w)));
    const partnerCount = moverIsWho ? task.things : task.who;
    let partner = 0;
    while (usedPartners.has(partner) && partner < partnerCount) partner++;
    if (partner >= partnerCount) return;
    movingRef.current = { pair: pairs.length, from: e.currentTarget.getBoundingClientRect() };
    setPairs((prev) => [...prev, moverIsWho ? [index, partner] : [partner, index]]);
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

  const canTap = step === "match" && !matched;
  const whoImg = (path, style) => urls[path] && <img className="enough-who-img" src={urls[path]} alt="" draggable={false} style={style} />;
  const board = (
    <div className="enough-board">
      <div className="enough-row enough-row--who" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {task.whoSprites.map((path, w) => {
          const k = pairOfWho(w);
          const without = showOutcome && k < 0;
          const cls = `enough-who${without ? " enough-who--without" : ""}${moverIsWho ? " enough-who--mover" : ""}`;
          // Mover characters (cups, cars) leave their place when paired.
          if (moverIsWho) {
            return (
              <button key={w} type="button" className={cls} disabled={!canTap || k >= 0} onClick={(e) => tapMover(w, e)}
                style={{ visibility: k >= 0 ? "hidden" : "visible" }} aria-label={`Персонаж ${w + 1}`}>
                {whoImg(path)}
              </button>
            );
          }
          return (
            <div key={w} className={cls}>
              {whoImg(path)}
              {k >= 0 && urls[task.thingSprite] && (
                <img ref={(el) => { placedRefs.current[k] = el; }} className="enough-placed" style={placedStyle(task.place)}
                  src={urls[task.thingSprite]} alt="" draggable={false} />
              )}
            </div>
          );
        })}
      </div>
      <div className="enough-row enough-row--things" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: task.things }, (_, i) => {
          const k = pairOfThing(i);
          const spare = showOutcome && k < 0;
          const thingImg = urls[task.thingSprite] && <img className="enough-thing-img" src={urls[task.thingSprite]} alt="" draggable={false} />;
          if (moverIsWho) {
            // Objects that stay put (saucers, garages): the character comes to them.
            return (
              <div key={i} className={`enough-thing enough-thing--target${spare ? " enough-thing--spare" : ""}`}>
                {thingImg}
                {k >= 0 && urls[task.whoSprites[pairs[k][0]]] && (
                  <img ref={(el) => { placedRefs.current[k] = el; }} className="enough-placed" style={placedStyle(task.place)}
                    src={urls[task.whoSprites[pairs[k][0]]]} alt="" draggable={false} />
                )}
              </div>
            );
          }
          return (
            <button key={i} type="button" className={`enough-thing${spare ? " enough-thing--spare" : ""}`}
              disabled={!canTap || k >= 0} onClick={(e) => tapMover(i, e)}
              style={{ visibility: k >= 0 ? "hidden" : "visible" }} aria-label={`Предмет ${i + 1}`}>
              {thingImg}
            </button>
          );
        })}
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
