import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { generateExamples } from "./engine.js";
import RewardVideoModal from "@/shared/components/RewardVideoModal";
import FingersShowTask from "./FingersShowTask.jsx";
import FingersCountTask from "./FingersCountTask.jsx";
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
  // Cell skew lives on .col-slant (text only), not on the cell itself,
  // so the 44px cell boundary stays rectangular = aligns with the grid.
  return (
    <div className="col-expression">
      {topChars.map((ch, i) => <span key={`t${i}`} className="col-expr-cell"><span className="col-slant">{ch}</span></span>)}
      <span className="col-expr-cell col-expr-sign"><span className="col-slant">{sign}</span></span>
      {botChars.map((ch, i) => <span key={`b${i}`} className="col-expr-cell"><span className="col-slant">{ch}</span></span>)}
      <span className="col-expr-cell col-expr-eq"><span className="col-slant">=</span></span>
      {resultChars
        ? resultChars.map((ch, i) => (
            <span key={`r${i}`} className="col-expr-cell col-expr-result"><span className="col-slant">{ch}</span></span>
          ))
        : <span className="col-expr-cell col-expr-unknown"><span className="col-slant">?</span></span>
      }
    </div>
  );
}

// ── Toolbox (phase 1): phone-keyboard layout ─────────────────────────────────
// Row 1: 1 2 3 | Row 2: 4 5 6 | Row 3: 7 8 9 | Row 4: + 0 − | Row 5: [line]

function DigitToolbox({ onDragStart }) {
  return (
    <div className="col-keyboard">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
        <div key={d} className="col-kb-tile" onPointerDown={(e) => onDragStart(e, { type: "digit", digit: d })}>
          <span className="col-slant">{d}</span>
        </div>
      ))}
      <div className="col-kb-tile col-kb-sign" onPointerDown={(e) => onDragStart(e, { type: "sign", sign: "+" })}>
        <span className="col-slant">+</span>
      </div>
      <div className="col-kb-tile" onPointerDown={(e) => onDragStart(e, { type: "digit", digit: 0 })}>
        <span className="col-slant">0</span>
      </div>
      <div className="col-kb-tile col-kb-sign" onPointerDown={(e) => onDragStart(e, { type: "sign", sign: "−" })}>
        <span className="col-slant">−</span>
      </div>
      <div className="col-kb-line-tile" onPointerDown={(e) => onDragStart(e, { type: "line" })}>
        <div className="col-line-tile-bar" />
      </div>
    </div>
  );
}

// ── Result digit bank (phase 2): phone-keyboard digits only ──────────────────
// Row 1: 1 2 3 | Row 2: 4 5 6 | Row 3: 7 8 9 | Row 4: _ 0 _

function DigitBank({ onDragStart }) {
  return (
    <div className="col-keyboard">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
        <div key={d} className="col-kb-tile" onPointerDown={(e) => onDragStart(e, d)}>
          <span className="col-slant">{d}</span>
        </div>
      ))}
      <div className="col-kb-spacer" />
      <div className="col-kb-tile" onPointerDown={(e) => onDragStart(e, 0)}>
        <span className="col-slant">0</span>
      </div>
      <div className="col-kb-spacer" />
      <div className="col-kb-line-tile" style={{ visibility: "hidden", pointerEvents: "none" }} />
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

