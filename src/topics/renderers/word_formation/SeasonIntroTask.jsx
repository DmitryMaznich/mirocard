import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { ForwardArrowIcon } from "@/shared/components/ArrowIcons";

const ADJ_ENDINGS = ["ый", "ий", "ой", "ая", "яя", "ое", "ее", "ые", "ие"];

function splitAdjPhrase(adjPhrase) {
  const [adj, ...rest] = (adjPhrase ?? "").split(" ");
  const noun = rest.length ? " " + rest.join(" ") : "";
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

function ChipImage({ topicId, path }) {
  const url = useTopicFile(topicId, path ?? "");
  return (path && url)
    ? <img className="wf-season__chip-img" src={url} alt="" draggable={false} />
    : <div className="wf-season__chip-img wf-season__chip-img--empty" />;
}

function Chip({ item, topicId }) {
  const { stem, ending, noun } = splitAdjPhrase(item.adjPhrase);
  return (
    <div className="wf-season__chip">
      <ChipImage topicId={topicId} path={item.image} />
      <span className="wf-season__chip-text">
        {stem}<span className="wf-season__chip-ending">{ending}</span>{noun}
      </span>
    </div>
  );
}

export default function SeasonIntroTask({ task, topicId, onAdvance }) {
  const { card } = task;
  const items = card.items ?? [];

  return (
    <div className="wf-season">
      <BgImage topicId={topicId} path={card.backgroundImage} />

      <div className="wf-season__title">{card.contextPhrase}.</div>

      <div className="wf-season__fog">
        {[0, 3].map(start => (
          <div key={start} className="wf-season__chips-row">
            {items.slice(start, start + 3).map(item => (
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
