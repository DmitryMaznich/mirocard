import { useEffect, useRef, useState } from "react";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { evaluateMatrixStroke, isOutsideCell, matrixCellTargets, pathData, sampleLines } from "./model";
import "./graphicMatrix.css";

const feedbackKeys = {
  outside: "graphicMatrix.outside",
  shape: "graphicMatrix.shape",
  duplicate: "graphicMatrix.duplicate",
  direction: "graphicMatrix.compare",
  extra: "graphicMatrix.compare",
};

function Sample({ sample }) {
  return (
    <div className="graphic-matrix__sample">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {sampleLines(sample).map((points, index) => <path key={index} d={pathData(points)} />)}
      </svg>
    </div>
  );
}

export default function GraphicMatrixTask({ task, sessionStatus, interactionDisabled, onCorrect, onStreakReset }) {
  const { t } = useUiTranslation();
  const { rows, columns } = task;
  const targets = matrixCellTargets(rows, columns);
  const [work, setWork] = useState(() => targets.map(() => []));
  const [trace, setTrace] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [eraseMode, setEraseMode] = useState(null);
  const workRef = useRef(work);
  const active = useRef(null);
  const feedbackTimer = useRef(null);
  const resolved = useRef(false);
  const acceptedCount = work.filter((strokes, index) => strokes.length === targets[index].total).length;
  const complete = sessionStatus === "answer_correct" || acceptedCount === targets.length;
  const hasInk = work.some((strokes) => strokes.length > 0);

  useEffect(() => () => clearTimeout(feedbackTimer.current), []);

  function setDrawing(next) {
    workRef.current = next;
    setWork(next);
  }

  function dismissFeedback() {
    clearTimeout(feedbackTimer.current);
    setFeedback(null);
  }

  function cancelStroke() {
    const stroke = active.current;
    if (!stroke) return;
    active.current = null;
    if (stroke.element.hasPointerCapture(stroke.pointerId)) {
      stroke.element.releasePointerCapture(stroke.pointerId);
    }
    setTrace(null);
  }

  function erase(index) {
    cancelStroke();
    dismissFeedback();
    setDrawing(workRef.current.map((strokes, current) => index === undefined || current === index ? [] : strokes));
    setEraseMode(null);
  }

  function startStroke(event, index) {
    if (interactionDisabled || complete || resolved.current || active.current ||
        !["touch", "pen"].includes(event.pointerType) || event.button !== 0) return;
    event.preventDefault();
    if (eraseMode === "cell") {
      if (workRef.current[index].length) erase(index);
      return;
    }
    if (eraseMode === "all" || workRef.current[index].length === targets[index].total) return;
    dismissFeedback();
    const rect = event.currentTarget.querySelector("svg").getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const stroke = { pointerId: event.pointerId, index, rect, element: event.currentTarget, points: [] };
    active.current = stroke;
    collect(event, stroke);
  }

  function collect(event, stroke) {
    const x = (event.clientX - stroke.rect.left) * 100 / stroke.rect.width;
    const y = (event.clientY - stroke.rect.top) * 100 / stroke.rect.height;
    const point = [x, y].map((value) => Math.round(Math.max(-20, Math.min(120, value))));
    const previous = stroke.points.at(-1);
    if (!previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) >= 1.5) stroke.points.push(point);
    if (isOutsideCell(point)) stroke.outside = true;
  }

  function moveStroke(event) {
    const stroke = active.current;
    if (stroke?.pointerId !== event.pointerId) return;
    if (interactionDisabled) {
      cancelStroke();
      return;
    }
    for (const sample of event.nativeEvent.getCoalescedEvents?.() ?? []) collect(sample, stroke);
    collect(event, stroke);
    setTrace({ index: stroke.index, path: pathData(stroke.points), outside: stroke.outside });
  }

  function endStroke(event) {
    const current = active.current;
    if (current?.pointerId !== event.pointerId) return;
    collect(event, current);
    cancelStroke();
    if (interactionDisabled || resolved.current) return;

    const { index, points } = current;
    const result = evaluateMatrixStroke(points, targets[index], workRef.current[index]);
    if (result.kind === "idle") return;
    if (result.kind !== "correct") {
      setFeedback({ index, key: feedbackKeys[result.kind], path: pathData(points) });
      feedbackTimer.current = setTimeout(() => {
        setFeedback((value) => value && { ...value, path: null });
      }, 900);
      onStreakReset(task.conceptId, task.card.id);
      return;
    }

    const next = workRef.current.map((strokes, cell) => cell === index ? [...strokes, result.stroke] : strokes);
    setDrawing(next);
    if (next.every((strokes, cell) => strokes.length === targets[cell].total)) {
      resolved.current = true;
      onCorrect(task.conceptId, task.card.id);
    }
  }

  function showEraseMode(mode) {
    cancelStroke();
    dismissFeedback();
    setEraseMode(eraseMode === mode ? null : mode);
  }

  const hint = complete ? "graphicMatrix.ready" : eraseMode === "cell" ? "graphicMatrix.pickCell"
    : eraseMode === "all" ? "graphicMatrix.askEraseAll" : feedback?.key;
  return (
    <div className="graphic-matrix">
      <p className="graphic-matrix__instruction">{t("graphicMatrix.instruction")}</p>
      <div className="graphic-matrix__board" role="group" aria-label={t("graphicMatrix.board")} style={{ "--matrix-size": rows.length }}>
        <div className="graphic-matrix__sample" aria-hidden="true" />
        {columns.map((sample, index) => <Sample key={index} sample={sample} />)}
        {rows.map((sample, row) => [
          <Sample key={`sample-${row}`} sample={sample} />,
          ...columns.map((_, column) => {
            const index = row * columns.length + column;
            const done = work[index].length === targets[index].total;
            const cancelled = (event) => {
              if (active.current?.pointerId === event.pointerId) cancelStroke();
            };
            return (
              <div
                key={`cell-${index}`}
                className={`graphic-matrix__cell${done ? " graphic-matrix__cell--done" : ""}`}
                aria-label={t("graphicMatrix.cell", { row: row + 1, column: column + 1 })}
                role="img"
                onPointerDown={(event) => startStroke(event, index)}
                onPointerMove={moveStroke}
                onPointerUp={endStroke}
                onPointerCancel={cancelled}
                onLostPointerCapture={cancelled}
              >
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  {work[index].map((stroke, step) => <path key={step} d={pathData(stroke.points)} />)}
                  {trace?.index === index && <path d={trace.path} className={trace.outside ? "graphic-matrix__invalid" : undefined} />}
                  {feedback?.index === index && feedback.path && <path d={feedback.path} className="graphic-matrix__invalid" />}
                </svg>
                {done && <span className="graphic-matrix__check" aria-hidden="true">✓</span>}
              </div>
            );
          }),
        ])}
      </div>
      <div className="graphic-matrix__feedback">
        <p role="status">{hint ? t(hint) : null}</p>
        <span>{t("graphicMatrix.count", { done: complete ? targets.length : acceptedCount, total: targets.length })}</span>
      </div>
      {!complete && (
        <div className="graphic-matrix__tools">
          {eraseMode !== "all" && <button type="button" className="btn btn--secondary" disabled={!hasInk || interactionDisabled} aria-pressed={eraseMode === "cell"} onClick={() => showEraseMode("cell")}>{t("graphicMatrix.eraseCell")}</button>}
          <button type="button" className="btn btn--secondary" disabled={!hasInk || interactionDisabled} onClick={() => eraseMode === "all" ? erase() : showEraseMode("all")}>
            {t(eraseMode === "all" ? "graphicMatrix.confirmEraseAll" : "graphicMatrix.eraseAll")}
          </button>
          {eraseMode === "all" && <button type="button" className="btn btn--secondary" onClick={() => showEraseMode(null)}>{t("common.cancel")}</button>}
        </div>
      )}
    </div>
  );
}
