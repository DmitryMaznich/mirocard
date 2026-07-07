import { useEffect, useRef, useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { useAudio } from "@/shared/hooks/useAudio";

function stripNoun(phrase) {
  const words = (phrase ?? "").trim().split(" ");
  return words.length > 1 ? words.slice(0, -1).join(" ") : phrase;
}

function StimulusImage({ topicId, path }) {
  const url = useTopicFile(topicId, path);
  return url
    ? <img className="wf-form__stimulus-img" src={url} alt="" draggable={false} />
    : <div className="wf-form__stimulus-img wf-form__stimulus-img--loading" />;
}

export default function FormItTask({ task, topicId, onCorrect, onIncorrect }) {
  const [answered, setAnswered] = useState(false);
  const [flash, setFlash]       = useState(null); // { adjPhrase, state: "correct"|"wrong" }
  const answeredRef = useRef(false);
  const { playTopicFile, playFeedback } = useAudio();

  useEffect(() => {
    setAnswered(false);
    setFlash(null);
    answeredRef.current = false;
    if (task.stimulus === "phrase") {
      playTopicFile(topicId, task.stimulusAudio);
    }
  }, [task.conceptId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleOption(opt) {
    if (answeredRef.current) return;
    if (opt.isTarget) {
      answeredRef.current = true;
      setAnswered(true);
      setFlash({ adjPhrase: opt.adjPhrase, state: "correct" });
      playFeedback("correct");
      playTopicFile(topicId, task.correctAudio);
      setTimeout(() => onCorrect(task.conceptId), 1000);
    } else {
      setFlash({ adjPhrase: opt.adjPhrase, state: "wrong" });
      playFeedback("incorrect");
      setTimeout(() => setFlash(null), 600);
    }
  }

  function buttonState(opt) {
    if (!flash || flash.adjPhrase !== opt.adjPhrase) return "idle";
    return flash.state;
  }

  return (
    <div className="wf-form">
      <div className="wf-form__stimulus">
        {task.stimulus === "image"
          ? <StimulusImage topicId={topicId} path={task.stimulusImage} />
          : (
            <div className="wf-form__stimulus-phrase">
              <span>{task.stimulusText}</span>
              <button
                className="wf-audio-btn"
                onClick={() => playTopicFile(topicId, task.stimulusAudio)}
                aria-label="Прослушать"
              >
                🔊
              </button>
            </div>
          )
        }
      </div>

      <div className="wf-form__options">
        {task.options.map((opt) => {
          const state = buttonState(opt);
          return (
            <button
              key={opt.adjPhrase}
              className={`wf-option wf-option--${state}`}
              onClick={() => handleOption(opt)}
              disabled={answered}
            >
              {stripNoun(opt.adjPhrase)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
