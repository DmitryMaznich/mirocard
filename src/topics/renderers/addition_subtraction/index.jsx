import { useState } from "react";

const LIVE_BEAD_COUNT = 20;
const LIVE_GREEN_COUNT = 10;
const LIVE_GAP_SLOTS = 5;

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

function getActionCommand(task) {
  return task.operation === "add" ? "Прибавь" : "Убери";
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

function LiveBeadTool({ task, onCorrect }) {
  const [workingCount, setWorkingCount] = useState(task.start);
  const [drag, setDrag] = useState(null);
  const visualCount = drag?.previewCount ?? workingCount;
  const done = workingCount === task.result;
  const totalColumns = LIVE_BEAD_COUNT + LIVE_GAP_SLOTS;
  const rightCount = LIVE_BEAD_COUNT - visualCount;

  function startDrag(event, index) {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({
      index,
      startX: event.clientX,
      originCount: workingCount,
      previewCount: null,
    });
  }

  function updateDrag(event) {
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    let previewCount = null;

    if (drag.index >= drag.originCount && dx < -10) {
      previewCount = drag.index + 1;
    } else if (drag.index < drag.originCount && dx > 10) {
      previewCount = drag.index;
    }

    setDrag((current) => current ? { ...current, previewCount } : current);
  }

  function finishDrag() {
    if (drag?.previewCount != null) {
      setWorkingCount(Math.max(0, Math.min(LIVE_BEAD_COUNT, drag.previewCount)));
    }
    setDrag(null);
  }

  function resetRail() {
    setWorkingCount(task.start);
    setDrag(null);
  }

  function getBeadColumn(index) {
    if (index < visualCount) return index + 1;
    return index + LIVE_GAP_SLOTS + 1;
  }

  function isPreviewBead(index) {
    if (!drag || drag.previewCount == null) return false;
    const from = Math.min(drag.originCount, drag.previewCount);
    const to = Math.max(drag.originCount, drag.previewCount);
    return index >= from && index < to;
  }

  return (
    <div className="operation-live-tool">
      <div className="operation-zone-rail__labels operation-live-tool__labels">
        <span>Рабочая зона: {visualCount}</span>
        <span>{getRightLabel(task)}: {rightCount}</span>
      </div>

      <div
        className={`operation-rail operation-live-rail operation-rail--${task.operation}`}
        aria-label={`Живая палка: рабочая зона ${visualCount}, правая зона ${rightCount}`}
        style={{ "--rail-columns": `${totalColumns}` }}
      >
        <div className="operation-rail__line" />
        <div className="operation-rail__track">
          {Array.from({ length: LIVE_BEAD_COUNT }, (_, index) => {
            const inWork = index < visualCount;
            const inPreview = isPreviewBead(index);
            const className = [
              "operation-bead",
              "operation-live-bead",
              index < LIVE_GREEN_COUNT ? "operation-live-bead--green" : "operation-live-bead--orange",
              inWork ? "operation-bead--left" : "operation-bead--right operation-bead--source",
              inPreview ? "operation-bead--moved operation-live-bead--preview" : "",
              drag?.index === index ? "operation-live-bead--dragging" : "",
            ].filter(Boolean).join(" ");

            return (
              <button
                key={index}
                className={className}
                type="button"
                style={{ gridColumn: getBeadColumn(index) }}
                onPointerDown={(event) => startDrag(event, index)}
                onPointerMove={updateDrag}
                onPointerUp={finishDrag}
                onPointerCancel={() => setDrag(null)}
                aria-label={`Фишка ${index + 1}`}
              />
            );
          })}
          <div
            className={`operation-rail__gap operation-rail__gap--${task.operation === "add" ? "left" : "right"}`}
            style={{ gridColumn: `${visualCount + 1} / span ${LIVE_GAP_SLOTS}` }}
            aria-hidden="true"
          >
            {task.operation === "add" ? "←" : "→"}
          </div>
        </div>
      </div>

      <div className="operation-live-tool__hint">
        {task.operation === "add"
          ? "Потяни фишку справа влево: вместе с ней придут все фишки до рабочей зоны."
          : "Потяни фишку слева вправо: вместе с ней уйдут фишки до правой зоны."}
      </div>

      <div className="operation-manipulation-actions">
        <button className="operation-step-btn operation-step-btn--secondary" type="button" disabled={workingCount === task.start} onClick={resetRail}>
          Вернуть
        </button>
        <button className="operation-ready-btn" type="button" disabled={!done} onClick={() => onCorrect(task.conceptId, task.cardId)}>
          Готово: стало {task.result}
        </button>
      </div>
    </div>
  );
}

function OperationExpression({ task, missingSign = false, missingResult = false }) {
  return (
    <div className="operation-expression" aria-label="пример">
      <span className="operation-expression__number">{task.start}</span>
      <span className={`operation-expression__sign operation-expression__sign--${task.operation}`}>
        {missingSign ? "?" : task.sign}
      </span>
      <span className="operation-expression__number">{task.delta}</span>
      <span className="operation-expression__equals">=</span>
      <span className="operation-expression__number operation-expression__result">
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

function ManipulationTask({ task, onCorrect }) {
  return (
    <div className="operation-stage">
      <div className="operation-caption operation-caption--large">
        Было {task.start}. {getActionCommand(task)} {task.delta}.
      </div>
      <LiveBeadTool task={task} onCorrect={onCorrect} />
    </div>
  );
}

function OperationTask({ task, onCorrect, onIncorrect }) {
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
    return <ManipulationTask task={task} onCorrect={onCorrect} />;
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

export default function AdditionSubtractionRenderer({ task, onCorrect, onIncorrect }) {
  if (!task) return null;
  return <OperationTask key={`${task.cardId}:${task.start}:${task.delta}:${task.type}:${task.associationDirection ?? ""}`} task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
}
