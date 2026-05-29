import { useTopicFile } from "@/shared/hooks/useTopicFile";
import "./Opposites.css";

function CardSide({ topicId, card, showLabels }) {
  const url = useTopicFile(topicId, card?.image);
  return (
    <div className="opp-pair__side">
      <div className="opp-pair__card">
        {url
          ? <img src={url} alt="" draggable={false} />
          : <div style={{ width: "100%", height: "100%", background: "#f0f0f0", borderRadius: 12 }} />
        }
      </div>
      {showLabels && <div className="opp-pair__label">{card.nominativeLabel}</div>}
      {showLabels && <div className="opp-pair__hint">{card.objectLabel}</div>}
    </div>
  );
}

export default function PairComparisonTask({ task, topicId, onAdvance }) {
  return (
    <div className="session-body opp-pair" onClick={onAdvance}>
      <CardSide topicId={topicId} card={task.leftCard} showLabels={task.showLabels} />
      <CardSide topicId={topicId} card={task.rightCard} showLabels={task.showLabels} />
    </div>
  );
}
