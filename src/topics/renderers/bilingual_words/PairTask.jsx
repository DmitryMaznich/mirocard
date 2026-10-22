import { useEffect, useState } from "react";
import SpeakerTile from "./SpeakerTile";
import CardImage from "./CardImage";
import { useSpeakers, PAIR_GAP_MS } from "./useSpeakers";

// Step Б «Показ пары»: home says the word, then school says it. Nothing to get
// wrong; a tap on the picture moves on once the pair has been heard.
export default function PairTask({ task, topicId, playTopicFile, onAdvance }) {
  const { card } = task;
  const { speaking, startRun } = useSpeakers(topicId, playTopicFile);
  const [heard, setHeard] = useState(false);

  useEffect(() => {
    const run = startRun();
    (async () => {
      if (!(await run.say("ru", card))) return;
      if (!(await run.pause(PAIR_GAP_MS))) return;
      if (!(await run.say("sl", card))) return;
      setHeard(true);
    })();
  }, [card, startRun]);

  const replay = (lang) => { startRun().say(lang, card); };

  return (
    <div className="session-body bw-stage">
      <SpeakerTile side="home" state={speaking === "ru" ? "speaking" : "idle"} onTap={() => replay("ru")} />
      <SpeakerTile side="school" state={speaking === "sl" ? "speaking" : "idle"} onTap={() => replay("sl")} />
      <div className="bw-options bw-options--1">
        <button
          type="button"
          className={`bw-opt${heard ? " bw-opt--ready" : ""}`}
          aria-label={`${card.word.ru} — ${card.word.sl}`}
          onClick={(event) => { event.stopPropagation(); if (heard) onAdvance?.(); }}
        >
          <CardImage topicId={topicId} card={card} />
        </button>
      </div>
    </div>
  );
}
