import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { ForwardArrowIcon } from "@/shared/components/ArrowIcons";

function BgImage({ topicId, path }) {
  const url = useTopicFile(topicId, path ?? "");
  return (path && url)
    ? <img className="wf-season__bg-img" src={url} alt="" draggable={false} />
    : <div className="wf-season__bg-img wf-season__bg-img--empty" />;
}

function ItemImage({ topicId, path }) {
  const url = useTopicFile(topicId, path ?? "");
  return (path && url)
    ? <img className="wf-season-item__img" src={url} alt="" draggable={false} />
    : <div className="wf-season-item__img wf-season-item__img--empty" />;
}

export default function SeasonIntroTask({ task, topicId, onAdvance }) {
  const { card } = task;

  return (
    <div className="wf-season">
      <div className="wf-season__bg">
        <BgImage topicId={topicId} path={card.backgroundImage} />
        <div className="wf-season__title">{card.contextPhrase}.</div>
      </div>

      <div className="wf-season__items">
        {(card.items ?? []).map(item => (
          <div key={item.id} className="wf-season-item">
            <ItemImage topicId={topicId} path={item.image} />
            <div className="wf-season-item__label">{item.adjPhrase}</div>
          </div>
        ))}
      </div>

      <div className="wf-season__nav">
        <button className="wf-nav-btn wf-nav-btn--next" onClick={onAdvance}>
          <ForwardArrowIcon size={22} />
        </button>
      </div>
    </div>
  );
}
