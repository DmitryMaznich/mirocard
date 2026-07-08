import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { ForwardArrowIcon } from "@/shared/components/ArrowIcons";

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

function Chip({ item, topicId }) {
  const { stem, ending, noun } = splitAdjPhrase(item.adjPhrase);
  const imgUrl = useTopicFile(topicId, item.image ?? "");
  return (
    <div className={`wf-season__chip${imgUrl ? " wf-season__chip--img" : ""}`}>
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

export default function SeasonIntroTask({ task, topicId, onAdvance }) {
  const { card } = task;
  const items = card.items ?? [];

  return (
    <div className="wf-season">
      <div className="wf-season__photo-wrap">
        <BgImage topicId={topicId} path={card.backgroundImage} />
        <div className="wf-season__title">{card.contextPhrase}.</div>
      </div>

      <div className="wf-season__panel">
        {[0, 2, 4].map(start => (
          <div key={start} className="wf-season__row">
            {items.slice(start, start + 2).map(item => (
              <Chip key={item.id} item={item} topicId={topicId} />
            ))}
          </div>
        ))}
      </div>

      <button className="wf-season__fwd" onClick={onAdvance}>
        <ForwardArrowIcon size={20} />
      </button>
    </div>
  );
}
