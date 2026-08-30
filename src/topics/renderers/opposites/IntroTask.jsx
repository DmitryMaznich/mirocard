import { useTopicFile } from "@/shared/hooks/useTopicFile";
import "./Opposites.css";

function IntroImage({ topicId, card }) {
  const url = useTopicFile(topicId, card?.image);
  return (
    <div className="opp-pair__card">
      {url
        ? <img src={url} alt="" draggable={false} />
        : <div className="opp-pair__card-placeholder" />
      }
    </div>
  );
}

export default function IntroTask({ task, topicId, onAdvance }) {
  const { card } = task;
  return (
    <button className="session-full-tap opp-intro" onClick={onAdvance}>
      <IntroImage topicId={topicId} card={card} />
      <div className="session-hint">{card.nominativeLabel}</div>
      <div className="session-label">{card.objectLabel}</div>
    </button>
  );
}
