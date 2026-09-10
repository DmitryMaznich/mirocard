import { useEffect, useMemo, useRef, useState } from "react";
import { useSpeech } from "@/shared/hooks/useSpeech";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { isCorrectAssociation } from "./matching";

function AlbumPhoto({ entry, topicId, match, wrong, onChoose }) {
  const url = useTopicFile(topicId, entry.image);
  const state = match ? " people-album-photo--matched" : wrong ? " people-album-photo--wrong" : "";
  return (
    <button
      type="button"
      className={`people-album-photo${state}`}
      onClick={() => onChoose(entry)}
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
  const [matches, setMatches] = useState({});
  const [wrongPersonId, setWrongPersonId] = useState(null);
  const wrongTimer = useRef(null);

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

  function choosePerson(entry) {
    if (!selectedAnswerId || matches[entry.personId]) return;
    const answer = answersById[selectedAnswerId];
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

  const chosenAnswer = answersById[selectedAnswerId];
  const completedCount = Object.keys(matches).length;
  const columnClass = task.entries.length >= 5 ? " people-album-photos--three-columns" : "";

  return (
    <div className="session-body people-album" aria-label="Задание на сопоставление людей">
      <div className="people-album__prompt">
        <div className="people-album__question">{task.prompt}</div>
        <button type="button" className="people-album__repeat" onClick={repeatPrompt} aria-label="Повторить задание">🔊</button>
      </div>
      <div className="people-album__hint">
        {chosenAnswer ? `Найди: ${chosenAnswer.label}` : "Выбери слово, затем фотографию"}
      </div>
      <div className={`people-album-photos${columnClass}`}>
        {task.entries.map((entry) => (
          <AlbumPhoto
            key={entry.personId}
            entry={entry}
            topicId={topicId}
            match={matches[entry.personId]}
            wrong={wrongPersonId === entry.personId}
            onChoose={choosePerson}
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
          return (
            <button
              key={answer.id}
              type="button"
              className={`people-album-answer${selected ? " people-album-answer--selected" : ""}${used ? " people-album-answer--used" : ""}`}
              onClick={() => !used && setSelectedAnswerId(answer.id)}
              disabled={used}
              aria-pressed={selected}
            >
              {answer.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function MyPeopleRenderer(props) {
  if (props.task?.type !== "people_album") {
    return <div className="session-body">Этому занятию нужен обновлённый режим «Мои люди».</div>;
  }
  return <PeopleAlbumTask {...props} />;
}
