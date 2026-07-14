import { useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";

const ADJ_ENDINGS = ["ый", "ий", "ой", "ая", "яя", "ое", "ее", "ые", "ие"];

function splitAdjPhrase(adjPhrase) {
  const [adj, ...rest] = (adjPhrase ?? "").split(" ");
  const noun = rest.join(" ");
  for (const end of ADJ_ENDINGS) {
    if (adj.endsWith(end)) {
      return { stem: adj.slice(0, -end.length), ending: end, noun };
    }
  }
  return { stem: adj, ending: "", noun };
}

function BgImage({ topicId, path }) {
  const url = useTopicFile(topicId, path ?? "");
  return (path && url)
    ? <img className="wf-season__bg" src={url} alt="" draggable={false} />
    : <div className="wf-season__bg wf-season__bg--empty" />;
}

function PickChip({ item, topicId, chipState, onClick, hideImage }) {
  const { stem, ending, noun } = splitAdjPhrase(item.adjPhrase);
  const imgUrl = useTopicFile(topicId, item.image ?? "");

  let cls = "wf-season__chip";
  if (imgUrl && !hideImage) cls += " wf-season__chip--img";
  if (chipState) cls += ` wf-pick-item__chip--${chipState}`;

  return (
    <div className={cls} onClick={onClick}>
      {imgUrl && !hideImage && <img className="wf-season__chip-img" src={imgUrl} alt="" draggable={false} />}
      <div className="wf-season__chip-text">
        <span className="wf-season__chip-adj">
          {stem}<span className="wf-season__chip-ending">{ending}</span>
        </span>
        {noun && <span className="wf-season__chip-noun">{noun}</span>}
      </div>
    </div>
  );
}

export default function SeasonPickItemsTask({ task, topicId, onCorrect, onIncorrect }) {
  const { card, chips } = task;
  const hideOptionImages = task.params?.hideOptionImages ?? false;
  const [correctTapped, setCorrectTapped] = useState(new Set());
  const [wrongId, setWrongId]             = useState(null);
  const done = wrongId !== null || correctTapped.size >= 2;

  function handleTap(item) {
    if (done) return;
    if (item.isTarget) {
      const next = new Set(correctTapped);
      next.add(item.id);
      setCorrectTapped(next);
      if (next.size >= 2) onCorrect?.();
    } else {
      setWrongId(item.id);
      onIncorrect?.();
    }
  }

  function chipState(item) {
    if (correctTapped.has(item.id)) return "correct";
    if (wrongId === item.id)        return "wrong";
    return null;
  }

  return (
    <div className="wf-season">
      <div className="wf-season__photo-wrap">
        <BgImage topicId={topicId} path={card.backgroundImage} />
        <div className="wf-season__title">{card.contextPhrase}.</div>
      </div>

      <div className="wf-season__panel">
        {[0, 2, 4].map(start => (
          <div key={start} className="wf-season__row">
            {chips.slice(start, start + 2).map(item => (
              <PickChip
                key={item.id}
                item={item}
                topicId={topicId}
                chipState={chipState(item)}
                onClick={() => handleTap(item)}
                hideImage={hideOptionImages}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
