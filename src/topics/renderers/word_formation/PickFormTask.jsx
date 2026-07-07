import { useLayoutEffect, useRef, useState, useMemo } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { shuffle } from "@/shared/utils/shuffle";

const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

const PRONOUNS = {
  "какой?":  "Этот",
  "какая?":  "Эта",
  "какое?":  "Это",
  "какие?":  "Эти",
};

function getBaseNoun(nounPhrase) {
  return (nounPhrase ?? "").trim().split(" ")[0].toLowerCase();
}

function buildQuestion(card, hintMode) {
  const q = card.questionText ?? "какой?";
  if (hintMode === "noun_only") {
    const pronoun  = PRONOUNS[q] ?? "Этот";
    const baseNoun = getBaseNoun(card.nounPhrase);
    return `${pronoun} ${baseNoun} ${q}`;
  }
  return `${cap(card.nounPhrase)} (${q})`;
}

function VisualImage({ topicId, path, className }) {
  const url = useTopicFile(topicId, path);
  return url
    ? <img className={className} src={url} alt="" draggable={false} />
    : <div className={`${className} wf-pair__visual-img--loading`} />;
}

function stripNoun(phrase) {
  const words = phrase.trim().split(" ");
  return words.length > 1 ? words.slice(0, -1).join(" ") : phrase;
}

function buildOptions(card, allCards, difficulty) {
  if (difficulty === "hard" && card.wrongForms?.length >= 3) {
    return shuffle([
      { text: stripNoun(card.adjPhrase), isTarget: true },
      ...card.wrongForms.map(text => ({ text: stripNoun(text), isTarget: false })),
    ]);
  }

  const sameCategory = allCards.filter(
    c => c.id !== card.id && c.questionText === card.questionText
  );

  return shuffle([
    { text: stripNoun(card.adjPhrase), isTarget: true },
    ...sameCategory.map(c => ({ text: stripNoun(c.adjPhrase), isTarget: false })),
  ]);
}

export default function PickFormTask({ task, topicId, onCorrect, onIncorrect }) {
  const { card, allCards } = task;
  const difficulty  = task.params?.difficulty  ?? "easy";
  const hintMode    = task.params?.hintMode    ?? "phrase";
  const showImage   = task.params?.showImage   !== false;

  const [picked, setPicked]     = useState(null);
  const [wrongIdx, setWrongIdx] = useState(null);
  const visualsRef = useRef();
  const promptRef1 = useRef();

  const options = useMemo(
    () => card ? buildOptions(card, allCards ?? [], difficulty) : [],
    [card?.id, difficulty] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useLayoutEffect(() => {
    const visuals = visualsRef.current;
    if (!visuals) return;
    const targetW = visuals.offsetWidth;
    const el = promptRef1.current;
    if (!el) return;
    el.style.fontSize = "";
    const textW = el.scrollWidth;
    if (textW > 0) {
      el.style.fontSize =
        (parseFloat(getComputedStyle(el).fontSize) * targetW / textW) + "px";
    }
  }, [card?.id, hintMode]);

  function handleOption(optionIdx) {
    if (picked) return;
    const opt = options[optionIdx];
    if (opt.isTarget) {
      setPicked("correct");
      onCorrect?.();
    } else {
      setWrongIdx(optionIdx);
      setPicked("wrong");
      onIncorrect?.();
    }
  }

  if (!card) return null;

  return (
    <div className="wf-pair">
      <div className="wf-pair__content">
        <div className="wf-pair__visuals" ref={visualsRef} style={showImage ? undefined : { visibility: "hidden" }}>
          {card.vesselImage ? (
            <>
              <VisualImage topicId={topicId} path={card.ingredientImage} className="wf-pair__visual-img" />
              <div className="wf-pair__plus">+</div>
              <VisualImage topicId={topicId} path={card.vesselImage} className="wf-pair__visual-img" />
            </>
          ) : (
            <VisualImage topicId={topicId} path={card.ingredientImage} className="wf-pair__visual-img wf-pair__visual-img--solo" />
          )}
        </div>

        <div className="wf-pair__prompt">
          <div className="wf-pair__prompt-line wf-pair__prompt-line--question" ref={promptRef1}>
            {buildQuestion(card, hintMode)}
          </div>
        </div>

        <div className={`wf-pick__options${options.length > 4 ? " wf-pick__options--wide" : ""}`}>
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
