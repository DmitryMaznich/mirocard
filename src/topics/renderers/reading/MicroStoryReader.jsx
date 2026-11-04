import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/core/store";
import { useSpeech } from "@/shared/hooks/useSpeech";
import { getTopicTitle } from "@/shared/utils/format";
import { generateTasks } from "./engine";
import { StoryFrame, StoryPictures } from "./StoryPictures";
import { getLineText, storyQuizSearchHint, StoryQuizTargetText, useStoryQuizChoice } from "./storyQuizText";
import "./microReader.css";

/*
 * The micro-story reader — design «тихая книжка» (owner-approved mockup
 * docs/mockups/reading-micro-2026-11-04/reading-micro-v01.html):
 *   read  — one big frame that follows the text, a marker on the sentence;
 *   ask   — the question in a speech bubble, equal word buttons,
 *           an answer slot; no explanatory text on the child's screen;
 *   done  — both frames and the found answers as a chain for retelling.
 * Attempts, picture help and the talking point's sample answer live in the
 * adult sheet behind the lock button.
 */

const Icon = {
  back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>,
  next: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>,
  speaker: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10v4h4l5 4V6L8 10H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /></svg>,
  stop: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>,
  lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>,
  picture: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="M20.5 16l-5-5-8 8" /></svg>,
  book: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M12 6v14M12 6C9 4 6 3.5 3 4v14c3-.5 6 0 9 2 3-2 6-2.5 9-2V4c-3-.5-6 0-9 2Z" /></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  again: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.5-5.8" /><path d="M4 4v5h5" /></svg>,
  close: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>,
};

const strip = (value) => String(value ?? "").replace(/(\p{L})-(?=\p{L})/gu, "$1");
const canSpeak = () => typeof window !== "undefined" && !!window.speechSynthesis;

// Which of the two frames belongs to a sentence: the first half of the story
// goes with the first picture, the rest with the second.
function frameForLine(index, lineCount, frameCount) {
  if (frameCount < 2) return 0;
  return index < Math.ceil(lineCount / 2) ? 0 : 1;
}

function QuestionTrack({ questions, index, answers, finished }) {
  return <div className="msr-track" aria-label={`Вопрос ${Math.min(index + 1, questions.length)} из ${questions.length}`}>
    {questions.map((question, i) => {
      const done = finished || answers.some((answer) => answer.id === question.id);
      return <i key={question.id} className={`msr-track__dot msr-track__dot--${question.kind}${done ? " is-done" : ""}${!finished && i === index ? " is-now" : ""}`} />;
    })}
  </div>;
}

function AdultSheet({ open, onClose, task, questions, answers }) {
  const discuss = questions.find((question) => question.kind === "discuss");
  return <section className="msr-adult" hidden={!open} aria-label="Для взрослого">
    <div className="msr-adult__scrim" onClick={onClose} />
    <div className="msr-adult__sheet">
      <div className="msr-adult__head">
        <div>
          <h2>{getTopicTitle(task.text.title)}</h2>
          <p>Для взрослого · рассказ {task.storyIndex + 1} из {task.storyCount}</p>
        </div>
        <button type="button" className="msr-icon-btn" aria-label="Закрыть" onClick={onClose}>{Icon.close}</button>
      </div>
      {answers.length === 0 && <p className="msr-adult__empty">Ответов пока нет.</p>}
      <ol className="micro-answer-history">{answers.map((answer) => <li key={answer.id} data-assisted={answer.assisted ? "true" : "false"} data-attempts={answer.attempts?.length} data-first-answer={answer.firstAnswer}>
        <span className="msr-adult__q">{answer.kind === "gist" && <em className="msr-tag msr-tag--kind">Понимание</em>}{answer.prompt}</span>
        <strong>{answer.answer}</strong>
        <span className="msr-adult__tags">
          {answer.kind === "discuss" ? <em className="msr-tag">Обсудили</em>
            : answer.attempts?.length === 1 ? <em className="msr-tag msr-tag--first">С первой попытки</em>
              : <em className="msr-tag">Попыток: {answer.attempts?.length ?? 1} · первый ответ «{answer.firstAnswer}»</em>}
          {answer.assisted && <em className="msr-tag msr-tag--help">С помощью</em>}
        </span>
      </li>)}</ol>
      {discuss && <div className="msr-adult__talk">
        <b>Для разговора: «{discuss.prompt}»</b>
        {discuss.expectedAnswer && <span>Пример ответа: {discuss.expectedAnswer}</span>}
        <span>Ответ словом, жестом, показом или карточкой.</span>
      </div>}
      <p className="msr-adult__note">«С помощью» — ребёнок открывал картинку или рассказ во время вопроса, либо после двух ошибок подсвечивалось нужное предложение. Вопросы на понимание включаются и выключаются в настройках режима («Вопросы»).</p>
    </div>
  </section>;
}

