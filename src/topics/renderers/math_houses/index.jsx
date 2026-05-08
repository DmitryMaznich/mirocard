import { useEffect, useMemo, useState } from "react";

function HouseTask({ task, onCorrect, onMistake }) {
  const hiddenCells = useMemo(
    () => task.hiddenCells ?? [{
      key: `${task.hiddenPairIndex}:${task.hiddenSide}`,
      pairIndex: task.hiddenPairIndex,
      side: task.hiddenSide,
      answer: task.answer,
      knownValue: task.knownValue,
    }],
    [task.answer, task.hiddenCells, task.hiddenPairIndex, task.hiddenSide, task.knownValue]
  );
  const [answers, setAnswers] = useState({});
  const [activeCellKey, setActiveCellKey] = useState(hiddenCells[0]?.key ?? null);
  const [wrongCellKey, setWrongCellKey] = useState(null);
  const options = Array.from({ length: task.number + 1 }, (_, i) => i);
  const hiddenCellByKey = useMemo(
    () => Object.fromEntries(hiddenCells.map((cell) => [cell.key, cell])),
    [hiddenCells]
  );

  function selectNextCell(nextAnswers) {
    const nextCell = hiddenCells.find((cell) => nextAnswers[cell.key] == null);
    setActiveCellKey(nextCell?.key ?? null);
  }

  function handleOption(value) {
    if (!activeCellKey) return;

    const activeCell = hiddenCellByKey[activeCellKey];
    if (!activeCell) return;

    if (value !== activeCell.answer) {
      setWrongCellKey(activeCellKey);
      onMistake?.(task.conceptId, null);
      window.setTimeout(() => setWrongCellKey(null), 420);
      return;
    }

    const nextAnswers = { ...answers, [activeCellKey]: value };
    setAnswers(nextAnswers);
    setWrongCellKey(null);

    if (hiddenCells.every((cell) => nextAnswers[cell.key] != null)) {
      setActiveCellKey(null);
      window.setTimeout(() => onCorrect(task.conceptId, null), 260);
      return;
    }

    selectNextCell(nextAnswers);
  }

  return (
    <div className="house-body">
      <div className="house-roof">
        <div className="house-number">{task.number}</div>
      </div>
      <div className="house-rooms">
        {task.pairs.map(([left, right], idx) => (
          <div key={idx} className="house-row">
            {(() => {
              const key = `${idx}:left`;
              const isHidden = Boolean(hiddenCellByKey[key]);
              const isActive = activeCellKey === key;
              const isWrong = wrongCellKey === key;
              const value = answers[key];
              if (!isHidden) return <div className="house-cell">{left}</div>;
              return (
                <button
                  className={`house-cell house-cell--hidden${isActive ? " house-cell--active" : ""}${isWrong ? " house-cell--wrong" : ""}${value != null ? " house-cell--correct" : ""}`}
                  onClick={() => setActiveCellKey(key)}
                >
                  {value ?? "?"}
                </button>
              );
            })()}
            <div className="house-divider" />
            {(() => {
              const key = `${idx}:right`;
              const isHidden = Boolean(hiddenCellByKey[key]);
              const isActive = activeCellKey === key;
              const isWrong = wrongCellKey === key;
              const value = answers[key];
              if (!isHidden) return <div className="house-cell">{right}</div>;
              return (
                <button
                  className={`house-cell house-cell--hidden${isActive ? " house-cell--active" : ""}${isWrong ? " house-cell--wrong" : ""}${value != null ? " house-cell--correct" : ""}`}
                  onClick={() => setActiveCellKey(key)}
                >
                  {value ?? "?"}
                </button>
              );
            })()}
          </div>
        ))}
      </div>
      {activeCellKey && (
        <div className="house-options">
          {options.map((n) => (
            <button key={n} className="house-option-btn" onClick={() => handleOption(n)}>
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getPair(pair) {
  return Array.isArray(pair)
    ? { left: pair[0], right: pair[1] }
    : { left: pair.left, right: pair.right };
}

function findNextHouseFloor(pairs, nextAnswers, currentFloorIndex, phase) {
  if (phase === "fill") {
    for (let index = currentFloorIndex + 1; index < pairs.length; index += 1) {
      if (!nextAnswers[index]) return index;
    }
    return -1;
  }

  for (let index = currentFloorIndex + 1; index < pairs.length; index += 1) {
    if (nextAnswers[index] && !nextAnswers[index].correct) return index;
  }

  for (let index = 0; index < currentFloorIndex; index += 1) {
    if (nextAnswers[index] && !nextAnswers[index].correct) return index;
  }

  return -1;
}

function HouseLegacy({ task, onCorrect, onMistake }) {
  const isRead = task.type === "math_houses_read";
  const isFill = task.type === "math_houses";
  const isRecall = task.type === "math_houses_recall";
  const pairs = task.pairs.map(getPair);
  const total = task.total ?? task.number;

  const [houseAnswers, setHouseAnswers] = useState(() => Array.from({ length: pairs.length }, () => null));
  const [housePhase, setHousePhase] = useState("fill");
  const [activeFloor, setActiveFloor] = useState(0);
  const [houseBlocked, setHouseBlocked] = useState(false);
  const [readInputStep, setReadInputStep] = useState(0);
  const [readInputValues, setReadInputValues] = useState([null, null, null, null, null]);
  const [recallStep, setRecallStep] = useState(0);
  const [recallLeft, setRecallLeft] = useState(null);

  useEffect(() => {
    setHouseAnswers(Array.from({ length: pairs.length }, () => null));
    setHousePhase("fill");
    setActiveFloor(0);
    setHouseBlocked(false);
    setReadInputStep(0);
    setReadInputValues([null, null, null, null, null]);
    setRecallStep(0);
    setRecallLeft(null);
  }, [task.cardId, task.type, pairs.length]);

  useEffect(() => {
    if (!isRead) return;
    setReadInputStep(0);
    setReadInputValues([null, null, null, null, null]);
  }, [activeFloor, isRead]);

  useEffect(() => {
    if (!isRecall) return;
    setRecallStep(0);
    setRecallLeft(null);
  }, [activeFloor, isRecall]);

  function finishTask() {
    setHouseBlocked(true);
    window.setTimeout(() => onCorrect(task.conceptId, task.cardId), 260);
  }

  function recordMistake() {
    onMistake?.(task.conceptId, task.cardId);
  }

  function advanceReadHouse(nextAnswers) {
    const nextFloor = activeFloor + 1;
    if (nextFloor >= pairs.length) {
      finishTask();
      return;
    }
    setHouseAnswers(nextAnswers);
    setActiveFloor(nextFloor);
    setHouseBlocked(false);
  }

  function handleFillNumber(value) {
    if (houseBlocked) return;

    const correct = pairs[activeFloor]?.right;
    const isCorrect = value === correct;
    const nextAnswers = [...houseAnswers];
    nextAnswers[activeFloor] = { value, correct: isCorrect };
    setHouseAnswers(nextAnswers);
    setHouseBlocked(true);

    if (!isCorrect) recordMistake();

    window.setTimeout(() => {
      const nextFloor = findNextHouseFloor(pairs, nextAnswers, activeFloor, housePhase);

      if (nextFloor === -1) {
        if (nextAnswers.every((item) => item?.correct)) {
          finishTask();
          return;
        }

        const firstWrongIndex = nextAnswers.findIndex((item) => item && !item.correct);
        setHousePhase("fix");
        setActiveFloor(firstWrongIndex >= 0 ? firstWrongIndex : 0);
        setHouseBlocked(false);
        return;
      }

      setActiveFloor(nextFloor);
      setHouseBlocked(false);
    }, isCorrect ? 380 : 650);
  }

  function handleReadInput(value) {
    if (houseBlocked) return;

    const expectsOperator = readInputStep === 1 || readInputStep === 3;
    const isOperatorValue = value === "+" || value === "=";

    if ((!expectsOperator && isOperatorValue) || (expectsOperator && !isOperatorValue)) return;
    if ((readInputStep === 1 && value !== "+") || (readInputStep === 3 && value !== "=")) return;

    const nextValues = [...readInputValues];
    nextValues[readInputStep] = value;
    setReadInputValues(nextValues);

    if (readInputStep < 4) {
      setReadInputStep((step) => step + 1);
      return;
    }

    const pair = pairs[activeFloor];
    const isCorrect =
      nextValues[0] === pair.left &&
      nextValues[1] === "+" &&
      nextValues[2] === pair.right &&
      nextValues[3] === "=" &&
      nextValues[4] === total;
    const nextAnswers = [...houseAnswers];
    nextAnswers[activeFloor] = { values: nextValues, correct: isCorrect };
    setHouseAnswers(nextAnswers);
    setHouseBlocked(true);

    if (!isCorrect) recordMistake();

    window.setTimeout(() => {
      if (!isCorrect) {
        const resetAnswers = [...nextAnswers];
        resetAnswers[activeFloor] = null;
        setHouseAnswers(resetAnswers);
        setReadInputStep(0);
        setReadInputValues([null, null, null, null, null]);
        setHouseBlocked(false);
        return;
      }

      setReadInputStep(0);
      setReadInputValues([null, null, null, null, null]);
      advanceReadHouse(nextAnswers);
    }, isCorrect ? 380 : 650);
  }

  function handleRecallNumber(value) {
    if (houseBlocked) return;

    if (recallStep === 0) {
      setRecallLeft(value);
      setRecallStep(1);
      return;
    }

    const leftValue = recallLeft ?? 0;
    const rightValue = value;
    const isCorrect =
      leftValue + rightValue === total &&
      !houseAnswers.some((answer) => answer?.correct && answer.left === leftValue && answer.right === rightValue);
    const nextAnswers = [...houseAnswers];
    nextAnswers[activeFloor] = {
      left: leftValue,
      right: rightValue,
      correct: isCorrect,
    };
    setHouseAnswers(nextAnswers);
    setHouseBlocked(true);

    if (!isCorrect) recordMistake();

    window.setTimeout(() => {
      if (!isCorrect) {
        const resetAnswers = [...nextAnswers];
        resetAnswers[activeFloor] = null;
        setHouseAnswers(resetAnswers);
        setRecallStep(0);
        setRecallLeft(null);
        setHouseBlocked(false);
        return;
      }

      const nextFloor = findNextHouseFloor(pairs, nextAnswers, activeFloor, housePhase);
      if (nextFloor === -1) {
        if (nextAnswers.every((item) => item?.correct)) {
          setRecallStep(0);
          setRecallLeft(null);
          finishTask();
          return;
        }

        const firstWrongIndex = nextAnswers.findIndex((item) => item && !item.correct);
        setHousePhase("fix");
        setActiveFloor(firstWrongIndex >= 0 ? firstWrongIndex : 0);
      } else {
        setActiveFloor(nextFloor);
      }

      setRecallStep(0);
      setRecallLeft(null);
      setHouseBlocked(false);
    }, isCorrect ? 380 : 650);
  }

  const activePair = pairs[activeFloor] || pairs[0];
  const phaseLabel = isRead ? "" : housePhase === "fix" ? "↑ Исправь ошибки" : "";
  const hintText = isRead || isRecall ? "" : `${activePair.left} + ? = ${total}`;
  const readPadValues = [...Array.from({ length: total + 1 }, (_, value) => value), "+", "="];
  const padValues = isRead ? readPadValues : Array.from({ length: total + 1 }, (_, value) => value);

  return (
    <div
      className="math-house-stage"
      style={{
        "--house-color": task.color || "#2d6fb5",
        "--num-floors": pairs.length,
        "--numpad-columns": Math.ceil(padValues.length / 2),
      }}
    >
      <div className="math-house-wrap">
        <svg className="math-house-roof-svg" viewBox="0 0 220 92" aria-hidden="true">
          <polygon points="33,0 187,0 220,92 0,92" fill="#2d6fb5" />
          <circle cx="110" cy="46" r="29" fill="#fbbf24" stroke="white" strokeWidth="3" />
          <text x="110" y="47" textAnchor="middle" dominantBaseline="middle" fontSize="28" fontWeight="900" fill="#422006">
            {total}
          </text>
        </svg>

        <div className="math-house-body">
          {pairs.map((pair, pairIndex) => {
            const answer = houseAnswers[pairIndex];
            const previewRecallLeft = isRecall && pairIndex === activeFloor ? recallLeft : null;
            const floorClassName = [
              "math-house-floor",
              pairIndex === activeFloor ? "math-house-floor--active" : "",
              !answer && pairIndex > activeFloor ? "math-house-floor--future" : "",
            ].filter(Boolean).join(" ");
            const leftBoxClassName = [
              "math-house-box",
              isRead ? "math-house-box--known" : "",
              isRecall && pairIndex === activeFloor && recallStep === 0 ? "math-house-box--focus" : "",
              !isRead && !answer && previewRecallLeft == null ? "math-house-box--empty" : "",
              answer?.correct ? "math-house-box--correct" : "",
              answer && !answer.correct ? "math-house-box--wrong" : "",
            ].filter(Boolean).join(" ");
            const rightBoxClassName = [
              "math-house-box",
              isRead ? "math-house-box--known" : "",
              isFill ? "math-house-box--empty" : "",
              isRecall && pairIndex === activeFloor && recallStep === 1 ? "math-house-box--focus" : "",
              !isRead && answer?.right == null ? "math-house-box--empty" : "",
              answer?.correct ? "math-house-box--correct" : "",
              answer && !answer.correct ? "math-house-box--wrong" : "",
            ].filter(Boolean).join(" ");
            const leftValue = isRead
              ? pair.left
              : isRecall
                ? (answer?.left ?? previewRecallLeft ?? "?")
                : pair.left;
            const rightValue = isRead
              ? pair.right
              : isRecall
                ? (answer?.right ?? "?")
                : (answer ? answer.value : "?");

            return (
              <div key={`${task.cardId}-${pairIndex}`} className={floorClassName}>
                <div className={leftBoxClassName}>{leftValue}</div>
                {!isRead && <div className="math-house-operator">+</div>}
                <div className={rightBoxClassName}>{rightValue}</div>
                {!isRead && <div className="math-house-equals">= {total}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="math-house-phase-label">{phaseLabel}</div>
      <div className={`math-house-hint${isRead ? " math-house-hint--compact" : ""}`}>{hintText}</div>

      {isRead && (
        <div className="math-house-read-inputs" aria-label="Читаю">
          {readInputValues.map((slotValue, slotIndex) => (
            <div
              key={`read-slot-${slotIndex}`}
              className={`math-house-read-box${readInputStep === slotIndex ? " math-house-read-box--active" : ""}${slotValue === "+" || slotValue === "=" ? " math-house-read-box--operator" : ""}`}
            >
              {slotValue ?? ""}
            </div>
          ))}
        </div>
      )}

      <div className="math-house-numpad">
        {padValues.map((value) => (
          <button
            key={`${task.cardId}-${value}`}
            className="math-house-num-btn"
            type="button"
            disabled={houseBlocked}
            onClick={() => {
              if (isRead) {
                handleReadInput(value);
              } else if (isRecall) {
                handleRecallNumber(value);
              } else {
                handleFillNumber(value);
              }
            }}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}

function HouseGrow({ task, onCorrect }) {
  const [completedPairs, setCompletedPairs] = useState([]);
  const [draft, setDraft] = useState([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [done, setDone] = useState(false);

  const options = useMemo(
    () => Array.from({ length: task.number + 1 }, (_, i) => i),
    [task.number]
  );
  const completedKeys = useMemo(
    () => new Set(completedPairs.map(([left, right]) => `${left}:${right}`)),
    [completedPairs]
  );
  const totalPairs = task.pairs.length;
  const activeLeft = draft[0] ?? "?";
  const activeRight = draft[1] ?? "?";

  useEffect(() => {
    if (!done) return undefined;
    const timeout = window.setTimeout(() => onCorrect(task.conceptId, null), 650);
    return () => window.clearTimeout(timeout);
  }, [done, onCorrect, task.conceptId]);

  function setFeedback(text, type) {
    setMessage(text);
    setMessageType(type);
  }

  function handleNumber(value) {
    if (done) return;

    if (draft.length === 0) {
      setDraft([value]);
      setFeedback("", "");
      return;
    }

    const pair = [draft[0], value];
    const pairKey = `${pair[0]}:${pair[1]}`;

    if (pair[0] + pair[1] !== task.number) {
      setDraft([]);
      setFeedback(`Эта пара не даёт ${task.number}`, "wrong");
      return;
    }

    if (completedKeys.has(pairKey)) {
      setDraft([]);
      setFeedback("Такая пара уже есть", "duplicate");
      return;
    }

    const nextPairs = [...completedPairs, pair];
    setCompletedPairs(nextPairs);
    setDraft([]);

    if (nextPairs.length >= totalPairs) {
      setFeedback("Домик собран", "correct");
      setDone(true);
    } else {
      setFeedback(`${nextPairs.length} из ${totalPairs}`, "correct");
    }
  }

  return (
    <div className="house-body house-body--grow">
      <div className="house-roof">
        <div className="house-number">{task.number}</div>
      </div>
      <div className="house-rooms house-rooms--grow">
        {completedPairs.map(([left, right], idx) => (
          <div key={`${left}:${right}:${idx}`} className="house-row house-row--done">
            <div className="house-cell">{left}</div>
            <div className="house-divider" />
            <div className="house-cell">{right}</div>
          </div>
        ))}
        {!done && (
          <div className="house-row house-row--active">
            <button
              className={`house-cell house-cell--hidden ${draft.length === 0 ? "house-cell--focus" : ""}`}
              onClick={() => setDraft([])}
            >
              {activeLeft}
            </button>
            <div className="house-divider" />
            <button
              className={`house-cell house-cell--hidden ${draft.length === 1 ? "house-cell--focus" : ""}`}
              onClick={() => draft.length === 1 && setDraft([draft[0]])}
            >
              {activeRight}
            </button>
          </div>
        )}
      </div>

      <div className="house-grow-status">
        <span>{done ? `${totalPairs} из ${totalPairs}` : `Осталось ${totalPairs - completedPairs.length}`}</span>
        {message && (
          <span className={`house-grow-message house-grow-message--${messageType}`}>
            {message}
          </span>
        )}
      </div>

      {!done && (
        <div className="house-options house-options--grow">
          {options.map((n) => (
            <button key={n} className="house-option-btn" onClick={() => handleNumber(n)}>
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MathHousesRenderer({ task, onCorrect, onMistake }) {
  if (
    task?.type === "math_houses_read" ||
    task?.type === "math_houses" ||
    task?.type === "math_houses_recall"
  ) {
    return <HouseLegacy task={task} onCorrect={onCorrect} onMistake={onMistake} />;
  }
  if (task?.type === "math_houses_grow") {
    return <HouseGrow task={task} onCorrect={onCorrect} />;
  }
  const selectiveKey = `${task.cardId}:${(task.hiddenCells ?? []).map((cell) => cell.key).join(",")}`;
  return <HouseTask key={selectiveKey} task={task} onCorrect={onCorrect} onMistake={onMistake} />;
}
