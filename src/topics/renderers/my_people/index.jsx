import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSpeech } from "@/shared/hooks/useSpeech";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { markPersonAxisIntroduced } from "@/features/myPeople/myPeoplePersistence";
import { isCorrectAssociation } from "./matching";
import "./my_people.css";

// Movement (px) that turns a press on a word into a drag; less is a tap.
const DRAG_START_DISTANCE = 8;

// Three grades are all an adult needs here: the child answered alone, with a
// hint, or not yet. (A fourth "Легко!" step only made the adult split hairs
// mid-lesson.) They sit in the adult's panel as light buttons with a
// coloured mark: the adult tells them apart by colour, while nothing in them
// outshines the photo for the child -- solid red/green buttons were the
// brightest things on screen, and red read as "bad". The words don't judge
// either: «Пока нет», not «Не знает».
const QUALITY_BUTTONS = [
  { value: "correct", label: "Сам", mark: "✓", mod: "correct" },
  { value: "prompted", label: "С подсказкой", mark: "½", mod: "prompted" },
  { value: "fail", label: "Пока нет", mark: "·", mod: "fail" },
];

// "Hear it again". Drawn as a plain speaker, not a filled teal tile: in the
// same colour as «Дальше» and the answer buttons it read as one more thing
// to press to move on.
// False when the mode's "Озвучка" is off: then there is nothing to hear
// again, so the speaker buttons go too.
const VoiceContext = createContext(true);

function SpeakerButton({ onClick, label, className = "" }) {
  if (!useContext(VoiceContext)) return null;
  return (
    <button type="button" className={`people-speaker ${className}`} onClick={onClick} aria-label={label}>
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" fill="currentColor" fillOpacity=".14" />
        <path d="M15.5 9a4.2 4.2 0 0 1 0 6" />
        <path d="M18.3 6.4a8 8 0 0 1 0 11.2" />
      </svg>
    </button>
  );
}

function usePeopleAlbumScale(task) {
  const viewportRef = useRef(null);
  const contentRef = useRef(null);
  const [fit, setFit] = useState({ scale: 1, topOffset: 0 });

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return undefined;

    function updateFit() {
      const availableWidth = viewport.clientWidth;
      const availableHeight = viewport.clientHeight;
      const contentWidth = content.scrollWidth;
      const contentHeight = content.scrollHeight;
      if (!availableWidth || !availableHeight || !contentWidth || !contentHeight) return;

      const scale = Math.min(1, availableWidth / contentWidth, availableHeight / contentHeight);
      const topOffset = Math.max(0, (availableHeight - contentHeight * scale) / 2);
      setFit((previous) => (
        Math.abs(previous.scale - scale) < 0.002 && Math.abs(previous.topOffset - topOffset) < 1
          ? previous
          : { scale, topOffset }
      ));
    }

    const animationFrame = window.requestAnimationFrame(updateFit);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateFit);
    observer?.observe(viewport);
    observer?.observe(content);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer?.disconnect();
    };
  }, [task]);

  return { viewportRef, contentRef, fit };
}

function AlbumPhoto({ entry, topicId, match, wrong, hint, dropTarget, onChoose }) {
  const url = useTopicFile(topicId, entry.image);
  const state = match
    ? " people-album-photo--matched"
    : wrong
      ? " people-album-photo--wrong"
      : hint
        ? " people-album-photo--hint"
        : dropTarget
          ? " people-album-photo--drop-target"
          : "";
  return (
    <button
      type="button"
      className={`people-album-photo${state}`}
      onClick={() => onChoose(entry)}
      data-person-id={entry.personId}
      aria-label={match ? `Фотография: ${match.label}` : "Выбрать фотографию"}
      disabled={Boolean(match)}
    >
      {url
        ? <img src={url} alt="" draggable={false} />
        : <span className="people-album-photo__loading" aria-hidden="true" />
      }
      <span className={`people-album-photo__label${match ? " people-album-photo__label--filled" : ""}`}>
        {match?.label ?? ""}
      </span>
    </button>
  );
}

