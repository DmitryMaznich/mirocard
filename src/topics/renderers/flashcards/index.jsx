import { useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { getTopicTitle } from "@/shared/utils/format";

function getTaskAudioPath(task) {
  if (task?.card?.audio?.ru) return task.card.audio.ru;
  if (task?.type === "find_n") {
    const target = task.options?.find((o) => o.isTarget);
    return target?.card?.audio?.ru ?? null;
  }
  return null;
}

function CardImage({ topicId, card }) {
  const url = useTopicFile(topicId, card?.image);
  if (!card?.image) return null;
  if (!url) return <div className="card-img card-img--loading" />;
  return <img className="card-img" src={url} alt="" draggable={false} />;
}

function SituationScene({ topicId, image }) {
  const url = useTopicFile(topicId, image);
  if (!image) return null;
  if (!url) return <div className="situation-scene situation-scene--loading" />;
  return <img className="situation-scene" src={url} alt="" draggable={false} />;
}

function CardArea({ topicId, card }) {
  return (
    <div className="card-area">
      <CardImage topicId={topicId} card={card} />
    </div>
  );
}

function AudioButton({ topicId, audioPath, playTopicFile, soundEnabled }) {
  if (!audioPath || !soundEnabled) return null;
  return (
    <button
      className="session-audio-icon-button session-audio-icon-button--active question-answer-audio-button"
      onClick={(e) => { e.stopPropagation(); playTopicFile(topicId, audioPath); }}
      aria-label="Повторить"
    >
      🔊
    </button>
  );
}

function IntroTask({ task, mode, topicId, soundEnabled, playTopicFile, onAdvance }) {
  const audioPath = getTaskAudioPath(task);

  useEffect(() => {
    if (audioPath) playTopicFile(topicId, audioPath);
  }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <button className="session-full-tap" onClick={onAdvance}>
      <CardArea topicId={topicId} card={task.card} />
      <div className="session-label">
        {mode?.answerPrefix && <span className="session-label__prefix">{mode.answerPrefix} </span>}
        {task.label}
      </div>
      <AudioButton topicId={topicId} audioPath={audioPath} playTopicFile={playTopicFile} soundEnabled={soundEnabled} />
    </button>
  );
}

function SituationIntroTask({ task, topicId, onAdvance }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { setRevealed(false); }, [task]);
  const hasScene = Boolean(task.sceneImage);

  function handleTap() {
    if (!revealed) { setRevealed(true); return; }
    onAdvance();
  }

  return (
    <button className="session-full-tap situation-intro" onClick={handleTap}>
      <div className="session-instruction">{task.situationText}</div>
      {hasScene && !revealed ? (
        <>
          <SituationScene topicId={topicId} image={task.sceneImage} />
          <div className="session-instruction situation-intro__question">Что чувствует?</div>
        </>
      ) : (
        <>
          <CardArea topicId={topicId} card={task.card} />
          {!hasScene && <div className="session-instruction situation-intro__question">Что чувствует?</div>}
          <div className={`situation-intro__reveal${revealed ? " situation-intro__reveal--shown" : ""}`}>
            <div className="situation-intro__label">{task.label}</div>
          </div>
        </>
      )}
      {!revealed && <div className="session-hint">{hasScene ? "Нажми, чтобы увидеть ответ" : "Нажми, чтобы узнать ответ"}</div>}
    </button>
  );
}

const QA_BUTTONS = [
  { value: "fail",     label: "Не ответил",   mod: "fail"     },
  { value: "prompted", label: "С подсказкой", mod: "prompted" },
  { value: "correct",  label: "Правильно",    mod: "correct"  },
  { value: "easy",     label: "Легко!",        mod: "easy"     },
];

const KEY_MAP = { "1": "fail", "2": "prompted", "3": "correct", "4": "easy" };

