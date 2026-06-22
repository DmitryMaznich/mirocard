import React, { useState, useRef, useCallback, useEffect } from "react";
import "./column_addition.css";

const POSITIONS = ["units", "tens", "hundreds"];
const POS_INDEX = { units: 0, tens: 1, hundreds: 2 };

// ── Digit Bank ───────────────────────────────────────────────────────────────

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

// ── Carry / Borrow row (row 1) ────────────────────────────────────────────────

function CarryRow({ task, filledCells, activeStep, digits }) {
  const cells = [];

  for (let i = 0; i < digits; i++) {
    const pos = POSITIONS[i];
    const col = task.columns[i];
    const gridCol = digits + 2 - i; // rightmost digit = column digits+1, leftmost = 2

    if (task.operation === "add") {
      // carry cell is above the column it's written into (tens and hundreds)
      if (i > 0) {
        const key = `carry:${pos}`;
        const filled = filledCells[key] !== undefined;
        const active = activeStep && activeStep.cellType === "carry" && activeStep.position === pos;
        cells.push(
          <div
            key={key}
            data-cell-key={key}
            className={[
              "col-carry-cell",
              active ? "col-carry-cell--active" : "",
              filled ? "col-carry-cell--filled" : "",
            ].join(" ").trim()}
            style={{ gridColumn: gridCol, gridRow: 1 }}
          >
            {filled ? filledCells[key] : ""}
          </div>
        );
      }
    } else {
      // borrow cell is above the column we borrow FROM (tens and hundreds)
      if (i > 0) {
        const key = `borrow:${pos}`;
        const filled = filledCells[key] !== undefined;
        const active = activeStep && activeStep.cellType === "borrow" && activeStep.position === pos;
        cells.push(
          <div
            key={key}
            data-cell-key={key}
            className={[
              "col-carry-cell",
              active ? "col-carry-cell--active" : "",
              filled ? "col-carry-cell--filled" : "",
            ].join(" ").trim()}
            style={{ gridColumn: gridCol, gridRow: 1 }}
          >
            {filled ? filledCells[key] : ""}
          </div>
        );
      }
    }
  }

  return <>{cells}</>;
}

// ── Top number row (row 2) ────────────────────────────────────────────────────

function TopRow({ task, filledCells, digits }) {
  const cells = [];

  for (let i = 0; i < digits; i++) {
    const pos = POSITIONS[i];
    const col = task.columns[i];
    const gridCol = digits + 2 - i;

    if (task.operation === "subtract") {
      const borrowKey = `borrow:${pos}`;
      const borrowFilled = filledCells[borrowKey] !== undefined;
      // this column was borrowed FROM (col.borrowOut === 1) and that borrow is now filled
      const wasBorrowedFrom = col.borrowOut === 1 && filledCells[`borrow:${POSITIONS[i + 1]}`] !== undefined;

      cells.push(
        <div
          key={`top:${pos}`}
          className={["col-digit", wasBorrowedFrom ? "col-digit--top-borrowed" : ""].join(" ").trim()}
          style={{ gridColumn: gridCol, gridRow: 2 }}
        >
          {col.topDigit}
          {wasBorrowedFrom && (
            <span className="col-digit-adjusted">{col.topDigit - 1}</span>
          )}
        </div>
      );
    } else {
      cells.push(
        <div key={`top:${pos}`} className="col-digit" style={{ gridColumn: gridCol, gridRow: 2 }}>
          {col.topDigit}
        </div>
      );
    }
  }

  return <>{cells}</>;
}

// ── Bottom number row (row 3) ─────────────────────────────────────────────────

