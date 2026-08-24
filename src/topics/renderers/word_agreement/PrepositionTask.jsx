import { useEffect, useRef, useState } from "react";
import { shuffle } from "@/shared/utils/shuffle";

const MAX_ATTEMPTS = 2;

const OBJECT_LABELS = {
  ball: "мяч",
  cube: "кубик",
  book: "книга",
  car: "машинка",
};

const LANDMARK_LABELS = {
  box: "коробка",
  table: "стол",
  chair: "стул",
};

const RELATION_LABELS = {
  in: "в",
  on: "на",
  under: "под",
};

const LANDMARK_FOR_RELATION = {
  box: { in: "коробке", on: "коробке", under: "коробкой" },
  table: { on: "столе", under: "столом" },
  chair: { on: "стуле", under: "стулом" },
};

const LANDMARK_FOR_ACTION = {
  box: { in: "коробку", on: "коробку", under: "коробку" },
  table: { on: "стол", under: "стол" },
  chair: { on: "стул", under: "стул" },
};

function relationDescription(card) {
  const landmark = LANDMARK_FOR_RELATION[card.landmark]?.[card.relation]
    ?? LANDMARK_LABELS[card.landmark]
    ?? "предмете";
  return `${OBJECT_LABELS[card.object] ?? "предмет"} ${RELATION_LABELS[card.relation] ?? ""} ${landmark}`;
}

function actionDescription(card, relation) {
  const landmark = LANDMARK_FOR_ACTION[card.landmark]?.[relation]
    ?? LANDMARK_LABELS[card.landmark]
    ?? "место";
  return `Положить ${OBJECT_LABELS[card.object] ?? "предмет"} ${RELATION_LABELS[relation]} ${landmark}`;
}

function SceneObject({ object }) {
  return <span className={`wa-scene__object wa-scene__object--${object}`} aria-hidden="true" />;
}

function Landmark({ landmark }) {
  if (landmark === "table") {
    return (
      <span className="wa-scene__landmark wa-scene__landmark--table" aria-hidden="true">
        <i className="wa-scene__table-top" />
        <i className="wa-scene__table-leg wa-scene__table-leg--left" />
        <i className="wa-scene__table-leg wa-scene__table-leg--right" />
      </span>
    );
  }

  if (landmark === "chair") {
    return (
      <span className="wa-scene__landmark wa-scene__landmark--chair" aria-hidden="true">
        <i className="wa-scene__chair-back" />
        <i className="wa-scene__chair-seat" />
        <i className="wa-scene__chair-leg wa-scene__chair-leg--left" />
        <i className="wa-scene__chair-leg wa-scene__chair-leg--right" />
      </span>
    );
  }

  return (
    <span className="wa-scene__landmark wa-scene__landmark--box" aria-hidden="true">
      <i className="wa-scene__box-inside" />
      <i className="wa-scene__box-front" />
    </span>
  );
}

function SpatialScene({ card, relation, selectableRelations, selectedRelation, wrongRelation, onSelect }) {
  const isInteractive = selectableRelations?.length > 0;
  const sceneLabel = relation === "start"
    ? `${OBJECT_LABELS[card.object]} рядом с предметом: выбери место`
    : relationDescription({ ...card, relation });
  const sceneRole = isInteractive ? "group" : "img";

  return (
    <div
      className={`wa-scene wa-scene--${card.landmark} wa-scene--relation-${relation}`}
      role={sceneRole}
      aria-label={sceneLabel}
    >
      <span className="wa-scene__floor" aria-hidden="true" />
      <Landmark landmark={card.landmark} />
      <SceneObject object={card.object} />

      {isInteractive && selectableRelations.map((candidate) => {
        const isCorrect = selectedRelation === candidate && candidate === card.relation;
        const isWrong = wrongRelation === candidate;
        return (
          <button
            key={candidate}
            type="button"
            className={`wa-scene__zone wa-scene__zone--${candidate}${isCorrect ? " wa-scene__zone--correct" : ""}${isWrong ? " wa-scene__zone--wrong" : ""}`}
            onClick={() => onSelect?.(candidate)}
            disabled={selectedRelation != null}
            aria-label={actionDescription(card, candidate)}
          >
          </button>
        );
      })}
    </div>
  );
}

function FilledSentence({ card, filledWord }) {
  const [before, after] = card.sentence.split("{blank}");
  return (
    <div className="wa-preposition__sentence">
      {before}
      <span className={`wa-blank${filledWord ? " wa-blank--filled" : ""}`}>
        {filledWord ?? "···"}
      </span>
      {after}
    </div>
  );
}

function ModelPhrase({ card, show }) {
  if (!show) return null;
  return <p className="wa-preposition__model">{card.resultPhrase}</p>;
}

