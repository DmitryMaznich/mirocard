import { useState, useRef, useEffect, useCallback } from "react";
import HelperPanel from "./HelperPanel";
import {
  buildStickSlots,
  evaluateStickMove,
  getStickBeadCount,
  getStickBeadColor,
  getStickSideCount,
  isStickComplete,
} from "./stickModel";

const ACTION_MEANING_OPTIONS = [
  { value: "add", label: "Прибавить" },
  { value: "remove", label: "Убрать" },
];

const ACTION_OPTIONS_PAST = [
  { value: "add",    label: "Прибавили" },
  { value: "remove", label: "Убрали"    },
];

const SIGN_OPTIONS = [
  { value: "+", label: "+" },
  { value: "-", label: "-" },
];

function getActionInfinitive(task) {
  return task.operation === "add" ? "Прибавить" : "Убрать";
}

function getRightLabel(task) {
  return task.operation === "add" ? "Берём отсюда" : "Сюда убираем";
}

function LiveBeadTool({ task, initialWorkCount = task.start, disabled, onAnswer, onMistake, onMove }) {
  const [workCount, setWorkCount] = useState(initialWorkCount);
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
      onMove?.(result.nextWorkCount);
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

function OperationExpression({ task, missingSign = false, missingResult = false, answered = false, activeParts = [] }) {
  const popCls = answered
    ? `operation-expression__result--pop${task.operation === "subtract" ? "-sub" : ""}`
    : "";
  const isActive = (part) => activeParts.includes(part);
  const partClass = (part, extra = "") => [
    extra,
    isActive(part) ? "operation-expression__part--active" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className="operation-expression" aria-label="пример">
      <span className={partClass("start", "operation-expression__number")}>{task.start}</span>
      <span className={partClass("sign", `operation-expression__sign${missingSign ? " operation-expression__sign--hidden" : ` operation-expression__sign--${task.operation}`}`)}>
        {missingSign ? "?" : task.sign}
      </span>
      <span className={partClass("delta", "operation-expression__number")}>{task.delta}</span>
      <span className="operation-expression__equals">=</span>
      <span
        key={answered ? "ans" : "open"}
        className={partClass("result", ["operation-expression__number", "operation-expression__result", popCls].filter(Boolean).join(" "))}
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

function NumberPad({ maxNumber, answer, selected, onAnswer }) {
  const values = Array.from({ length: maxNumber }, (_, index) => index + 1);
  const answerValues = answer === 0 ? [0, ...values] : values;
  return (
    <div className={`operation-number-grid operation-number-grid--pad operation-number-grid--pad-${maxNumber}${answer === 0 ? " operation-number-grid--pad-has-zero" : ""}`}>
      {answerValues.map((value) => {
        const isSelected = selected === value;
        const isCorrect = selected != null && value === answer;
        const isWrong = isSelected && value !== answer;
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

function WorksheetTask({ task }) {
  const groups = [];
  for (let g = 0; g < task.groupCount; g++) {
    groups.push(task.examples.slice(g * task.perGroup, (g + 1) * task.perGroup));
  }
  return (
    <div className="operation-stage operation-stage--worksheet">
      <div className="operation-worksheet">
        {groups.map((group, gi) => (
          <div key={gi} className="operation-worksheet__group">
            <div className="operation-worksheet__group-label">{gi + 1}</div>
            <div className="operation-worksheet__list">
              {group.map((ex, ei) => (
                <div key={ei} className="operation-worksheet__row">
                  <span className="operation-worksheet__num">{ex.A}</span>
                  <span className={`operation-worksheet__sign operation-worksheet__sign--${ex.opAB}`}>{ex.signAB}</span>
                  <span className="operation-worksheet__num">{ex.B}</span>
                  <span className={`operation-worksheet__sign operation-worksheet__sign--${ex.opBC}`}>{ex.signBC}</span>
                  <span className="operation-worksheet__num">{ex.C}</span>
                  <span className="operation-worksheet__equals">=</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ManipulationTask({ task, onCorrect, onIncorrect, onMistake }) {
  const [phase, setPhase] = useState("setup");
  const [selectedResult, setSelectedResult] = useState(null);
  const beadCount = getStickBeadCount(task);
  const setupTask = { ...task, operation: "add", result: task.start };
  const actionWord = task.operation === "add" ? "Прибавь" : "Убери";
  const isFinalAnswerCorrect = selectedResult === task.result;

  function handleSetupComplete() {
    setPhase("action");
  }

  function handleActionComplete() {
    setPhase("answer");
  }

  function handleResultAnswer(value) {
    if (selectedResult != null) return;
    setSelectedResult(value);
    if (value === task.result) {
      onCorrect(task.conceptId, task.cardId);
    } else {
      onIncorrect(task.conceptId, task.cardId);
    }
  }

  const prompt = phase === "setup"
    ? `Покажи ${task.start} на палке`
    : phase === "action"
      ? `${actionWord} ${task.delta}`
      : "Нажми сколько стало";
  const activeExpressionParts = phase === "setup"
    ? ["start"]
    : phase === "action"
      ? ["sign", "delta"]
      : selectedResult == null
        ? ["result"]
        : [];

  return (
    <div className="operation-stage operation-stage--stick">
      <div className="operation-stage-stick__main">
        <OperationExpression
          task={task}
          missingResult={!isFinalAnswerCorrect}
          answered={isFinalAnswerCorrect}
          activeParts={activeExpressionParts}
        />
        {task.showInstruction !== false && (
          <div className={`operation-stick-caption operation-stick-caption--${task.operation} show`}>
            {prompt}
          </div>
        )}
        {phase === "setup" && (
          <LiveBeadTool
            key={`setup-${task.cardId}-${task.start}-${task.delta}`}
            task={setupTask}
            initialWorkCount={0}
            disabled={false}
            onAnswer={handleSetupComplete}
            onMistake={onMistake}
          />
        )}
        {phase === "action" && (
          <LiveBeadTool
            key={`action-${task.cardId}-${task.start}-${task.delta}`}
            task={task}
            initialWorkCount={task.start}
            disabled={false}
            onAnswer={handleActionComplete}
            onMistake={onMistake}
          />
        )}
        {phase === "answer" && (
          <LiveBeadTool
            key={`answer-${task.cardId}-${task.start}-${task.delta}`}
            task={task}
            initialWorkCount={task.result}
            disabled
            onAnswer={() => {}}
            onMistake={onMistake}
          />
        )}
      </div>
      {phase === "answer" && (
        <NumberPad
          maxNumber={beadCount}
          answer={task.result}
          selected={selectedResult}
          onAnswer={handleResultAnswer}
        />
      )}
    </div>
  );
}

function PlaceholderTask() {
  return (
    <div className="operation-stage operation-stage--placeholder">
      <div className="operation-placeholder-text">Скоро</div>
    </div>
  );
}

function FindSignTask({ task, onCorrect, onIncorrect }) {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState(null);
  const [helperOpen, setHelperOpen] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function handleStep1(value) {
    if (selected != null) return;
    setSelected(value);
    if (value === task.action) {
      timerRef.current = setTimeout(() => { setStep(2); setSelected(null); }, 500);
    } else {
      onIncorrect(task.conceptId, task.cardId);
      timerRef.current = setTimeout(() => setSelected(null), 700);
    }
  }

  function handleStep2(value) {
    if (selected != null) return;
    setSelected(value);
    if (value === task.sign) {
      onCorrect(task.conceptId, task.cardId);
    } else {
      onIncorrect(task.conceptId, task.cardId);
      timerRef.current = setTimeout(() => setSelected(null), 700);
    }
  }

  return (
    <div className="operation-stage operation-stage--find-sign">
      <OperationExpression task={task} missingSign answered={step === 2 && selected === task.sign} />
      <div className="operation-link-drill__question">
        {step === 1 ? "Что мы сделали?" : "Какой знак нужно поставить?"}
      </div>
      <ChoiceGrid
        key={step}
        options={step === 1 ? ACTION_OPTIONS_PAST : SIGN_OPTIONS}
        selected={selected}
        answer={step === 1 ? task.action : task.sign}
        variant={step === 1 ? "action-words" : "large-signs"}
        onAnswer={step === 1 ? handleStep1 : handleStep2}
      />
      {task.showHelper && !helperOpen && (
        <button
          type="button"
          className="helper-toggle-btn"
          onClick={() => setHelperOpen(true)}
          aria-label="Открыть помощник"
        >
          🧮
        </button>
      )}
      {helperOpen && (
        <HelperPanel maxNumber={task.maxNumber} onClose={() => setHelperOpen(false)} />
      )}
    </div>
  );
}

function TimerBar({ seconds, onExpire }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) { onExpire(); return; }
    const id = setTimeout(() => setRemaining((prev) => prev - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining, onExpire]);

  const pct = Math.max(0, (remaining / seconds) * 100);
  return (
    <div className="operation-timer" role="timer" aria-label={`${remaining} секунд`}>
      <div className="operation-timer__bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

function ResultTask({ task, onCorrect, onIncorrect }) {
  const [selected, setSelected] = useState(null);
  const [helperOpen, setHelperOpen] = useState(false);
  const answered = selected != null;

  const handleAnswer = useCallback((value) => {
    if (answered) return;
    setSelected(value);
    if (value === task.result) {
      onCorrect(task.conceptId, task.cardId);
    } else {
      onIncorrect(task.conceptId, task.cardId);
    }
  }, [answered, task, onCorrect, onIncorrect]);

  return (
    <div className="operation-stage operation-stage--result">
      <OperationExpression
        task={task}
        missingResult={selected !== task.result}
        answered={selected === task.result}
      />
      {task.inputMode === "pad" ? (
        <NumberPad
          maxNumber={task.maxNumber}
          answer={task.result}
          selected={selected}
          onAnswer={handleAnswer}
        />
      ) : (
        <NumberChoices
          task={task}
          selected={selected}
          onAnswer={handleAnswer}
        />
      )}
      {task.timer > 0 && !answered && (
        <TimerBar seconds={task.timer} onExpire={() => handleAnswer(-1)} />
      )}
      {task.showHelper && (
        <button
          type="button"
          className="helper-toggle-btn"
          onClick={() => setHelperOpen(true)}
          aria-label="Открыть помощник"
        >
          🧮
        </button>
      )}
      {helperOpen && (
        <HelperPanel maxNumber={task.maxNumber} onClose={() => setHelperOpen(false)} />
      )}
    </div>
  );
}

function ChainTask({ task, onCorrect, onIncorrect }) {
  const [selected, setSelected] = useState(null);
  const [helperOpen, setHelperOpen] = useState(false);
  const answered = selected != null;

  const handleAnswer = useCallback((value) => {
    if (answered) return;
    setSelected(value);
    if (value === task.result) {
      onCorrect(task.conceptId, task.cardId);
    } else {
      onIncorrect(task.conceptId, task.cardId);
    }
  }, [answered, task, onCorrect, onIncorrect]);

  return (
    <div className="operation-stage operation-stage--chain">
      <div className="chain-expression" aria-label="пример">
        <span className="chain-expression__num">{task.A}</span>
        <span className={`chain-expression__sign chain-expression__sign--${task.opAB}`}>{task.signAB}</span>
        <span className="chain-expression__num">{task.B}</span>
        <span className={`chain-expression__sign chain-expression__sign--${task.opBC}`}>{task.signBC}</span>
        <span className="chain-expression__num">{task.C}</span>
        <span className="chain-expression__equals">=</span>
        <span className={["chain-expression__num", "chain-expression__result", answered && selected === task.result ? "chain-expression__result--pop" : ""].filter(Boolean).join(" ")}>
          {selected === task.result ? task.result : "?"}
        </span>
      </div>
      <div className="chain-caption">Посчитай пример</div>
      {task.inputMode === "pad" ? (
        <NumberPad
          maxNumber={task.maxNumber}
          answer={task.result}
          selected={selected}
          onAnswer={handleAnswer}
        />
      ) : (
        <NumberChoices
          task={task}
          selected={selected}
          onAnswer={handleAnswer}
        />
      )}
      {task.timer > 0 && !answered && (
        <TimerBar seconds={task.timer} onExpire={() => handleAnswer(-1)} />
      )}
      {task.showHelper && (
        <button
          type="button"
          className="helper-toggle-btn"
          onClick={() => setHelperOpen(true)}
          aria-label="Открыть помощник"
        >
          🧮
        </button>
      )}
      {helperOpen && (
        <HelperPanel maxNumber={task.maxNumber} onClose={() => setHelperOpen(false)} />
      )}
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

  if (type === "operation_worksheet") {
    return <WorksheetTask task={task} />;
  }

  if (type === "operation_observe") {
    return <PlaceholderTask />;
  }

  if (type === "operation_do_action") {
    return <ManipulationTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} onMistake={onMistake} />;
  }

  if (type === "operation_name_action") {
    return <PlaceholderTask />;
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

  if (type === "operation_find_sign") {
    return <FindSignTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
  }

  if (type === "operation_result") {
    return <ResultTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
  }

  if (type === "operation_chain") {
    return <ChainTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
  }

  return null;
}

export default function AdditionSubtractionRenderer({ task, onCorrect, onIncorrect, onMistake }) {
  if (!task) return null;
  return <OperationTask key={`${task.cardId}:${task.start}:${task.delta}:${task.type}:${task.associationDirection ?? ""}`} task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} onMistake={onMistake} />;
}
