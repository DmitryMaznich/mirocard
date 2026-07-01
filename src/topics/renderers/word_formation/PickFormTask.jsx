import { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { useAudio } from "@/shared/hooks/useAudio";
import { useAppStore } from "@/core/store";
import { shuffle } from "@/shared/utils/shuffle";

const OPTION_COUNT = 4;
const QUESTION_DELAY_MS = 1800;

function VisualImage({ topicId, path, className }) {
  const url = useTopicFile(topicId, path);
  return url
    ? <img className={className} src={url} alt="" draggable={false} />
    : <div className={`${className} wf-pair__visual-img--loading`} />;
}

function buildOptions(card, allCards, difficulty) {
  const correct = { text: card.adjPhrase, isTarget: true };

  let wrongTexts;
  if (difficulty === "hard" && card.wrongForms?.length >= 3) {
    wrongTexts = card.wrongForms.slice(0, OPTION_COUNT - 1);
  } else {
    wrongTexts = shuffle(allCards.filter(c => c.id !== card.id))
      .slice(0, OPTION_COUNT - 1)
      .map(c => c.adjPhrase);
  }

  return shuffle([correct, ...wrongTexts.map(text => ({ text, isTarget: false }))]);
}

export default function PickFormTask({ task, topicId, onAdvance, onCorrect, onIncorrect }) {
  const { cards } = task;
  const [index, setIndex]     = useState(0);
  const [picked, setPicked]   = useState(null);   // null | "correct" | "wrong"
  const [wrongIdx, setWrongIdx] = useState(null);
  const { playTopicFile, playFeedback } = useAudio();
  const audioEnabled  = useAppStore((s) => s.settings?.exerciseAudio ?? true);
  const difficulty    = useAppStore((s) => s.settings?.wordFormationLevel ?? "easy");
  const timersRef     = useRef([]);
  const visualsRef    = useRef();
  const promptRef1    = useRef();
  const promptRef2    = useRef();

  const card   = cards[index];
  const isLast = index === cards.length - 1;

  const options = useMemo(
    () => card ? buildOptions(card, cards, difficulty) : [],
    [card?.id, difficulty] // eslint-disable-line react-hooks/exhaustive-deps
  );

  function clearTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  useEffect(() => {
    setPicked(null);
    setWrongIdx(null);
    clearTimers();
    if (!card) return;
    if (audioEnabled) {
      playTopicFile(topicId, card.audioPrepPhrase);
      timersRef.current.push(
        setTimeout(() => playTopicFile(topicId, card.audioQuestion ?? "audio/question.mp3"), QUESTION_DELAY_MS)
      );
    }
    return clearTimers;
  }, [index, card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const visuals = visualsRef.current;
    if (!visuals) return;
    const targetW = visuals.offsetWidth;
    [promptRef1, promptRef2].forEach(ref => {
      const el = ref.current;
      if (!el) return;
      el.style.fontSize = "";
      const textW = el.scrollWidth;
      if (textW > 0) {
        el.style.fontSize =
          (parseFloat(getComputedStyle(el).fontSize) * targetW / textW) + "px";
      }
    });
  }, [index, card?.id]);

  function handleOption(optionIdx) {
    if (picked) return;
    const opt = options[optionIdx];
    if (opt.isTarget) {
      setPicked("correct");
      if (audioEnabled) playTopicFile(topicId, card.audioAdjPhrase);
      playFeedback("correct");
      onCorrect?.();
    } else {
      setWrongIdx(optionIdx);
      setPicked("wrong");
      playFeedback("incorrect");
      onIncorrect?.();
    }
  }

  function handleNext() {
    if (!isLast) setIndex(i => i + 1);
    else onAdvance();
  }

  function handlePrev() {
    if (index > 0) setIndex(i => i - 1);
  }

  if (!card) return null;

  return (
    <div className="wf-pair">
      <div className="wf-pair__content">
        <div className="wf-pair__visuals" ref={visualsRef}>
          <VisualImage topicId={topicId} path={card.ingredientImage} className="wf-pair__visual-img" />
          <div className="wf-pair__plus">+</div>
          <VisualImage topicId={topicId} path={card.vesselImage ?? "media/pot.webp"} className="wf-pair__visual-img" />
        </div>

        <div className="wf-pair__prompt">
          <div className="wf-pair__prompt-line" ref={promptRef1}>
            Готовим {card.nounPhrase}
          </div>
          <div className="wf-pair__prompt-line wf-pair__prompt-line--question" ref={promptRef2}>
            {card.questionText ?? "Какой суп получится?"}
          </div>
        </div>

        <div className="wf-pick__options">
          {options.map((opt, i) => {
            let mod = "";
            if (picked === "correct" && opt.isTarget)  mod = "wf-pick__option--correct";
            if (picked === "wrong"   && i === wrongIdx) mod = "wf-pick__option--wrong";
            if (picked === "correct" && !opt.isTarget)  mod = "wf-pick__option--dim";
            return (
              <button
                key={i}
                className={`wf-pick__option ${mod}`}
                onClick={() => handleOption(i)}
                disabled={!!picked}
              >
                {opt.text}
              </button>
            );
          })}
        </div>
      </div>

      <div className="wf-pair__nav">
        <button className="wf-nav-btn" onClick={handlePrev} disabled={index === 0}>←</button>
        <div className="wf-pair__dots">
          {cards.map((c, i) => (
            <span key={c.id} className={`wf-pair__dot${i === index ? " wf-pair__dot--active" : ""}`} />
          ))}
        </div>
        <button
          className="wf-nav-btn wf-nav-btn--next"
          onClick={handleNext}
          disabled={!picked}
        >
          {isLast ? "Готово" : "→"}
        </button>
      </div>
    </div>
  );
}
