import { useEffect, useRef, useState } from "react";
import { shuffle } from "@/shared/utils/shuffle";

const MAX_ATTEMPTS = 3;
const MARKER_ATTEMPT_THRESHOLD = 2;

function withMarker(text, marker, active) {
  if (!marker || !active || !text) return text;
  const idx = text.toLowerCase().indexOf(marker.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="wa-marker">{text.slice(idx, idx + marker.length)}</mark>
      {text.slice(idx + marker.length)}
    </>
  );
}

function BlankSentence({ card, filledWord, showMarker }) {
  const [before, after] = card.sentence.split("{blank}");
  return (
    <div className="wa-task__text">
      {card.context && (
        <div className="wa-task__context">
          {withMarker(card.context, card.marker, showMarker)}
        </div>
      )}
      <div className="wa-task__sentence">
        {withMarker(before, card.marker, showMarker)}
        <span className={`wa-blank${filledWord ? " wa-blank--filled" : ""}`}>
          {filledWord ?? "···"}
        </span>
        {withMarker(after, card.marker, showMarker)}
      </div>
    </div>
  );
}

export default function FillBlankTask({ task, topicId, playTopicFile, onCorrect, onMistake, onAdvance, onCardShown, onTap }) {
  const { card, options } = task;

  // Only the deck's recorded audio (Gemini TTS, generated offline — see
  // scripts/generate-word-agreement-audio.mjs) is good enough for this
  // content; browser speech synthesis mis-stresses Russian words and reads
  // too flat, so cards without recorded audio just stay silent for now.
  function playCorrectAudio() {
    if (card.audio && topicId && playTopicFile) {
      playTopicFile(topicId, card.audio);
    }
  }

  const [shownOptions, setShownOptions] = useState(() => shuffle(options));
  const [wrongCount, setWrongCount]     = useState(0);
  const [wrongIdx, setWrongIdx]         = useState(null);
  const [status, setStatus]             = useState("active"); // active | correct | revealed
  const revealTimerRef = useRef(null);
  const advanceTimerRef = useRef(null);

  useEffect(() => {
    setShownOptions(shuffle(options));
    setWrongCount(0);
    setWrongIdx(null);
    setStatus("active");
    onCardShown?.(card.id, card.id);
    return () => {
      clearTimeout(revealTimerRef.current);
      clearTimeout(advanceTimerRef.current);
    };
  }, [card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePick(idx) {
    if (status !== "active") return;
    const word = shownOptions[idx];
    const isCorrect = word === card.answer;
    onTap?.(word, isCorrect);

    if (isCorrect) {
      setStatus("correct");
      playCorrectAudio();
      advanceTimerRef.current = setTimeout(() => onCorrect?.(card.id, card.id), 1200);
      return;
    }

    setWrongIdx(idx);
    const nextWrongCount = wrongCount + 1;
    setWrongCount(nextWrongCount);

    if (nextWrongCount >= MAX_ATTEMPTS) {
      setStatus("revealed");
      playCorrectAudio();
      onMistake?.(card.id, card.id);
      revealTimerRef.current = setTimeout(() => onAdvance?.(), 2200);
      return;
    }

    setTimeout(() => {
      setWrongIdx(null);
      setShownOptions((opts) => shuffle(opts));
    }, 500);
  }

  const filledWord = status === "active" ? null : card.answer;
  const showMarker = status === "active" && wrongCount >= MARKER_ATTEMPT_THRESHOLD;

  return (
    <div className="wa-task">
      <BlankSentence card={card} filledWord={filledWord} showMarker={showMarker} />

      <div className="wa-options">
        {shownOptions.map((word, i) => {
          let mod = "";
          if (status !== "active" && word === card.answer) mod = "wa-option--correct";
          else if (i === wrongIdx) mod = "wa-option--wrong";
          else if (status !== "active") mod = "wa-option--dim";
          return (
            <button
              key={word}
              className={`wa-option ${mod}`}
              onClick={() => handlePick(i)}
              disabled={status !== "active"}
            >
              {word}
            </button>
          );
        })}
      </div>
    </div>
  );
}