function QuestionAnswerTask({ task, mode, sessionParams, topicId, soundEnabled, playTopicFile, onQualityAnswer, onCardShown, onQuality }) {
  const audioPath       = getTaskAudioPath(task);
  const prefixAudioPath = mode?.answerPrefixAudio ?? null;
  const useKeyboard     = useAppStore((s) => s.settings.physicalKeyboard ?? false);
  const [revealed,      setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(false);
    onCardShown?.(task.card?.id, task.conceptId);
  }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleQuality(value) {
    if (revealed) return;
    setRevealed(true);
    onQuality?.(value, task.card?.id, task.conceptId);

    const hasPrefix = Boolean(prefixAudioPath && soundEnabled);
    const hasMain   = Boolean(audioPath && soundEnabled);
    const PREFIX_GAP = 480; // ms to wait after prefix before main audio

    if (hasPrefix) {
      playTopicFile(topicId, prefixAudioPath);
      if (hasMain) setTimeout(() => playTopicFile(topicId, audioPath), PREFIX_GAP);
    } else if (hasMain) {
      playTopicFile(topicId, audioPath);
    }

    const delay = hasPrefix ? PREFIX_GAP + 1400 : (hasMain ? 1400 : 700);
    setTimeout(() => {
      onQualityAnswer(value, task.conceptId, task.card?.id);
    }, delay);
  }

  useEffect(() => {
    if (!useKeyboard) return;
    function onKey(e) {
      const quality = KEY_MAP[e.key];
      if (quality) handleQuality(quality);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [useKeyboard, revealed]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="session-body qa-body">
      <CardArea topicId={topicId} card={task.card} />
      <div className="qa-right-panel">
        <div className="session-instruction">{getTopicTitle(mode.ui.instruction)}</div>
        <div className={`qa-reveal${revealed ? " qa-reveal--shown" : ""}`}>
          {mode?.answerPrefix ? `${mode.answerPrefix} ${task.label}` : task.label}
        </div>
        <div className="qa-row">
          {QA_BUTTONS.map((btn, i) => (
            <button
              key={btn.value}
              className={`qa-btn qa-btn--${btn.mod}`}
              disabled={revealed}
              onClick={() => handleQuality(btn.value)}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <p className="qa-legend">
          {QA_BUTTONS.map((btn, i) => `${i + 1} — ${btn.label}`).join("   ")}
        </p>
      </div>
    </div>
  );
}

function YesNoTask({ task, mode, topicId, onCorrect, onIncorrect, onCardShown, onTap }) {
  const [result, setResult] = useState(null); // null | "correct" | "incorrect"

  useEffect(() => {
    setResult(null);
    onCardShown?.(task.card?.id, task.conceptId);
  }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAnswer(tappedYes) {
    if (result !== null) return;
    const correct = tappedYes === task.isLabelCorrect;
    const outcome = correct ? "correct" : "incorrect";
    setResult(outcome);
    onTap?.(tappedYes ? "yes" : "no", correct);
    setTimeout(() => {
      if (correct) onCorrect(task.conceptId, task.card.id);
      else         onIncorrect(task.conceptId, task.card.id);
    }, 1500);
  }

  const displayLower  = task.displayLabel?.toLowerCase() ?? "";
  const correctLower  = task.correctLabel?.toLowerCase()  ?? displayLower;
  const prefix        = mode?.answerPrefix ?? "Это";
  const question      = `${prefix} ${displayLower}?`;
  const feedbackText  = result === "correct"
    ? `Правильно! ${prefix} ${correctLower}!`
    : result === "incorrect"
      ? `Нет! ${prefix} ${correctLower}!`
      : null;

  return (
    <div className="session-body session-body--yes-no">
      <CardArea topicId={topicId} card={task.card} />
      <div className="yn-right-panel">
        <div className={`session-label yn-label${result ? ` yn-label--${result}` : ""}`}>
          {feedbackText ?? question}
        </div>
        {!result && (
          <div className="yes-no-row">
            <button className="yes-no-btn yes-no-btn--no"  onClick={() => handleAnswer(false)}>НЕТ</button>
            <button className="yes-no-btn yes-no-btn--yes" onClick={() => handleAnswer(true)}>ДА</button>
          </div>
        )}
      </div>
    </div>
  );
}

function FindNOption({ option, topicId, onClick }) {
  const url = useTopicFile(topicId, option.card?.image);
  return (
    <button className="find-n-option" onClick={() => onClick(option)}>
      {url
        ? <img className="find-n-option__img" src={url} alt="" draggable={false} />
        : <div className="find-n-option__img find-n-option__img--loading" />
      }
    </button>
  );
}

function FindNTask({ task, topicId, onCorrect, onIncorrect, onCardShown, onTap }) {
  useEffect(() => {
    onCardShown?.(null, task.targetConceptId);
  }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleOption(option) {
    onTap?.(option.card.id, option.isTarget);
    if (option.isTarget) onCorrect(task.targetConceptId, option.card.id);
    else                 onIncorrect(task.targetConceptId, option.card.id);
  }

  const cols = 2;
  const rows = Math.ceil(task.options.length / cols);

  return (
    <div className={`session-body session-body--find-n${task.sceneImage ? " session-body--situation" : ""}`} style={{ "--rows": rows }}>
      <div className="session-instruction">{task.targetLabel}</div>
      {task.sceneImage && <SituationScene topicId={topicId} image={task.sceneImage} />}
      <div className="find-n-grid" style={{ "--cols": cols }}>
        <div className="find-n-inner">
          {task.options.map((option) => (
            <FindNOption key={option.card.id} option={option} topicId={topicId} onClick={handleOption} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ChooseWordTask({ task, topicId, onCorrect, onIncorrect, onCardShown, onTap }) {
  useEffect(() => {
    onCardShown?.(task.card?.id, task.conceptId);
  }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleOption(option) {
    onTap?.(option.conceptId, option.isTarget);
    if (option.isTarget) onCorrect(task.conceptId, task.card.id);
    else                 onIncorrect(task.conceptId, task.card.id);
  }

  return (
    <div className="session-body session-body--choose-word">
      <CardArea topicId={topicId} card={task.card} />
      <div className="choose-word-options">
        {task.options.map((option) => (
          <button
            key={option.conceptId}
            className="choose-word-btn"
            onClick={() => handleOption(option)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChooseAllOption({ card, topicId, mark, onClick, disabled }) {
  const url = useTopicFile(topicId, card?.image);
  return (
    <button
      className={`choose-all-option${mark ? ` choose-all-option--${mark}` : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {url
        ? <img className="choose-all-option__img" src={url} alt="" draggable={false} />
        : <div className="choose-all-option__img choose-all-option__img--loading" />
      }
      {mark && (
        <span className={`choose-all-badge choose-all-badge--${mark}`}>
          {mark === "correct" ? "✓" : "✕"}
        </span>
      )}
    </button>
  );
}

function ChooseAllTask({ task, topicId, onCorrect, onIncorrect }) {
  const [marks,    setMarks]    = useState({});
  const [hadWrong, setHadWrong] = useState(false);
  const [done,     setDone]     = useState(false);

  const targetIds = new Set(task.targetCardIds);

  function handleTap(card) {
    if (done || marks[card.id]) return;
    const isTarget   = targetIds.has(card.id);
    const newMarks   = { ...marks, [card.id]: isTarget ? "correct" : "wrong" };
    const newHadWrong = hadWrong || !isTarget;
    setMarks(newMarks);
    if (!isTarget) setHadWrong(true);
    const allFound = task.targetCardIds.every((id) => newMarks[id] === "correct");
    if (allFound) {
      setDone(true);
      if (newHadWrong) onIncorrect(task.conceptId, null);
      else             onCorrect(task.conceptId, null);
    }
  }

  const cols = task.allCards.length === 9 ? 3 : 2;
  const rows = Math.ceil(task.allCards.length / cols);

  return (
    <div className="session-body">
      <div className="choose-all-instruction">
        Найди все: <strong>{task.targetLabel}</strong>
      </div>
      <div className="choose-all-grid" style={{ "--cols": cols, "--rows": rows }}>
        <div className="choose-all-inner">
        {task.allCards.map((card) => (
          <ChooseAllOption
            key={card.id}
            card={card}
            topicId={topicId}
            mark={marks[card.id]}
            onClick={() => handleTap(card)}
            disabled={done || !!marks[card.id]}
          />
        ))}
        </div>
      </div>
    </div>
  );
}

const TASK_RENDERERS = {
  intro:                  IntroTask,
  question_answer:        QuestionAnswerTask,
  yes_no:                 YesNoTask,
  find_n:                 FindNTask,
  situation_emotion:      FindNTask,
  situation_intro:        SituationIntroTask,
  emotion_situation:      ChooseWordTask,
  choose_word_by_picture: ChooseWordTask,
  choose_all:             ChooseAllTask,
};

export default function FlashcardsRenderer({ task, mode, sessionParams, topicId, soundEnabled, playTopicFile, onCorrect, onIncorrect, onAdvance, onQualityAnswer, onCardShown, onTap, onQuality }) {
  const TaskRenderer = TASK_RENDERERS[task?.type];
  if (!TaskRenderer) return <div className="session-body">Неизвестный тип задания: {task?.type}</div>;
  return (
    <TaskRenderer
      task={task}
      mode={mode}
      sessionParams={sessionParams}
      topicId={topicId}
      soundEnabled={soundEnabled}
      playTopicFile={playTopicFile}
      onCorrect={onCorrect}
      onIncorrect={onIncorrect}
      onAdvance={onAdvance}
      onQualityAnswer={onQualityAnswer}
      onCardShown={onCardShown}
      onTap={onTap}
      onQuality={onQuality}
    />
  );
}
