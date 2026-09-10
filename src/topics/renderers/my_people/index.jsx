import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSpeech } from "@/shared/hooks/useSpeech";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { isCorrectAssociation } from "./matching";

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

function AlbumPhoto({ entry, topicId, match, wrong, dropTarget, onChoose }) {
  const url = useTopicFile(topicId, entry.image);
  const state = match
    ? " people-album-photo--matched"
    : wrong
      ? " people-album-photo--wrong"
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

function PeopleAlbumTask({ task, topicId, soundEnabled, onCorrect, onStreakReset, onCardShown, onTap }) {
  const { speak } = useSpeech();
  const [selectedAnswerId, setSelectedAnswerId] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [matches, setMatches] = useState({});
  const [wrongPersonId, setWrongPersonId] = useState(null);
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
      setWrongPersonId(entry.personId);
      onStreakReset?.(entry.conceptId, entry.personId);
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      wrongTimer.current = setTimeout(() => setWrongPersonId(null), 620);
      return;
    }

    const nextMatches = { ...matches, [entry.personId]: { answerId: answer.id, label: answer.label } };
    setMatches(nextMatches);
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

  function startAnswerDrag(event, answer) {
    if ((event.pointerType === "mouse" && event.button !== 0) || usedAnswerIds.has(answer.id)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const nextDrag = {
      answerId: answer.id,
      label: answer.label,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      overPersonId: getDropPersonId(event.clientX, event.clientY),
    };
    dragRef.current = nextDrag;
    setSelectedAnswerId(null);
    setDragging(nextDrag);
  }

  function moveAnswerDrag(event) {
    const currentDrag = dragRef.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;
    const nextDrag = {
      ...currentDrag,
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
    const personId = getDropPersonId(event.clientX, event.clientY);
    dragRef.current = null;
    setDragging(null);
    const entry = task.entries.find((candidate) => candidate.personId === personId);
    if (entry) associateAnswer(currentDrag.answerId, entry);
  }

  function chooseAnswerWithKeyboard(event, answer) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (!usedAnswerIds.has(answer.id)) setSelectedAnswerId(answer.id);
  }

  const chosenAnswer = answersById[selectedAnswerId];
  const completedCount = Object.keys(matches).length;
  const columnClass = task.entries.length >= 5 ? " people-album-photos--three-columns" : "";
  const dragHint = dragging
    ? `Перенеси «${dragging.label}» на нужную фотографию`
    : chosenAnswer
      ? `Найди: ${chosenAnswer.label}`
      : `Перетащи ${task.axis === "name" ? "имя" : "слово"} на фотографию`;

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
        <button type="button" className="people-album__repeat" onClick={repeatPrompt} aria-label="Повторить задание">🔊</button>
      </div>
      <div className="people-album__hint">
        {dragHint}
      </div>
      <div className={`people-album-photos${columnClass}`}>
        {task.entries.map((entry) => (
          <AlbumPhoto
            key={entry.personId}
            entry={entry}
            topicId={topicId}
            match={matches[entry.personId]}
            wrong={wrongPersonId === entry.personId}
            dropTarget={dragging?.overPersonId === entry.personId}
            onChoose={chooseKeyboardPerson}
          />
        ))}
      </div>
      <div className="people-album__answers-heading">
        <span>{task.answerTitle}</span>
        <span>{completedCount} из {task.entries.length}</span>
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

export default function MyPeopleRenderer(props) {
  if (props.task?.type !== "people_album") {
    return <div className="session-body">Этому занятию нужен обновлённый режим «Мои люди».</div>;
  }
  return <PeopleAlbumTask {...props} />;
}
