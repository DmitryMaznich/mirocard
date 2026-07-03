import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { ChevronRightIcon, RefreshIcon } from "@/shared/components/ArrowIcons";

function ConceptImage({ topicId, path }) {
  const url = useTopicFile(topicId, path);
  return url
    ? <img className="wf-qa__img" src={url} alt="" draggable={false} />
    : <div className="wf-qa__img wf-qa__img--loading" />;
}

export default function QuestionAskTask({ task, topicId, onCorrect }) {
  return (
    <div className="wf-qa">
      <div className="wf-qa__instruction">Как называется суп?</div>

      <div className="wf-qa__stimulus">
        <ConceptImage topicId={topicId} path={task.stimulusImage} />
        <div className="wf-qa__noun-phrase">{task.stimulusText}</div>
      </div>

      <div className="wf-qa__answer-hint">
        <span className="wf-qa__arrow"><ChevronRightIcon size={20} /></span>
        <span className="wf-qa__adj-phrase">{task.correctAdjPhrase}</span>
      </div>

      <div className="wf-qa__buttons">
        <button className="wf-qa__btn wf-qa__btn--retry" onClick={() => {}}>
          <RefreshIcon size={14} /> Ещё раз
        </button>
        <button className="wf-qa__btn wf-qa__btn--correct" onClick={() => onCorrect(task.conceptId)}>
          ✓ Правильно
        </button>
      </div>
    </div>
  );
}
