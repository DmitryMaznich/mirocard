import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import "./column_addition.css";

const POSITIONS = ["units", "tens", "hundreds"];
const POS_INDEX = { units: 0, tens: 1, hundreds: 2 };

function getDigitAt(n, position) {
  return Math.floor(n / 10 ** POS_INDEX[position]) % 10;
}

// ── Expression header ─────────────────────────────────────────────────────────

function Expression({ task, result }) {
  const sign = task.operation === "add" ? "+" : "−";
  const topChars = String(task.top).split("");
  const botChars = String(task.bottom).split("");
  const resultChars = result !== null && result !== undefined ? String(result).split("") : null;
  return (
    <div className="col-expression">
      {topChars.map((ch, i) => <span key={`t${i}`} className="col-expr-cell">{ch}</span>)}
      <span className="col-expr-cell col-expr-sign">{sign}</span>
      {botChars.map((ch, i) => <span key={`b${i}`} className="col-expr-cell">{ch}</span>)}
      <span className="col-expr-cell col-expr-eq">=</span>
      {resultChars
        ? resultChars.map((ch, i) => (
            <span key={`r${i}`} className="col-expr-cell col-expr-result">{ch}</span>
          ))
        : <span className="col-expr-cell col-expr-unknown">?</span>
      }
    </div>
  );
}

// ── Toolbox (phase 1): 0-9 digits + signs + line ─────────────────────────────

function DigitToolbox({ onDragStart }) {
  return (
    <div className="col-toolbox">
      <div className="col-toolbox-digits">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className="col-bank-tile"
            onPointerDown={(e) => onDragStart(e, { type: "digit", digit: i })}
          >
            {i}
          </div>
        ))}
      </div>
      <div className="col-toolbox-extras">
        <div
          className="col-bank-tile col-sign-tile"
          onPointerDown={(e) => onDragStart(e, { type: "sign", sign: "+" })}
        >
          +
        </div>
        <div
          className="col-bank-tile col-sign-tile"
          onPointerDown={(e) => onDragStart(e, { type: "sign", sign: "−" })}
        >
          −
        </div>
        <div
          className="col-line-tile"
          onPointerDown={(e) => onDragStart(e, { type: "line" })}
        >
          <div className="col-line-tile-bar" />
        </div>
      </div>
    </div>
  );
}

// ── Result digit bank (phase 2): 0-9 only ────────────────────────────────────

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

// ── Floating ghost element ────────────────────────────────────────────────────

function FloatingItem({ drag }) {
  if (!drag) return null;
  const content = drag.type === "line"
    ? <div className="col-line-tile-bar" style={{ width: 60 }} />
    : (drag.type === "sign" ? drag.sign : drag.digit);
  return (
    <div className="col-floating-digit" style={{ left: drag.x, top: drag.y }}>
      {content}
    </div>
  );
}

// ── Column grid ───────────────────────────────────────────────────────────────

