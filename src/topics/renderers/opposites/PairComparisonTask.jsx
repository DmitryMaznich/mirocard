import { useTopicFile } from "@/shared/hooks/useTopicFile";
import "./Opposites.css";

function CardSide({ topicId, card }) {
  const url = useTopicFile(topicId, card?.image);
  return (
    <div className="opp-pair__side">
      <div className="opp-pair__card-wrap">
        {url
          ? <img className="opp-img" src={url} alt="" draggable={false} />
          : <div className="opp-img opp-img--loading" />
        }
      </div>
      <div className="opp-label">{card.nominativeLabel}</div>
      <div className="opp-label opp-label--secondary">{card.objectLabel}</div>
    </div>
  );
}

export default function PairComparisonTask({ task, topicId, onAdvance }) {
  return (
    <div className="opp-pair session-body" onClick={onAdvance}>
      <CardSide topicId={topicId} card={task.leftCard} />
      <CardSide topicId={topicId} card={task.rightCard} />
    </div>
  );
}
