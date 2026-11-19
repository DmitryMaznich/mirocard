import { useEffect, useRef, useState } from "react";
import { wait } from "./voice";

// «Что пропало?» (owner, 2026-11-19; mockup docs/mockups/letters-and-sounds/syllables-v01.html):
// a row of letters or syllables to look at — each is voiced in turn — then the cards
// turn over, and one place is empty: pick the card that was there among 3 options.
// A wrong option shakes and fades; after two the row opens again for a second.
const LOOK_MS = 3000; // looking time without recordings (and the minimum with them)

export default function MissingTask({ task, topicId, playTopicFile, onCorrect, onStreakReset }) {
  const [phase, setPhase] = useState("look"); // look | hidden | ask | right
  const [peek, setPeek] = useState(false);
  const [faded, setFaded] = useState(() => new Set());
  const [shake, setShake] = useState(null);
  const errors = useRef(0);
  const alive = useRef(true);
  const say = async (u) => { const f = task.sounds?.[u]; if (f && playTopicFile) await playTopicFile(topicId, f); };

  useEffect(() => {
    alive.current = true;
    (async () => {
      const started = Date.now();
      await wait(400);
      for (const u of task.row) {
        if (!alive.current) return;
        await say(u);
        await wait(250);
      }
      await wait(Math.max(900, LOOK_MS - (Date.now() - started)));
      if (!alive.current) return;
      setPhase("hidden");
      await wait(900);
      if (alive.current) setPhase("ask");
    })();
    return () => { alive.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.taskId]);

  async function pick(i) {
    if (phase !== "ask" || faded.has(i)) return;
    const u = task.options[i];
    if (u === task.letter) {
      setPhase("right");
      say(u);
      await wait(1300);
      onCorrect?.(task.conceptId, task.conceptId, errors.current ? { assisted: true } : undefined);
      return;
    }
    errors.current += 1;
    onStreakReset?.(task.conceptId, task.conceptId);
    setShake(i);
    setFaded((prev) => new Set(prev).add(i));
    window.setTimeout(() => setShake(null), 450);
    if (errors.current === 2) {
      setPeek(true);
      await wait(1100);
      setPeek(false);
    }
  }

  const syl = task.letter.length > 1;
  const prompt = phase === "look" ? "Запомни" : phase === "hidden" ? "Закрываем…" : "Что пропало?";
  return (
    <div className="session-body pa-stage pa-stage--missing">
      <div className="pa-prompt">{prompt}</div>
      <div className={`pa-mrow${syl ? " pa-syl" : ""}`} style={{ "--n": task.row.length }}>
        {task.row.map((u, i) => {
          const gap = i === task.missing && (phase === "ask" || phase === "right");
          const cls = ["pa-mcard"];
          if (phase === "hidden") cls.push("pa-mcard--back");
          else if (gap && phase === "right") cls.push("pa-mcard--ok");
          else if (gap && !peek) cls.push("pa-mcard--gap");
          return <div key={i} className={cls.join(" ")}>{phase === "hidden" ? "" : gap && !peek && phase === "ask" ? "?" : u}</div>;
        })}
      </div>
      <div className={`pa-options pa-options--3${syl ? " pa-syl" : ""}`} style={{ visibility: phase === "ask" || phase === "right" ? "visible" : "hidden" }}>
        {task.options.map((u, i) => (
          <button
            key={i}
            type="button"
            className={`pa-tile pa-tile--option${phase === "right" && u === task.letter ? " pa-tile--ok" : ""}${faded.has(i) || (phase === "right" && u !== task.letter) ? " pa-tile--faded" : ""}${shake === i ? " pa-tile--shake pa-tile--bad" : ""}`}
            onClick={(e) => { e.stopPropagation(); pick(i); }}
          >
            {u}
          </button>
        ))}
      </div>
    </div>
  );
}
