import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState } from "react";
import { CheckmarkIcon } from "@/shared/components/ArrowIcons.jsx";
import { arePathNeighbors } from "./numberPath.js";
import "./numberPath.css";

function sum([left, right]) {
  return left + right;
}

function expression(pair) {
  return pair.join(" + ");
}

function directionTo(from, to, columns) {
  if (to === from + 1) return "right";
  if (to === from - 1) return "left";
  if (to === from + columns) return "down";
  if (to === from - columns) return "up";
  return undefined;
}

export default function NumberPath({ task, sessionParams, sessionStatus, interactionDisabled, onCorrect, onMistake, onAdvance }) {
  const { number, size, columns = size } = task;
  const start = task.route[0];
  const finish = task.route.at(-1);
  const cells = task.cells.map((pair, index) => pair ?? (index === start ? [number, 0] : [0, number]));
  const restartOnMistake = sessionParams?.mistakeBehavior === "restart";
  const titleId = useId();
  const checkId = useId();
  const [route, setRoute] = useState(() => sessionStatus === "answer_correct" ? task.route : [start]);
  const [lastPick, setLastPick] = useState(null);
  const [checkPick, setCheckPick] = useState(null);
  const boardRef = useRef(null);
  const checkRef = useRef(null);
  const moveFocus = useRef(false);
  const current = route.at(-1);
  const finished = current === finish;
  const pickedPair = cells[lastPick];
  const incorrect = pickedPair && sum(pickedPair) !== number;
  const knownPart = Math.floor(number / 2);
  const missingPart = number - knownPart;
  const options = Array.from({ length: 3 }, (_, index) => missingPart - 1 + (index + finish) % 3);
  const checkSolved = checkPick === missingPart;
  const nextByCell = new Map(route.slice(0, -1).map((cell, step) => [cell, route[step + 1]]));
  const advance = useEffectEvent(() => onAdvance());

  useEffect(() => {
    if (!checkSolved || interactionDisabled) return undefined;
    const timer = window.setTimeout(() => advance(), 1000);
    return () => window.clearTimeout(timer);
  }, [checkSolved, interactionDisabled]);

  useLayoutEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    const next = finished ? checkRef.current : boardRef.current;
    next?.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
  }, [current, finished]);

  function choose(index, event) {
    const pair = cells[index];
    setLastPick(index);
    if (sum(pair) !== number) {
      if (restartOnMistake && route.length > 1) {
        moveFocus.current = event.detail === 0;
        setRoute([start]);
      }
      onMistake(task.conceptId, task.cardId);
      return;
    }
    moveFocus.current = event.detail === 0;
    setRoute([...route, index]);
    if (index === finish) onCorrect(task.conceptId, task.cardId);
  }

  const message = finished ? "Дорожка пройдена!" : pickedPair ? `${expression(pickedPair)} = ${sum(pickedPair)}` : "";

  return (
    <section
      className="number-path"
      data-size={size}
      data-rectangular={columns !== size ? "" : undefined}
      style={{ "--np-columns": columns, "--np-rows": size }}
      aria-labelledby={titleId}
    >
      <header className="number-path__goal">
        <h2 id={titleId}>Найди дорожку</h2>
        <strong className="number-path__target"><span className="number-path__target-label">Ищем </span>{number}</strong>
      </header>
      <div className="number-path__field">
        <div className="number-path__board-frame">
          <div
            ref={boardRef}
            className="number-path__board"
            role="group"
            aria-label="Поле задания"
          >
            {cells.map((pair, index) => {
              const visited = route.includes(index);
              const neighbor = !finished && !visited && arePathNeighbors(current, index, columns);
              const state = index === current ? "current" : visited ? "path"
                : incorrect && !restartOnMistake && index === lastPick ? "retry" : neighbor ? "neighbor" : "idle";
              const label = expression(pair);
              const description = {
                current: "здесь", path: "пройдено", retry: "сумма не подходит",
                neighbor: "соседняя клетка",
              }[state];
              const endpoint = index === start ? "Старт" : index === finish ? "Финиш" : null;
              return (
                <button
                  key={index}
                  type="button"
                  className="number-path__tile"
                  data-state={state}
                  data-two-digits={pair.some((part) => part >= 10) ? "" : undefined}
                  data-endpoint={index === start ? "start" : index === finish ? "finish" : undefined}
                  data-link={directionTo(index, nextByCell.get(index), columns)}
                  aria-label={[label, endpoint, description].filter(Boolean).join(", ")}
                  disabled={!neighbor || interactionDisabled}
                  onClick={(event) => choose(index, event)}
                >
                  {endpoint && <span className="number-path__endpoint" aria-hidden="true">{endpoint}</span>}
                  {!endpoint && (state === "current" || state === "path" || state === "retry") && (
                    <span className="number-path__marker" aria-hidden="true">
                      {state === "path" ? "✓" : state === "retry" ? "×" : "●"}
                    </span>
                  )}
                  <span className="number-path__sum">
                    {pair[0]}<span className="number-path__plus">+</span>{pair[1]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <footer className="number-path__footer">
        <div className="number-path__feedback" data-mistake={Boolean(incorrect)} data-finished={finished} role="status" aria-atomic="true" hidden={!message}>
          <span className="number-path__feedback-icon" aria-hidden="true">
            {incorrect ? "×" : <CheckmarkIcon size={20} />}
          </span>
          <div>
            <strong>{message}</strong>
            {incorrect && <p>Ищем {number}.{restartOnMistake ? " Начни снова со старта." : ""}</p>}
          </div>
        </div>
        {finished && (
          <section ref={checkRef} className="number-path__check" aria-labelledby={checkId}>
            <h3 id={checkId}>Какого числа не хватает?</h3>
            <p className="number-path__missing">{knownPart} + <span>{checkSolved ? missingPart : "?"}</span> = {number}</p>
            <div className="number-path__choices">
              {options.map((option) => (
                <button
                  key={option}
                  className="number-path__action"
                  type="button"
                  data-result={option === checkPick ? (checkSolved ? "correct" : "incorrect") : undefined}
                  disabled={interactionDisabled || checkSolved}
                  onClick={() => setCheckPick(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <p className="number-path__check-status" role="status">
              {checkSolved ? "Верно!" : checkPick !== null ? `Получилось ${knownPart + checkPick}. Ищем ${number}.` : ""}
            </p>
          </section>
        )}
      </footer>
    </section>
  );
}