function ColumnGrid({ task, phase, topFilled, bottomFilled, signFilled, lineFilled, filledCells, activeStep, shakeCell }) {
  const { digits, operation } = task;
  const totalCols = digits + 2;
  const cells = [];

  // ── Carry / borrow row (phase 2 only) ────────────────────────────────────
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
            {filled ? <span className="col-slant">{filledCells[key]}</span> : ""}
          </div>
        );
      }
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
          {filled ? <span className="col-slant">{topFilled[pos]}</span> : ""}
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

  // ── Sign cell ─────────────────────────────────────────────────────────────
  // Spans cols 1-2, rows 2-3 → visual center falls exactly on the grid-line
  // intersection between the top-number row and the bottom-number row.
  if (phase === "form") {
    cells.push(
      <div
        key="sign"
        data-cell-key="sign"
        className={[
          "col-sign-cell",
          signFilled ? "col-sign-cell--filled" : "",
          shakeCell === "sign" ? "col-form-cell--shake" : "",
        ].filter(Boolean).join(" ")}
        style={{ gridColumn: "1 / 3", gridRow: "2 / 4" }}
      >
        {signFilled ? <span className="col-slant">{signFilled}</span> : ""}
      </div>
    );
  } else {
    cells.push(
      <div key="sign" className="col-digit col-digit--sign" style={{ gridColumn: "1 / 3", gridRow: "2 / 4" }}>
        {signFilled || (operation === "add" ? "+" : "−")}
      </div>
    );
  }

  // ── Bottom row ────────────────────────────────────────────────────────────
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
          {filled ? <span className="col-slant">{bottomFilled[pos]}</span> : ""}
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

  // ── Line row ──────────────────────────────────────────────────────────────
  if (phase === "form") {
    cells.push(
      <div
        key="line"
        data-cell-key="line"
        className={[
          "col-line-placeholder",
          lineFilled ? "col-line-placeholder--filled" : "",
          shakeCell === "line" ? "col-form-cell--shake" : "",
        ].filter(Boolean).join(" ")}
        style={{ gridColumn: `1 / ${digits + 3}`, gridRow: 4 }}
      />
    );
  } else {
    cells.push(
      <div key="line" className="col-line" style={{ gridColumn: `1 / ${digits + 3}`, gridRow: 4 }} />
    );
  }

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
          {filled ? <span className="col-slant">{filledCells[key]}</span> : ""}
        </div>
      );
    }
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
          {filled ? <span className="col-slant">{filledCells[key]}</span> : lastCol.carryOut}
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
  const [topFilled, setTopFilled] = useState({});
  const [bottomFilled, setBottomFilled] = useState({});
  const [signFilled, setSignFilled] = useState(null);
  const [lineFilled, setLineFilled] = useState(false);
  const [filledCells, setFilledCells] = useState({});
  const [stepIdx, setStepIdx] = useState(0);
  const [drag, setDrag] = useState(null);
  const [shakeCell, setShakeCell] = useState(null);
  const [solved, setSolved] = useState(false);

  const rootRef = useRef(null);
  const notebookRef = useRef(null);
  const dragRef = useRef(null);

  const activeStep = phase === "solve" && stepIdx < task.steps.length ? task.steps[stepIdx] : null;

  // Align the full-screen background grid with notebook cell boundaries.
  // Measures notebook offset relative to screen and sets background-position.
  useLayoutEffect(() => {
    const alignGrid = () => {
      const screen = rootRef.current;
      const notebook = notebookRef.current;
      if (!screen || !notebook) return;
      const sr = screen.getBoundingClientRect();
      const nr = notebook.getBoundingClientRect();
      const offX = ((nr.left - sr.left) % 44 + 44) % 44;
      const offY = ((nr.top - sr.top) % 44 + 44) % 44;
      screen.style.backgroundPosition = `${offX}px ${offY}px`;
    };
    alignGrid();
    window.addEventListener("resize", alignGrid);
    return () => window.removeEventListener("resize", alignGrid);
  }, [task.top, task.bottom, task.operation, solved]);

  useEffect(() => {
    setPhase("form");
    setTopFilled({});
    setBottomFilled({});
    setSignFilled(null);
    setLineFilled(false);
    setFilledCells({});
    setStepIdx(0);
    setDrag(null);
    setShakeCell(null);
    setSolved(false);
    dragRef.current = null;
  }, [task.cardId, task.top, task.bottom, task.operation]);

  // advance to phase 2 when column fully built
  useEffect(() => {
    if (
      phase === "form" &&
      Object.keys(topFilled).length === task.digits &&
      Object.keys(bottomFilled).length === task.digits &&
      signFilled !== null &&
      lineFilled
    ) {
      const t = setTimeout(() => setPhase("solve"), 500);
      return () => clearTimeout(t);
    }
  }, [phase, topFilled, bottomFilled, signFilled, lineFilled, task.digits]);

  const triggerShake = useCallback((key) => {
    setShakeCell(key);
    setTimeout(() => setShakeCell(null), 450);
  }, []);

  const findCellUnderPointer = useCallback((x, y) => {
    if (!rootRef.current) return null;
    for (const el of rootRef.current.querySelectorAll("[data-cell-key]")) {
      const r = el.getBoundingClientRect();
      const key = el.getAttribute("data-cell-key");
      // Line row is only 3px tall — expand hit area ±25px vertically
      const vPad = key === "line" ? 25 : 0;
      if (x >= r.left && x <= r.right && y >= r.top - vPad && y <= r.bottom + vPad) {
        return key;
      }
    }
    return null;
  }, []);

  // ── Universal drag start ──────────────────────────────────────────────────

  const startDrag = useCallback((e, item) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const displayDigit = item.type === "digit" ? item.digit : item.type === "sign" ? item.sign : null;
    dragRef.current = { ...item, x: e.clientX, y: e.clientY };
    setDrag({ ...item, digit: displayDigit, x: e.clientX, y: e.clientY });

    const el = e.currentTarget;

    const onMove = (ev) => {
      if (!dragRef.current) return;
      dragRef.current = { ...dragRef.current, x: ev.clientX, y: ev.clientY };
      setDrag((prev) => prev ? { ...prev, x: ev.clientX, y: ev.clientY } : null);
    };

    const onUp = (ev) => {
      el.removeEventListener("pointermove", onMove);
      if (!dragRef.current) return;
      const info = dragRef.current;
      dragRef.current = null;
      setDrag(null);

      const cellKey = findCellUnderPointer(ev.clientX, ev.clientY);
      if (!cellKey) return;

      if (info.type === "digit") {
        const parts = cellKey.split(":");
        if (parts.length !== 2 || (parts[0] !== "top" && parts[0] !== "bottom")) {
          triggerShake(cellKey);
          return;
        }
        const [rowName, pos] = parts;
        if (!POSITIONS.includes(pos)) { triggerShake(cellKey); return; }
        const colData = task.columns[POS_INDEX[pos]];
        const expected = rowName === "top" ? colData.topDigit : colData.bottomDigit;
        if (info.digit !== expected) {
          triggerShake(cellKey);
          if (onWrong) onWrong();
          return;
        }
        if (rowName === "top") {
          if (topFilled[pos] !== undefined) return;
          setTopFilled((prev) => ({ ...prev, [pos]: info.digit }));
        } else {
          if (bottomFilled[pos] !== undefined) return;
          setBottomFilled((prev) => ({ ...prev, [pos]: info.digit }));
        }

      } else if (info.type === "sign") {
        if (cellKey !== "sign") { triggerShake(cellKey); return; }
        const expected = task.operation === "add" ? "+" : "−";
        if (info.sign !== expected) {
          triggerShake("sign");
          if (onWrong) onWrong();
          return;
        }
        setSignFilled(info.sign);

      } else if (info.type === "line") {
        if (cellKey !== "line") { triggerShake(cellKey); return; }
        setLineFilled(true);
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
  }, [task, topFilled, bottomFilled, findCellUnderPointer, triggerShake, onWrong]);

  // ── Phase 2 solve drag ────────────────────────────────────────────────────

  const handleSolveDrag = useCallback((e, digit) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    dragRef.current = { type: "digit", digit, x: e.clientX, y: e.clientY };
    setDrag({ type: "digit", digit, x: e.clientX, y: e.clientY });

    const el = e.currentTarget;

    const onMove = (ev) => {
      if (!dragRef.current) return;
      dragRef.current = { ...dragRef.current, x: ev.clientX, y: ev.clientY };
      setDrag((prev) => prev ? { ...prev, x: ev.clientX, y: ev.clientY } : null);
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
        setSolved(true);
        setTimeout(() => onCorrect && onCorrect(), 1200);
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

  return (
    <div className="col-screen" ref={rootRef}>
      <div className="col-notebook" ref={notebookRef}>
        <Expression task={task} result={solved ? task.result : null} />
        <ColumnGrid
          task={task}
          phase={phase}
          topFilled={topFilled}
          bottomFilled={bottomFilled}
          signFilled={signFilled}
          lineFilled={lineFilled}
          filledCells={filledCells}
          activeStep={activeStep}
          shakeCell={shakeCell}
        />
      </div>

      {phase === "form"
        ? <DigitToolbox onDragStart={startDrag} />
        : <DigitBank onDragStart={handleSolveDrag} />
      }

      <FloatingItem drag={drag} />
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