function ColumnGrid({ task, phase, topFilled, bottomFilled, signFilled, lineFilled, filledCells, activeStep, formActiveKey, shakeCell }) {
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
            formActiveKey === key && !filled ? "col-form-cell--active" : "",
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
  // gridRow:3 (bottom-number row) + translateY(-50%) → visual center sits on
  // the grid line between top and bottom rows without spanning into row 4.
  // Spanning into row 4 caused a 22px layout jump when the line was placed.
  if (phase === "form") {
    cells.push(
      <div
        key="sign"
        data-cell-key="sign"
        className={[
          "col-sign-cell",
          operation === "add" ? "col-sign--plus" : "col-sign--minus",
          formActiveKey === "sign" && !signFilled ? "col-sign-cell--active" : "",
          signFilled ? "col-sign-cell--filled" : "",
          shakeCell === "sign" ? "col-form-cell--shake" : "",
        ].filter(Boolean).join(" ")}
        style={{ gridColumn: "1 / 3", gridRow: 3 }}
      >
        {signFilled ? <span className="col-slant">{signFilled}</span> : ""}
      </div>
    );
  } else {
    cells.push(
      <div key="sign" className={["col-digit col-digit--sign", operation === "add" ? "col-sign--plus" : "col-sign--minus"].join(" ")} style={{ gridColumn: "1 / 3", gridRow: 3 }}>
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
            formActiveKey === key && !filled ? "col-form-cell--active" : "",
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
          formActiveKey === "line" && !lineFilled ? "col-line-placeholder--active" : "",
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

function ColumnArithmeticTask({ task, onCorrect }) {
  const [phase, setPhase] = useState("form");
  const [topFilled, setTopFilled] = useState({});
  const [bottomFilled, setBottomFilled] = useState({});
  const [signFilled, setSignFilled] = useState(null);
  const [lineFilled, setLineFilled] = useState(false);
  const [filledCells, setFilledCells] = useState({});
  const [stepIdx, setStepIdx] = useState(0);
  const [formStepIdx, setFormStepIdx] = useState(0);
  const [drag, setDrag] = useState(null);
  const [shakeCell, setShakeCell] = useState(null);
  const [solved, setSolved] = useState(false);

  const rootRef = useRef(null);
  const notebookRef = useRef(null);
  const dragRef = useRef(null);
  const formActiveRef = useRef(null);

  // Sequential form-fill order: top left→right, sign, bottom left→right, line.
  const formSteps = useMemo(() => {
    const positions = POSITIONS.slice(0, task.digits).reverse();
    const steps = [];
    for (const pos of positions) {
      steps.push({ cellKey: `top:${pos}`, value: task.columns[POS_INDEX[pos]].topDigit });
    }
    steps.push({ cellKey: "sign", value: task.operation === "add" ? "+" : "−" });
    for (const pos of positions) {
      steps.push({ cellKey: `bottom:${pos}`, value: task.columns[POS_INDEX[pos]].bottomDigit });
    }
    steps.push({ cellKey: "line", value: null });
    return steps;
  }, [task]);

  const formActiveStep = phase === "form" && formStepIdx < formSteps.length ? formSteps[formStepIdx] : null;
  const formActiveKey = formActiveStep?.cellKey ?? null;

  const activeStep = phase === "solve" && stepIdx < task.steps.length ? task.steps[stepIdx] : null;

  // Keep ref in sync so startDrag closure always reads the current formActiveStep.
  formActiveRef.current = formActiveStep;

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
  // Also depend on phase and lineFilled: when phase changes the toolbox
  // switches (DigitToolbox → DigitBank), changing total content height in the
  // flex-centered screen → notebook repositions → background must recalculate.
  }, [task.top, task.bottom, task.operation, solved, phase]);

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

      const step = formActiveRef.current;
      if (!step) return; // all form steps done, phase transitioning

      const activeKey = step.cellKey;
      const cellKey = findCellUnderPointer(ev.clientX, ev.clientY);

      // Released in empty space — silent cancel, not an error
      if (!cellKey) return;
      // Wrong cell → shake to guide and count as error
      if (cellKey !== activeKey) {
        triggerShake(activeKey);
        return;
      }

      // Check value matches expected
      const ok = activeKey === "line"
        ? info.type === "line"
        : activeKey === "sign"
          ? info.type === "sign" && info.sign === step.value
          : info.type === "digit" && info.digit === step.value;

      if (!ok) {
        triggerShake(activeKey);
        return;
      }

      // Apply fill
      if (activeKey.startsWith("top:")) {
        setTopFilled((prev) => ({ ...prev, [activeKey.split(":")[1]]: info.digit }));
      } else if (activeKey.startsWith("bottom:")) {
        setBottomFilled((prev) => ({ ...prev, [activeKey.split(":")[1]]: info.digit }));
      } else if (activeKey === "sign") {
        setSignFilled(info.sign);
      } else if (activeKey === "line") {
        setLineFilled(true);
      }
      setFormStepIdx((prev) => prev + 1);
    };

    const onCancel = () => {
      el.removeEventListener("pointermove", onMove);
      dragRef.current = null;
      setDrag(null);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp, { once: true });
    el.addEventListener("pointercancel", onCancel, { once: true });
  }, [findCellUnderPointer, triggerShake]);

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
        hadErrorRef.current = true;
        if (onMistake) onMistake();
        return;
      }

      setFilledCells((prev) => ({ ...prev, [cellKey]: droppedDigit }));
      const next = stepIdx + 1;
      setStepIdx(next);
      if (next >= task.steps.length) {
        setSolved(true);
        setTimeout(() => onCorrect?.(), 1200);
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
  }, [activeStep, stepIdx, task.steps, findCellUnderPointer, triggerShake, onCorrect]);

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
          formActiveKey={formActiveKey}
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

// ── Copy mode (column_copy) ───────────────────────────────────────────────────

