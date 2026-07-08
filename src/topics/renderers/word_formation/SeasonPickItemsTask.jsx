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

function PickChip({ item, topicId, chipState, onClick }) {
  const { stem, ending, noun } = splitAdjPhrase(item.adjPhrase);
  const imgUrl = useTopicFile(topicId, item.image ?? "");

  let cls = "wf-season__chip";
  if (imgUrl) cls += " wf-season__chip--img";
  if (chipState) cls += ` wf-pick-item__chip--${chipState}`;

  return (
    <div className={cls} onClick={onClick}>
      {imgUrl && <img className="wf-season__chip-img" src={imgUrl} alt="" draggable={false} />}
      <div className="wf-season__chip-text">
        <span className="wf-season__chip-adj">
          {stem}<span className="wf-season__chip-ending">{ending}</span>
        </span>
        {noun && <span className="wf-season__chip-noun">{noun}</span>}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <polyline points="4,11 9,16 18,6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SeasonPickItemsTask({ task, topicId, onCorrect, onIncorrect }) {
  const { card, chips } = task;
  const [selected, setSelected]   = useState(new Set());
  const [evaluated, setEvaluated] = useState(false);

  function toggleChip(itemId) {
    if (evaluated) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }

  function handleCheck() {
    if (evaluated || selected.size === 0) return;
    setEvaluated(true);
    const allCorrect = chips.filter(c => c.isTarget).every(c => selected.has(c.id));
    const noWrong    = [...selected].every(id => chips.find(c => c.id === id)?.isTarget);
    if (allCorrect && noWrong) onCorrect?.(); else onIncorrect?.();
  }

  function chipState(item) {
    if (!evaluated) return selected.has(item.id) ? "selected" : null;
    if (item.isTarget && selected.has(item.id))  return "correct";
    if (!item.isTarget && selected.has(item.id)) return "wrong";
    if (item.isTarget && !selected.has(item.id)) return "missed";
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
                onClick={() => toggleChip(item.id)}
              />
            ))}
          </div>
        ))}
      </div>

      <button
        className={`wf-season__fwd wf-pick-item__check${selected.size === 0 ? " wf-pick-item__check--dim" : ""}${evaluated ? " wf-pick-item__check--done" : ""}`}
        onClick={handleCheck}
        disabled={selected.size === 0 || evaluated}
      >
        <CheckIcon />
      </button>
    </div>
  );
}
