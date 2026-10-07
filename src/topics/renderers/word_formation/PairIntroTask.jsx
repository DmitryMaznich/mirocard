import { useState } from "react";
import { BackArrowIcon, ForwardArrowIcon } from "@/shared/components/ArrowIcons";
import { buildWordQuestion, modelAnswer } from "./exerciseModel";
import { ListenButton } from "./WordSpeech";
import WordMeaning from "./WordMeaning";

export default function PairIntroTask({ task, topicId, onAdvance }) {
  const [index, setIndex] = useState(0);
  const asking = task.params?.introStage === "answer";
  const showAnswer = !asking;
  const card = task.cards[index];
  if (!card) return null;
  const prompt = buildWordQuestion(card, { showImage: false, askForWord: asking });
  const answer = modelAnswer(card);

  function navigate(next) {
    if (next >= task.cards.length) { onAdvance?.(); return; }
    setIndex(next);
  }

  const hasImage = task.params?.showImage !== false && !!(card.ingredientImage ?? card.image);
  return <div className={`wf-pair wf-pair--lesson${hasImage ? "" : " wf-pair--text"}${hasImage ? " wf-pair--meaning" : ""}`}>
    <div className="wf-pair__content">
      {hasImage && <div className="wf-pair__visuals">
        <WordMeaning card={card} topicId={topicId} />
      </div>}
      <div className="wf-pair__prompt">
        <div className="wf-pair__prompt-line">{prompt}</div>
        <ListenButton text={prompt} label="Послушать условие" />
        {showAnswer && <div className="wf-lesson__model"><strong>{answer}</strong></div>}
      </div>
    </div>
    <div className="wf-pair__nav">
      <button className="wf-nav-btn" aria-label="Предыдущая пара" disabled={index === 0} onClick={() => navigate(index - 1)}><BackArrowIcon size={22} /></button>
      <span>{asking ? "Ответьте устно или средствами АДК" : "Рассмотрите и проговорите пару"}</span>
      <button className="wf-nav-btn wf-nav-btn--next" aria-label="Следующая пара" onClick={() => navigate(index + 1)}><ForwardArrowIcon size={22} /></button>
    </div>
  </div>;
}
