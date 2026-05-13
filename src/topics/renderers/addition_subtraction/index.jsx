import { useState, useRef, useEffect } from "react";
import {
  buildStickSlots,
  evaluateStickMove,
  getStickBeadColor,
  getStickSideCount,
  isStickComplete,
} from "./stickModel";

const ACTION_OPTIONS = [
  { value: "add", label: "Прибавили" },
  { value: "remove", label: "Убрали" },
];

const ACTION_MEANING_OPTIONS = [
  { value: "add", label: "Прибавить" },
  { value: "remove", label: "Убрать" },
];

const SIGN_OPTIONS = [
  { value: "+", label: "+" },
  { value: "-", label: "-" },
];

const DIRECTION_OPTIONS = [
  { value: "more", label: "Больше" },
  { value: "less", label: "Меньше" },
];

function getActionWord(task) {
  return task.operation === "add" ? "прибавили" : "убрали";
}

function getActionInfinitive(task) {
  return task.operation === "add" ? "Прибавить" : "Убрать";
}

function getDirectionAnswer(task) {
  return task.result > task.start ? "more" : "less";
}

function getRightLabel(task) {
  return task.operation === "add" ? "Берём отсюда" : "Сюда убираем";
}

function getRailState(task, phase = "result", moved = null) {
  if (moved != null) {
    return {
      leftCount: task.operation === "add" ? task.start + moved : task.start - moved,
      rightCount: task.operation === "add" ? task.delta - moved : moved,
      highlightLeftFrom: task.operation === "add" && moved > 0 ? task.start : null,
      highlightRight: task.operation === "subtract" && moved > 0,
    };
  }

  if (phase === "start") {
    return {
      leftCount: task.start,
      rightCount: task.operation === "add" ? task.delta : 0,
      highlightLeftFrom: null,
      highlightRight: false,
    };
  }

  return {
    leftCount: task.result,
    rightCount: task.operation === "add" ? 0 : task.delta,
    highlightLeftFrom: task.operation === "add" ? task.start : null,
    highlightRight: task.operation === "subtract",
  };
}

