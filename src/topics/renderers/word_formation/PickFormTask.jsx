import { useMemo } from "react";
import { buildWordOptions, buildWordQuestion, modelAnswer } from "./exerciseModel";
import { ListenButton } from "./WordSpeech";
import WordMeaning from "./WordMeaning";
import { useWordAnswer } from "./useWordAnswer";

export default function PickFormTask({ task, topicId, onCorrect, onIncorrect }) {
  const { card, allCards } = task;
  const showImage   = task.params?.showImage   !== false;

  const { answer, select } = useWordAnswer(onCorrect, onIncorrect, card?.conceptId ?? card?.id, card?.id);
  const picked = answer?.status;
  const wrongIdx = answer?.index;

  const options = useMemo(
    () => task.options ?? (card ? buildWordOptions(card, allCards ?? [], task.params?.optionCount) : []),
    [task.options, card, allCards, task.params?.optionCount]
  );

  if (!card) return null;

  return (
    <div className={`wf-pair wf-pair--pick${showImage ? "" : " wf-pair--no-image"}${showImage ? " wf-pair--meaning" : ""}`}>
      <div className="wf-pair__content">
        {showImage && <div className="wf-pair__visuals"><WordMeaning card={card} topicId={topicId} /></div>}

        <div className="wf-pair__prompt">
          <div className="wf-pair__prompt-line wf-pair__prompt-line--question">
            {buildWordQuestion(card, task.params)}
          </div>
          <ListenButton text={buildWordQuestion(card, task.params)} label="Послушать условие" />
          {picked === "correct" && <div className="wf-lesson__model"><strong>{modelAnswer(card)}</strong></div>}
          {picked === "wrong" && <div className="wf-lesson__feedback" role="status">Посмотрим вместе</div>}
        </div>

        <div className={`wf-pick__options${options.length > 4 ? " wf-pick__options--wide" : ""}`}>
          {options.map((opt, i) => {
            let mod = "";
            if (picked === "correct" && opt.isTarget)   mod = "wf-pick__option--correct";
            if (picked === "wrong"   && i === wrongIdx)  mod = "wf-pick__option--wrong";
            if (picked === "correct" && !opt.isTarget)   mod = "wf-pick__option--dim";
            return (
              <div className="wf-choice" key={i}>
              <button
                key={i}
                className={`wf-pick__option ${mod}`}
                onClick={() => select(opt, i)}
                disabled={!!picked}
              >
                {opt.text}
              </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