export default function PrepositionTask({ task, topicId, playTopicFile, onCorrect, onMistake, onAdvance, onCardShown, onTap }) {
  const { card, options } = task;
  const [shownOptions, setShownOptions] = useState(() => shuffle(options));
  const [wrongCount, setWrongCount] = useState(0);
  const [wrongOption, setWrongOption] = useState(null);
  const [status, setStatus] = useState("active");
  const wrongTimerRef = useRef(null);

  function playModelAudio() {
    if (card.audio && topicId && playTopicFile) playTopicFile(topicId, card.audio);
  }

  function playPromptAudio() {
    const promptAudio = task.type === "preposition_recognize"
      ? card.locateAudio
      : task.type === "preposition_place"
        ? card.actionAudio
        : null;
    if (promptAudio && topicId && playTopicFile) playTopicFile(topicId, promptAudio);
  }

  useEffect(() => {
    onCardShown?.(card.id, card.id);
    playPromptAudio();
    return () => clearTimeout(wrongTimerRef.current);
  }, [card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAnswer(answer) {
    if (status !== "active") return;
    const isCorrect = answer === card.relation;
    onTap?.(answer, isCorrect);

    if (isCorrect) {
      setStatus("correct");
      playModelAudio();
      onCorrect?.(card.id, card.id);
      return;
    }

    setWrongOption(answer);
    const nextWrongCount = wrongCount + 1;
    setWrongCount(nextWrongCount);

    if (nextWrongCount >= MAX_ATTEMPTS) {
      setStatus("revealed");
      playModelAudio();
      onMistake?.(card.id, card.id);
      return;
    }

    wrongTimerRef.current = setTimeout(() => {
      setWrongOption(null);
      setShownOptions((currentOptions) => shuffle(currentOptions));
    }, 500);
  }

  const isFinished = status !== "active";
  const prompt = task.type === "preposition_recognize"
    ? card.locatePrompt
    : task.type === "preposition_place"
      ? card.actionPrompt
      : "Выбери слово для фразы";

  return (
    <div className={`wa-preposition wa-preposition--${task.type}`}>
      <div className="wa-preposition__prompt">{prompt}</div>

      {task.type === "preposition_recognize" && (
        <div className={`wa-preposition__choices wa-preposition__choices--${shownOptions.length}`}>
          {shownOptions.map((relation) => {
            const isCorrect = isFinished && relation === card.relation;
            const isWrong = wrongOption === relation;
            return (
              <button
                key={relation}
                type="button"
                className={`wa-scene-choice${isCorrect ? " wa-scene-choice--correct" : ""}${isWrong ? " wa-scene-choice--wrong" : ""}${isFinished && !isCorrect ? " wa-scene-choice--dim" : ""}`}
                onClick={() => handleAnswer(relation)}
                disabled={isFinished}
                aria-label={relationDescription({ ...card, relation })}
              >
                <SpatialScene card={card} relation={relation} />
                {isCorrect && <span className="wa-option__icon" aria-hidden="true">✓</span>}
                {isWrong && <span className="wa-option__icon" aria-hidden="true">✗</span>}
              </button>
            );
          })}
        </div>
      )}

      {task.type === "preposition_place" && (
        <SpatialScene
          card={card}
          relation={isFinished ? card.relation : "start"}
          selectableRelations={shownOptions}
          selectedRelation={isFinished ? card.relation : null}
          wrongRelation={wrongOption}
          onSelect={handleAnswer}
        />
      )}

      {task.type === "preposition_phrase" && (
        <>
          <SpatialScene card={card} relation={card.relation} />
          <FilledSentence card={card} filledWord={isFinished ? card.answer : null} />
          <div className={`wa-options wa-options--${shownOptions.length}`}>
            {shownOptions.map((relation) => {
              const isCorrect = isFinished && relation === card.relation;
              const isWrong = wrongOption === relation;
              return (
                <button
                  key={relation}
                  type="button"
                  className={`wa-option${isCorrect ? " wa-option--correct" : ""}${isWrong ? " wa-option--wrong" : ""}${isFinished && !isCorrect ? " wa-option--dim" : ""}`}
                  onClick={() => handleAnswer(relation)}
                  disabled={isFinished}
                >
                  {isCorrect && <span className="wa-option__icon" aria-hidden="true">✓</span>}
                  {isWrong && <span className="wa-option__icon" aria-hidden="true">✗</span>}
                  {RELATION_LABELS[relation]}
                </button>
              );
            })}
          </div>
        </>
      )}

      <ModelPhrase card={card} show={isFinished} />

      {!isFinished && (card.locateAudio || card.actionAudio) && task.type !== "preposition_phrase" && (
        <button className="wa-preposition__listen" type="button" onClick={playPromptAudio}>
          Слушать задание
        </button>
      )}

      {isFinished && card.audio && (
        <button className="wa-preposition__listen" type="button" onClick={playModelAudio}>
          Слушать ещё раз
        </button>
      )}

      {status === "revealed" && (
        <button className="wa-next-button" type="button" onClick={onAdvance}>
          Дальше
        </button>
      )}
    </div>
  );
}
