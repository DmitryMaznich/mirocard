import { useState } from "react";
import CardImage from "./CardImage";
import { useSpeakers, PAIR_GAP_MS } from "./useSpeakers";

// «Прослушать все слова»: for the adult and for the native speaker who checks
// the recordings in the app itself. Every word with its two recordings.
export default function ListenAllTask({ task, topicId, playTopicFile, onAdvance }) {
  const { speaking, startRun } = useSpeakers(topicId, playTopicFile);
  const [active, setActive] = useState(null);

  async function play(card, langs) {
    setActive(card.id);
    const run = startRun();
    for (let i = 0; i < langs.length; i++) {
      if (i > 0 && !(await run.pause(PAIR_GAP_MS))) return;
      if (!(await run.say(langs[i], card))) return;
    }
    setActive(null);
  }

  return (
    <div className="session-body bw-list">
      <ul className="bw-list__rows">
        {task.cards.map((card) => (
          <li key={card.id} className={`bw-list__row${active === card.id ? " bw-list__row--active" : ""}`}>
            <span className="bw-list__thumb"><CardImage topicId={topicId} card={card} /></span>
            <span className="bw-list__words">
              <span className="bw-list__sl">{card.word.sl}</span>
              <span className="bw-list__ru">{card.word.ru}</span>
            </span>
            <span className="bw-list__buttons">
              <button type="button" className={`bw-play bw-play--sl${active === card.id && speaking === "sl" ? " bw-play--on" : ""}`} onClick={() => play(card, ["sl"])}>
                SL
              </button>
              <button type="button" className={`bw-play bw-play--ru${active === card.id && speaking === "ru" ? " bw-play--on" : ""}`} onClick={() => play(card, ["ru"])}>
                RU
              </button>
              <button type="button" className="bw-play bw-play--pair" onClick={() => play(card, ["ru", "sl"])}>
                RU → SL
              </button>
            </span>
          </li>
        ))}
      </ul>
      <button type="button" className="bw-done" onClick={() => onAdvance?.()}>Готово</button>
    </div>
  );
}
