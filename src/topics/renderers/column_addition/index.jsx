import React, { useState, useRef, useCallback, useEffect } from "react";
import "./column_addition.css";

const POSITIONS = ["units", "tens", "hundreds"];
const POS_INDEX = { units: 0, tens: 1, hundreds: 2 };

function getDigitAt(n, position) {
  return Math.floor(n / 10 ** POS_INDEX[position]) % 10;
}

// ── Expression header ─────────────────────────────────────────────────────────
// Each character gets its own 44px cell to match the notebook grid

function Expression({ task }) {
  const sign = task.operation === "add" ? "+" : "−";
  const topChars = String(task.top).split("");
  const botChars = String(task.bottom).split("");

  return (
    <div className="col-expression">
      {topChars.map((ch, i) => (
        <span key={`t${i}`} className="col-expr-cell">{ch}</span>
      ))}
      <span className="col-expr-cell col-expr-sign">{sign}</span>
      {botChars.map((ch, i) => (
        <span key={`b${i}`} className="col-expr-cell">{ch}</span>
      ))}
      <span className="col-expr-cell col-expr-eq">=</span>
      <span className="col-expr-cell col-expr-unknown">?</span>
    </div>
  );
}

// ── Phase 1: source digit tiles from the numbers ──────────────────────────────