function PeopleAlbumTask({ task, topicId, soundEnabled, sessionParams, onCorrect, onStreakReset, onCardShown, onTap }) {
  const { speak } = useSpeech();
  // «Озвучивать слово при нажатии» off: the child has to read the word.
  const speakWords = soundEnabled && sessionParams?.speakWords !== false;
  const [selectedAnswerId, setSelectedAnswerId] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [matches, setMatches] = useState({});
  const [wrongPersonId, setWrongPersonId] = useState(null);
  // After a miss: which photo the word belongs to, lit up until it is placed.
  const [hintPersonId, setHintPersonId] = useState(null);
  const dragRef = useRef(null);
  const wrongTimer = useRef(null);
  const { viewportRef, contentRef, fit } = usePeopleAlbumScale(task);

  const answersById = useMemo(
    () => Object.fromEntries((task.answers ?? []).map((answer) => [answer.id, answer])),
    [task.answers],
  );
  const usedAnswerIds = useMemo(
    () => new Set(Object.values(matches).map((match) => match.answerId)),
    [matches],
  );

  useEffect(() => {
    onCardShown?.(null, task.conceptId);
    if (task.promptSpeech && soundEnabled) speak(task.promptSpeech);
    return () => {
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
    };
  }, [task, soundEnabled, speak, onCardShown]);

  function repeatPrompt(event) {
    event.stopPropagation();
    if (task.promptSpeech && soundEnabled) speak(task.promptSpeech);
  }

  function associateAnswer(answerId, entry) {
    if (!answerId || matches[entry.personId]) return;
    const answer = answersById[answerId];
    if (!answer) return;

    const correct = isCorrectAssociation(task.axis, answer, entry);
    onTap?.(answer.personId, correct);
    setSelectedAnswerId(null);

    if (!correct) {
      // Errorless, as in «Покажи»: the wrong photo flashes red, the word's
      // own photo lights up and the word stays picked, so the next tap on
      // the lit photo finishes the match. The miss is still recorded.
      setWrongPersonId(entry.personId);
      setHintPersonId(answer.personId);
      setSelectedAnswerId(answer.id);
      onStreakReset?.(entry.conceptId, entry.personId);
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      wrongTimer.current = setTimeout(() => setWrongPersonId(null), 620);
      return;
    }
    setHintPersonId(null);

    const nextMatches = { ...matches, [entry.personId]: { answerId: answer.id, label: answer.label } };
    setMatches(nextMatches);
    // A hit is confirmed in words, the way an adult would: "Это мама."
    if (soundEnabled) speak(`Это ${answer.label}.`);
    if (Object.keys(nextMatches).length === task.entries.length) {
      setTimeout(() => onCorrect(task.conceptId, "people_album", { scoreCount: task.entries.length }), 520);
    }
  }

  function chooseKeyboardPerson(entry) {
    associateAnswer(selectedAnswerId, entry);
  }

  function getDropPersonId(clientX, clientY) {
    const target = document.elementFromPoint(clientX, clientY)?.closest?.("[data-person-id]");
    return target?.dataset.personId ?? null;
  }

  // A press becomes a drag only once the finger has moved; a press that
  // stays put is a tap that picks the word, and the next tap on a photo
  // places it. Dragging is a motor barrier for many of these children.
  function startAnswerDrag(event, answer) {
    if ((event.pointerType === "mouse" && event.button !== 0) || usedAnswerIds.has(answer.id)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (speakWords) speak(answer.label);
    dragRef.current = {
      answerId: answer.id,
      label: answer.label,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };
  }

  function moveAnswerDrag(event) {
    const currentDrag = dragRef.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;
    if (!currentDrag.active && Math.hypot(event.clientX - currentDrag.startX, event.clientY - currentDrag.startY) < DRAG_START_DISTANCE) return;
    if (!currentDrag.active) setSelectedAnswerId(null);
    const nextDrag = {
      ...currentDrag,
      active: true,
      x: event.clientX,
      y: event.clientY,
      overPersonId: getDropPersonId(event.clientX, event.clientY),
    };
    dragRef.current = nextDrag;
    setDragging(nextDrag);
  }

  function cancelAnswerDrag(event) {
    const currentDrag = dragRef.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(null);
  }

  function finishAnswerDrag(event) {
    const currentDrag = dragRef.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
    if (!currentDrag.active) {
      setSelectedAnswerId((selected) => (selected === currentDrag.answerId ? null : currentDrag.answerId));
      return;
    }
    const personId = getDropPersonId(event.clientX, event.clientY);
    setDragging(null);
    const entry = task.entries.find((candidate) => candidate.personId === personId);
    if (entry) associateAnswer(currentDrag.answerId, entry);
  }

  function chooseAnswerWithKeyboard(event, answer) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (usedAnswerIds.has(answer.id)) return;
    setSelectedAnswerId(answer.id);
    if (speakWords) speak(answer.label);
  }

  const chosenAnswer = answersById[selectedAnswerId];
  // The light follows the missed word: pick another word and it goes out.
  const heldPersonId = dragging ? answersById[dragging.answerId]?.personId : chosenAnswer?.personId;
  const litPersonId = hintPersonId && heldPersonId === hintPersonId ? hintPersonId : null;
  const completedCount = Object.keys(matches).length;
  // Three people sit in one row rather than 2 + 1: two rows made the album
  // tall enough to be scaled down to fit a phone, shrinking the answer
  // buttons along with it.
  const columnClass = task.entries.length === 3 || task.entries.length >= 5 ? " people-album-photos--three-columns" : "";

  return (
    <div className="people-album-fit" ref={viewportRef}>
      <div
        ref={contentRef}
        className="session-body people-album"
        aria-label="Задание на сопоставление людей"
        style={{ transform: `translateY(${fit.topOffset}px) scale(${fit.scale})` }}
      >
      <div className="people-album__prompt">
        <div className="people-album__question">{task.prompt}</div>
        <SpeakerButton onClick={repeatPrompt} label="Повторить задание" />
      </div>
      <div className={`people-album-photos${columnClass}`}>
        {task.entries.map((entry) => (
          <AlbumPhoto
            key={entry.personId}
            entry={entry}
            topicId={topicId}
            match={matches[entry.personId]}
            wrong={wrongPersonId === entry.personId}
            hint={litPersonId === entry.personId}
            dropTarget={dragging?.overPersonId === entry.personId}
            onChoose={chooseKeyboardPerson}
          />
        ))}
      </div>
      {/* No words for the child here ("Перетащи имя на фото…" was the
          adult's instruction on the child's screen); the dots show progress. */}
      <div className="people-album__answers-heading">
        <div className="people-album__answers-progress" aria-label={`Подписано ${completedCount} из ${task.entries.length}`}>
          <span className="people-album__progress-dots" aria-hidden="true">
            {task.entries.map((entry) => (
              <span
                key={entry.personId}
                className={`people-album__progress-dot${matches[entry.personId] ? " people-album__progress-dot--done" : ""}`}
              />
            ))}
          </span>
        </div>
      </div>
      <div className="people-album-answers">
        {task.answers.map((answer) => {
          const used = usedAnswerIds.has(answer.id);
          const selected = selectedAnswerId === answer.id;
          const isDragging = dragging?.answerId === answer.id;
          return (
            <button
              key={answer.id}
              type="button"
              className={`people-album-answer${selected ? " people-album-answer--selected" : ""}${used ? " people-album-answer--used" : ""}${isDragging ? " people-album-answer--dragging" : ""}`}
              onKeyDown={(event) => chooseAnswerWithKeyboard(event, answer)}
              onPointerDown={(event) => startAnswerDrag(event, answer)}
              onPointerMove={moveAnswerDrag}
              onPointerUp={finishAnswerDrag}
              onPointerCancel={cancelAnswerDrag}
              disabled={used}
              aria-grabbed={isDragging}
              aria-pressed={selected}
            >
              {answer.label}
            </button>
          );
        })}
      </div>
      </div>
      {dragging && createPortal(
        <div className="people-album-drag-ghost" style={{ left: dragging.x, top: dragging.y }} aria-hidden="true">
          {dragging.label}
        </div>,
        document.body,
      )}
    </div>
  );
}

