import { useEffect, useRef, useState } from "react";
import { shuffle } from "@/shared/utils/shuffle";
import { ADJECTIVE_FORMS, POSSESSIVE_FORMS } from "./engine.js";

const MAX_ATTEMPTS = 3;

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

// The true grammatical ending isn't a fixed number of letters — "маленький"
// (masc, -ий), "свой" (masc, -й) and "наш" (masc, zero ending!) all end
// differently. The only correct way to find it is to compare a word against
// the *other forms of the same word* and take what's left after their shared
// root — never against a different word standing next to it as a distractor
// (possessive_agreement mixes свой/мой/твой/наш as options for the same
// gender, and those share no root at all).
function commonPrefixLength(words) {
  return words.reduce((len, word) => {
    let i = 0;
    while (i < len && i < word.length && word[i] === words[0][i]) i++;
    return Math.min(len, i);
  }, words[0]?.length ?? 0);
}

function buildEndingMap(formsByLexeme) {
  const endings = new Map();
  for (const forms of Object.values(formsByLexeme)) {
    const words = Object.values(forms);
    const rootLength = commonPrefixLength(words);
    for (const word of words) endings.set(word, word.slice(rootLength));
  }
  return endings;
}

// Only adjective_agreement and possessive_agreement options are looked up
// here (see showOptionEndings below) — every word they can offer is one of
// these two paradigms, so a miss never happens for them in practice.
const OPTION_ENDINGS = new Map([...buildEndingMap(ADJECTIVE_FORMS), ...buildEndingMap(POSSESSIVE_FORMS)]);

// свой/мой/твой decline like "чей", not like a real adjective — their ending
// is one letter (сво-й, мо-я, тво-ё…), and чья/чьё/чьи additionally swap the
// root's е for ь. какой declines like a genuine adjective (2-letter ending),
// matching ADJECTIVE_FORMS exactly. This is a fixed, closed 8-word set (the
// only two question families word_agreement content uses), listed directly
// rather than derived, since the root-swap makes a generic diff unreliable.
const QUESTION_ENDINGS = {
  "какой?": "ой", "какая?": "ая", "какое?": "ое", "какие?": "ие",
  "чей?": "й", "чья?": "я", "чьё?": "ё", "чьи?": "и",
};

// A word/ending pair may legitimately have an empty ending (наш's masculine
// form has none — "наш" *is* the root) — nothing gets highlighted then,
// same outcome as a lookup miss.
function withEnding(word, ending) {
  if (!ending) return word;
  const splitAt = word.length - ending.length;
  return (
    <>
      {word.slice(0, splitAt)}
      <mark className="wa-ending">{ending}</mark>
    </>
  );
}

function withQuestionEnding(question) {
  const ending = QUESTION_ENDINGS[question];
  if (!ending) return question;
  const wordPart = question.slice(0, question.length - ending.length - 1); // -1 for the trailing "?"
  const punctuation = question.slice(wordPart.length + ending.length);
  return (
    <>
      {wordPart}
      <mark className="wa-ending">{ending}</mark>
      {punctuation}
    </>
  );
}

function BlankSentence({ card, filledWord, showHint }) {
  const [before, after] = card.sentence.split("{blank}");
  // Reserve the blank's final width up front from the answer's own length
  // (never the letters themselves — just the count) so filling it in
  // doesn't reflow the line. Floor of 3ch keeps very short answers from
  // looking like a stray dash.
  const blankWidth = `${Math.max(card.answer.length, 3)}ch`;
  return (
    <div className="wa-task__text">
      {card.context && (
        <div className="wa-task__context">
          {withMarker(card.context, card.marker, showHint)}
        </div>
      )}
      <div className="wa-task__sentence">
        {withMarker(before, card.marker, showHint)}
        {showHint && card.question && (
          <em className="wa-question">({withQuestionEnding(card.question)})</em>
        )}
        <span
          className={`wa-blank${filledWord ? " wa-blank--filled" : ""}`}
          style={{ minWidth: blankWidth }}
        >
          {filledWord ?? "···"}
        </span>
        {withMarker(after, card.marker, showHint)}
      </div>
    </div>
  );
}

export default function FillBlankTask({ task, topicId, playTopicFile, onCorrect, onMistake, onAdvance, onCardShown, onTap }) {
  const { card, options, type } = task;

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
  const [hintUsed, setHintUsed] = useState(false);
  const wrongTimerRef = useRef(null);

  useEffect(() => {
    onCardShown?.(card.id, card.id);
    setHintUsed(false);
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
  const showHint = status === "active" && hintUsed;
  // Ending-comparison only covers adjective_agreement/possessive_agreement —
  // OPTION_ENDINGS only knows those two paradigms. Other fill-blank types
  // (case_agreement, verb forms, numerals) still get the question line and
  // marker highlight, just without an ending lookup that would either miss
  // or (worse) guess wrong for words outside those two tables.
  const showOptionEndings = showHint && (type === "adjective_agreement" || type === "possessive_agreement");

  return (
    <div className="wa-task">
      {status === "active" && !hintUsed && (
        <button
          className="wa-hint-button"
          type="button"
          onClick={() => setHintUsed(true)}
          aria-label="Подсказка"
        >
          💡
        </button>
      )}

      <BlankSentence card={card} filledWord={filledWord} showHint={showHint} />

      <div className={`wa-options wa-options--${shownOptions.length}`}>
        {shownOptions.map((word, i) => {
          let mod = "";
          const isCorrectAnswer = status !== "active" && word === card.answer;
          const isWrongPick = i === wrongIdx;
          if (isCorrectAnswer) mod = "wa-option--correct";
          else if (isWrongPick) mod = "wa-option--wrong";
          else if (status !== "active") mod = "wa-option--dim";
          return (
            <button
              key={word}
              className={`wa-option ${mod}`}
              onClick={() => handlePick(i)}
              disabled={status !== "active"}
            >
              {/* Color alone (green/red) isn't enough for colorblind readers —
                  the glyph carries the same meaning independently of hue. */}
              {isCorrectAnswer && <span className="wa-option__icon" aria-hidden="true">✓</span>}
              {isWrongPick && <span className="wa-option__icon" aria-hidden="true">✗</span>}
              {showOptionEndings ? withEnding(word, OPTION_ENDINGS.get(word)) : word}
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
