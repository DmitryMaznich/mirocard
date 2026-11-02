import { useEffect, useLayoutEffect, useRef, useState } from "react";

// «Всем хватает?» — the hardest cards of «Сравни в жизни» (an option of that
// mode). Characters stand in the top row, their objects lie in the bottom
// row; every tap on an object gives it to the next character who has none.
//
// What moves is what the action names (task.mover, see ENOUGH_SETS): the
// chair to the child, the cup onto its saucer, the car into its garage.
//
// The child answers «Всем детям хватает стульев?» — Хватает / Не хватает —
// by eye, then «Почему стульев не хватает?» («Потому что…» + three endings,
// one right: «детей больше / стульев больше / детей и стульев поровну» —
// see ENOUGH_SETS in engine.js). No sentences on the screen (owner: too much
// text).
//
// The matching — each one gets its object — is the check after a wrong
// answer only (owner's call, 2026-11-02): right → «почему?» straight away;
// wrong → the guess stays marked, counts as a mistake, «Проверь: дай
// каждому…», then the same question again (now the board shows it), then
// «почему?». A wrong «почему» shakes, counts and is answered again. The card
// counts (onCorrect) when «почему» is answered.
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

export default function CompareEnough({ task, topicId, loadTopicFileUrl, onCorrect, onMistake, onAdvance }) {
  const urls = useTopicFiles([...task.whoSprites, task.thingSprite], topicId, loadTopicFileUrl);
  // enough → why → done, or after a wrong «хватает?»: enough → match → again → why → done
  const [step, setStep] = useState("enough");
  // pairs[k] = [character, object], in the order they were made. What moves
  // is what the action names (task.mover): «Дай каждому ребёнку стул» — the
  // chair goes to the child; «Поставь каждую чашку на блюдце» — the cup goes
  // down onto the saucer, and a cup left without one stays alone on top.
  const [pairs, setPairs] = useState([]);
  const [picked, setPicked] = useState({});          // { enough: "yes"|"no", why: option id } — the given answers
  const [shake, setShake] = useState(null);          // the button value shaking after a wrong answer
  const reportedRef = useRef(false);
  const movingRef = useRef(null);                    // { pair, from: DOMRect } for the glide
  const placedRefs = useRef([]);

  const moverIsWho = task.mover === "who";
  const done = step === "done";
  const matched = pairs.length === Math.min(task.who, task.things);
  const showOutcome = matched;                       // who is without / what is spare lights up once matched
  const cols = Math.max(task.who, task.things);
  const right = { enough: [task.enough ? "yes" : "no"], again: [task.enough ? "yes" : "no"], why: task.whyRight ?? [] };
  const pairOfWho = (w) => pairs.findIndex(([pw]) => pw === w);
  const pairOfThing = (t) => pairs.findIndex(([, pt]) => pt === t);

  useEffect(() => {
    if (done && !reportedRef.current) {
      reportedRef.current = true;
      onCorrect(task.conceptId, null);
    }
  }, [done, onCorrect, task.conceptId]);

  // The last pair made ends the check; the question comes again.
  useEffect(() => {
    if (step === "match" && matched) {
      const t = window.setTimeout(() => setStep("again"), 450);
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

  const NEXT = { enough: "why", again: "why", why: "done" };
  function answer(question, value) {
    if (step !== question || picked[question] !== undefined) return;
    if (right[question].includes(value)) {
      setPicked((p) => ({ ...p, [question]: value }));
      window.setTimeout(() => setStep(NEXT[question]), 350);
      return;
    }
    onMistake?.(task.conceptId, null);
    if (question === "enough") {
      // The first guess, by eye: it stays marked, and the matching checks it.
      setPicked((p) => ({ ...p, enough: value }));
      window.setTimeout(() => setStep("match"), 600);
    } else {
      setShake(value);
      window.setTimeout(() => setShake(null), 400);
    }
  }

  function optionClass(question, value) {
    const given = picked[question];
    if (shake === value && step === question) return "cfn-btn cfn-btn--wrong";
    if (given === value) return `cfn-btn ${right[question].includes(given) ? "cfn-btn--correct" : "cfn-btn--wrong-kept"}`;
    return "cfn-btn";
  }

  const canTap = step === "match" && !matched;
  // A tappable cell is a button while the card runs; on the finished card
  // (itself the «next» button) it is a plain div — a button can't hold buttons.
  const tapProps = (onClick, disabled, label) => (done
    ? {}
    : { type: "button", disabled, onClick, "aria-label": label });
  const Tap = done ? "div" : "button";
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
              <Tap key={w} className={cls} {...tapProps((e) => tapMover(w, e), !canTap || k >= 0, `Персонаж ${w + 1}`)}
                style={{ visibility: k >= 0 ? "hidden" : "visible" }}>
                {whoImg(path)}
              </Tap>
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
            <Tap key={i} className={`enough-thing${spare ? " enough-thing--spare" : ""}`}
              {...tapProps((e) => tapMover(i, e), !canTap || k >= 0, `Предмет ${i + 1}`)}
              style={{ visibility: k >= 0 ? "hidden" : "visible" }}>
              {thingImg}
            </Tap>
          );
        })}
      </div>
    </div>
  );

  // On the finished card the options are plain tiles (the whole card is the
  // «next» button there, and a button can't hold buttons).
  // «Потому что…» stands over the options, which continue it; once the right
  // one is chosen the dots give way to it: «Потому что кроликов больше.»
  const chosenWhy = (task.whyOptions ?? []).find((o) => o.id === picked.why && right.why.includes(o.id));
  const whyButtons = (
    <>
    <div className="enough-because">{chosenWhy ? `Потому что ${chosenWhy.label}.` : "Потому что…"}</div>
    <div className="enough-why-grid">
      {(task.whyOptions ?? []).map((o) => {
        const cls = `${optionClass("why", o.id)}${o.id === "same" ? " enough-why-same" : ""}`;
        return done
          ? <span key={o.id} className={cls}>{o.label}</span>
          : <button key={o.id} type="button" className={cls} onClick={() => answer("why", o.id)}>{o.label}</button>;
      })}
    </div>
    </>
  );

  if (done) {
    // No sentence: the board and the right answer, highlighted, say it.
    return (
      <button type="button" className="session-full-tap cfn-result-tap compare-body enough-body" onClick={(e) => { e.stopPropagation(); onAdvance?.(); }}>
        <div className="compare-instruction">{task.whyQuestion}</div>
        {board}
        {whyButtons}
      </button>
    );
  }

  const heading = step === "match" ? `Проверь: ${task.matchHint[0].toLowerCase()}${task.matchHint.slice(1)}` : step === "why" ? task.whyQuestion : task.enoughQuestion;
  return (
    <div className="compare-body enough-body">
      <div className="compare-instruction">{heading}</div>
      {board}
      {(step === "enough" || step === "again") && (
        <div className="cfn-options enough-options">
          <button type="button" className={optionClass(step, "yes")} onClick={() => answer(step, "yes")}>Хватает</button>
          <button type="button" className={optionClass(step, "no")} onClick={() => answer(step, "no")}>Не хватает</button>
        </div>
      )}
      {step === "why" && whyButtons}
    </div>
  );
}
