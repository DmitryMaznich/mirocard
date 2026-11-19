import { useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { emotionCardGender, emotionPrompt } from "@/topics/emotionsContent";
import "./emotionLesson.css";

function LessonImage({ topicId, path, alt = "" }) {
  const url = useTopicFile(topicId, path);
  return url
    ? <img className="emotion-lesson__image" src={url} alt={alt} draggable={false} />
    : <span className="emotion-lesson__image emotion-lesson__placeholder" aria-hidden="true" />;
}

export default function EmotionLesson({
  task, topicId, sessionStatus, interactionDisabled, onAdvance, onCorrect, onIncorrect,
  onStreakReset, onRecordAssessment, onTap,
}) {
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState([]);
  const [miss, setMiss] = useState(null);
  const [hadWrong, setHadWrong] = useState(false);
  const [finished, setFinished] = useState(false);
  const [quality, setQuality] = useState("");
  const { type, card } = task;
  const conceptId = task.conceptId ?? task.targetConceptId;
  const sceneLabel = task.situationText ?? (type === "situation_emotion" ? task.targetLabel : null);
  const scene = task.sceneImage;
  const altCard = emotionCardGender(card) === "female" ? "Портрет девочки"
    : emotionCardGender(card) === "male" ? "Портрет мальчика" : "Портрет ребёнка";
  const sceneGender = task.gender ?? emotionCardGender({ sceneImage: scene, id: task.sceneId });
  const disabled = interactionDisabled || finished || sessionStatus === "answer_correct";
  const isOral = type === "emotion_control";
  const isIntro = type === "intro" || type === "situation_intro";
  const canAdvance = isIntro || sessionStatus === "answer_correct";
  const revealPending = !revealed && (type === "situation_intro" || type === "situation_emotion" || isOral);

  let question;
  let stimulus;
  let answers = [];
  let mediaType = "";
  const portrait = card?.image && <LessonImage topicId={topicId} path={card.image} alt={altCard} />;
  const sceneImage = scene && <LessonImage topicId={topicId} path={scene} alt={sceneLabel} />;

  switch (type) {
    case "intro":
      question = task.label;
      stimulus = portrait;
      break;
    case "find_n":
      question = emotionPrompt("find", conceptId, null, task.targetLabel);
      mediaType = "portrait";
      answers = task.options.map((option) => ({ ...option, id: option.card.id, path: option.card.image }));
      break;
    case "yes_no":
      question = emotionPrompt("yesNo", task.displayConceptId, emotionCardGender(card), task.displayLabel);
      stimulus = portrait;
      answers = [
        { id: "yes", label: "Да", isTarget: task.isLabelCorrect },
        { id: "no", label: "Нет", isTarget: !task.isLabelCorrect },
      ];
      break;
    case "choose_word_by_picture":
    case "emotion_control":
      question = isOral ? emotionPrompt("name", conceptId, emotionCardGender(card)) : "Выбери слово";
      stimulus = portrait;
      if (!revealPending) answers = task.options.map((option) => ({ ...option, id: option.conceptId }));
      break;
    case "choose_all":
      question = emotionPrompt("all", conceptId, null, task.targetLabel);
      mediaType = "portrait";
      answers = task.allCards.map((option) => ({
        id: option.id, card: option, path: option.image, isTarget: task.targetCardIds.includes(option.id),
      }));
      break;
    case "situation_intro":
      question = revealed ? (task.discussion ? "" : task.label) : "Что случилось?";
      stimulus = revealed && sceneImage && portrait
        ? <div className="emotion-lesson__pair">{sceneImage}{portrait}</div>
        : sceneImage || portrait;
      break;
    case "situation_emotion":
      question = emotionPrompt("name", conceptId, sceneGender);
      stimulus = sceneImage;
      mediaType = "portrait";
      if (revealed) answers = task.options.map((option) => ({ ...option, id: option.card.id, path: option.card.image }));
      break;
    case "emotion_situation":
      question = emotionPrompt("where", conceptId);
      mediaType = "scene";
      answers = task.options.map((option) => ({ ...option, path: option.sceneImage }));
      break;
    default:
      return null;
  }

  function reveal() {
    if (isOral && quality) onRecordAssessment?.(quality, conceptId, card?.id);
    setRevealed(true);
  }

  function choose(event, option) {
    event.stopPropagation();
    if (disabled || selected.includes(option.id) || miss === option.id) return;
    const cardId = task.sceneId ?? card?.id ?? option.card?.id ?? option.id;
    onTap?.(option.id, option.isTarget);

    if (!option.isTarget) {
      setMiss(option.id);
      setHadWrong(true);
      if (type !== "choose_all") onStreakReset?.(conceptId, cardId);
      return;
    }
    const next = [...selected, option.id];
    setSelected(next);
    setMiss(null);
    if (next.length !== answers.filter((answer) => answer.isTarget).length) return;
    setFinished(true);
    if (type === "choose_all" && hadWrong) onIncorrect(conceptId, cardId);
    else onCorrect(conceptId, cardId);
  }

  const answerKind = mediaType || "words";
  const layout = stimulus && answers.length ? " emotion-lesson__layout--split" : "";
  return (
    <section className="emotion-lesson" aria-label="Задание">
      <div className="emotion-lesson__exercise">
        {question && <h1 className="emotion-lesson__question">{question}</h1>}
        <div className={`emotion-lesson__layout${layout}`}>
          {stimulus && <div className="emotion-lesson__stimulus">{stimulus}</div>}
          {answers.length > 0 && (
            <div className={`emotion-lesson__answers emotion-lesson__answers--${answerKind}${isOral ? " emotion-lesson__answers--tags" : ""}`} data-count={answers.length}>
              {answers.map((option, index) => {
                const correct = selected.includes(option.id);
                const wrong = !correct && miss === option.id;
                const label = answerKind === "scene" ? (option.label || `Сюжет ${index + 1}`)
                  : answerKind === "portrait" ? `Портрет ${index + 1}` : option.label;
                return (
                  <button
                    type="button"
                    key={option.id}
                    className="emotion-lesson__option"
                    data-result={correct ? "correct" : wrong ? "incorrect" : undefined}
                    disabled={disabled || correct}
                    aria-label={correct ? `${label}, выбрано` : label}
                    onClick={(event) => choose(event, option)}
                  >
                    {mediaType ? <LessonImage topicId={topicId} path={option.path} /> : option.label}
                    {(correct || wrong) && <span className="emotion-lesson__mark" aria-hidden="true">{correct ? "✓" : "×"}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <span className="emotion-lesson__status" role="status">
        {miss ? "Попробуй ещё." : selected.length ? "Верно." : ""}
      </span>
      {(canAdvance || revealPending) && (
        <div className="emotion-lesson__controls" aria-label="Управление взрослого">
          {sceneLabel && (
            <details className="emotion-lesson__adult-note">
              <summary>Текст для взрослого</summary>
              <p>{sceneLabel}</p>
            </details>
          )}
          {isOral && revealPending && (
            <select aria-label="Устный ответ" value={quality} disabled={interactionDisabled} onChange={(event) => setQuality(event.target.value)}>
              <option value="">Устный ответ</option>
              <option value="independent">Самостоятельно</option>
              <option value="prompted">С подсказкой</option>
              <option value="none">Нет ответа</option>
            </select>
          )}
          <button type="button" disabled={interactionDisabled} onClick={(event) => {
            event.stopPropagation();
            if (revealPending) reveal();
            else onAdvance();
          }}>
            {revealPending ? (type === "situation_intro" ? "Показать лицо" : "Показать варианты") : "Дальше"}
          </button>
        </div>
      )}
    </section>
  );
}