// Meeting someone new: the photo, the word under it and the voice ("Это
// мама."). The child touches the photo -- the first, errorless trial -- and
// the word settles into the photo's caption, is said again and the lesson
// moves on. The adult can skip from the panel below.
function PersonIntroTask({ task, topicId, student, soundEnabled, onAdvance, onCardShown }) {
  const { speak } = useSpeech();
  const imageUrl = useTopicFile(topicId, task.image);
  const [touched, setTouched] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const advanceTimer = useRef(null);

  useEffect(() => {
    onCardShown?.(null, task.conceptId);
    if (task.promptSpeech && soundEnabled) speak(task.promptSpeech);
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, [task, soundEnabled, speak, onCardShown]);

  function repeatPrompt() {
    if (task.promptSpeech && soundEnabled) speak(task.promptSpeech);
  }

  function confirmIntroduction() {
    if (confirmed) return;
    setConfirmed(true);
    markPersonAxisIntroduced(student?.id, task.personId, task.axis).catch(() => {});
    onAdvance?.();
  }

  function touchPhoto() {
    if (touched) return;
    setTouched(true);
    if (soundEnabled) speak(task.label);
    advanceTimer.current = setTimeout(confirmIntroduction, 1300);
  }

  return (
    <div className="people-zones" aria-label="Знакомство с человеком">
      <div className="session-body person-intro">
        <button
          type="button"
          className={`person-intro__photo-wrap${touched ? " person-intro__photo-wrap--touched" : ""}`}
          onClick={touchPhoto}
          aria-label={`Фотография: ${task.label}`}
        >
          {imageUrl
            ? <img className="person-intro__photo" src={imageUrl} alt="" draggable={false} />
            : <span className="person-intro__photo person-intro__photo--loading" aria-hidden="true" />
          }
          {!touched && <span className="person-intro__touch" aria-hidden="true" />}
        </button>
        <div className="person-intro__label-row">
          <div className={`person-intro__label${touched ? " person-intro__label--placed" : ""}`}>{task.label}</div>
          <SpeakerButton onClick={repeatPrompt} label="Повторить" />
        </div>
      </div>
      <div className="people-adult" aria-label="Для взрослого">
        <div className="people-adult__row">
          <span className="people-adult__label">Знакомство: ребёнок касается фото сам</span>
          <button type="button" className="people-adult__skip person-intro__next" onClick={confirmIntroduction} disabled={confirmed}>
            Дальше
          </button>
        </div>
      </div>
    </div>
  );
}

// The adult's hint ladder as a row of steps: each one stays on screen once
// used (ticked), so the adult sees how far up the ladder this answer went.
function HintSteps({ steps, level }) {
  if (!steps.length) return null;
  return (
    <div className="people-adult__steps">
      {steps.map((step) => {
        const used = level >= step.level;
        return (
          <button
            key={step.label}
            type="button"
            className={`people-adult__step${used ? " people-adult__step--used" : ""}`}
            onClick={step.onClick}
            disabled={used}
            aria-pressed={used}
          >
            {step.label}
          </button>
        );
      })}
    </div>
  );
}

// Two zones: the child's stage on top (photo, question, the word to echo)
// and the adult's panel at the bottom -- the answer to listen for, the hint
// steps and the grade, on a grey ground behind a line.
function QualityAnswerTask({
  task,
  soundEnabled,
  onQualityAnswer,
  onCardShown,
  onQuality,
  className,
  ariaLabel,
  answerShown = false,
  stageAnswer,
  hinted = false,
  hints = null,
  children,
}) {
  const { speak } = useSpeech();
  const [answeredTaskId, setAnsweredTaskId] = useState(null);
  const advanceTimer = useRef(null);
  const answered = answeredTaskId === task.conceptId;

  useEffect(() => {
    onCardShown?.(null, task.conceptId);
    if (task.promptSpeech && soundEnabled) speak(task.promptSpeech);
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, [task, soundEnabled, speak, onCardShown]);

  function repeatPrompt() {
    if (task.promptSpeech && soundEnabled) speak(task.promptSpeech);
  }

  function markAnswer(quality) {
    if (answered) return;
    setAnsweredTaskId(task.conceptId);
    onQuality?.(quality, null, task.conceptId);
    // Match the established open-answer cards: briefly show the response
    // model before the shared quality handler advances the session.
    advanceTimer.current = setTimeout(() => {
      onQualityAnswer?.(quality, task.conceptId, null);
    }, 700);
  }

  return (
    <div className="people-zones" aria-label={ariaLabel}>
      <div className={`session-body ${className}`}>
        {children({ repeatPrompt })}
        {/* The word or sentence to echo: on the stage only once the adult
            shows it (or after grading). */}
        <div className={`about-me-task__answer${answered || answerShown ? " about-me-task__answer--shown" : ""}`} aria-live="polite">
          {answered || answerShown ? (stageAnswer ?? task.answer) : ""}
        </div>
      </div>
      <div className="people-adult" aria-label="Для взрослого">
        <div className="people-adult__label">Ответ: <b>{task.answer}</b></div>
        {hints}
        <div className="people-grade-row">
          {QUALITY_BUTTONS.map((button) => (
            <button
              key={button.value}
              type="button"
              className={`people-grade people-grade--${button.mod}`}
              // After any hint the answer is at best "С подсказкой".
              disabled={answered || (hinted && button.value === "correct")}
              onClick={() => markAnswer(button.value)}
            >
              <span className="people-grade__mark" aria-hidden="true">{button.mark}</span>
              <span className="people-grade__label">{button.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// «Представься»: a new person's question in a speech bubble; the child's
// answer is scripted. The script fades: the adult starts from the whole
// answer, its opening words or nothing (task.hintLevel) and can step up
// with the buttons. Any script on screen means "С подсказкой" at best.
function IntroduceTurnTask(props) {
  const { speak } = useSpeech();
  const [hint, setHint] = useState({ taskId: null, level: 0 });
  const startLevel = props.task.hintLevel ?? 0;
  const level = Math.max(startLevel, hint.taskId === props.task.conceptId ? hint.level : 0);

  function showStarter() {
    setHint({ taskId: props.task.conceptId, level: 1 });
    if (props.soundEnabled) speak(props.task.starter.replace(/\s*…/g, ""));
  }
  function showAnswer() {
    setHint({ taskId: props.task.conceptId, level: 2 });
    if (props.soundEnabled) speak(props.task.answer);
  }

  return (
    <QualityAnswerTask
      {...props}
      className="about-me-task introduce-turn"
      ariaLabel="Знакомство с новым человеком"
      answerShown={level >= 2}
      hinted={level >= 1}
      hints={<HintSteps level={level} steps={[
        { level: 1, label: "Начало фразы", onClick: showStarter },
        { level: 2, label: "Весь ответ", onClick: showAnswer },
      ]} />}
    >
      {({ repeatPrompt }) => (
        <>
          <span className="introduce-turn__partner">С тобой знакомится: {props.task.partner}</span>
          <div className="introduce-turn__bubble">
            <div className="introduce-turn__question">{props.task.prompt}</div>
            <SpeakerButton onClick={repeatPrompt} label="Повторить вопрос" />
          </div>
          <div className={`introduce-turn__starter${level === 1 ? " introduce-turn__starter--shown" : ""}`} aria-live="polite">
            {level === 1 ? props.task.starter : ""}
          </div>
        </>
      )}
    </QualityAnswerTask>
  );
}

// A short personal question with a prompt ladder the adult steps through
// only as needed: the question alone → the photo (mum's photo for "Как
// зовут маму?") → the answer, shown and spoken for the child to echo. The
// adult then scores it as usual; any hint means "С подсказкой".
function AboutMeQuestionTask(props) {
  const { speak } = useSpeech();
  const [hint, setHint] = useState({ taskId: null, level: 0 });
  const level = hint.taskId === props.task.conceptId ? hint.level : 0;
  const imageUrl = useTopicFile(props.topicId, level >= 1 ? props.task.cueImage : null);

  function showPhoto() { setHint({ taskId: props.task.conceptId, level: Math.max(level, 1) }); }
  function showAnswer() {
    setHint({ taskId: props.task.conceptId, level: 2 });
    if (props.soundEnabled) speak(props.task.answer);
  }

  return (
    <QualityAnswerTask
      {...props}
      className="about-me-task about-me-question"
      ariaLabel="Вопрос обо мне"
      answerShown={level >= 2}
      hinted={level >= 1}
      hints={<HintSteps level={level} steps={[
        ...(props.task.cueImage ? [{ level: 1, label: "Показать фото", onClick: showPhoto }] : []),
        { level: 2, label: "Показать ответ", onClick: showAnswer },
      ]} />}
    >
      {({ repeatPrompt }) => (
        <>
          <div className="about-me-task__prompt-row">
            <div className="about-me-task__prompt about-me-question__prompt">{props.task.prompt}</div>
            <SpeakerButton onClick={repeatPrompt} label="Повторить вопрос" />
          </div>
          {level >= 1 && props.task.cueImage && (
            <div className="person-naming__photo-wrap about-me-question__photo">
              {imageUrl
                ? <img className="person-naming__photo" src={imageUrl} alt="" />
                : <span className="person-naming__photo person-naming__photo--loading" aria-hidden="true" />}
            </div>
          )}
        </>
      )}
    </QualityAnswerTask>
  );
}

// «Найди такого же»: the photo to match, set apart from the choices by a
// frame, not shown as one more thing to tap.
function MatchSample({ topicId, image }) {
  const url = useTopicFile(topicId, image);
  return (
    <div className="people-match__sample" aria-label="Образец">
      {url
        ? <img src={url} alt="" draggable={false} />
        : <span className="people-point-photo__loading" aria-hidden="true" />}
    </div>
  );
}

function PointPhoto({ choice, topicId, state, disabled, onChoose }) {
  const url = useTopicFile(topicId, choice.image);
  return (
    <button
      type="button"
      className={`people-point-photo${state ? ` people-point-photo--${state}` : ""}`}
      onClick={() => onChoose(choice)}
      disabled={disabled}
      aria-label="Фотография"
    >
      {url
        ? <img src={url} alt="" draggable={false} />
        : <span className="people-point-photo__loading" aria-hidden="true" />}
    </button>
  );
}

// «Покажи»: "Где мама?" → tap the photo. Errorless on a miss: the wrong
// photo fades, the right one is lit up and named ("Вот мама"), and only it
// stays tappable -- the child finishes the trial correctly instead of
// guessing again. The miss is still recorded.
function PersonPointTask({ task, topicId, student, soundEnabled, sessionParams, onCorrect, onStreakReset, onCardShown }) {
  const { speak } = useSpeech();
  // `prompted`: the light came on after a pause, not after a miss.
  const fresh = { taskId: task.conceptId, missedId: null, prompted: false, done: false };
  const [trial, setTrial] = useState({ ...fresh, taskId: null });
  const current = trial.taskId === task.conceptId ? trial : fresh;
  const helped = Boolean(current.missedId) || current.prompted;
  const advanceTimer = useRef(null);
  const delayTimer = useRef(null);
  // What the delay timer sees when it fires.
  const currentRef = useRef(current);
  useEffect(() => { currentRef.current = current; });
  // «Подсказка через»: seconds of no answer before the right photo lights
  // up.
  const delaySeconds = Number(sessionParams?.promptDelay ?? 5);
  const usesDelay = delaySeconds > 0;

  function startDelay() {
    if (delayTimer.current) clearTimeout(delayTimer.current);
    if (!usesDelay) return;
    delayTimer.current = setTimeout(() => {
      const now = currentRef.current;
      if (now.done || now.missedId || now.prompted) return;
      setTrial({ ...now, prompted: true });
      // No answer is not an independent answer: the streak goes, as on a miss.
      onStreakReset?.(task.conceptId, task.personId);
      if (soundEnabled) speak(task.missSpeech ?? `Вот ${task.word}.`);
    }, delaySeconds * 1000);
  }

  useEffect(() => {
    onCardShown?.(null, task.conceptId);
    if (soundEnabled) speak(task.promptSpeech);
    startDelay();
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      if (delayTimer.current) clearTimeout(delayTimer.current);
    };
  }, [task, soundEnabled, speak, onCardShown]); // eslint-disable-line react-hooks/exhaustive-deps

  function repeatPrompt() {
    if (soundEnabled) speak(task.promptSpeech);
    // The adult asked again: the wait starts over.
    if (!helped && !current.done) startDelay();
  }

  function choose(choice) {
    if (current.done) return;
    if (choice.personId === task.personId) {
      if (delayTimer.current) clearTimeout(delayTimer.current);
      setTrial({ ...current, done: true });
      // The child has now found this person by the word -- an introduction
      // for «Кто это?», which asks only about people already met.
      if (task.introduces) markPersonAxisIntroduced(student?.id, task.personId, task.axis).catch(() => {});
      if (soundEnabled) speak(task.correctSpeech ?? `Да, это ${task.word}!`);
      // Found only with help: the same trial comes back a little later,
      // without the light (insertRetryTrial).
      onCorrect?.(task.conceptId, task.personId, { autoAdvance: true, autoAdvanceDelayMs: 1400, retryLater: helped });
      return;
    }
    if (helped) return;
    if (delayTimer.current) clearTimeout(delayTimer.current);
    setTrial({ ...current, missedId: choice.personId });
    onStreakReset?.(task.conceptId, task.personId);
    if (soundEnabled) speak(task.missSpeech ?? `Вот ${task.word}.`);
  }

  const columns = task.choices.length === 4 ? " people-point__photos--grid" : "";
  return (
    <div className={`session-body people-point${task.sample ? " people-point--match" : ""}`} aria-label={task.sample ? "Найди такого же" : "Покажи человека"}>
      <div className="people-point__prompt">
        <div className="people-point__question">{task.prompt}</div>
        <SpeakerButton onClick={repeatPrompt} label="Повторить вопрос" />
      </div>
      {task.sample && <MatchSample topicId={topicId} image={task.sample} />}
      <div className={`people-point__photos${columns}`}>
        {task.choices.map((choice) => {
          const isTarget = choice.personId === task.personId;
          const state = current.done && isTarget ? "correct"
            : helped && isTarget ? "hint"
              : helped && !isTarget ? "faded"
                : "";
          return (
            <PointPhoto
              key={choice.personId}
              choice={choice}
              topicId={topicId}
              state={state}
              disabled={current.done || (helped && !isTarget)}
              onChoose={choose}
            />
          );
        })}
      </div>
    </div>
  );
}

// «Кто это?»: the same prompt ladder as «Обо мне», stepped through only as
// needed -- the photo alone → the opening syllable ("Ма…", spoken) → the
// word itself, shown and spoken for the child to echo. Any hint means
// "С подсказкой" at best.
function PersonNamingTask(props) {
  const { speak } = useSpeech();
  const imageUrl = useTopicFile(props.topicId, props.task.image);
  const [hint, setHint] = useState({ taskId: null, level: 0 });
  const level = hint.taskId === props.task.conceptId ? hint.level : 0;
  const hintWord = props.task.hintWord ?? props.task.answer;
  const syllable = props.task.hintSyllable;

  function showSyllable() {
    setHint({ taskId: props.task.conceptId, level: Math.max(level, 1) });
    if (props.soundEnabled) speak(syllable);
  }
  function showAnswer() {
    setHint({ taskId: props.task.conceptId, level: 2 });
    if (props.soundEnabled) speak(hintWord);
  }

  return (
    <QualityAnswerTask
      {...props}
      className="about-me-task person-naming"
      ariaLabel="Задание назвать человека"
      answerShown={level >= 2}
      // The stage shows the child's own word to echo; the adult's panel
      // has both right answers.
      stageAnswer={hintWord}
      hinted={level >= 1}
      hints={<HintSteps level={level} steps={[
        ...(syllable ? [{ level: 1, label: "Первый слог", onClick: showSyllable }] : []),
        { level: 2, label: "Показать ответ", onClick: showAnswer },
      ]} />}
    >
      {({ repeatPrompt }) => (
        <>
          <div className="person-naming__photo-wrap">
            {imageUrl
              ? <img className="person-naming__photo" src={imageUrl} alt="" />
              : <span className="person-naming__photo person-naming__photo--loading" aria-hidden="true" />
            }
          </div>
          <div className="about-me-task__prompt-row">
            <div className="about-me-task__prompt">{props.task.prompt}</div>
            <SpeakerButton onClick={repeatPrompt} label="Повторить вопрос" />
          </div>
          {/* The cue slot keeps its height so the photo stays put as the
              hints come and go. */}
          <div className={`person-naming__syllable${level === 1 ? " person-naming__syllable--shown" : ""}`} aria-live="polite">
            {level === 1 ? `${syllable}…` : ""}
          </div>
        </>
      )}
    </QualityAnswerTask>
  );
}

export default function MyPeopleRenderer(rawProps) {
  // The mode's "Озвучка" switch sits on top of the app's sound: off means no
  // speech anywhere in the mode. Every task speaks only through
  // `soundEnabled`, so turning it off here silences them all.
  const voiceOn = rawProps.sessionParams?.voice !== false;
  const props = { ...rawProps, soundEnabled: Boolean(rawProps.soundEnabled) && voiceOn };
  return (
    <VoiceContext.Provider value={voiceOn}>
      <MyPeopleTask {...props} />
    </VoiceContext.Provider>
  );
}

function MyPeopleTask(props) {
  switch (props.task?.type) {
    case "people_album":
      return <PeopleAlbumTask {...props} />;
    case "person_intro":
      return <PersonIntroTask {...props} />;
    case "person_point":
    case "person_match":
      return <PersonPointTask {...props} />;
    case "about_me_question":
      return <AboutMeQuestionTask {...props} />;
    case "introduce_turn":
      return <IntroduceTurnTask {...props} />;
    case "person_naming":
      return <PersonNamingTask {...props} />;
    default:
      return <div className="session-body">Этому занятию нужен обновлённый режим «Мои люди».</div>;
  }
}
