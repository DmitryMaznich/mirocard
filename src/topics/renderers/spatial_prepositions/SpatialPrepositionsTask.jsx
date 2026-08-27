import { useEffect, useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";

function speak({ topicId, text, audio, playTopicFile, soundEnabled }) {
  if (!soundEnabled || !text) return;
  if (audio && playTopicFile) {
    playTopicFile(topicId, audio);
    return;
  }
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ru-RU";
  utterance.rate = 0.82;
  window.speechSynthesis.speak(utterance);
}

function Photo({ topicId, path, className = "" }) {
  const url = useTopicFile(topicId, path);
  if (!url) return <div className={`sp-photo sp-photo--loading ${className}`} aria-hidden="true" />;
  return <img className={`sp-photo ${className}`} src={url} alt="" draggable={false} />;
}

function RepeatButton({ onClick, label = "Повторить", iconOnly = false }) {
  return (
    <button
      className={`sp-audio-button${iconOnly ? " sp-audio-button--icon" : ""}`}
      type="button"
      onClick={onClick}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
    >
      🔊{iconOnly ? null : ` ${label}`}
    </button>
  );
}

function IntroductionTask({ task, topicId, playTopicFile, soundEnabled, onAdvance, onCardShown }) {
  const { card, modelFirst } = task;
  const [revealed, setRevealed] = useState(modelFirst);
  const voice = (text, audio) => speak({ topicId, text, audio, playTopicFile, soundEnabled });

  useEffect(() => {
    onCardShown?.(card.id, card.conceptId);
    voice(modelFirst ? card.model : card.question, modelFirst ? card.modelAudio : card.questionAudio);
  }, [card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function reveal() {
    if (revealed) return;
    setRevealed(true);
    voice(card.model, card.modelAudio);
  }

  return (
    <main className="sp-task sp-task--introduction">
      <Photo topicId={topicId} path={card.image} />
      {!revealed ? (
        <>
          <h1 className="sp-question">{card.question}</h1>
          <div className="sp-actions sp-actions--question">
            <RepeatButton onClick={() => voice(card.question, card.questionAudio)} label="Повторить вопрос" iconOnly />
            <button className="sp-primary-button" type="button" onClick={reveal}>Узнать</button>
          </div>
        </>
      ) : (
        <>
          <div className="sp-answer" aria-live="polite">{card.phrase}</div>
          <div className="sp-actions sp-actions--question">
            <RepeatButton onClick={() => voice(card.model, card.modelAudio)} label="Слушать ещё раз" iconOnly />
            <button className="sp-primary-button" type="button" onClick={onAdvance}>Дальше</button>
          </div>
        </>
      )}
    </main>
  );
}

function RecognizeTask({ task, topicId, playTopicFile, soundEnabled, onCorrect, onIncorrect, onCardShown, onTap }) {
  const { card, options } = task;
  const [selectedOption, setSelectedOption] = useState(null);
  const voice = (text, audio) => speak({ topicId, text, audio, playTopicFile, soundEnabled });

  useEffect(() => {
    onCardShown?.(card.id, card.conceptId);
    voice(card.recognizePrompt, card.recognizeAudio);
  }, [card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function choose(option) {
    if (selectedOption) return;
    onTap?.(option.id, option.isTarget);
    setSelectedOption(option);
    if (option.isTarget) {
      onCorrect?.(card.conceptId, card.id);
      return;
    }
    onIncorrect?.(card.conceptId, card.id);
  }

  return (
    <main className="sp-task sp-task--recognize">
      {task.type === "spatial_recognize" && (
        <h1 className="sp-recognize-prompt">{card.recognizePrompt}</h1>
      )}
      <div className="sp-choice-grid" aria-label={card.recognizePrompt}>
        {options.map((option) => {
          const correctTarget = selectedOption?.isTarget && option.isTarget;
          const incorrectChoice = selectedOption && !selectedOption.isTarget && selectedOption.id === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={`sp-choice${correctTarget ? " sp-choice--target" : ""}${incorrectChoice ? " sp-choice--incorrect" : ""}`}
              onClick={() => choose(option)}
              disabled={Boolean(selectedOption)}
            >
              <Photo topicId={topicId} path={option.image} />
            </button>
          );
        })}
      </div>
      <RepeatButton onClick={() => voice(card.recognizePrompt, card.recognizeAudio)} label="Повторить задание" iconOnly />
    </main>
  );
}

function RespondTask({ task, topicId, playTopicFile, soundEnabled, onCorrect, onIncorrect, onCardShown, onTap }) {
  const { card, options } = task;
  const [selectedOption, setSelectedOption] = useState(null);
  const voice = (text, audio) => speak({ topicId, text, audio, playTopicFile, soundEnabled });

  useEffect(() => {
    onCardShown?.(card.id, card.conceptId);
    voice(card.question, card.questionAudio);
  }, [card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function choose(option) {
    if (selectedOption) return;
    onTap?.(option.id, option.isTarget);
    setSelectedOption(option);
    if (option.isTarget) {
      onCorrect?.(card.conceptId, card.id);
      return;
    }
    onIncorrect?.(card.conceptId, card.id);
  }

  return (
    <main className="sp-task sp-task--respond">
      <Photo topicId={topicId} path={card.image} />
      <h1 className="sp-question">{card.question}</h1>
      <div className="sp-answer-choice-grid" aria-label={card.question}>
        {options.map((option) => {
          const correctTarget = selectedOption?.isTarget && option.isTarget;
          const incorrectChoice = selectedOption && !selectedOption.isTarget && selectedOption.id === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={`sp-answer-choice${correctTarget ? " sp-answer-choice--target" : ""}${incorrectChoice ? " sp-answer-choice--incorrect" : ""}`}
              onClick={() => choose(option)}
              disabled={Boolean(selectedOption)}
            >
              {option.text}
            </button>
          );
        })}
      </div>
      <RepeatButton onClick={() => voice(card.question, card.questionAudio)} label="Повторить вопрос" iconOnly />
    </main>
  );
}

export default function SpatialPrepositionsTask(props) {
  switch (props.task?.type) {
    case "spatial_introduction": return <IntroductionTask {...props} />;
    case "spatial_recognize":
    case "spatial_transfer": return <RecognizeTask {...props} />;
    case "spatial_respond": return <RespondTask {...props} />;
    default: return <div className="sp-task">Нет подходящего упражнения.</div>;
  }
}