function BottomRow({ task, digits }) {
  const sign = task.operation === "add" ? "+" : "−";
  const signGridCol = 1;

  const cells = [
    <div key="sign" className="col-digit col-digit--sign" style={{ gridColumn: signGridCol, gridRow: 3 }}>
      {sign}
    </div>,
  ];

  for (let i = 0; i < digits; i++) {
    const col = task.columns[i];
    const gridCol = digits + 2 - i;
    cells.push(
      <div key={`bot:${POSITIONS[i]}`} className="col-digit" style={{ gridColumn: gridCol, gridRow: 3 }}>
        {col.bottomDigit}
      </div>
    );
  }

  return <>{cells}</>;
}

// ── Effective top digit label (for subtraction borrow) ───────────────────────

function EffectiveLabels({ task, filledCells, digits }) {
  if (task.operation !== "subtract") return null;

  const labels = [];
  for (let i = 0; i < digits; i++) {
    const pos = POSITIONS[i];
    const col = task.columns[i];
    const gridCol = digits + 2 - i;

    // show effectiveTopDigit in carry row when the borrow for this column's position is filled
    // (borrow affects the units column: borrowOut from units means we borrowed for units from tens)
    // col.borrowIn === 1 means this column received a borrow → show effectiveTopDigit above this column
    if (col.borrowIn === 1 && filledCells[`borrow:${pos}`] !== undefined) {
      labels.push(
        <div
          key={`eff:${pos}`}
          className="col-effective-label"
          style={{ gridColumn: gridCol, gridRow: 1 }}
        >
          {col.effectiveTopDigit}
        </div>
      );
    }
  }

  return <>{labels}</>;
}

// ── Horizontal line (row 4) ───────────────────────────────────────────────────

function HorizLine({ digits }) {
  return (
    <div
      className="col-line"
      style={{ gridColumn: `1 / ${digits + 3}`, gridRow: 4 }}
    />
  );
}

// ── Result row (row 5) ───────────────────────────────────────────────────────

function ResultRow({ task, filledCells, activeStep, shakeCell, digits }) {
  const cells = [];

  for (let i = 0; i < digits; i++) {
    const pos = POSITIONS[i];
    const gridCol = digits + 2 - i;
    const key = `result:${pos}`;
    const filled = filledCells[key] !== undefined;
    const active = activeStep && activeStep.cellType === "result" && activeStep.position === pos;
    const shaking = shakeCell === key;

    cells.push(
      <div
        key={key}
        data-cell-key={key}
        className={[
          "col-result-cell",
          active && !filled ? "col-result-cell--active" : "",
          filled ? "col-result-cell--filled" : "",
          shaking ? "col-result-cell--shake" : "",
        ].join(" ").trim()}
        style={{ gridColumn: gridCol, gridRow: 5 }}
      >
        {filled ? filledCells[key] : ""}
      </div>
    );
  }

  // carry overflow into a higher column (e.g. 3-digit result from 2-digit addition)
  const lastCol = task.columns[digits - 1];
  if (task.operation === "add" && lastCol.carryOut > 0) {
    const overflowGridCol = 2; // leftmost position
    const key = `result:overflow`;
    const filled = filledCells[key] !== undefined;
    cells.push(
      <div
        key={key}
        data-cell-key={key}
        className={["col-result-cell", filled ? "col-result-cell--filled" : ""].join(" ").trim()}
        style={{ gridColumn: overflowGridCol, gridRow: 5 }}
      >
        {filled ? filledCells[key] : lastCol.carryOut}
      </div>
    );
  }

  return <>{cells}</>;
}

// ── Column Problem (full grid) ────────────────────────────────────────────────

function ColumnProblem({ task, filledCells, activeStep, shakeCell }) {
  const digits = task.digits;
  const totalCols = digits + 2; // sign col + digit cols + one extra left margin

  return (
    <div
      className="col-problem"
      style={{ gridTemplateColumns: `repeat(${totalCols}, 44px)` }}
    >
      <CarryRow task={task} filledCells={filledCells} activeStep={activeStep} digits={digits} />
      <TopRow task={task} filledCells={filledCells} digits={digits} />
      <EffectiveLabels task={task} filledCells={filledCells} digits={digits} />
      <BottomRow task={task} digits={digits} />
      <HorizLine digits={digits} />
      <ResultRow task={task} filledCells={filledCells} activeStep={activeStep} shakeCell={shakeCell} digits={digits} />
    </div>
  );
}