function OperationRail({ task, title, phase = "result", moved = null, compact = false }) {
  const state = getRailState(task, phase, moved);
  const gapSlots = 5;
  const rightSlots = Math.max(task.delta, 2);
  const totalColumns = task.maxNumber + gapSlots + rightSlots;
  const rightStart = task.maxNumber + gapSlots + 1;
  const leftBeads = Array.from({ length: state.leftCount }, (_, index) => ({
    id: `left-${index}`,
    moved: state.highlightLeftFrom != null && index >= state.highlightLeftFrom,
  }));
  const rightBeads = Array.from({ length: state.rightCount }, (_, index) => ({
    id: `right-${index}`,
    moved: state.highlightRight,
    column: rightStart + index,
  }));

  return (
    <div className={`operation-zone-rail${compact ? " operation-zone-rail--compact" : ""}`}>
      {title && <div className="operation-zone-rail__title">{title}</div>}
      <div className="operation-zone-rail__labels">
        <span>Рабочая зона: {state.leftCount}</span>
        <span>{getRightLabel(task)}: {state.rightCount}</span>
      </div>
      <div
        className={`operation-rail operation-rail--${task.operation}`}
        aria-label={`${title ?? "Фишки"}: рабочая зона ${state.leftCount}, правая зона ${state.rightCount}`}
        style={{ "--rail-columns": `${totalColumns}` }}
      >
        <div className="operation-rail__line" />
        <div className="operation-rail__track">
          {leftBeads.map((bead, index) => (
            <span
              key={bead.id}
              className={[
                "operation-bead",
                "operation-bead--left",
                bead.moved ? "operation-bead--moved" : "",
              ].filter(Boolean).join(" ")}
              style={{ gridColumn: index + 1 }}
              aria-hidden="true"
            />
          ))}
          <div
            className={`operation-rail__gap operation-rail__gap--${task.operation === "add" ? "left" : "right"}`}
            style={{ gridColumn: `${task.maxNumber + 1} / span ${gapSlots}` }}
            aria-hidden="true"
          >
            {task.operation === "add" ? "←" : "→"}
          </div>
          {rightBeads.map((bead) => (
            <span
              key={bead.id}
              className={[
                "operation-bead",
                "operation-bead--right",
                task.operation === "add" ? "operation-bead--source" : "",
                bead.moved ? "operation-bead--moved" : "",
              ].filter(Boolean).join(" ")}
              style={{ gridColumn: bead.column }}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function OperationStory({ task, compact = false }) {
  return (
    <div className={`operation-rail-story${compact ? " operation-rail-story--compact" : ""}`}>
      <OperationRail task={task} title="Было" phase="start" compact={compact} />
      <OperationRail task={task} title="Стало" phase="result" compact={compact} />
    </div>
  );
}

function LiveBeadTool({ task, disabled, onAnswer, onMistake }) {
  const [workCount, setWorkCount] = useState(task.start);
  const [drag, setDrag]           = useState(null);
  const [error, setError]         = useState(false);
  const wrapRef     = useRef(null);
  const dragRef     = useRef(null);
  const errorRef    = useRef(null);
  const onAnswerRef = useRef(onAnswer);
  const answerCommittedRef = useRef(false);

  useEffect(() => { onAnswerRef.current = onAnswer; }, [onAnswer]);
  useEffect(() => () => { clearTimeout(errorRef.current); }, []);

  function commitAnswer() {
    if (answerCommittedRef.current) return;
    answerCommittedRef.current = true;
    onAnswerRef.current();
  }

  function getMoveFromPointer(clientX, currentDrag) {
    return evaluateStickMove(
      task,
      currentDrag.originWorkCount,
      currentDrag.sourceSlot,
      clientX - currentDrag.startX,
    );
  }

  function startDrag(e, sourceSlot) {
    if (disabled || answerCommittedRef.current) return;
    e.preventDefault();
    wrapRef.current?.setPointerCapture?.(e.pointerId);

    const nextDrag = {
      pointerId: e.pointerId,
      sourceSlot,
      startX: e.clientX,
      originWorkCount: workCount,
      previewWorkCount: null,
    };

    dragRef.current = nextDrag;
    setDrag(nextDrag);
  }

  function moveDrag(e) {
    const currentDrag = dragRef.current;
    if (!currentDrag || e.pointerId !== currentDrag.pointerId) return;

    const result = getMoveFromPointer(e.clientX, currentDrag);
    const nextDrag = {
      ...currentDrag,
      previewWorkCount: result.kind === "move" ? result.nextWorkCount : null,
    };

    dragRef.current = nextDrag;
    setDrag(nextDrag);
  }

  function endDrag(e) {
    const currentDrag = dragRef.current;
    if (!currentDrag || e.pointerId !== currentDrag.pointerId) return;
    dragRef.current = null;
    wrapRef.current?.releasePointerCapture?.(e.pointerId);

    if (answerCommittedRef.current) {
      setDrag(null);
      return;
    }

    const result = getMoveFromPointer(e.clientX, currentDrag);

    if (result.kind === "mistake") {
      onMistake?.(task.conceptId, task.cardId);
      setError(true);
      clearTimeout(errorRef.current);
      errorRef.current = setTimeout(() => setError(false), 600);
      setDrag(null);
      return;
    }

    if (result.kind === "move") {
      setWorkCount(result.nextWorkCount);
      if (result.complete) commitAnswer();
    }

    setDrag(null);
  }

  function cancelDrag(e) {
    if (dragRef.current?.pointerId === e.pointerId) {
      wrapRef.current?.releasePointerCapture?.(e.pointerId);
    }
    dragRef.current = null;
    setDrag(null);
  }

  const displayWorkCount = drag?.previewWorkCount ?? workCount;
  const slots = buildStickSlots(task, displayWorkCount);
  const sideCount = getStickSideCount(task, displayWorkCount);

  return (
    <div className="operation-stick">
      <div
        ref={wrapRef}
        className="operation-stick__wrap"
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={cancelDrag}
      >
        <div className="operation-stick__rod" />
        <div
          className={`operation-stick__track${error ? " operation-stick__track--error" : ""}`}
          style={{ "--stick-columns": slots.length }}
          aria-label={`Рабочая зона ${displayWorkCount}, ${getRightLabel(task).toLowerCase()} ${sideCount}`}
        >
          {slots.map((slot) => (
            <div
              key={slot.id}
              className={[
                "operation-stick__slot",
                `operation-stick__slot--${slot.zone}`,
                slot.occupied ? "operation-stick__slot--occupied" : "",
              ].filter(Boolean).join(" ")}
            >
              {slot.occupied && (
                <button
                  type="button"
                  className={`operation-stick__bead operation-stick__bead--${getStickBeadColor(task, slot.beadIndex)}`}
                  onPointerDown={(e) => startDrag(e, slot)}
                  disabled={disabled || isStickComplete(task, workCount)}
                  aria-label={`Фишка ${slot.zone === "work" ? "в рабочей зоне" : "в правой зоне"} ${slot.zoneIndex + 1}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OperationExpression({ task, missingSign = false, missingResult = false, answered = false }) {
  const popCls = answered
    ? `operation-expression__result--pop${task.operation === "subtract" ? "-sub" : ""}`
    : "";
  return (
    <div className="operation-expression" aria-label="пример">
      <span className="operation-expression__number">{task.start}</span>
      <span className={`operation-expression__sign operation-expression__sign--${task.operation}`}>
        {missingSign ? "?" : task.sign}
      </span>
      <span className="operation-expression__number">{task.delta}</span>
      <span className="operation-expression__equals">=</span>
      <span
        key={answered ? "ans" : "open"}
        className={["operation-expression__number", "operation-expression__result", popCls].filter(Boolean).join(" ")}
      >
        {missingResult ? "?" : task.result}
      </span>
    </div>
  );
}

function getSignActionLinkPrompt(task) {
  const direction = task.associationDirection === "action_to_sign" ? "action_to_sign" : "sign_to_action";
  const isSignToAction = direction === "sign_to_action";
  const question = isSignToAction ? "Что значит этот знак:" : "Какой знак поставить для:";
  const answer = isSignToAction ? task.action : task.sign;
  const options = isSignToAction ? ACTION_MEANING_OPTIONS : SIGN_OPTIONS;
  const choiceVariant = isSignToAction ? "action-words" : "large-signs";

  return {
    answer,
    choiceVariant,
    options,
    node: (
      <div className={`operation-link-drill operation-link-drill--${task.operation}`}>
        <div className="operation-link-drill__question">{question}</div>
        {isSignToAction ? (
          <div className={`operation-link-drill__symbol operation-link-drill__symbol--${task.operation}`}>
            {task.sign}
          </div>
        ) : (
          <div className={`operation-link-drill__verb operation-link-drill__verb--${task.operation}`}>
            {getActionInfinitive(task)}
          </div>
        )}
      </div>
    ),
  };
}

function ActionCard({ task }) {
  return (
    <div className={`operation-action-card operation-action-card--${task.operation}`}>
      <div className="operation-action-card__verb">{getActionWord(task)}</div>
      <div className="operation-action-card__amount">{task.delta}</div>
    </div>
  );
}

function ChoiceGrid({ options, selected, answer, onAnswer, variant }) {
  return (
    <div className={`operation-choice-grid${variant ? ` operation-choice-grid--${variant}` : ""}`}>
      {options.map((option) => {
        const isSelected = selected === option.value;
        const isCorrect = selected != null && option.value === answer;
        const isWrong = isSelected && option.value !== answer;
        const isSign = option.value === "+" || option.value === "-";
        const className = [
          "operation-choice",
          option.value === "+" ? "operation-choice--add" : "",
          option.value === "-" ? "operation-choice--subtract" : "",
          isCorrect ? "operation-choice--correct" : "",
          isWrong ? "operation-choice--wrong" : "",
        ].filter(Boolean).join(" ");
        return (
          <button
            key={option.value}
            className={className}
            type="button"
            disabled={selected != null}
            onClick={() => onAnswer(option.value)}
          >
            {isSign ? <span className="operation-choice__sign">{option.label}</span> : <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

function NumberChoices({ task, selected, onAnswer }) {
  return (
    <div className="operation-number-grid">
      {task.resultOptions.map((value) => {
        const isSelected = selected === value;
        const isCorrect = selected != null && value === task.result;
        const isWrong = isSelected && value !== task.result;
        return (
          <button
            key={value}
            className={[
              "operation-number-choice",
              isCorrect ? "operation-number-choice--correct" : "",
              isWrong ? "operation-number-choice--wrong" : "",
            ].filter(Boolean).join(" ")}
            type="button"
            disabled={selected != null}
            onClick={() => onAnswer(value)}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}

function ManipulationTask({ task, onCorrect, onMistake }) {
  const [answered, setAnswered] = useState(false);

  function handleAnswer() {
    setAnswered(true);
    onCorrect(task.conceptId, task.cardId);
  }

  const caption = task.operation === "add"
    ? "Да! Плюс — это прибавить!"
    : "Да! Минус — это убрать!";

  return (
    <div className="operation-stage operation-stage--stick">
      <OperationExpression task={task} missingResult={!answered} answered={answered} />
      <div className={`operation-stick-caption operation-stick-caption--${task.operation}${answered ? " show" : ""}`}>
        {caption}
      </div>
      <LiveBeadTool task={task} disabled={answered} onAnswer={handleAnswer} onMistake={onMistake} />
    </div>
  );
}

function OperationTask({ task, onCorrect, onIncorrect, onMistake }) {
  const [selected, setSelected] = useState(null);
  const type = task.type;

  function finish(value, answer) {
    if (selected != null) return;
    setSelected(value);
    if (value === answer) {
      onCorrect(task.conceptId, task.cardId);
    } else {
      onIncorrect(task.conceptId, task.cardId);
    }
  }

  if (type === "operation_do_action") {
    return <ManipulationTask task={task} onCorrect={onCorrect} onMistake={onMistake} />;
  }

  if (type === "operation_name_action") {
    return (
      <div className="operation-stage">
        <OperationStory task={task} />
        <div className="operation-caption">
          Было {task.start}, стало {task.result}. Что сделали?
        </div>
        <ChoiceGrid
          options={ACTION_OPTIONS}
          selected={selected}
          answer={task.action}
          onAnswer={(value) => finish(value, task.action)}
        />
      </div>
    );
  }

  if (type === "operation_more_less") {
    return (
      <div className="operation-stage">
        <OperationStory task={task} />
        <div className="operation-caption">
          Было {task.start}, стало {task.result}. Как изменилось количество?
        </div>
        <ChoiceGrid
          options={DIRECTION_OPTIONS}
          selected={selected}
          answer={getDirectionAnswer(task)}
          onAnswer={(value) => finish(value, getDirectionAnswer(task))}
        />
      </div>
    );
  }

  if (type === "operation_sign_from_action") {
    return (
      <div className="operation-stage">
        <ActionCard task={task} />
        <OperationStory task={task} compact />
        <div className="operation-caption">
          {getActionWord(task)} {task.delta}. Какой знак подходит?
        </div>
        <ChoiceGrid
          options={SIGN_OPTIONS}
          selected={selected}
          answer={task.sign}
          onAnswer={(value) => finish(value, task.sign)}
        />
      </div>
    );
  }

  if (type === "operation_action_from_sign") {
    const prompt = getSignActionLinkPrompt(task);

    return (
      <div className="operation-stage">
        {prompt.node}
        <ChoiceGrid
          options={prompt.options}
          selected={selected}
          answer={prompt.answer}
          variant={prompt.choiceVariant}
          onAnswer={(value) => finish(value, prompt.answer)}
        />
      </div>
    );
  }

  if (type === "operation_build_expression") {
    return (
      <div className="operation-stage">
        <OperationStory task={task} compact />
        <OperationExpression task={task} missingSign />
        <div className="operation-caption">
          Собери пример: какой знак поставить?
        </div>
        <ChoiceGrid
          options={SIGN_OPTIONS}
          selected={selected}
          answer={task.sign}
          onAnswer={(value) => finish(value, task.sign)}
        />
      </div>
    );
  }

  if (type === "operation_missing_sign") {
    return (
      <div className="operation-stage">
        <OperationExpression task={task} missingSign />
        <div className="operation-caption">
          Без подсказки: какой знак подходит?
        </div>
        <ChoiceGrid
          options={SIGN_OPTIONS}
          selected={selected}
          answer={task.sign}
          onAnswer={(value) => finish(value, task.sign)}
        />
      </div>
    );
  }

  return (
    <div className="operation-stage">
      <OperationStory task={task} compact />
      <OperationExpression task={task} missingResult />
      <div className="operation-caption">
        Посчитай, сколько стало.
      </div>
      <NumberChoices
        task={task}
        selected={selected}
        onAnswer={(value) => finish(value, task.result)}
      />
    </div>
  );
}

export default function AdditionSubtractionRenderer({ task, onCorrect, onIncorrect, onMistake }) {
  if (!task) return null;
  return <OperationTask key={`${task.cardId}:${task.start}:${task.delta}:${task.type}:${task.associationDirection ?? ""}`} task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} onMistake={onMistake} />;
}
