import { useTopicFile } from "@/shared/hooks/useTopicFile";

function CardImage({ topicId, card }) {
  const url = useTopicFile(topicId, card?.image);
  if (!card?.image) return null;
  if (!url) return <div className="card-img card-img--loading" />;
  return <img className="card-img" src={url} alt="" draggable={false} />;
}

// Flex-growing wrapper that lets the square card image expand to fill available height
function CardArea({ topicId, card }) {
  return (
    <div className="card-area">
      <CardImage topicId={topicId} card={card} />
    </div>
  );
}

function IntroTask({ task, topicId, onAdvance }) {
  return (
    <button className="session-full-tap" onClick={onAdvance}>
      <CardArea topicId={topicId} card={task.card} />
      <div className="session-label">{task.label}</div>
      <div className="session-hint">Нажмите, чтобы продолжить</div>
    </button>
  );
}

function YesNoTask({ task, topicId, onCorrect, onIncorrect }) {
  function handleAnswer(tappedYes) {
    const correct = tappedYes === task.isLabelCorrect;
    if (correct) onCorrect(task.conceptId, task.card.id);
    else         onIncorrect(task.conceptId, task.card.id);
  }

  return (
    <div className="session-body">
      <CardArea topicId={topicId} card={task.card} />
      <div className="session-label">{task.displayLabel}</div>
      <div className="yes-no-row">
        <button className="yes-no-btn yes-no-btn--no"  onClick={() => handleAnswer(false)}>НЕТ</button>
        <button className="yes-no-btn yes-no-btn--yes" onClick={() => handleAnswer(true)}>ДА</button>
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

function FindNTask({ task, topicId, onCorrect, onIncorrect }) {
  function handleOption(option) {
    if (option.isTarget) onCorrect(task.targetConceptId, option.card.id);
    else                 onIncorrect(task.targetConceptId, option.card.id);
  }

  const cols = task.options.length <= 4 ? 2 : 3;
  const rows = Math.ceil(task.options.length / cols);

  return (
    <div className="session-body">
      <div className="session-instruction">{task.targetLabel}</div>
      <div className="find-n-grid" style={{ "--cols": cols, "--rows": rows }}>
        {task.options.map((option) => (
          <FindNOption key={option.card.id} option={option} topicId={topicId} onClick={handleOption} />
        ))}
      </div>
    </div>
  );
}

function ChooseWordTask({ task, topicId, onCorrect, onIncorrect }) {
  function handleOption(option) {
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

const TASK_RENDERERS = {
  intro:                  IntroTask,
  yes_no:                 YesNoTask,
  find_n:                 FindNTask,
  choose_word_by_picture: ChooseWordTask,
};

export default function FlashcardsRenderer({ task, topicId, onCorrect, onIncorrect, onAdvance }) {
  const TaskRenderer = TASK_RENDERERS[task?.type];
  if (!TaskRenderer) return <div className="session-body">Неизвестный тип задания: {task?.type}</div>;
  return (
    <TaskRenderer
      task={task}
      topicId={topicId}
      onCorrect={onCorrect}
      onIncorrect={onIncorrect}
      onAdvance={onAdvance}
    />
  );
}