// ── Floating digit (drag ghost) ───────────────────────────────────────────────

function FloatingDigit({ drag }) {
  if (!drag) return null;
  return (
    <div
      className="col-floating-digit"
      style={{ left: drag.x, top: drag.y }}
    >
      {drag.digit}
    </div>
  );
}

// ── Main task component ───────────────────────────────────────────────────────

function ColumnArithmeticTask({ task, onCorrect, onWrong }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [filledCells, setFilledCells] = useState({});
  const [drag, setDrag] = useState(null);
  const [shakeCell, setShakeCell] = useState(null);

  const rootRef = useRef(null);
  const dragRef = useRef(null);

  const steps = task.steps;
  const activeStep = stepIdx < steps.length ? steps[stepIdx] : null;

  // reset when task changes
  useEffect(() => {
    setStepIdx(0);
    setFilledCells({});
    setDrag(null);
    setShakeCell(null);
    dragRef.current = null;
  }, [task.cardId, task.top, task.bottom, task.operation]);

  // find which cell the pointer is over
  const findCellUnderPointer = useCallback((x, y) => {
    if (!rootRef.current) return null;
    const elements = rootRef.current.querySelectorAll("[data-cell-key]");
    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return el.getAttribute("data-cell-key");
      }
    }
    return null;
  }, []);

  const handleDragStart = useCallback((e, digit) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const state = { digit, x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    dragRef.current = state;
    setDrag(state);

    const onMove = (ev) => {
      if (!dragRef.current) return;
      const updated = { ...dragRef.current, x: ev.clientX, y: ev.clientY };
      dragRef.current = updated;
      setDrag({ ...updated });
    };

    const onUp = (ev) => {
      if (!dragRef.current) return;
      const cellKey = findCellUnderPointer(ev.clientX, ev.clientY);
      const droppedDigit = dragRef.current.digit;
      dragRef.current = null;
      setDrag(null);

      if (!cellKey || !activeStep) return;

      const expectedKey = `${activeStep.cellType}:${activeStep.position}`;
      if (cellKey !== expectedKey) {
        // wrong cell — shake active cell
        setShakeCell(expectedKey);
        setTimeout(() => setShakeCell(null), 450);
        if (onWrong) onWrong();
        return;
      }

      if (droppedDigit !== activeStep.digit) {
        // wrong digit
        setShakeCell(expectedKey);
        setTimeout(() => setShakeCell(null), 450);
        if (onWrong) onWrong();
        return;
      }

      // correct!
      setFilledCells(prev => ({ ...prev, [cellKey]: droppedDigit }));
      const nextIdx = stepIdx + 1;
      setStepIdx(nextIdx);
      if (nextIdx >= steps.length) {
        setTimeout(() => onCorrect && onCorrect(), 300);
      }
    };

    e.currentTarget.addEventListener("pointermove", onMove, { once: false });
    e.currentTarget.addEventListener("pointerup", onUp, { once: true });
    e.currentTarget.addEventListener("pointercancel", () => {
      dragRef.current = null;
      setDrag(null);
    }, { once: true });
  }, [activeStep, stepIdx, steps, findCellUnderPointer, onCorrect, onWrong]);

  return (
    <div className="col-screen" ref={rootRef}>
      <ColumnProblem
        task={task}
        filledCells={filledCells}
        activeStep={activeStep}
        shakeCell={shakeCell}
      />
      <DigitBank onDragStart={handleDragStart} />
      <FloatingDigit drag={drag} />
    </div>
  );
}

// ── Renderer entry point ──────────────────────────────────────────────────────

export default function ColumnAdditionRenderer({ task, onCorrect, onWrong, onSkip }) {
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
