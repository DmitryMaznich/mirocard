import { useEffect, useRef, useState } from "react";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { pathData } from "../graphicMatrix/model.js";
import { evaluateLineOperationStroke, lineExamplePoints, lineTicks } from "./model.js";
import "./lineOperations.css";

const tapSlop = 6;
const gridStart = lineTicks[0];
const gridEnd = lineTicks.at(-1);
const gridSize = gridEnd - gridStart;
const gridPath = lineTicks.slice(1, -1)
  .map((value) => `M${value} ${gridStart}V${gridEnd}M${gridStart} ${value}H${gridEnd}`)
  .join("");
const emptyDrawing = () => ({ paths: [], accepted: new Set() });

function Grid() {
  return (
    <>
      <path className="line-operations__grid" d={gridPath} />
      <rect className="line-operations__frame" x={gridStart} y={gridStart} width={gridSize} height={gridSize} />
    </>
  );
}

function Example({ paths, label, side }) {
  return (
    <div className={`line-operations__panel line-operations__example line-operations__example--${side}`}>
      <svg viewBox="0 0 100 100" role="img" aria-label={label}>
        <Grid />
        {paths.map((path, index) => (
          <path key={index} className="line-operations__ink" d={pathData(lineExamplePoints(path))} />
        ))}
      </svg>
    </div>
  );
}

function addPoint(event, stroke) {
  stroke.moved ||= Math.hypot(event.clientX - stroke.startX, event.clientY - stroke.startY) >= tapSlop;
  const { left, top, width, height } = stroke.rect;
  const point = [(event.clientX - left) * 100 / width, (event.clientY - top) * 100 / height]
    .map((value) => Math.round(Math.max(-15, Math.min(115, value)) * 10) / 10);
  const previous = stroke.points.at(-1);
  if (!previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) >= 1) stroke.points.push(point);
}

export default function LineOperationsTask({ task, sessionStatus, interactionDisabled, onCorrect, onStreakReset }) {
  const { t } = useUiTranslation();
  const isMinus = task.operation === "minus";
  const target = new Set(task.target);
  const [drawing, setDrawing] = useState(emptyDrawing);
  const [trace, setTrace] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const work = useRef(drawing);
  const active = useRef(null);
  const timer = useRef(null);
  const resolved = useRef(false);
  const complete = sessionStatus === "answer_correct" || drawing.accepted.size === target.size;

  useEffect(() => () => clearTimeout(timer.current), []);

  function keep(next) {
    work.current = next;
    setDrawing(next);
  }

  function dismissFeedback() {
    clearTimeout(timer.current);
    setFeedback(null);
  }

  function cancelStroke() {
    const stroke = active.current;
    if (!stroke) return;
    active.current = null;
    if (stroke.element.hasPointerCapture(stroke.id)) stroke.element.releasePointerCapture(stroke.id);
    setTrace(null);
  }

  function startStroke(event) {
    if (interactionDisabled || complete || resolved.current || active.current ||
        event.button !== 0 || !["touch", "pen"].includes(event.pointerType)) return;
    const element = event.currentTarget;
    const rect = element.querySelector("svg").getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    event.preventDefault();
    element.setPointerCapture(event.pointerId);
    active.current = {
      id: event.pointerId, element, rect, points: [], moved: false,
      startX: event.clientX, startY: event.clientY,
    };
    addPoint(event, active.current);
  }

  function moveStroke(event) {
    const stroke = active.current;
    if (stroke?.id !== event.pointerId) return;
    if (interactionDisabled) {
      cancelStroke();
      return;
    }
    const wasMoving = stroke.moved;
    for (const sample of event.nativeEvent.getCoalescedEvents?.() ?? []) addPoint(sample, stroke);
    addPoint(event, stroke);
    if (!stroke.moved) return;
    if (!wasMoving) dismissFeedback();
    setTrace(pathData(stroke.points));
  }

  function endStroke(event) {
    const stroke = active.current;
    if (stroke?.id !== event.pointerId) return;
    addPoint(event, stroke);
    cancelStroke();
    if (interactionDisabled || resolved.current) return;
    dismissFeedback();
    if (!stroke.moved) {
      if (work.current.paths.length) keep(emptyDrawing());
      return;
    }
    const evaluation = evaluateLineOperationStroke(stroke.points, target);
    if (evaluation.kind === "idle") return;
    if (evaluation.kind === "incorrect") {
      setFeedback({ path: pathData(stroke.points) });
      timer.current = setTimeout(() => setFeedback({ path: null }), 750);
      onStreakReset(task.conceptId, task.card.id);
      return;
    }
    const previous = work.current;
    if (evaluation.edges.every((edge) => previous.accepted.has(edge))) return;
    const next = {
      paths: [...previous.paths, pathData(stroke.points)],
      accepted: new Set([...previous.accepted, ...evaluation.edges]),
    };
    keep(next);
    if (next.accepted.size === target.size) {
      resolved.current = true;
      onCorrect(task.conceptId, task.card.id);
    }
  }

  function cancelPointer(event) {
    if (active.current?.id === event.pointerId) cancelStroke();
  }

  return (
    <div className="line-operations">
      <h1 className="line-operations__title">{t("lineOperations.title")}</h1>
      <p className="line-operations__prompt">{t(isMinus ? "lineOperations.minusPrompt" : "lineOperations.plusPrompt")}</p>
      <div className="line-operations__equation">
        <Example paths={task.first} label={t("lineOperations.first")} side="first" />
        <span className="line-operations__symbol" role="img" aria-label={t(isMinus ? "lineOperations.minus" : "lineOperations.plus")}>
          {isMinus ? "−" : "+"}
        </span>
        <Example paths={task.second} label={t("lineOperations.second")} side="second" />
        <span className="line-operations__symbol line-operations__equals" role="img" aria-label={t("lineOperations.equals")}>=</span>
        <div
          className={`line-operations__panel line-operations__result${complete ? " line-operations__result--done" : ""}${feedback ? " line-operations__result--retry" : ""}`}
          onPointerDown={startStroke}
          onPointerMove={moveStroke}
          onPointerUp={endStroke}
          onPointerCancel={cancelPointer}
          onLostPointerCapture={cancelPointer}
        >
          <svg viewBox="0 0 100 100" role="img" aria-label={t("lineOperations.answer")}>
            <Grid />
            {drawing.paths.map((path, index) => <path key={index} className="line-operations__ink line-operations__response" d={path} />)}
            {trace && <path className="line-operations__ink line-operations__response" d={trace} />}
            {feedback?.path && <path className="line-operations__ink line-operations__invalid" d={feedback.path} />}
          </svg>
          {complete && <span className="line-operations__check" aria-hidden="true">✓</span>}
        </div>
      </div>
      <p className="line-operations__feedback" role="status">
        {complete ? t("lineOperations.ready") : feedback ? t("lineOperations.retry") : null}
      </p>
    </div>
  );
}
