import { useEffect, useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { useAudio } from "@/shared/hooks/useAudio";

function ConceptImage({ topicId, path }) {
  const url = useTopicFile(topicId, path);
  return url
    ? <img className="wf-yn__img" src={url} alt="" draggable={false} />
    : <div className="wf-yn__img wf-yn__img--loading" />;
}

export default function YesNoTask({ task, topicId, onCorrect, onIncorrect }) {
  const [answered, setAnswered] = useState(false);
  const [result, setResult]     = useState(null); // "correct" | "wrong"
  const { playTopicFile, playFeedback } = useAudio();

  useEffect(() => {
    setAnswered(false);
    setResult(null);
    playTopicFile(topicId, task.correctAudio);
  }, [task.conceptId, task.displayPhrase]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAnswer(userSaysYes) {
    if (answered) return;
    setAnswered(true);
    const isRight = userSaysYes === task.isCorrect;
    setResult(isRight ? "correct" : "wrong");
    playFeedback(isRight ? "correct" : "incorrect");
    setTimeout(() => {
      if (isRight) onCorrect(task.conceptId);
      else onIncorrect(task.conceptId);
    }, 900);
  }

  return (
    <div className="wf-yn">
      <div className="wf-yn__stimulus">
        <ConceptImage topicId={topicId} path={task.image} />
        <div className="wf-yn__phrase">{task.displayPhrase}</div>
      </div>

      <div className={`wf-yn__feedback wf-yn__feedback--${result ?? "idle"}`}>
        {result === "correct" && "✓"}
        {result === "wrong"   && "✗"}
      </div>

      <div className="wf-yn__buttons">
        <button
          className="wf-yn__btn wf-yn__btn--yes"
          onClick={() => handleAnswer(true)}
          disabled={answered}
        >
          ДА
        </button>
        <button
          className="wf-yn__btn wf-yn__btn--no"
          onClick={() => handleAnswer(false)}
          disabled={answered}
        >
          НЕТ
        </button>
      </div>
    </div>
  );
}
