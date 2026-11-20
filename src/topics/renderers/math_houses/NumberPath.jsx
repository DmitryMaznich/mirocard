import { Fragment, useId, useLayoutEffect, useRef, useState } from "react";
import { arePathNeighbors } from "./numberPath.js";
import "./numberPath.css";

function sum([left, right]) {
  return left + right;
}

function expression(pair) {
  return pair.join(" + ");
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
  const current = route.at(-1);
  const guideCell = task.route[1];
  const guideLabel = expression(cells[guideCell]);
  const pickedPair = cells[lastPick];
  const incorrect = pickedPair && sum(pickedPair) !== number;
  const canFinish = arePathNeighbors(current, finish, size);

  useLayoutEffect(() => {
    const viewport = boardViewportRef.current;
    const tile = boardRef.current?.querySelector('[data-state="current"]');
    if (!viewport || !tile) return undefined;

    function keepCurrentCellVisible() {
      const bounds = viewport.getBoundingClientRect();
      const cell = tile.getBoundingClientRect();
      const horizontalMargin = Math.max(0, Math.min(cell.width + 5, (viewport.clientWidth - cell.width) / 2));
      const verticalMargin = Math.max(0, Math.min(cell.height + 5, (viewport.clientHeight - cell.height) / 2));
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
    if (index === finish) {
      onCorrect(task.conceptId, task.cardId);
      return;
    }
    moveFocus.current = event.detail === 0;
    setRoute([...route, index]);
  }

  const message = pickedPair ? `${expression(pickedPair)} = ${sum(pickedPair)}` : `Начни с ${firstLabel}.`;
  const detail = incorrect ? (restartOnMistake ? `Начни снова с ${firstLabel}.` : `Найди рядом клетку с суммой ${number}.`)
    : canFinish ? `Теперь нажми на ${lastLabel}.` : "Выбери одну из соседних клеток.";

  return (
    <section
      className="number-path"
      style={{ "--number-path-size": size }}
      aria-labelledby={titleId}
    >
      <header className="number-path__goal">
        <div>
          <h2 id={titleId}>Найди дорожку до {lastLabel}</h2>
          <p>Нажимай на соседние клетки, где сумма равна {number}.</p>
        </div>
        <span className="number-path__target" aria-hidden="true">{number}</span>
      </header>
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
            const neighbor = !visited && arePathNeighbors(current, index, size) && (!showGuide || guided);
            const state = index === current ? "current" : visited ? "path" : guided ? "guide"
              : incorrect && !restartOnMistake && index === lastPick ? "retry" : neighbor ? "neighbor" : "idle";
            const label = expression(pair);
            const description = {
              current: "здесь", path: "пройдено", retry: "сумма не подходит",
              neighbor: "соседняя клетка", guide: "клетка для первого хода",
            }[state];
            return (
              <button
                key={index}
                type="button"
                className="number-path__tile"
                data-state={state}
                aria-label={description ? `${label}, ${description}` : label}
                disabled={!neighbor || interactionDisabled}
                onClick={(event) => choose(index, event)}
              >
                <span>{label}</span>
                {showCounters && neighbor && !showGuide && <Counters pair={pair} />}
              </button>
            );
          })}
        </div>
      </div>
      <footer className="number-path__footer">
        <div id={guideId} className="number-path__guide" hidden={!showGuide}>
          <div className="number-path__worked" aria-hidden="true">
            <Counters pair={cells[guideCell]} showPlus />
            <strong>= {number}</strong>
          </div>
          <p>{guideLabel} = {number}. Нажми на клетку {guideLabel}.</p>
        </div>
        <div className="number-path__feedback" data-mistake={Boolean(incorrect)} role="status" aria-atomic="true" hidden={showGuide}>
          <strong>{message}</strong>
          <p>{detail}</p>
        </div>
        <div className="number-path__actions">
          {route.length === 1 && !usedGuide && (
            <button
              className="number-path__action"
              type="button"
              aria-expanded={showGuide}
              aria-controls={guideId}
              disabled={interactionDisabled}
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
              data-active={showCounters}
              disabled={interactionDisabled}
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
