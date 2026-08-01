import { useEffect, useRef, useState } from "react";
import { shuffle } from "@/shared/utils/shuffle";

const MAX_ATTEMPTS = 3;
const MARKER_ATTEMPT_THRESHOLD = 2;

// JS's \b word boundary only recognizes [A-Za-z0-9_], not Cyrillic, so a
// plain indexOf/regex search for a short marker like "о" or "с" would also
// match that letter sequence inside an unrelated word (e.g. "о" inside
// "комнате"). Walk occurrences manually and keep only ones flanked by a
// non-letter (or string start/end) on both sides.
const LETTER_RE = /[a-zа-яё]/i;

function findStandaloneIndex(text, marker) {
  const lowerText = text.toLowerCase();
  const lowerMarker = marker.toLowerCase();
  let from = 0;
  while (from <= lowerText.length) {
    const idx = lowerText.indexOf(lowerMarker, from);
    if (idx === -1) return -1;
    const before = lowerText[idx - 1];
    const after = lowerText[idx + lowerMarker.length];
    if (!LETTER_RE.test(before ?? "") && !LETTER_RE.test(after ?? "")) return idx;
    from = idx + 1;
  }
  return -1;
}

function withMarker(text, marker, active) {
  if (!marker || !active || !text) return text;
  const idx = findStandaloneIndex(text, marker);
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
  const [wrongCount, setWrongCount] = useState(0);
  const [wrongIdx, setWrongIdx] = useState(null);
  const [status, setStatus] = useState("active");
  const wrongTimerRef = useRef(null);

  useEffect(() => {
    onCardShown?.(card.id, card.id);
    return () => clearTimeout(wrongTimerRef.current);
  }, [card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePick(idx) {
    if (status !== "active") return;
    const word = shownOptions[idx];
    const isCorrect = word === card.answer;
    onTap?.(word, isCorrect);

    if (isCorrect) {
      setStatus("correct");
      playCorrectAudio();
      onCorrect?.(card.id, card.id);
      return;
    }

    setWrongIdx(idx);
    const nextWrongCount = wrongCount + 1;
    setWrongCount(nextWrongCount);

    if (nextWrongCount >= MAX_ATTEMPTS) {
      setStatus("revealed");
      playCorrectAudio();
      onMistake?.(card.id, card.id);
      return;
    }

    wrongTimerRef.current = setTimeout(() => {
      setWrongIdx(null);
      setShownOptions((currentOptions) => shuffle(currentOptions));
    }, 500);
  }

  const filledWord = status === "active" ? null : card.answer;
  const showMarker = status === "active" && wrongCount >= MARKER_ATTEMPT_THRESHOLD;

  return (
    <div className="wa-task">
      <BlankSentence card={card} filledWord={filledWord} showMarker={showMarker} />

      <div className={`wa-options wa-options--${shownOptions.length}`}>
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

      {status === "revealed" && (
        <button className="wa-next-button" type="button" onClick={onAdvance}>
          Дальше
        </button>
      )}
    </div>
  );
}