function ColumnCopyView({ sessionParams, onCorrect, student }) {
  const count     = Number(sessionParams?.count     ?? 6);
  const operation = sessionParams?.operation ?? "mixed";
  const carryMode = sessionParams?.carryMode ?? "none";
  const digits    = Number(sessionParams?.digits    ?? 2);

  const screenRef = useRef(null);
  const listRef   = useRef(null);
  const activeRef = useRef(null);

  const [examples,    setExamples]    = useState(() => generateExamples(count, { operation, carryMode, digits }));
  const [activeIdx,   setActiveIdx]   = useState(0);
  const [solved,      setSolved]      = useState({});
  const [input,       setInput]       = useState([]);
  const [shake,       setShake]       = useState(false);
  const [showReward,  setShowReward]  = useState(false);

  // Align background grid with first cell left edge
  useLayoutEffect(() => {
    const screen = screenRef.current;
    const list   = listRef.current;
    if (!screen || !list) return;
    const sr = screen.getBoundingClientRect();
    const lr = list.getBoundingClientRect();
    screen.style.backgroundPosition = `${(lr.left - sr.left) % 44}px ${(lr.top - sr.top) % 44}px`;
  }, [examples]);

  // Scroll active row into view when it changes
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIdx]);

  const activeEx = examples[activeIdx] ?? null;
  const correctResult = activeEx
    ? (activeEx.operation === "add" ? activeEx.top + activeEx.bottom : activeEx.top - activeEx.bottom)
    : null;
  const resultStr = correctResult !== null ? String(correctResult) : "";

  function handleDigit(d) {
    if (!activeEx || shake) return;
    const next = [...input, String(d)];
    if (next.length < resultStr.length) { setInput(next); return; }
    // Last digit — auto-check
    if (Number(next.join("")) === correctResult) {
      setSolved(prev => ({ ...prev, [activeIdx]: true }));
      setInput([]);
      if (activeIdx + 1 < examples.length) {
        setActiveIdx(activeIdx + 1);
      } else {
        setTimeout(() => setShowReward(true), 400);
      }
    } else {
      setShake(true);
      setTimeout(() => { setShake(false); setInput([]); }, 500);
    }
  }

  function handleDelete() {
    if (shake) return;
    setInput(prev => prev.slice(0, -1));
  }

  function refresh() {
    setExamples(generateExamples(count, { operation, carryMode, digits }));
    setActiveIdx(0);
    setSolved({});
    setInput([]);
    setShake(false);
    setShowReward(false);
  }

  return (
    <div className="col-screen col-copy-screen" ref={screenRef}>
      <div className="col-copy-list" ref={listRef}>
        {examples.map((ex, i) => {
          const res    = ex.operation === "add" ? ex.top + ex.bottom : ex.top - ex.bottom;
          const resStr = String(res);
          const sign   = ex.operation === "add" ? "+" : "−";
          const isActive  = i === activeIdx;
          const isSolved  = !!solved[i];

          return (
            <div key={i} ref={isActive ? activeRef : null} className="col-copy-expr-row">
              {String(ex.top).split("").map((ch, j) => (
                <span key={j} className="col-expr-cell"><span className="col-slant">{ch}</span></span>
              ))}
              <span className="col-expr-cell col-expr-sign"><span className="col-slant">{sign}</span></span>
              {String(ex.bottom).split("").map((ch, j) => (
                <span key={`b${j}`} className="col-expr-cell"><span className="col-slant">{ch}</span></span>
              ))}
              <span className="col-expr-cell col-expr-eq"><span className="col-slant">=</span></span>
              {isSolved ? (
                resStr.split("").map((ch, j) => (
                  <span key={`r${j}`} className="col-expr-cell col-copy-cell-ok">
                    <span className="col-slant">{ch}</span>
                  </span>
                ))
              ) : isActive ? (
                resStr.split("").map((_, j) => (
                  <span key={`inp${j}`} className={`col-expr-cell col-copy-cell-input${shake ? " col-copy-cell-shake" : ""}`}>
                    {input[j] != null ? <span className="col-slant">{input[j]}</span> : null}
                  </span>
                ))
              ) : (
                resStr.split("").map((_, j) => (
                  <span key={`w${j}`} className="col-expr-cell col-copy-cell-wait" />
                ))
              )}
            </div>
          );
        })}
      </div>

      {showReward && (
        <RewardVideoModal
          rewardVideos={student?.rewardVideos ?? []}
          studentId={student?.id}
          onDismiss={() => { setShowReward(false); onCorrect?.(); }}
        />
      )}

      <div className="col-copy-keyboard">
        {[1,2,3,4,5,6,7,8,9].map(d => (
          <button key={d} className="col-copy-kb-btn" onClick={() => handleDigit(d)}>
            <span className="col-slant">{d}</span>
          </button>
        ))}
        <button className="col-copy-kb-btn col-copy-kb-del" onClick={handleDelete}>⌫</button>
        <button className="col-copy-kb-btn" onClick={() => handleDigit(0)}>
          <span className="col-slant">0</span>
        </button>
        <button className="col-copy-kb-btn col-copy-kb-refresh" onClick={refresh}>↻</button>
      </div>
    </div>
  );
}

// ── Renderer entry point ──────────────────────────────────────────────────────

export default function ColumnAdditionRenderer({ task, mode, sessionParams, onCorrect, onPrevious, student }) {
  if (mode?.type === "column_copy") {
    return <ColumnCopyView sessionParams={sessionParams} onCorrect={onCorrect} student={student} />;
  }
  if (task?.type === "fingers_show") {
    return <FingersShowTask task={task} sessionParams={sessionParams} onCorrect={onCorrect} onPrevious={onPrevious} />;
  }
  if (task?.type === "fingers_count") {
    return <FingersCountTask task={task} onCorrect={onCorrect} />;
  }
  if (!task || task.type !== "column_arithmetic") {
    return <div className="col-screen" style={{ color: "#666", fontSize: 18 }}>Нет задания</div>;
  }
  return (
    <ColumnArithmeticTask
      key={`${task.cardId}-${task.top}-${task.bottom}-${task.operation}`}
      task={task}
      onCorrect={onCorrect}
    />
  );
}