function SourceTileGroup({ task, row, placedPositions, onDragStart }) {
  const sign = task.operation === "add" ? "+" : "−";
  const number = row === "top" ? task.top : task.bottom;

  // display left-to-right: most significant first
  const items = POSITIONS.slice(0, task.digits)
    .reverse()
    .map((pos) => ({ position: pos, digit: getDigitAt(number, pos) }));

  return (
    <div className="col-source-row">
      <span className="col-source-sign">{row === "bottom" ? sign : " "}</span>
      <div className="col-source-tiles">
        {items.map(({ position, digit }) => {
          const placed = placedPositions.has(position);
          return (
            <div
              key={position}
              className={`col-bank-tile${placed ? " col-bank-tile--placed" : ""}`}
              onPointerDown={placed ? undefined : (e) => onDragStart(e, { sourceRow: row, sourcePosition: position, digit })}
            >
              {digit}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Phase 2: 0–9 digit bank ───────────────────────────────────────────────────

function DigitBank({ onDragStart }) {
  return (
    <div className="col-digit-bank">
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          className="col-bank-tile"
          onPointerDown={(e) => onDragStart(e, i)}
        >
          {i}
        </div>
      ))}
    </div>
  );
}

// ── Floating ghost digit ──────────────────────────────────────────────────────

function FloatingDigit({ drag }) {
  if (!drag) return null;
  return (
    <div className="col-floating-digit" style={{ left: drag.x, top: drag.y }}>
      {drag.digit}
    </div>
  );
}

// ── Column grid (both phases) ─────────────────────────────────────────────────

function ColumnGrid({ task, phase, topFilled, bottomFilled, filledCells, activeStep, shakeCell }) {
  const { digits, operation } = task;
  const totalCols = digits + 2;
  const sign = operation === "add" ? "+" : "−";
  const cells = [];

  // ── Carry / borrow aux row (phase 2, only when steps need it) ────────────
  if (phase === "solve") {
    const hasAux = task.steps.some((s) => s.cellType === "carry" || s.cellType === "borrow");
    if (hasAux) {
      for (let i = 1; i < digits; i++) {
        const pos = POSITIONS[i];
        const cellType = operation === "add" ? "carry" : "borrow";
        const key = `${cellType}:${pos}`;
        const filled = filledCells[key] !== undefined;
        const active = activeStep?.cellType === cellType && activeStep?.position === pos;
        const gridCol = digits + 2 - i;
        cells.push(
          <div
            key={`aux:${pos}`}
            data-cell-key={key}
            className={[
              "col-carry-cell",
              active ? "col-carry-cell--active" : "",
              filled ? "col-carry-cell--filled" : "",
            ].filter(Boolean).join(" ")}
            style={{ gridColumn: gridCol, gridRow: 1 }}
          >
            {filled ? filledCells[key] : ""}
          </div>
        );
      }
      // effective top digit for subtraction borrow visualization
      if (operation === "subtract") {
        for (let i = 0; i < digits; i++) {
          const pos = POSITIONS[i];
          const col = task.columns[i];
          const gridCol = digits + 2 - i;
          if (col.borrowIn === 1 && filledCells[`borrow:${pos}`] !== undefined) {
            cells.push(
              <div key={`eff:${pos}`} className="col-effective-label" style={{ gridColumn: gridCol, gridRow: 1 }}>
                {col.effectiveTopDigit}
              </div>
            );
          }
        }
      }
    }
  }

  // ── Top row ───────────────────────────────────────────────────────────────
  for (let i = 0; i < digits; i++) {
    const pos = POSITIONS[i];
    const gridCol = digits + 2 - i;
    const col = task.columns[i];

    if (phase === "form") {
      const key = `top:${pos}`;
      const filled = topFilled[pos] !== undefined;
      cells.push(
        <div
          key={key}
          data-cell-key={key}
          className={[
            "col-form-cell",
            filled ? "col-form-cell--filled" : "",
            shakeCell === key ? "col-form-cell--shake" : "",
          ].filter(Boolean).join(" ")}
          style={{ gridColumn: gridCol, gridRow: 2 }}
        >
          {filled ? topFilled[pos] : ""}
        </div>
      );
    } else {
      const wasBorrowedFrom =
        operation === "subtract" &&
        col.borrowOut === 1 &&
        filledCells[`borrow:${POSITIONS[i + 1]}`] !== undefined;
      cells.push(
        <div
          key={`top:${pos}`}
          className={["col-digit", wasBorrowedFrom ? "col-digit--top-borrowed" : ""].filter(Boolean).join(" ")}
          style={{ gridColumn: gridCol, gridRow: 2 }}
        >
          {col.topDigit}
          {wasBorrowedFrom && <span className="col-digit-adjusted">{col.topDigit - 1}</span>}
        </div>
      );
    }
  }

  // ── Sign + bottom row ─────────────────────────────────────────────────────
  cells.push(
    <div key="sign" className="col-digit col-digit--sign" style={{ gridColumn: 1, gridRow: 3 }}>
      {sign}
    </div>
  );

  for (let i = 0; i < digits; i++) {
    const pos = POSITIONS[i];
    const gridCol = digits + 2 - i;
    const col = task.columns[i];

    if (phase === "form") {
      const key = `bottom:${pos}`;
      const filled = bottomFilled[pos] !== undefined;
      cells.push(
        <div
          key={key}
          data-cell-key={key}
          className={[
            "col-form-cell",
            filled ? "col-form-cell--filled" : "",
            shakeCell === key ? "col-form-cell--shake" : "",
          ].filter(Boolean).join(" ")}
          style={{ gridColumn: gridCol, gridRow: 3 }}
        >
          {filled ? bottomFilled[pos] : ""}
        </div>
      );
    } else {
      cells.push(
        <div key={`bot:${pos}`} className="col-digit" style={{ gridColumn: gridCol, gridRow: 3 }}>
          {col.bottomDigit}
        </div>
      );
    }
  }

  // ── Horizontal line ───────────────────────────────────────────────────────
  cells.push(
    <div key="line" className="col-line" style={{ gridColumn: `1 / ${digits + 3}`, gridRow: 4 }} />
  );

  // ── Result row (phase 2 only) ─────────────────────────────────────────────
  if (phase === "solve") {
    for (let i = 0; i < digits; i++) {
      const pos = POSITIONS[i];
      const gridCol = digits + 2 - i;
      const key = `result:${pos}`;
      const filled = filledCells[key] !== undefined;
      const active = activeStep?.cellType === "result" && activeStep?.position === pos;
      cells.push(
        <div
          key={key}
          data-cell-key={key}
          className={[
            "col-result-cell",
            active && !filled ? "col-result-cell--active" : "",
            filled ? "col-result-cell--filled" : "",
            shakeCell === key ? "col-result-cell--shake" : "",
          ].filter(Boolean).join(" ")}
          style={{ gridColumn: gridCol, gridRow: 5 }}
        >
          {filled ? filledCells[key] : ""}
        </div>
      );
    }
    // overflow carry (e.g. 57 + 65 = 122: the leading 1)
    const lastCol = task.columns[digits - 1];
    if (operation === "add" && lastCol.carryOut > 0) {
      const key = "result:overflow";
      const filled = filledCells[key] !== undefined;
      cells.push(
        <div
          key={key}
          data-cell-key={key}
          className={["col-result-cell", filled ? "col-result-cell--filled" : ""].filter(Boolean).join(" ")}
          style={{ gridColumn: 2, gridRow: 5 }}
        >
          {filled ? filledCells[key] : lastCol.carryOut}
        </div>
      );
    }
  }

  return (
    <div className="col-problem" style={{ gridTemplateColumns: `repeat(${totalCols}, 44px)` }}>
      {cells}
    </div>
  );
}

// ── Main task component ───────────────────────────────────────────────────────

function ColumnArithmeticTask({ task, onCorrect, onWrong }) {
  const [phase, setPhase] = useState("form");
  const [topFilled, setTopFilled] = useState({});     // { units: 4, tens: 1 }
  const [bottomFilled, setBottomFilled] = useState({}); // { units: 4, tens: 2 }
  const [filledCells, setFilledCells] = useState({});   // phase 2 result/carry
  const [stepIdx, setStepIdx] = useState(0);
  const [drag, setDrag] = useState(null);
  const [shakeCell, setShakeCell] = useState(null);

  const rootRef = useRef(null);
  const dragRef = useRef(null);

  const activeStep = phase === "solve" && stepIdx < task.steps.length ? task.steps[stepIdx] : null;

  useEffect(() => {
    setPhase("form");
    setTopFilled({});
    setBottomFilled({});
    setFilledCells({});
    setStepIdx(0);
    setDrag(null);
    setShakeCell(null);
    dragRef.current = null;
  }, [task.cardId, task.top, task.bottom, task.operation]);

  // advance to phase 2 when both rows are fully placed
  useEffect(() => {
    if (
      phase === "form" &&
      Object.keys(topFilled).length === task.digits &&
      Object.keys(bottomFilled).length === task.digits
    ) {
      const t = setTimeout(() => setPhase("solve"), 500);
      return () => clearTimeout(t);
    }
  }, [phase, topFilled, bottomFilled, task.digits]);

  const triggerShake = useCallback((key) => {
    setShakeCell(key);
    setTimeout(() => setShakeCell(null), 450);
  }, []);

  const findCellUnderPointer = useCallback((x, y) => {
    if (!rootRef.current) return null;
    for (const el of rootRef.current.querySelectorAll("[data-cell-key]")) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return el.getAttribute("data-cell-key");
      }
    }
    return null;
  }, []);

  // ── Phase 1 drag: place digits from expression into grid ─────────────────

  const handleFormDragStart = useCallback((e, tileInfo) => {
    // tileInfo = { sourceRow: "top"|"bottom", sourcePosition, digit }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const state = { ...tileInfo, x: e.clientX, y: e.clientY };
    dragRef.current = state;
    setDrag({ digit: tileInfo.digit, x: e.clientX, y: e.clientY });

    const el = e.currentTarget;

    const onMove = (ev) => {
      if (!dragRef.current) return;
      dragRef.current = { ...dragRef.current, x: ev.clientX, y: ev.clientY };
      setDrag({ digit: dragRef.current.digit, x: ev.clientX, y: ev.clientY });
    };

    const onUp = (ev) => {
      el.removeEventListener("pointermove", onMove);
      if (!dragRef.current) return;
      const info = dragRef.current;
      dragRef.current = null;
      setDrag(null);

      const cellKey = findCellUnderPointer(ev.clientX, ev.clientY);
      if (!cellKey) return;

      // cellKey: "top:units" | "bottom:tens" etc.
      const [targetRow, targetPos] = cellKey.split(":");
      if (targetRow !== info.sourceRow || targetPos !== info.sourcePosition) {
        triggerShake(cellKey);
        if (onWrong) onWrong();
        return;
      }

      // correct placement
      if (info.sourceRow === "top") {
        setTopFilled((prev) => ({ ...prev, [info.sourcePosition]: info.digit }));
      } else {
        setBottomFilled((prev) => ({ ...prev, [info.sourcePosition]: info.digit }));
      }
    };

    const onCancel = () => {
      el.removeEventListener("pointermove", onMove);
      dragRef.current = null;
      setDrag(null);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp, { once: true });
    el.addEventListener("pointercancel", onCancel, { once: true });
  }, [findCellUnderPointer, triggerShake, onWrong]);

  // ── Phase 2 drag: fill result / carry cells ───────────────────────────────

  const handleSolveDragStart = useCallback((e, digit) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    dragRef.current = { digit, x: e.clientX, y: e.clientY };
    setDrag({ digit, x: e.clientX, y: e.clientY });

    const el = e.currentTarget;

    const onMove = (ev) => {
      if (!dragRef.current) return;
      dragRef.current = { ...dragRef.current, x: ev.clientX, y: ev.clientY };
      setDrag({ digit: dragRef.current.digit, x: ev.clientX, y: ev.clientY });
    };

    const onUp = (ev) => {
      el.removeEventListener("pointermove", onMove);
      if (!dragRef.current) return;
      const droppedDigit = dragRef.current.digit;
      dragRef.current = null;
      setDrag(null);

      const cellKey = findCellUnderPointer(ev.clientX, ev.clientY);
      if (!cellKey || !activeStep) return;

      const expectedKey = `${activeStep.cellType}:${activeStep.position}`;
      if (cellKey !== expectedKey || droppedDigit !== activeStep.digit) {
        triggerShake(expectedKey);
        if (onWrong) onWrong();
        return;
      }

      setFilledCells((prev) => ({ ...prev, [cellKey]: droppedDigit }));
      const next = stepIdx + 1;
      setStepIdx(next);
      if (next >= task.steps.length) {
        setTimeout(() => onCorrect && onCorrect(), 300);
      }
    };

    const onCancel = () => {
      el.removeEventListener("pointermove", onMove);
      dragRef.current = null;
      setDrag(null);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp, { once: true });
    el.addEventListener("pointercancel", onCancel, { once: true });
  }, [activeStep, stepIdx, task.steps, findCellUnderPointer, triggerShake, onCorrect, onWrong]);

  const topPlaced = new Set(Object.keys(topFilled));
  const bottomPlaced = new Set(Object.keys(bottomFilled));

  return (
    <div className="col-screen" ref={rootRef}>
      <Expression task={task} />

      <ColumnGrid
        task={task}
        phase={phase}
        topFilled={topFilled}
        bottomFilled={bottomFilled}
        filledCells={filledCells}
        activeStep={activeStep}
        shakeCell={shakeCell}
      />

      {phase === "form" ? (
        <div className="col-source-area">
          <p className="col-phase-hint">Выложи пример в столбик</p>
          <SourceTileGroup task={task} row="top" placedPositions={topPlaced} onDragStart={handleFormDragStart} />
          <SourceTileGroup task={task} row="bottom" placedPositions={bottomPlaced} onDragStart={handleFormDragStart} />
        </div>
      ) : (
        <DigitBank onDragStart={handleSolveDragStart} />
      )}

      <FloatingDigit drag={drag} />
    </div>
  );
}

// ── Renderer entry point ──────────────────────────────────────────────────────

export default function ColumnAdditionRenderer({ task, onCorrect, onWrong }) {
  if (!task || task.type !== "column_arithmetic") {
    return <div className="col-screen" style={{ color: "#666", fontSize: 18 }}>Нет задания</div>;
  }
  return (
    <ColumnArithmeticTask
      key={`${task.cardId}-${task.top}-${task.bottom}-${task.operation}`}
      task={task}
      onCorrect={onCorrect}
      onWrong={onWrong}
    />
  );
}
