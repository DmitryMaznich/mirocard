import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { CheckmarkIcon, ForwardArrowIcon } from "@/shared/components/ArrowIcons.jsx";
import { arePathNeighbors } from "./numberPath.js";
import "./numberPath.css";

function sum([left, right]) {
  return left + right;
}

function expression(pair) {
  return pair.join(" + ");
}

function directionTo(from, to, size) {
  if (to === from + 1) return "right";
  if (to === from - 1) return "left";
  if (to === from + size) return "down";
  if (to === from - size) return "up";
  return undefined;
}

function Counters({ pair, showPlus = false }) {
  return (
    <span className="number-path__counters" aria-hidden="true">
      {pair.map((count, group) => (
        <Fragment key={group}>
          {showPlus && group === 1 && <span>+</span>}
          <span className="number-path__counter-group" data-group={group}>
            {Array.from({ length: count }, (_, i) => <span key={i} />)}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

export default function NumberPath({ task, sessionParams, interactionDisabled, onCorrect, onMistake }) {
  const { number, size } = task;
  const start = task.route[0];
  const finish = task.route.at(-1);
  const cells = task.cells.map((pair, index) => pair ?? (index === start ? [number, 0] : [0, number]));
  const firstLabel = expression(cells[start]);
  const lastLabel = expression(cells[finish]);
  const restartOnMistake = sessionParams?.mistakeBehavior === "restart";
  const titleId = useId();
  const guideId = useId();
  const [route, setRoute] = useState([start]);
  const [lastPick, setLastPick] = useState(null);
  const [showCounters, setShowCounters] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [usedGuide, setUsedGuide] = useState(false);
  const boardRef = useRef(null);
  const boardViewportRef = useRef(null);
  const moveFocus = useRef(false);
  const completionReported = useRef(false);
  const current = route.at(-1);
  const finished = current === finish;
  const guideCell = task.route[1];
  const guideLabel = expression(cells[guideCell]);
  const pickedPair = cells[lastPick];
  const incorrect = pickedPair && sum(pickedPair) !== number;
  const canFinish = arePathNeighbors(current, finish, size);
  const nextByCell = new Map(route.slice(0, -1).map((cell, step) => [cell, route[step + 1]]));

  useEffect(() => {
    if (!finished || interactionDisabled || completionReported.current) return undefined;
    const timer = window.setTimeout(() => {
      completionReported.current = true;
      onCorrect(task.conceptId, task.cardId);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [finished, interactionDisabled, onCorrect, task.conceptId, task.cardId]);

  useLayoutEffect(() => {
    const viewport = boardViewportRef.current;
    const tile = boardRef.current?.querySelector('[data-state="current"]');
    if (!viewport || !tile) return undefined;

    function keepCurrentCellVisible() {
      const bounds = viewport.getBoundingClientRect();
      const cell = tile.getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(boardRef.current).gap) || 0;
      const horizontalMargin = Math.max(0, Math.min(cell.width + gap, (viewport.clientWidth - cell.width) / 2));
      const verticalMargin = Math.max(0, Math.min(cell.height + gap, (viewport.clientHeight - cell.height) / 2));
      const left = Math.min(0, cell.left - horizontalMargin - bounds.left)
        || Math.max(0, cell.right + horizontalMargin - bounds.left - viewport.clientWidth);
      const top = Math.min(0, cell.top - verticalMargin - bounds.top)
        || Math.max(0, cell.bottom + verticalMargin - bounds.top - viewport.clientHeight);
      if (left || top) viewport.scrollBy({ left, top, behavior: "instant" });
    }

    keepCurrentCellVisible();
    if (moveFocus.current) {
      moveFocus.current = false;
      boardRef.current?.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
    }
    const observer = new ResizeObserver(keepCurrentCellVisible);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [current, showGuide]);

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
    if (showGuide) {
      setShowGuide(false);
      setUsedGuide(true);
    }
    moveFocus.current = index !== finish && event.detail === 0;
    setRoute([...route, index]);
  }

  const message = finished ? "Дорожка пройдена!"
    : pickedPair ? `${expression(pickedPair)} = ${sum(pickedPair)}` : `Старт на клетке ${firstLabel}`;
  const detail = finished ? `${lastLabel} = ${number}`
    : incorrect ? (restartOnMistake ? "Начни снова со старта." : "Попробуй другую соседнюю клетку.")
      : canFinish ? `Шагни на финиш: ${lastLabel}.` : "Выбери одну из соседних клеток.";

  return (
    <section
      className="number-path"
      data-size={size}
      style={{ "--number-path-size": size }}
      aria-labelledby={titleId}
    >
      <header className="number-path__goal">
        <div>
          <h2 id={titleId}>Найди дорожку</h2>
          <p>Шагай к финишу по клеткам с суммой <strong>{number}</strong>.</p>
        </div>
        <div className="number-path__target" aria-hidden="true">
          <span>Сумма</span>
          <strong>{number}</strong>
        </div>
      </header>
      <div className="number-path__field">
        <div ref={boardViewportRef} className="number-path__board-viewport">
          <div
            ref={boardRef}
            className="number-path__board"
            role="group"
            aria-label="Поле задания"
          >
            {cells.map((pair, index) => {
              const visited = route.includes(index);
              const guided = showGuide && index === guideCell;
              const neighbor = !finished && !visited && arePathNeighbors(current, index, size) && (!showGuide || guided);
              const state = index === current ? "current" : visited ? "path" : guided ? "guide"
                : incorrect && !restartOnMistake && index === lastPick ? "retry" : neighbor ? "neighbor" : "idle";
              const label = expression(pair);
              const description = {
                current: "здесь", path: "пройдено", retry: "сумма не подходит",
                neighbor: "соседняя клетка", guide: "клетка для первого хода",
              }[state];
              const endpoint = index === start ? "Старт" : index === finish ? "Финиш" : null;
              return (
                <button
                  key={index}
                  type="button"
                  className="number-path__tile"
                  data-state={state}
                  data-endpoint={index === start ? "start" : index === finish ? "finish" : undefined}
                  data-link={directionTo(index, nextByCell.get(index), size)}
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
                  {showCounters && neighbor && !showGuide && <Counters pair={pair} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <footer className="number-path__footer">
        <div id={guideId} className="number-path__guide" hidden={!showGuide}>
          <div className="number-path__worked" aria-hidden="true">
            <Counters pair={cells[guideCell]} showPlus />
            <strong>= {number}</strong>
          </div>
          <p>{guideLabel} = {number}. Нажми на эту клетку.</p>
        </div>
        <div className="number-path__feedback" data-mistake={Boolean(incorrect)} role="status" aria-atomic="true" hidden={showGuide}>
          <span className="number-path__feedback-icon" aria-hidden="true">
            {incorrect ? "×" : pickedPair ? <CheckmarkIcon size={20} /> : <ForwardArrowIcon size={20} />}
          </span>
          <div>
            <strong>{message}</strong>
            <p>{detail}</p>
          </div>
        </div>
        <div className="number-path__actions">
          {route.length === 1 && !usedGuide && (
            <button
              className="number-path__action"
              type="button"
              aria-expanded={showGuide}
              aria-controls={guideId}
              disabled={interactionDisabled || finished}
              onClick={() => {
                if (!showGuide) setLastPick(null);
                setShowGuide(!showGuide);
              }}
            >
              {showGuide ? "Закрыть показ" : "Показать первый ход"}
            </button>
          )}
          {!showGuide && (
            <button
              className="number-path__action"
              type="button"
              aria-pressed={showCounters}
              disabled={interactionDisabled || finished}
              onClick={() => setShowCounters(!showCounters)}
            >
              {showCounters ? "Скрыть фишки" : "Показать фишки"}
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}