export default function MicroStoryReader({ task, topicId, textStyle, onAdvance, onPrevious }) {
  const topicRecord = useAppStore((state) => state.topicRecords.find((record) => record.meta.id === topicId));
  const { speak, cancel } = useSpeech();
  const [view, setView] = useState("read"); // read | ask
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [finished, setFinished] = useState(false);
  const [activeLine, setActiveLine] = useState(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [reading, setReading] = useState(false);
  const [adultOpen, setAdultOpen] = useState(false);
  const [picturesOpen, setPicturesOpen] = useState(false);
  const [misses, setMisses] = useState(0);
  const choice = useStoryQuizChoice();
  const answerGate = useRef(false);
  const assisted = useRef(false);
  const speechToken = useRef(0);
  const bodyRef = useRef(null);

  const text = task.text;
  const lines = text.lines ?? [];
  const frames = text.images?.length ? text.images : (text.image ? [{ file: text.image }] : []);
  const questions = useMemo(() => task.storyQuestions ?? (topicRecord ? generateTasks({ type: "story_quiz" }, topicRecord, task.textId, {
    storyStage: "micro", selectedMicroStories: [task.textId],
  }).map(({ question, expectedAnswer }) => ({ ...question, expectedAnswer })) : []), [task.storyQuestions, task.textId, topicRecord]);
  const question = questions[questionIndex];
  const answered = answers.some((item) => item.id === question?.id);
  const discussing = question?.kind === "discuss";
  const shownFrame = activeLine === null ? frameIndex : frameForLine(activeLine, lines.length, frames.length);
  const isLastStory = task.storyCount && task.storyIndex === task.storyCount - 1;

  useLayoutEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [view, questionIndex, finished]);
  // The question is spoken when it appears (the child may not read it yet).
  useEffect(() => {
    if (view === "ask" && !finished && question?.prompt) speak(question.prompt);
  }, [view, questionIndex, finished]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => cancel(), [cancel]);

  function stopReading() {
    speechToken.current += 1;
    setReading(false);
    cancel();
  }
  function readAloud() {
    if (reading) { stopReading(); return; }
    const token = ++speechToken.current;
    setReading(true);
    const sayLine = (index) => {
      if (speechToken.current !== token) return;
      if (index >= lines.length) { setReading(false); setActiveLine(null); return; }
      setActiveLine(index);
      speak(strip(getLineText(lines[index])), { onEnd: () => sayLine(index + 1) });
    };
    sayLine(0);
  }
  function openQuestions() {
    stopReading();
    setActiveLine(null);
    setView("ask");
  }
  function backToStory() {
    // Looking at the story (its pictures) while a question is open is help.
    if (!answered && !finished) assisted.current = true;
    setView("read");
  }
  function togglePictures() {
    if (!picturesOpen && !answered) assisted.current = true;
    setPicturesOpen(!picturesOpen);
  }
  function confirm() {
    choice.confirm((result) => {
      if (answerGate.current || answered || finished || !question || discussing) return;
      answerGate.current = true;
      const answer = result.attempts.at(-1).answer;
      setAnswers((previous) => [...previous, { id: question.id, kind: question.kind, prompt: question.prompt, answer, assisted: assisted.current, ...result }]);
      speak(`Верно! ${answer}`);
    }, () => {
      setMisses((value) => value + 1);
      if (choice.selected?.near) speak("Ты рядом.");
    });
  }
  // After two misses the sentence holding the answer is lit faintly: help,
  // recorded as such.
  const hint = misses >= 2 && !answered;
  useEffect(() => { if (hint) assisted.current = true; }, [hint]);

  function nextQuestion() {
    if (questionIndex === questions.length - 1) { setFinished(true); return; }
    answerGate.current = false;
    assisted.current = false;
    choice.reset();
    setMisses(0);
    setPicturesOpen(false);
    setQuestionIndex((index) => index + 1);
  }
  function finishDiscussion() {
    if (!answers.some((answer) => answer.id === question.id)) {
      setAnswers((previous) => [...previous, { id: question.id, kind: "discuss", prompt: question.prompt, answer: question.expectedAnswer ?? "Обсудили", assisted: false }]);
    }
    setFinished(true);
  }
  function restartQuestions() {
    answerGate.current = false;
    assisted.current = false;
    choice.reset();
    setMisses(0);
    setAnswers([]);
    setFinished(false);
    setQuestionIndex(0);
    setView("read");
  }

  const tools = <div className="msr-tools">
    {view === "ask" && !finished ? <QuestionTrack questions={questions} index={questionIndex} answers={answers} finished={finished} /> : <span />}
    <div className="msr-tools__right">
      {view === "read" && canSpeak() && <button type="button" className={`msr-icon-btn${reading ? " is-on" : ""}`} aria-label={reading ? "Остановить чтение" : "Прочитать вслух"} onClick={readAloud}>{reading ? Icon.stop : Icon.speaker}</button>}
      {view === "ask" && !finished && <button type="button" className="msr-icon-btn" aria-label="Рассказ" onClick={backToStory}>{Icon.book}</button>}
      <button type="button" className="msr-icon-btn msr-icon-btn--quiet" aria-label="Для взрослого" onClick={() => setAdultOpen(true)}>{Icon.lock}</button>
    </div>
  </div>;

  const storyNav = <footer className="msr-foot">
    <button type="button" className="msr-icon-btn" aria-label="Предыдущий рассказ" onClick={onPrevious} disabled={task.storyIndex === 0}>{Icon.back}</button>
    <div className="msr-foot__dots" aria-label={`Рассказ ${task.storyIndex + 1} из ${task.storyCount ?? 1}`}>
      {Array.from({ length: task.storyCount ?? 1 }, (_, i) => <i key={i} className={i <= task.storyIndex ? "is-on" : ""} />)}
    </div>
    {view === "read" && questions.length > 0 && !finished
      ? <>
        <button type="button" className="msr-icon-btn" aria-label={isLastStory ? "Завершить" : "Следующий рассказ"} onClick={onAdvance}>{Icon.next}</button>
        <button type="button" className="msr-btn" onClick={openQuestions}>Вопросы {Icon.next}</button>
      </>
      : <button type="button" className="msr-btn" onClick={onAdvance}>{isLastStory ? "Завершить" : "Дальше"} {Icon.next}</button>}
  </footer>;

  // ── Read ────────────────────────────────────────────────────────────────
  if (view === "read") {
    return <div ref={bodyRef} className="session-body msr msr--read">
      {tools}
      <div className="msr-spread">
        {frames.length > 0 && <div className="msr-frame">
          <StoryFrame key={frames[shownFrame].file} topicId={topicId} frame={frames[shownFrame]} />
          {frames.length > 1 && <div className="msr-frame__dots">
            {frames.map((frame, i) => <button type="button" key={frame.file} aria-label={`Картинка ${i + 1}`} className={i === shownFrame ? "is-on" : ""} onClick={() => { setActiveLine(null); setFrameIndex(i); }} />)}
          </div>}
        </div>}
        <div className="msr-page">
          <h2 className="msr-title">{getTopicTitle(text.title)}</h2>
          <div className="msr-lines">
            {lines.map((line, i) => <p key={line.id ?? i} className={`msr-line${activeLine === null ? "" : activeLine === i ? " is-now" : " is-faded"}`}
              onClick={() => setActiveLine(activeLine === i ? null : i)}><span>{getLineText(line, textStyle)}</span></p>)}
          </div>
        </div>
      </div>
      {storyNav}
      <AdultSheet open={adultOpen} onClose={() => setAdultOpen(false)} task={task} questions={questions} answers={answers} />
    </div>;
  }

  // ── Done: the found answers as a chain for retelling ────────────────────
  if (finished) {
    // In the order of the story, so the chain reads as a retelling.
    const storyText = lines.map((line) => strip(getLineText(line)).toLocaleLowerCase("ru-RU")).join("\n");
    const place = (answer) => { const at = storyText.indexOf(strip(answer.answer).toLocaleLowerCase("ru-RU")); return at < 0 ? Infinity : at; };
    const chain = answers.filter((answer) => answer.kind !== "discuss")
      .map((answer, order) => ({ answer, order, at: place(answer) }))
      .sort((a, b) => a.at - b.at || a.order - b.order).map(({ answer }) => answer);
    return <div ref={bodyRef} className="session-body msr msr--done">
      {tools}
      <div className="msr-done">
        <h2 className="msr-title">{getTopicTitle(text.title)}</h2>
        {frames.length > 0 && <StoryPictures topicId={topicId} text={text} />}
        <div className="msr-chain" aria-label="Ответы">
          {chain.map((answer, i) => <span key={answer.id} className="msr-chain__item">
            {i > 0 && <span className="msr-chain__arrow" aria-hidden="true">→</span>}
            <span className={`msr-chip${answer.kind === "gist" ? " msr-chip--gist" : ""}`}>{answer.answer}</span>
          </span>)}
        </div>
        <button type="button" className="msr-btn msr-btn--ghost" onClick={restartQuestions}>{Icon.again} Ещё раз</button>
      </div>
      {storyNav}
      <AdultSheet open={adultOpen} onClose={() => setAdultOpen(false)} task={task} questions={questions} answers={answers} />
    </div>;
  }

  // ── Ask ─────────────────────────────────────────────────────────────────
  const kindLabel = question.kind === "gist" ? "Подумай" : discussing ? "Поговорим" : null;
  const status = answered ? "Ответ найден." : storyQuizSearchHint(question.prompt, choice.rejected, choice.selected?.near);
  return <div ref={bodyRef} className={`session-body msr msr--ask${discussing ? " msr--talk" : ""}`}>
    {tools}
    {/* No hero name or initial on the child's screens: it is the answer to
        the first question, and the owner finds it superfluous (2026-11-04). */}
    <div className="msr-ask">
      <div className="msr-bubble">
        {kindLabel && <span className="msr-bubble__kind">{kindLabel}</span>}
        <h2 id="micro-current-question">{question.prompt}</h2>
        {canSpeak() && <button type="button" className="msr-icon-btn msr-bubble__say" aria-label="Повторить вопрос" onClick={() => speak(question.prompt)}>{Icon.speaker}</button>}
      </div>
    </div>
    <div className="msr-textcard">
      {!discussing && frames.length > 0 && <button type="button" className={`msr-icon-btn msr-textcard__pic${picturesOpen ? " is-on" : ""}`} aria-label={picturesOpen ? "Скрыть картинки" : "Показать картинки"} aria-expanded={picturesOpen} onClick={togglePictures}>{Icon.picture}</button>}
      {discussing
        ? <div className="msr-plain">{lines.map((line, i) => <p key={line.id ?? i}>{getLineText(line, textStyle)}</p>)}</div>
        : <StoryQuizTargetText key={question.id} lines={lines} textStyle={textStyle} target={question.targets ?? question.target}
          answered={answered} selection={choice.selected} rejected={choice.rejected} onSelect={choice.select} sentenceLayout hintTarget={hint} />}
      {picturesOpen && !discussing && <StoryPictures topicId={topicId} text={text} />}
    </div>
    <p className="msr-sr" role="status">{discussing ? "" : status}</p>
    <footer className="msr-answer">
      {discussing
        ? <><div className="msr-slot msr-slot--talk">Скажи, покажи или разыграй</div>
          <button type="button" className="msr-btn" onClick={finishDiscussion}>Обсудили</button></>
        : <>
          <div className={`msr-slot${answered ? " msr-slot--ok" : choice.rejected ? " msr-slot--miss" : choice.selected ? " msr-slot--filled" : ""}`} aria-label="Выбранный ответ">
            {answered && Icon.check}
            {choice.selected ? (answered ? choice.selected.answerText ?? choice.selected.text : choice.selected.text) : ""}
          </div>
          {answered
            ? <button type="button" className="msr-btn" onClick={nextQuestion}>Дальше {Icon.next}</button>
            : <button type="button" className="msr-btn" onClick={confirm} disabled={!choice.selected || choice.rejected}>Ответить</button>}
        </>}
    </footer>
    <AdultSheet open={adultOpen} onClose={() => setAdultOpen(false)} task={task} questions={questions} answers={answers} />
  </div>;
}
