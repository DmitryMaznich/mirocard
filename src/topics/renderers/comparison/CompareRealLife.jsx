import { useMemo, useState } from "react";
import { REAL_LIFE_ITEM_ICONS } from "./realLifeItems.js";
import ChildAvatar from "./ChildAvatar.jsx";

// Above this many items, scattering one icon per unit stops being legible —
// switch to a single icon + "× N" badge instead (matches how compare_visual
// itself falls back from dots to a plain number at higher levels).
const SCATTER_LIMIT = 12;

// Deterministic PRNG so a given task's scatter layout doesn't reshuffle on
// every re-render (a wrong-tap flash, the "answered" reveal, ...) — same
// seed in, same positions out.
function seededRandom(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Scattered (not gridded) placement, in percent-of-container units so it
// stays responsive without any viewport math — same idea as
// column_addition's PILE_LAYOUT (randomized-but-fixed x/y/rotation for a
// heap of coins), applied here to a heap of real-life items.
function scatterItems(count, seed) {
  const rand = seededRandom(seed);
  const placed = [];
  for (let i = 0; i < count; i++) {
    let x, y, ok, tries = 0;
    do {
      x = 12 + rand() * 76;
      y = 48 + rand() * 46;
      ok = placed.every((p) => Math.hypot(p.x - x, p.y - y) > 17);
      tries++;
    } while (!ok && tries < 40);
    placed.push({ x, y, rot: Math.round(rand() * 50 - 25) });
  }
  return placed;
}

function ItemPile({ item, count, seed }) {
  const icon = REAL_LIFE_ITEM_ICONS[item];
  const positions = useMemo(() => scatterItems(Math.min(count, SCATTER_LIMIT), seed), [count, seed]);

  if (count > SCATTER_LIMIT) {
    return (
      <div className="reallife-badge">
        <img className="reallife-badge-icon" src={icon} alt="" />
        <span className="reallife-badge-times">× {count}</span>
      </div>
    );
  }
  return positions.map((p, i) => (
    <img
      key={i}
      className="reallife-item"
      src={icon}
      alt=""
      style={{ left: `${p.x}%`, top: `${p.y}%`, transform: `translate(-50%, -50%) rotate(${p.rot}deg)` }}
    />
  ));
}

function Side({ as: As, name, gender, item, count, correct, wrong, ...rest }) {
  const cls = [
    "reallife-side",
    correct && "reallife-side--correct",
    wrong && "reallife-side--wrong",
  ].filter(Boolean).join(" ");
  return (
    <As className={cls} {...rest}>
      <div className="reallife-who">
        <ChildAvatar gender={gender} className="reallife-avatar" />
        <div className="reallife-tag">{name}</div>
      </div>
      <ItemPile item={item} count={count} seed={count * 97 + name.length} />
    </As>
  );
}

export default function CompareRealLife({ task, onCorrect, onIncorrect, onAdvance }) {
  const [answered, setAnswered]   = useState(false);
  const [wrongSide, setWrongSide] = useState(null); // "a" | "b" | "equal" | null

  function flashWrong(side) {
    setWrongSide(side);
    window.setTimeout(() => setWrongSide(null), 350);
  }

  function handlePick(pickedA) {
    if (answered || task.question === "equal") return;
    setAnswered(true);
    const isCorrect = pickedA ? task.question === "more" : task.question === "less";
    if (isCorrect) onCorrect(task.conceptId, null);
    else {
      flashWrong(pickedA ? "a" : "b");
      onIncorrect(task.conceptId, null);
    }
  }

  function handleEqual() {
    if (answered) return;
    setAnswered(true);
    if (task.question === "equal") onCorrect(task.conceptId, null);
    else {
      flashWrong("equal");
      onIncorrect(task.conceptId, null);
    }
  }

  const scene = (interactive) => (
    <div className="reallife-scene">
      <Side
        as={interactive ? "button" : "div"}
        type={interactive ? "button" : undefined}
        name={task.nameA}
        gender={task.genderA}
        item={task.item}
        count={task.left}
        correct={answered && task.question === "more"}
        wrong={wrongSide === "a"}
        disabled={interactive ? answered : undefined}
        onClick={interactive ? () => handlePick(true) : undefined}
      />
      <Side
        as={interactive ? "button" : "div"}
        type={interactive ? "button" : undefined}
        name={task.nameB}
        gender={task.genderB}
        item={task.item}
        count={task.right}
        correct={answered && task.question === "less"}
        wrong={wrongSide === "b"}
        disabled={interactive ? answered : undefined}
        onClick={interactive ? () => handlePick(false) : undefined}
      />
    </div>
  );

  if (answered) {
    return (
      <button className="session-full-tap cfn-result-tap" onClick={(e) => { e.stopPropagation(); onAdvance(); }}>
        <div className="compare-instruction">{task.instruction}</div>
        {scene(false)}
        <div className="compare-verdict cfn-verdict-reveal">{task.verdictText}</div>
      </button>
    );
  }

  return (
    <div className="compare-body">
      <div className="compare-instruction">{task.instruction}</div>
      {scene(true)}
      {task.allowEqual && (
        <button type="button" className={`reallife-equal-btn${wrongSide === "equal" ? " reallife-equal-btn--wrong" : ""}`} onClick={handleEqual}>
          Поровну
        </button>
      )}
    </div>
  );
}
