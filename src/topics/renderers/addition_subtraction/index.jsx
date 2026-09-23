import { useState, useRef, useEffect, useCallback } from "react";
import { useSpeech } from "@/shared/hooks/useSpeech";
import RewardVideoModal from "@/shared/components/RewardVideoModal";
import HelperPanel from "./HelperPanel";
import NameActionTask from "./NameActionTask";
import {
  buildStickSlots,
  evaluateStickMove,
  getStickBeadCount,
  getStickBeadColor,
  getStickSideCount,
  isStickComplete,
} from "./stickModel";
import { taskAudioItems, audioKeyUrl } from "./audioNumbers";
import { useAudioSequence } from "./useAudioSequence";


const ACTION_OPTIONS_PAST = [
  { value: "add",    label: "Прибавили" },
  { value: "remove", label: "Убрали"    },
];

const SIGN_OPTIONS = [
  { value: "+", label: "+" },
  { value: "-", label: "-" },
];

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
  const actionInfinitive = task.operation === "add" ? "Прибавить" : "Убрать";
  const options = isSignToAction
    ? [
        { value: "add",    label: `Прибавить ${task.delta}` },
        { value: "remove", label: `Убрать ${task.delta}` },
      ]
    : [
        { value: "+", label: `+${task.delta}` },
        { value: "-", label: `-${task.delta}` },
      ];
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
            {task.sign}{task.delta}
          </div>
        ) : (
          <div className={`operation-link-drill__verb operation-link-drill__verb--${task.operation}`}>
            {actionInfinitive} {task.delta}
          </div>
        )}
      </div>
    ),
  };
}

