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
      <div className="sp-stage-label">Посмотри и узнай</div>
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

function RecognizeTask({ task, topicId, playTopicFile, soundEnabled, onCorrect, onMistake, onAdvance, onCardShown, onTap }) {
  const { card, options, showInstructionText, type } = task;
  const [result, setResult] = useState(null);
  const voice = (text, audio) => speak({ topicId, text, audio, playTopicFile, soundEnabled });

  useEffect(() => {
    onCardShown?.(card.id, card.conceptId);
    voice(card.recognizePrompt, card.recognizeAudio);
  }, [card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function choose(option) {
    if (result) return;
    onTap?.(option.id, option.isTarget);
    if (option.isTarget) {
      setResult("correct");
      voice(card.model, card.modelAudio);
      onCorrect?.(card.conceptId, card.id);
      return;
    }
    setResult("model");
    voice(card.model, card.modelAudio);
    onMistake?.(card.conceptId, card.id);
  }

  const isTransfer = type === "spatial_transfer";
  const isMixed = type === "spatial_mixed";
  return (
    <main className="sp-task sp-task--recognize">
      <div className="sp-stage-label">{isMixed ? "Микс" : isTransfer ? "Новая картинка" : "Покажи"}</div>
      <div className={`sp-instruction${showInstructionText ? "" : " sp-instruction--audio-only"}`}>
        {showInstructionText ? card.recognizePrompt : "Слушай задание"}
      </div>
      <div className="sp-choice-grid" aria-label={card.recognizePrompt}>
        {options.map((option) => {
          const revealTarget = result === "model" && option.isTarget;
          const correctTarget = result === "correct" && option.isTarget;
          return (
            <button
              key={option.id}
              type="button"
              className={`sp-choice${revealTarget || correctTarget ? " sp-choice--target" : ""}${result && !option.isTarget ? " sp-choice--muted" : ""}`}
              onClick={() => choose(option)}
              disabled={Boolean(result)}
            >
              <Photo topicId={topicId} path={option.image} />
            </button>
          );
        })}
      </div>
      <RepeatButton onClick={() => voice(card.recognizePrompt, card.recognizeAudio)} label="Повторить" />
      {result && <div className="sp-model-line" aria-live="polite">{card.model}</div>}
      {result === "model" && <button className="sp-primary-button" type="button" onClick={onAdvance}>Дальше</button>}
    </main>
  );
}

function RespondTask({ task, topicId, playTopicFile, soundEnabled, onAdvance, onCardShown }) {
  const { card } = task;
  const [revealed, setRevealed] = useState(false);
  const voice = (text, audio) => speak({ topicId, text, audio, playTopicFile, soundEnabled });

  useEffect(() => {
    onCardShown?.(card.id, card.conceptId);
    voice(card.question, card.questionAudio);
  }, [card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function reveal() {
    if (revealed) return;
    setRevealed(true);
    voice(card.model, card.modelAudio);
  }

  return (
    <main className="sp-task sp-task--respond">
      <div className="sp-stage-label">Ответь</div>
      <Photo topicId={topicId} path={card.image} />
      <h1 className="sp-question">{card.question}</h1>
      {!revealed ? (
        <div className="sp-actions">
          <RepeatButton onClick={() => voice(card.question, card.questionAudio)} label="Повторить вопрос" />
          <button className="sp-primary-button" type="button" onClick={reveal}>Показать ответ</button>
        </div>
      ) : (
        <>
          <div className="sp-answer" aria-live="polite">{card.phrase}</div>
          <div className="sp-model-line">{card.model}</div>
          <div className="sp-actions">
            <RepeatButton onClick={() => voice(card.model, card.modelAudio)} label="Слушать ещё раз" />
            <button className="sp-primary-button" type="button" onClick={onAdvance}>Дальше</button>
          </div>
        </>
      )}
    </main>
  );
}

export default function SpatialPrepositionsTask(props) {
  switch (props.task?.type) {
    case "spatial_introduction": return <IntroductionTask {...props} />;
    case "spatial_recognize":
    case "spatial_transfer":
    case "spatial_mixed": return <RecognizeTask {...props} />;
    case "spatial_respond": return <RespondTask {...props} />;
    default: return <div className="sp-task">Нет подходящего упражнения.</div>;
  }
}
