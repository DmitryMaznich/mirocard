import { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { useAudio } from "@/shared/hooks/useAudio";
import { shuffle } from "@/shared/utils/shuffle";

const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

const OPTION_COUNT = 4;
const QUESTION_DELAY_MS = 1800;

function VisualImage({ topicId, path, className }) {
  const url = useTopicFile(topicId, path);
  return url
    ? <img className={className} src={url} alt="" draggable={false} />
    : <div className={`${className} wf-pair__visual-img--loading`} />;
}

// "рыбный суп" → "рыбный"
function stripNoun(phrase) {
  const words = phrase.trim().split(" ");
  return words.length > 1 ? words.slice(0, -1).join(" ") : phrase;
}

function buildOptions(card, allCards, difficulty) {
  if (difficulty === "hard" && card.wrongForms?.length >= 3) {
    return shuffle([
      { text: card.adjPhrase, isTarget: true },
      ...card.wrongForms.slice(0, OPTION_COUNT - 1).map(text => ({ text, isTarget: false })),
    ]);
  }

  // Easy: same-category cards (same questionText), adjective only (no noun)
  const sameCategory = allCards.filter(
    c => c.id !== card.id && c.questionText === card.questionText
  );
  const wrongTexts = shuffle(sameCategory)
    .slice(0, OPTION_COUNT - 1)
    .map(c => stripNoun(c.adjPhrase));

  return shuffle([
    { text: stripNoun(card.adjPhrase), isTarget: true },
    ...wrongTexts.map(text => ({ text, isTarget: false })),
  ]);
}

// Each task now represents a single card.
// Session engine handles card-to-card navigation via onAdvance / onCorrect / onIncorrect.
export default function PickFormTask({ task, topicId, onCorrect, onIncorrect }) {
  const { card, allCards } = task;
  const audioEnabled = task.params?.exerciseAudio ?? true;
  const difficulty   = task.params?.difficulty ?? "easy";

  const [picked, setPicked]     = useState(null);   // null | "correct" | "wrong"
  const [wrongIdx, setWrongIdx] = useState(null);
  const { playTopicFile } = useAudio();
  const timersRef  = useRef([]);
  const visualsRef = useRef();
  const promptRef1 = useRef();
  const promptRef2 = useRef();

  const options = useMemo(
    () => card ? buildOptions(card, allCards ?? [], difficulty) : [],
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
  }, [card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [card?.id]);

  function handleOption(optionIdx) {
    if (picked) return;
    const opt = options[optionIdx];
    if (opt.isTarget) {
      setPicked("correct");
      if (audioEnabled) playTopicFile(topicId, card.audioAdjPhrase);
      // playFeedback is handled by SessionScreen's handleCorrect wrapper
      onCorrect?.();
    } else {
      setWrongIdx(optionIdx);
      setPicked("wrong");
      // playFeedback is handled by SessionScreen's handleIncorrect wrapper
      onIncorrect?.();
    }
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
            {cap(card.nounPhrase)}
          </div>
          <div className="wf-pair__prompt-line wf-pair__prompt-line--question" ref={promptRef2}>
            {card.questionText ?? "Какой?"}
          </div>
        </div>

        <div className="wf-pick__options">
          {options.map((opt, i) => {
            let mod = "";
            if (picked === "correct" && opt.isTarget)   mod = "wf-pick__option--correct";
            if (picked === "wrong"   && i === wrongIdx)  mod = "wf-pick__option--wrong";
            if (picked === "correct" && !opt.isTarget)   mod = "wf-pick__option--dim";
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

    </div>
  );
}
