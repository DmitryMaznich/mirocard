import { Fragment, useRef, useState } from "react";
import { getStoryQuizTargetMatches, isStoryQuizFunctionWord, tokenizeStoryQuizWords } from "./storyQuiz";

// Shared by the story-quiz mode and the micro-story reader: picking one word
// in the text, confirming it and recording the attempts.

export function getLineText(line, textStyle = "normal") {
  if (typeof line === "string") return line;
  if (textStyle === "syllables" && line?.syllableText) return line.syllableText;
  return line?.text ?? "";
}

export function useStoryQuizChoice() {
  const [selected, setSelected] = useState(null);
  const [rejected, setRejected] = useState(false);
  const attempts = useRef([]);
  const submittedId = useRef(null);

  function select(candidate) {
    if (candidate.id === selected?.id) return;
    submittedId.current = null;
    setRejected(false);
    setSelected(candidate);
  }
  function confirm(onTarget, onMiss) {
    if (!selected || submittedId.current === selected.id) return;
    submittedId.current = selected.id;
    // A correct tap records the whole answer phrase it belongs to.
    const answer = (selected.isTarget ? selected.answerText ?? selected.text : selected.text).replace(/(\p{L})-(?=\p{L})/gu, "$1");
    attempts.current = [...attempts.current, { answer, correct: selected.isTarget }];
    const result = { firstAnswer: attempts.current[0].answer, attempts: attempts.current };
    if (selected.isTarget) onTarget(result);
    else { setRejected(true); onMiss(result); }
  }
  function reset() {
    attempts.current = [];
    submittedId.current = null;
    setSelected(null);
    setRejected(false);
  }
  return { selected, rejected, select, confirm, reset };
}

export function storyQuizSearchHint(prompt, rejected, near = false) {
  if (!rejected) return "Выбери слово в рассказе, затем нажми «Ответить». Выбор можно изменить.";
  if (near) return "Ты рядом. Выбери другое слово здесь же.";
  if (/^Как зовут мальчика\?/u.test(prompt)) return "Мы ищем имя мальчика. Прочитай вопрос ещё раз и выбери другое слово.";
  if (/^Как зовут девочку\?/u.test(prompt)) return "Мы ищем имя девочки. Прочитай вопрос ещё раз и выбери другое слово.";
  return "Прочитай вопрос ещё раз. Выбери в рассказе фрагмент, который на него отвечает.";
}

export function StoryQuizTargetText({ lines, textStyle, target, answered, selection, rejected, onSelect, sentenceLayout = false, hintTarget = false }) {
  const items = lines ?? [];
  const firstIsDialogue = items.length > 0 && getLineText(items[0], textStyle).trimStart().startsWith("—");
  const paragraphs = [];
  items.forEach((line, index) => {
    if (index === 0 || line.newParagraph || sentenceLayout) paragraphs.push([]);
    paragraphs[paragraphs.length - 1].push(line);
  });

  // Every word is its own candidate with identical look and interaction
  // before confirmation: neither hover, focus, spacing nor tapping reveals
  // where an answer is. A meaningful word inside an accepted answer counts;
  // once confirmed, the whole answer phrase lights up.
  function renderLine(text, key) {
    const matches = getStoryQuizTargetMatches(text, target);
    const words = tokenizeStoryQuizWords(text);
    const parts = [];
    let cursor = 0;
    let previousFound = false;

    words.forEach((word, wordIndex) => {
      const match = matches.find((range) => word.start >= range.start && word.start < range.end);
      const matchId = match ? `${key}_m${match.start}` : null;
      const found = answered && !!matchId && selection?.matchId === matchId;
      if (word.start > cursor) {
        const gap = text.slice(cursor, word.start);
        parts.push(previousFound && found ? <span key={`${key}_g${wordIndex}`} className="story-quiz__gap story-quiz__gap--found">{gap}</span> : gap);
      }
      const wordText = text.slice(word.start, word.end);
      const id = `${key}_w${wordIndex}`;
      const functionWord = isStoryQuizFunctionWord(wordText);
      const selected = selection?.id === id;
      parts.push(<button key={id} type="button"
        className={`story-quiz__word${selected ? " story-quiz__word--selected" : ""}${found ? " story-quiz__word--found" : ""}${selected && rejected ? " story-quiz__word--miss" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          if (!answered) onSelect({
            id, text: wordText, matchId,
            isTarget: !!match && !functionWord,
            near: !!match && functionWord,
            answerText: match ? text.slice(match.start, match.end) : null,
          });
        }}
        disabled={answered} aria-pressed={selected} aria-label={wordText}>{wordText}</button>);
      cursor = word.end;
      previousFound = found;
    });

    if (cursor < text.length) parts.push(text.slice(cursor));
    return parts;
  }

  return (
    <div className="reading-text reading-text--flow story-quiz__text">
      <div className={`reading-flow-text${firstIsDialogue ? " reading-flow-text--no-dropcap" : ""}`}>
        {paragraphs.map((paraLines, paragraphIndex) => (
          <p className={`reading-flow-para${hintTarget && paraLines.some((line) => getStoryQuizTargetMatches(getLineText(line, textStyle), target).length) ? " story-quiz__para--hint" : ""}`} key={paraLines[0]?.id ?? paragraphIndex}>
            {paraLines.map((line, index) => {
              const text = getLineText(line, textStyle);
              const isDialogue = text.trimStart().startsWith("—");
              const previousIsDialogue = index > 0 && getLineText(paraLines[index - 1], textStyle).trimStart().startsWith("—");
              return (
                <Fragment key={line.id ?? index}>
                  {index > 0 && (isDialogue || previousIsDialogue ? <br /> : " ")}
                  {renderLine(text, line.id ?? index)}
                </Fragment>
              );
            })}
          </p>
        ))}
      </div>
    </div>
  );
}