function SignActionTask({ task, onCorrect, onIncorrect, onMistake }) {
  const [phase, setPhase] = useState("choice");
  const [choiceSelected, setChoiceSelected] = useState(null);
  const [helperOpen, setHelperOpen] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const prompt = getSignActionLinkPrompt(task);
  const actionWord = task.operation === "add" ? "Прибавь" : "Убери";

  function handleChoice(value) {
    if (choiceSelected != null) return;
    setChoiceSelected(value);
    if (value === prompt.answer) {
      if (task.showStickPhase) {
        timerRef.current = setTimeout(() => setPhase("stick"), 500);
      } else {
        onCorrect(task.conceptId, task.cardId);
      }
    } else {
      onIncorrect(task.conceptId, task.cardId);
    }
  }

  if (phase === "stick") {
    return (
      <div className="operation-stage operation-stage--stick">
        <div className="operation-stage-stick__main">
          <div className={`operation-stick-caption operation-stick-caption--${task.operation} operation-stick-caption--headline show`}>
            {actionWord} {task.delta}
          </div>
          <LiveBeadTool
            key={`sign-action-stick-${task.cardId}-${task.start}-${task.delta}`}
            task={task}
            initialWorkCount={task.start}
            disabled={false}
            onAnswer={() => onCorrect(task.conceptId, task.cardId)}
            onMistake={onMistake}
          />
        </div>
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
          <HelperPanel
            maxNumber={task.maxNumber}
            showMoveHint={task.showMoveHint}
            onClose={() => setHelperOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="operation-stage">
      {prompt.node}
      <ChoiceGrid
        options={prompt.options}
        selected={choiceSelected}
        answer={prompt.answer}
        variant={prompt.choiceVariant}
        onAnswer={handleChoice}
      />
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
          isSign && option.value === "-" ? "operation-choice--subtract" : "",
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

// "Контрольная работа": the child computes each example on paper (or with
// fingers/counting rod) and enters only the final result here — this screen
// never shows intermediate steps or answer choices. One example is editable
// at a time (activeIdx), in the same reading order the printed groups are
// laid out in, so the flat examples[] index maps directly onto (group, row).
// A wrong entry just shakes and clears — unlimited retries, no penalty — the
// point is protecting against guessing, not grading. Finishing every example
// shows one reward video (self-contained here, not the session-wide streak,
// since this mode's evaluation is "none").
function WorksheetTask({ task, onCorrect, student }) {
  const total = task.examples.length;
  const [activeIdx, setActiveIdx] = useState(0);
  const [solved, setSolved] = useState({});
  const [digits, setDigits] = useState([]);
  const [wrong, setWrong] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const activeRef = useRef(null);
  const wrongTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(wrongTimerRef.current), []);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIdx]);

  const activeEx = task.examples[activeIdx] ?? null;

  function addDigit(d) {
    if (wrong || !activeEx || digits.length >= AUDIO_MAX_DIGITS) return;
    setDigits((prev) => [...prev, d]);
  }

  function removeDigit() {
    if (wrong) return;
    setDigits((prev) => prev.slice(0, -1));
  }

  function checkAnswer() {
    if (wrong || !activeEx || digits.length === 0) return;
    const value = Number(digits.join(""));
    if (value === activeEx.result) {
      setSolved((prev) => ({ ...prev, [activeIdx]: true }));
      setDigits([]);
      if (activeIdx + 1 < total) {
        setActiveIdx(activeIdx + 1);
      } else {
        setTimeout(() => setShowReward(true), 400);
      }
    } else {
      setWrong(true);
      wrongTimerRef.current = setTimeout(() => { setWrong(false); setDigits([]); }, 550);
    }
  }

  const handleRewardDismiss = useCallback(() => {
    setShowReward(false);
    onCorrect?.(task.conceptId, task.cardId);
  }, [onCorrect, task.conceptId, task.cardId]);

  return (
    <div className="operation-stage operation-stage--worksheet">
      <div className="operation-worksheet">
        {task.examples.map((ex, flatIdx) => {
          const isActive = flatIdx === activeIdx;
          const isSolved = !!solved[flatIdx];
          const groupIndex = Math.floor(flatIdx / task.perGroup);
          const isGroupStart = flatIdx % task.perGroup === 0;
          return (
            <div key={flatIdx} className="operation-worksheet__row">
              {isGroupStart && (
                <div className="operation-worksheet__divider">
                  <span className="operation-worksheet__divider-badge">{groupIndex + 1}</span>
                  <span className="operation-worksheet__divider-label">Группа {groupIndex + 1}</span>
                </div>
              )}
              <div
                ref={isActive ? activeRef : null}
                className={[
                  "operation-worksheet__line",
                  isSolved ? "operation-worksheet__line--solved" : "",
                  isActive ? "operation-worksheet__line--active" : "",
                ].filter(Boolean).join(" ")}
              >
                <span className="operation-worksheet__num">{ex.A}</span>
                <span className={`operation-worksheet__sign operation-worksheet__sign--${ex.opAB}`}>{ex.signAB}</span>
                <span className="operation-worksheet__num">{ex.B}</span>
                <span className={`operation-worksheet__sign operation-worksheet__sign--${ex.opBC}`}>{ex.signBC}</span>
                <span className="operation-worksheet__num">{ex.C}</span>
                <span className="operation-worksheet__equals">=</span>
                <span
                  className={[
                    "operation-worksheet__answer",
                    isSolved ? "operation-worksheet__answer--correct" : "",
                    isActive ? "operation-worksheet__answer--active" : "",
                    isActive && wrong ? "operation-worksheet__answer--wrong" : "",
                  ].filter(Boolean).join(" ")}
                >
                  {isSolved
                    ? ex.result
                    : isActive
                      ? (digits.length
                          ? digits.join("")
                          : <span className="operation-worksheet__answer-placeholder">?</span>)
                      : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {!showReward && activeEx && (
        <AudioAnswerPad
          digits={digits}
          disabled={wrong}
          onDigit={addDigit}
          onBackspace={removeDigit}
          onCheck={checkAnswer}
        />
      )}

      {showReward && (
        <RewardVideoModal
          rewardVideos={student?.rewardVideos ?? []}
          studentId={student?.id}
          onDismiss={handleRewardDismiss}
        />
      )}
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

function ManualSessionTask({ task, onCorrect, onIncorrect, streakCount = 0 }) {
  return (
    <div className="operation-stage operation-stage--manual">
      <div className="operation-manual__stars">
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={`operation-manual__star${i < streakCount ? " operation-manual__star--lit" : ""}`}
          >★</span>
        ))}
      </div>
      <div className="operation-manual__btns">
        <button
          type="button"
          className="operation-manual__btn operation-manual__btn--wrong"
          onClick={() => onIncorrect(task.conceptId, task.cardId)}
          aria-label="Неверно"
        >✗</button>
        <button
          type="button"
          className="operation-manual__btn operation-manual__btn--correct"
          onClick={() => onCorrect(task.conceptId, task.cardId)}
          aria-label="Верно"
        >✓</button>
      </div>
    </div>
  );
}

function ObserveQuantityRail({ task, phase }) {
  const isBefore = phase === "before";
  const isChanging = phase === "changing";
  const changedIndex = task.operation === "add" ? task.result - 1 : task.start - 1;
  const shownCount = isBefore ? task.start : task.result;
  const shape = ["circle", "square", "triangle"].includes(task.shape) ? task.shape : "circle";

  return (
    <div className="observe-change__quantity" aria-label={`Количество: ${shownCount}`}>
      {task.showNumerals && <strong className="observe-change__numeral">{shownCount}</strong>}
      <div className="observe-change__rail" style={{ "--observe-slots": task.maxNumber }} aria-hidden="true">
        {Array.from({ length: task.maxNumber }, (_, index) => {
          const isChangedDot = index === changedIndex;
          const isPresent = task.operation === "subtract"
            ? (phase === "after" || phase === "question" ? index < task.result : index < task.start)
            : index < (isBefore ? task.start : task.result);
          const animation = isChanging && isChangedDot
            ? task.operation === "add" ? " observe-change__dot--enter" : " observe-change__dot--leave"
            : "";

          return (
            <div key={index} className="observe-change__slot">
              {isPresent && <span className={`observe-change__dot observe-change__dot--${shape}${animation}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ObserveChangeTask({ task, onCorrect, onIncorrect, playFeedback, soundEnabled }) {
  const [phase, setPhase] = useState("before");
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const timersRef = useRef([]);
  const { speak, cancel } = useSpeech();

  const clearSequence = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const schedule = useCallback((callback, delay) => {
    const timer = setTimeout(callback, delay);
    timersRef.current.push(timer);
    return timer;
  }, []);

  const say = useCallback((text) => {
    if (soundEnabled) speak(text, { rate: 0.82 });
  }, [soundEnabled, speak]);

  const startSequence = useCallback(() => {
    clearSequence();
    cancel();
    setPhase("before");
    setSelected(null);
    setFeedback(null);

    // The child hears the starting quantity, then sees one event at a time:
    // the initial set, a single change, then the stable result and only after
    // that the two sign choices. The action itself remains unnamed so the
    // child still has to decide whether the quantity grew or shrank.
    schedule(() => say(`Было ${task.start}.`), 80);
    schedule(() => setPhase("changing"), 2000);
    schedule(() => setPhase("after"), 3200);
    schedule(() => {
      setPhase("question");
      say("Стало больше или меньше?");
    }, 5000);
  }, [cancel, clearSequence, say, schedule, task.start]);

  useEffect(() => {
    const startTimer = schedule(startSequence, 0);
    return () => {
      clearTimeout(startTimer);
      clearSequence();
      cancel();
    };
  }, [cancel, clearSequence, schedule, startSequence]);

  function replay() {
    startSequence();
  }

  function handleAnswer(value) {
    if (phase !== "question" || selected != null || feedback != null) return;

    if (value === task.answer) {
      setSelected(value);
      setFeedback("correct");
      playFeedback?.("correct");
      say(value === "more" ? "Правильно. Стало больше." : "Правильно. Стало меньше.");
      schedule(() => onCorrect(task.conceptId, task.cardId), 750);
      return;
    }

    // Stay on this wrong tap instead of auto-replaying: the child taps ↻
    // (pulsing below) when ready, rather than being swept into a replay
    // they didn't ask for.
    setSelected(value);
    setFeedback("retry");
    playFeedback?.("incorrect");
    say("Неправильно. Посмотри ещё раз.");
    onIncorrect(task.conceptId, task.cardId);
  }

  return (
    <div className="operation-stage operation-stage--observe">
      <div className="observe-change">
        <ObserveQuantityRail task={task} phase={phase} />
        <div className="observe-change__controls" aria-label="Повтор задания">
          <button
            type="button"
            className={`observe-change__repeat${feedback === "retry" ? " observe-change__repeat--attention" : ""}`}
            onClick={replay}
            aria-label="Показать ещё раз"
          >
            ↻
          </button>
        </div>
        <div
          className={`observe-change__answer-area${phase === "question" ? " observe-change__answer-area--visible" : ""}`}
          aria-hidden={phase !== "question"}
        >
          <div className="observe-change__answers">
            <button
              type="button"
              className={[
                "observe-change__answer",
                "observe-change__answer--more",
                feedback === "correct" && task.answer === "more" ? "observe-change__answer--correct" : "",
                feedback === "retry" && selected === "more" ? "observe-change__answer--wrong" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => handleAnswer("more")}
              disabled={selected != null || feedback === "retry"}
              aria-label="Стало больше"
            >
              <svg className="observe-change__answer-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5 L20 18 L4 18 Z" />
              </svg>
              <span>Больше</span>
            </button>
            <button
              type="button"
              className={[
                "observe-change__answer",
                "observe-change__answer--less",
                feedback === "correct" && task.answer === "less" ? "observe-change__answer--correct" : "",
                feedback === "retry" && selected === "less" ? "observe-change__answer--wrong" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => handleAnswer("less")}
              disabled={selected != null || feedback === "retry"}
              aria-label="Стало меньше"
            >
              <svg className="observe-change__answer-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 19 L4 6 L20 6 Z" />
              </svg>
              <span>Меньше</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FindSignTask({ task, onCorrect, onIncorrect }) {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState(null);
  const [step1Label, setStep1Label] = useState(null);
  const [helperOpen, setHelperOpen] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function handleStep1(value) {
    if (selected != null) return;
    setSelected(value);
    if (value === task.action) {
      const label = ACTION_OPTIONS_PAST.find((o) => o.value === value)?.label;
      timerRef.current = setTimeout(() => { setStep1Label(label); setStep(2); setSelected(null); }, 500);
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
      {step === 2 && step1Label && (
        <div className="operation-find-sign__step1-badge">
          {step1Label} <span className="operation-find-sign__step1-check">✓</span>
        </div>
      )}
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
        <HelperPanel maxNumber={task.maxNumber} showMoveHint={task.showMoveHint} onClose={() => setHelperOpen(false)} />
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
        <HelperPanel maxNumber={task.maxNumber} showMoveHint={task.showMoveHint} onClose={() => setHelperOpen(false)} />
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
        <HelperPanel maxNumber={task.maxNumber} showMoveHint={task.showMoveHint} onClose={() => setHelperOpen(false)} />
      )}
    </div>
  );
}

function MissingTermExpression({ task, answered }) {
  const answeredCls = answered
    ? `operation-expression__unknown--answered${task.operation === "subtract" ? "-sub" : ""}`
    : "";

  function renderSlot(value, key) {
    if (value !== null) {
      return <span key={key} className="operation-expression__number">{value}</span>;
    }
    const symbolCls = task.unknownSymbol === "x" ? "operation-expression__unknown--x" : "";
    return (
      <span
        key={key}
        className={["operation-expression__unknown", symbolCls, answeredCls].filter(Boolean).join(" ")}
      >
        {answered ? task.answer : (task.unknownSymbol === "x" ? "X" : "?")}
      </span>
    );
  }

  return (
    <div className="operation-expression" aria-label="пример">
      {renderSlot(task.A, "left")}
      <span className={`operation-expression__sign operation-expression__sign--${task.operation}`}>{task.sign}</span>
      {renderSlot(task.B, "right")}
      <span className="operation-expression__equals">=</span>
      <span className="operation-expression__number">{task.C}</span>
    </div>
  );
}

function MissingTermTask({ task, onCorrect, onIncorrect }) {
  const [selected, setSelected] = useState(null);
  const [digits, setDigits] = useState([]);
  const [helperOpen, setHelperOpen] = useState(false);
  const answered = selected != null;
  const maxDigits = Math.max(1, String(task.maxNumber).length);

  const handleAnswer = useCallback((value) => {
    if (answered) return;
    setSelected(value);
    if (value === task.answer) {
      onCorrect(task.conceptId, task.cardId);
    } else {
      onIncorrect(task.conceptId, task.cardId);
    }
  }, [answered, task, onCorrect, onIncorrect]);

  function addDigit(d) {
    if (answered || digits.length >= maxDigits) return;
    setDigits((prev) => [...prev, d]);
  }

  function removeDigit() {
    if (answered) return;
    setDigits((prev) => prev.slice(0, -1));
  }

  function checkDigits() {
    if (answered || digits.length === 0) return;
    handleAnswer(Number(digits.join("")));
  }

  const isWrong = answered && selected !== task.answer;
  const isCorrect = selected === task.answer;
  const placeholder = task.unknownSymbol === "x" ? "X" : "?";
  const fieldValue = answered ? String(selected) : digits.join("");

  return (
    <div className="operation-stage operation-stage--missing-term">
      <MissingTermExpression task={task} answered={isCorrect} />
      {task.inputMode === "pad" ? (
        <div className="operation-missing-term-pad">
          <div
            className={[
              "operation-audio-answer",
              isWrong ? "operation-audio-answer--wrong" : "",
              isCorrect ? "operation-audio-answer--correct" : "",
            ].filter(Boolean).join(" ")}
          >
            {fieldValue || placeholder}
          </div>
          <AudioAnswerPad
            digits={digits}
            disabled={answered}
            maxDigits={maxDigits}
            onDigit={addDigit}
            onBackspace={removeDigit}
            onCheck={checkDigits}
          />
        </div>
      ) : (
        <NumberChoices
          task={{ result: task.answer, resultOptions: task.resultOptions }}
          selected={selected}
          onAnswer={handleAnswer}
        />
      )}
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
        <HelperPanel
          maxNumber={task.maxNumber}
          onClose={() => setHelperOpen(false)}
        />
      )}
    </div>
  );
}

const AUDIO_MAX_DIGITS = 3;

function AudioAnswerPad({ digits, disabled, onDigit, onBackspace, onCheck, maxDigits = AUDIO_MAX_DIGITS }) {
  return (
    <div className="operation-audio-keypad">
      <div className="operation-audio-keypad__grid">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => (
          <button
            key={d}
            type="button"
            className="operation-audio-key"
            disabled={disabled || digits.length >= maxDigits}
            onClick={() => onDigit(d)}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="operation-audio-keypad__controls">
        <button
          type="button"
          className="operation-audio-key operation-audio-key--action"
          disabled={disabled || digits.length === 0}
          onClick={onBackspace}
          aria-label="Стереть"
        >
          ⌫
        </button>
        <button
          type="button"
          className="operation-audio-key operation-audio-key--check"
          disabled={disabled || digits.length === 0}
          onClick={onCheck}
          aria-label="Проверить"
        >
          ✓
        </button>
      </div>
    </div>
  );
}

function AudioOperationTask({ task, onCorrect, onIncorrect }) {
  const [digits, setDigits] = useState([]);
  const [wrong, setWrong] = useState(false);
  const [answered, setAnswered] = useState(false);
  const { isPlaying, play } = useAudioSequence();
  const wrongTimerRef = useRef(null);

  const playPrompt = useCallback(() => {
    play(taskAudioItems(task).map(({ key, tight }) => ({ url: audioKeyUrl(key), tight })));
  }, [play, task]);

  useEffect(() => {
    playPrompt();
    return () => clearTimeout(wrongTimerRef.current);
  }, [playPrompt]);

  function addDigit(d) {
    if (answered || digits.length >= AUDIO_MAX_DIGITS) return;
    setDigits((prev) => [...prev, d]);
  }

  function removeDigit() {
    if (answered) return;
    setDigits((prev) => prev.slice(0, -1));
  }

  function checkAnswer() {
    if (answered || digits.length === 0) return;
    const value = Number(digits.join(""));
    if (value === task.result) {
      setAnswered(true);
      onCorrect(task.conceptId, task.cardId);
    } else {
      setWrong(true);
      onIncorrect(task.conceptId, task.cardId);
      wrongTimerRef.current = setTimeout(() => { setWrong(false); setDigits([]); }, 550);
    }
  }

  const displayValue = answered ? String(task.result) : digits.join("");

  return (
    <div className="operation-stage operation-stage--audio">
      <div className="operation-audio">
        <div className={`operation-audio-diktor-wrap${isPlaying ? " operation-audio-diktor-wrap--playing" : ""}`}>
          <span className="operation-audio-ripple" />
          <span className="operation-audio-ripple" />
          <span className="operation-audio-ripple" />
          <button
            type="button"
            className={`operation-audio-diktor${isPlaying ? " operation-audio-diktor--playing" : ""}`}
            onClick={playPrompt}
            disabled={isPlaying}
            aria-label="Повторить пример"
          >
            <span className="operation-audio-bar" />
            <span className="operation-audio-bar" />
            <span className="operation-audio-bar" />
            <span className="operation-audio-bar" />
          </button>
        </div>
        <div
          className={[
            "operation-audio-answer",
            wrong ? "operation-audio-answer--wrong" : "",
            answered ? "operation-audio-answer--correct" : "",
          ].filter(Boolean).join(" ")}
        >
          {displayValue || "?"}
        </div>
        {answered && (
          <div className="operation-audio-continue-hint">Нажми, чтобы продолжить</div>
        )}
        {!answered && (
          <AudioAnswerPad
            digits={digits}
            disabled={wrong}
            onDigit={addDigit}
            onBackspace={removeDigit}
            onCheck={checkAnswer}
          />
        )}
      </div>
    </div>
  );
}

function OperationTask({ task, onCorrect, onIncorrect, onMistake, streakCount, playFeedback, soundEnabled, student }) {
  const type = task.type;

  if (type === "operation_worksheet") {
    return <WorksheetTask task={task} onCorrect={onCorrect} student={student} />;
  }
  // Kept for the future specialist-only physical-stick tool. It is no longer
  // part of the child-facing `operation_observe` lesson.
  if (type === "operation_manual_observe") {
    return <ManualSessionTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} streakCount={streakCount} />;
  }
  if (type === "operation_observe") {
    return <ObserveChangeTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} playFeedback={playFeedback} soundEnabled={soundEnabled} />;
  }
  if (type === "operation_do_action") {
    return <ManipulationTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} onMistake={onMistake} />;
  }
  if (type === "operation_name_action") {
    return <NameActionTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} playFeedback={playFeedback} soundEnabled={soundEnabled} />;
  }
  if (type === "operation_action_from_sign") {
    return <SignActionTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} onMistake={onMistake} />;
  }
  if (type === "operation_find_sign") {
    return <FindSignTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
  }
  if (type === "operation_result") {
    return <ResultTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
  }
  if (type === "operation_audio") {
    return <AudioOperationTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
  }
  if (type === "operation_chain") {
    return <ChainTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
  }
  if (type === "operation_missing_term") {
    return <MissingTermTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
  }
  return null;
}

export default function AdditionSubtractionRenderer({ task, onCorrect, onIncorrect, onMistake, streakCount, playFeedback, soundEnabled, student }) {
  if (!task) return null;
  return <OperationTask key={`${task.cardId}:${task.start ?? task.C}:${task.delta ?? task.answer}:${task.type}:${task.missingPosition ?? task.associationDirection ?? ""}`} task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} onMistake={onMistake} streakCount={streakCount} playFeedback={playFeedback} soundEnabled={soundEnabled} student={student} />;
}
