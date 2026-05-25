import { useTopicFile } from "@/shared/hooks/useTopicFile";
import "./Opposites.css";

function CardImage({ topicId, card }) {
  const url = useTopicFile(topicId, card?.image);
  if (!card?.image) return <div className="opp-img opp-img--loading" />;
  if (!url)         return <div className="opp-img opp-img--loading" />;
  return <img className="opp-img" src={url} alt="" draggable={false} />;
}

export default function IntroTask({ task, topicId, onAdvance }) {
  const { card } = task;
  return (
    <div className="opp-intro session-body" onClick={onAdvance}>
      <div className="opp-intro__card-wrap">
        <CardImage topicId={topicId} card={card} />
      </div>
      <div className="opp-intro__labels">
        <div className="opp-label">{card.nominativeLabel}</div>
        <div className="opp-label opp-label--secondary">{card.objectLabel}</div>
      </div>
    </div>
  );
}
