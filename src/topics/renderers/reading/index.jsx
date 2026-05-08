import { useMemo, useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { shuffle } from "@/shared/utils/shuffle";
import { getTopicTitle } from "@/shared/utils/format";
import { tokenizeReadingLine } from "./engine";

const UNDERSTAND_BUTTONS = [
  { value: "independent", label: "Сам", mod: "easy" },
  { value: "after_text",  label: "После текста", mod: "prompted" },
  { value: "none",        label: "Нет ответа", mod: "fail" },
];

const FINAL_BUTTONS = [
  { value: "none",       label: "Не рассказал", mod: "fail" },
  { value: "prompted",   label: "С подсказкой", mod: "prompted" },
  { value: "read",       label: "Прочитал", mod: "correct" },
  { value: "expressive", label: "Выразительно", mod: "easy" },
];

function getLineText(line) {
  return typeof line === "string" ? line : line?.text ?? "";
}

function ReadingTextBlock({ lines, large = false, activeLineId = null }) {
  return (
    <div className={`reading-text${large ? " reading-text--large" : ""}`}>
      {(lines ?? []).map((line) => (
        <div
          key={line.id ?? getLineText(line)}
          className={`reading-line${activeLineId === line.id ? " reading-line--active" : ""}`}
        >
          {getLineText(line)}
        </div>
      ))}
    </div>
  );
}

function ReadingIllustration({ topicId, text }) {
  const url = useTopicFile(topicId, text?.image);
  if (!text?.image || !url) return null;

  return (
    <div className="reading-illustration">
      <img src={url} alt="" draggable={false} />
    </div>
  );
}

function ReadTextTask({ task, topicId, sessionParams, onAdvance }) {
  const lines = task.text?.lines ?? [];
  const layout = sessionParams?.layout ?? "full";
  const [lineIndex, setLineIndex] = useState(0);
  const activeLine = lines[lineIndex] ?? lines[0];

  if (layout === "line") {
    return (
      <div className="session-body reading-body">
        <div className="reading-title">{getTopicTitle(task.text.title)}</div>
        <div className="reading-content">
          <ReadingTextBlock lines={[activeLine]} large activeLineId={activeLine?.id} />
        </div>
        <div className="reading-line-nav">
          <button
            className="reading-secondary-btn"
            disabled={lineIndex <= 0}
            onClick={() => setLineIndex((i) => Math.max(0, i - 1))}
          >
            Назад
          </button>
          <span className="reading-line-count">{lineIndex + 1} / {lines.length}</span>
          {lineIndex + 1 < lines.length ? (
            <button
              className="reading-primary-btn"
              onClick={() => setLineIndex((i) => Math.min(lines.length - 1, i + 1))}
            >
              Дальше
            </button>
          ) : (
            <button className="reading-primary-btn" onClick={onAdvance}>Готово</button>
          )}
        </div>
        <ReadingIllustration topicId={topicId} text={task.text} />
      </div>
    );
  }

  return (
    <div className="session-body reading-body" onClick={onAdvance}>
      <div className="reading-title">{getTopicTitle(task.text.title)}</div>
      <div className="reading-content">
        <ReadingTextBlock lines={lines} />
      </div>
      <ReadingIllustration topicId={topicId} text={task.text} />
    </div>
  );
}

function UnderstandTextTask({ task, onQualityAnswer }) {
  const [showSupport, setShowSupport] = useState(false);
  const supportLines = task.supportLines?.length ? task.supportLines : task.text?.lines ?? [];

  function answer(value) {
    onQualityAnswer(value, task.textId, task.question.id);
  }

  return (
    <div className="session-body reading-body reading-understand">
      <div className="reading-question">{task.question.prompt}</div>

      {showSupport ? (
        <ReadingTextBlock lines={supportLines} activeLineId={supportLines[0]?.id} />
      ) : (
        <button className="reading-support-placeholder" onClick={() => setShowSupport(true)}>
          Показать фрагмент текста
        </button>
      )}

      <div className="qa-row reading-quality-row">
        {UNDERSTAND_BUTTONS.map((btn) => (
          <button
            key={btn.value}
            className={`qa-btn qa-btn--${btn.mod}`}
            onClick={() => answer(btn.value)}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function makeLineTokens(line) {
  return tokenizeReadingLine(line).map((token, index) => ({
    ...token,
    uid: `${line.id}_${index}_${token.text}_${Math.random().toString(36).slice(2, 7)}`,
  }));
}

function buildLineState(line) {
  return {
    available: line ? shuffle(makeLineTokens(line)) : [],
    placed: {},
    selectedUid: null,
    wrongSlot: null,
  };
}

function AssembleTextTask({ task, onQualityAnswer }) {
  const lines = task.text?.lines ?? [];
  const [lineIndex, setLineIndex] = useState(0);
  const [lineState, setLineState] = useState(() => buildLineState(lines[0]));
  const [completedLines, setCompletedLines] = useState([]);
  const [assembled, setAssembled] = useState(false);

  const activeLine = lines[lineIndex];
  const expectedTokens = useMemo(() => tokenizeReadingLine(activeLine), [activeLine]);
  const { available, placed, selectedUid, wrongSlot } = lineState;

  function rejectSlot(slotIndex) {
    setLineState((state) => ({ ...state, wrongSlot: slotIndex }));
    setTimeout(() => setLineState((state) => ({ ...state, wrongSlot: null })), 420);
  }

  function placeToken(uid, slotIndex) {
    if (placed[slotIndex]) return;
    const token = available.find((item) => item.uid === uid);
    const expected = expectedTokens[slotIndex];
    if (!token || !expected) return;

    if (token.text !== expected.text) {
      rejectSlot(slotIndex);
      return;
    }

    const nextPlaced = { ...placed, [slotIndex]: token };
    setLineState((state) => ({
      ...state,
      placed: nextPlaced,
      available: state.available.filter((item) => item.uid !== uid),
      selectedUid: null,
      wrongSlot: null,
    }));

    if (Object.keys(nextPlaced).length === expectedTokens.length) {
      setTimeout(() => {
        const finishedLine = { ...activeLine, text: expectedTokens.map((item) => item.text).join(" ") };
        setCompletedLines((prev) => [...prev, finishedLine]);
        if (lineIndex + 1 >= lines.length) {
          setAssembled(true);
        } else {
          const nextIndex = lineIndex + 1;
          setLineIndex(nextIndex);
          setLineState(buildLineState(lines[nextIndex]));
        }
      }, 420);
    }
  }

  function handleDrop(event, slotIndex) {
    event.preventDefault();
    const uid = event.dataTransfer.getData("text/plain");
    placeToken(uid, slotIndex);
  }

  function handleSlotClick(slotIndex) {
    if (!selectedUid) return;
    placeToken(selectedUid, slotIndex);
  }

  if (assembled) {
    return (
      <div className="session-body reading-body reading-assembled-final">
        <ReadingTextBlock lines={completedLines} large />
        <div className="qa-row reading-final-row">
          {FINAL_BUTTONS.map((btn) => (
            <button
              key={btn.value}
              className={`qa-btn qa-btn--${btn.mod}`}
              onClick={() => onQualityAnswer(btn.value, task.textId, "assemble_final")}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="session-body reading-body reading-assemble">
      <div className="reading-assembled-preview">
        {completedLines.length > 0 ? (
          <ReadingTextBlock lines={completedLines} />
        ) : (
          <div className="reading-muted">Собранные строки появятся здесь</div>
        )}
      </div>

      <div className="reading-slot-row" aria-label="Строка с пропусками">
        {expectedTokens.map((token, index) => (
          <button
            key={`${token.text}_${index}`}
            className={`reading-slot${placed[index] ? " reading-slot--filled" : ""}${wrongSlot === index ? " reading-slot--wrong" : ""}`}
            style={{ "--chars": Math.max(2, token.text.length) }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, index)}
            onClick={() => handleSlotClick(index)}
          >
            {placed[index]?.text ?? ""}
          </button>
        ))}
      </div>

      <div className="reading-word-bank">
        {available.map((token) => (
          <button
            key={token.uid}
            className={`reading-word${selectedUid === token.uid ? " reading-word--selected" : ""}`}
            draggable
            onDragStart={(event) => event.dataTransfer.setData("text/plain", token.uid)}
            onClick={() => setLineState((state) => ({
              ...state,
              selectedUid: state.selectedUid === token.uid ? null : token.uid,
            }))}
          >
            {token.text}
          </button>
        ))}
      </div>

      <div className="reading-line-count">{lineIndex + 1} / {lines.length}</div>
    </div>
  );
}

const TASK_RENDERERS = {
  read_text:       ReadTextTask,
  understand_text: UnderstandTextTask,
  assemble_text:   AssembleTextTask,
};

export default function ReadingRenderer({ task, topicId, sessionParams, onAdvance, onQualityAnswer }) {
  const TaskRenderer = TASK_RENDERERS[task?.type];
  if (!TaskRenderer) return <div className="session-body">Неизвестный тип задания: {task?.type}</div>;
  return (
    <TaskRenderer
      task={task}
      topicId={topicId}
      sessionParams={sessionParams}
      onAdvance={onAdvance}
      onQualityAnswer={onQualityAnswer}
    />
  );
}
