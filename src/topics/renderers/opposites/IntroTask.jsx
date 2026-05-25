import { useTopicFile } from "@/shared/hooks/useTopicFile";
import "./Opposites.css";

export default function IntroTask({ task, topicId, onAdvance }) {
  const { card } = task;
  const url = useTopicFile(topicId, card?.image);

  return (
    <div className="session-body opp-intro" onClick={onAdvance}>
      <div className="card-area">
        {url
          ? <img className="card-img" src={url} alt="" draggable={false} style={{ objectFit: "contain" }} />
          : <div className="card-img card-img--loading" />
        }
      </div>
      <div className="session-label">{card.nominativeLabel}</div>
      <div className="session-hint">{card.objectLabel}</div>
    </div>
  );
}
