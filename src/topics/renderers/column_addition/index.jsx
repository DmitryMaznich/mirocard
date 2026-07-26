import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { generateExamples, taskNeedsBorrowTeaching, resolveCompareMode } from "./engine.js";
import RewardVideoModal from "@/shared/components/RewardVideoModal";
import FingersShowTask from "./FingersShowTask.jsx";
import FingersCountTask from "./FingersCountTask.jsx";
import BuildNumberTask from "./BuildNumberTask.jsx";
import IdentifyNumberTask from "./IdentifyNumberTask.jsx";
import RegroupTenTask from "./RegroupTenTask.jsx";
import CrossoutGesture from "./CrossoutGesture.jsx";
import HelperPanel from "../addition_subtraction/HelperPanel.jsx";
import DigitKeypad from "./DigitKeypad.jsx";
import { useTapButtonSize } from "./useTapButtonSize.js";
import "./column_addition.css";

const POSITIONS = ["units", "tens", "hundreds"];
const POS_INDEX = { units: 0, tens: 1, hundreds: 2 };

function getDigitAt(n, position) {
  return Math.floor(n / 10 ** POS_INDEX[position]) % 10;
}

// ── Expression header ─────────────────────────────────────────────────────────

function Expression({ task, result, cellSize = 44 }) {
  const sign = task.operation === "add" ? "+" : "−";
  const topChars = String(task.top).split("");
  const botChars = String(task.bottom).split("");
  const resultChars = result !== null && result !== undefined ? String(result).split("") : null;
  const cs = cellSize + "px";
  const pt = Math.round(cellSize * 0.5) + "px";
  const fs = Math.round(cellSize * 1.14) + "px";
  const cellStyle = { width: cs, height: cs, paddingTop: pt, fontSize: fs };
  return (
    <div className="col-expression" style={{ gridAutoColumns: cs, height: cs }}>
      {topChars.map((ch, i) => (
        <span key={`t${i}`} className="col-expr-cell" style={cellStyle}><span className="col-slant">{ch}</span></span>
      ))}
      <span className="col-expr-cell col-expr-sign" style={cellStyle}><span className="col-slant">{sign}</span></span>
      {botChars.map((ch, i) => (
        <span key={`b${i}`} className="col-expr-cell" style={cellStyle}><span className="col-slant">{ch}</span></span>
      ))}
      <span className="col-expr-cell col-expr-eq" style={cellStyle}><span className="col-slant">=</span></span>
      {resultChars
        ? resultChars.map((ch, i) => (
            <span key={`r${i}`} className="col-expr-cell col-expr-result" style={cellStyle}><span className="col-slant">{ch}</span></span>
          ))
        : <span className="col-expr-cell col-expr-unknown" style={cellStyle}><span className="col-slant">?</span></span>
      }
    </div>
  );
}

// ── Compact tap keyboard ──────────────────────────────────────────────────────
// Rows: [1-5] / [6-0] / phase1: [sign+][sign−][line]  phase2: [helper toggle]

function TapKeyboard({ phase, operation, onDigit, onSign, onLine, btnSize, hidden }) {
  const bs = useTapButtonSize(btnSize);
  const bsStr = bs + "px";
  const signFS = Math.round(bs * 0.85) + "px";
  const signStyle = { width: bsStr, height: bsStr, fontSize: signFS };
  const correctSign = operation === "add" ? "+" : "−";
  const wrongSign = operation === "add" ? "−" : "+";

  return (
    <div className="col-tap-kb" style={hidden ? { visibility: "hidden", pointerEvents: "none" } : undefined}>
      <DigitKeypad onDigit={onDigit} bs={bs} />
      <div
        className="col-tap-row col-tap-row--form"
        style={phase !== "form" ? { visibility: "hidden", pointerEvents: "none" } : undefined}
      >
        <button className="col-tap-btn col-tap-btn--sign" style={signStyle} onClick={() => onSign(correctSign)}>
          <span className="col-slant">{correctSign}</span>
        </button>
        <button className="col-tap-btn col-tap-btn--sign-dim" style={signStyle} onClick={() => onSign(wrongSign)}>
          <span className="col-slant">{wrongSign}</span>
        </button>
        <button className="col-tap-btn col-tap-btn--line" style={{ height: bsStr, flex: 1 }} onClick={onLine}>
          <div className="col-line-tile-bar" />
        </button>
      </div>
    </div>
  );
}

// ── Borrow comparison strip ───────────────────────────────────────────────
// Shown under the column, gated by the "Сравнение" param, right before the
// child is expected to fill a "borrow" step. Reuses the same tap-a-sign
// interaction as the "Сравнение чисел" topic's ComparePutSign, scaled down.
// The child's own answer is what unlocks the borrow square below — nothing
// here is decided for them.

function BorrowCompareStrip({ topDigit, bottomDigit, onResolve }) {
  const [shakeSign, setShakeSign] = useState(null);
  const correctSign = topDigit < bottomDigit ? "<" : topDigit > bottomDigit ? ">" : "=";

  function handleTap(sign) {
    if (sign !== correctSign) {
      setShakeSign(sign);
      setTimeout(() => setShakeSign(null), 400);
      return;
    }
    onResolve();
  }

  return (
    <div className="col-borrow-compare">
      <div className="col-borrow-compare-expr">
        <span className="col-slant">{topDigit}</span>
        <span className="col-borrow-compare-blank">?</span>
        <span className="col-slant">{bottomDigit}</span>
      </div>
      <div className="col-borrow-compare-btns">
        {["<", ">", "="].map((sign) => (
          <button
            key={sign}
            className={["col-borrow-compare-btn", shakeSign === sign ? "col-borrow-compare-btn--shake" : ""].filter(Boolean).join(" ")}
            onClick={() => handleTap(sign)}
          >
            <span className="col-slant">{sign}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Column grid ───────────────────────────────────────────────────────────────

function ColumnGrid({ task, phase, topFilled, bottomFilled, signFilled, lineFilled, filledCells, activeStep, formActiveKey, shakeCell, cellSize = 44, crossoutPaths = {}, onCrossoutComplete }) {
  const { digits, operation } = task;
  const totalCols = digits + 2;
  const cells = [];

  const cs = cellSize;
  const csStr = cs + "px";
  const carryH = Math.max(20, Math.round(cs * 0.59)) + "px";
  const carryW = Math.max(22, Math.round(cs * 0.64)) + "px";
  const carryFS = Math.max(12, Math.round(cs * 0.36)) + "px";
  const digitPT = Math.round(cs * 0.45) + "px";
  const digitFS = Math.round(cs * 1.02) + "px";
  const signFS = Math.round(cs * 1.14) + "px";

  const digitStyle = { width: csStr, height: csStr, paddingTop: digitPT, fontSize: digitFS };
  const signCellStyle = { width: csStr, height: csStr, fontSize: signFS };
  const formCellStyle = { width: csStr, height: csStr, paddingTop: digitPT, fontSize: digitFS };
  const resultCellStyle = { width: csStr, height: csStr, paddingTop: digitPT, fontSize: digitFS };
  const carryStyle = { width: carryW, height: carryH, fontSize: carryFS };

  // ── Carry / borrow / adjust row (phase 2 only) ───────────────────────────
  // Driven directly by whichever aux steps exist in task.steps, rather than a
  // fixed position range — this is what lets "borrow" (now at the receiving
  // column) and "adjust" (at the source column) coexist without assuming
  // where either one lives.
  if (phase === "solve") {
    const auxSteps = task.steps.filter(
      (s) => s.cellType === "carry" || s.cellType === "borrow" || s.cellType === "adjust"
    );
    for (const step of auxSteps) {
      const i = POS_INDEX[step.position];
      const gridCol = digits + 2 - i;
      const key = `${step.cellType}:${step.position}`;
      const filled = filledCells[key] !== undefined;
      const active = activeStep?.cellType === step.cellType && activeStep?.position === step.position;
      cells.push(
        <div
          key={`aux:${key}`}
          data-cell-key={key}
          className={[
            "col-carry-cell",
            active ? "col-carry-cell--active" : "",
            filled ? "col-carry-cell--filled" : "",
          ].filter(Boolean).join(" ")}
          style={{ ...carryStyle, gridColumn: gridCol, gridRow: 1 }}
        >
          {filled ? <span className="col-slant">{filledCells[key]}</span> : ""}
        </div>
      );
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
          style={{ ...formCellStyle, gridColumn: gridCol, gridRow: 2 }}
        >
          {filled ? <span className="col-slant">{topFilled[pos]}</span> : ""}
        </div>
      );
    } else {
      // The digit that gets crossed out is the SOURCE of a borrow — its own
      // "crossout" step (same position as "adjust") is what marks it, once
      // the child's own swipe gesture has completed. No more deriving this
      // from the lower column's borrow cell — the gesture is its own step.
      const crossoutKey = `crossout:${pos}`;
      const wasBorrowedFrom = operation === "subtract" && filledCells[crossoutKey] !== undefined;
      const isCrossoutActive =
        operation === "subtract" &&
        activeStep?.cellType === "crossout" &&
        activeStep?.position === pos;
      const adjustKey = `adjust:${pos}`;
      const adjustFilled = wasBorrowedFrom && filledCells[adjustKey] !== undefined;
      cells.push(
        <div
          key={`top:${pos}`}
          className={["col-digit", wasBorrowedFrom ? "col-digit--top-borrowed" : ""].filter(Boolean).join(" ")}
          style={{ ...digitStyle, gridColumn: gridCol, gridRow: 2 }}
        >
          {col.topDigit}
          {adjustFilled && <span className="col-digit-adjusted">{filledCells[adjustKey]}</span>}
          {isCrossoutActive && (
            <CrossoutGesture cellWidth={cs} cellHeight={cs} onComplete={onCrossoutComplete} />
          )}
          {wasBorrowedFrom && crossoutPaths[pos] && (
            <svg className="col-crossout-mark" width={cs} height={cs}>
              <path
                d={crossoutPaths[pos]}
                fill="none"
                stroke="#ef4444"
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      );
    }
  }

  // ── Sign cell ─────────────────────────────────────────────────────────────
  // gridRow:3 (bottom-number row) + translateY(-50%) → visual center sits on
  // the grid line between top and bottom rows without spanning into row 4.
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
        style={{ ...signCellStyle, gridColumn: "1 / 3", gridRow: 3 }}
      >
        {signFilled ? <span className="col-slant">{signFilled}</span> : ""}
      </div>
    );
  } else {
    cells.push(
      <div
        key="sign"
        className={["col-digit col-digit--sign", operation === "add" ? "col-sign--plus" : "col-sign--minus"].join(" ")}
        style={{ ...signCellStyle, gridColumn: "1 / 3", gridRow: 3, paddingTop: 0 }}
      >
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
          style={{ ...formCellStyle, gridColumn: gridCol, gridRow: 3 }}
        >
          {filled ? <span className="col-slant">{bottomFilled[pos]}</span> : ""}
        </div>
      );
    } else {
      cells.push(
        <div
          key={`bot:${pos}`}
          className="col-digit"
          style={{ ...digitStyle, gridColumn: gridCol, gridRow: 3 }}
        >
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
          style={{ ...resultCellStyle, gridColumn: gridCol, gridRow: 5 }}
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
          style={{ ...resultCellStyle, gridColumn: 2, gridRow: 5 }}
        >
          {filled ? <span className="col-slant">{filledCells[key]}</span> : lastCol.carryOut}
        </div>
      );
    }
  }

  return (
    <div
      className="col-problem"
      style={{
        gridTemplateColumns: `repeat(${totalCols}, ${csStr})`,
        gridTemplateRows: `${csStr} ${csStr} ${csStr} 3px ${csStr}`,
      }}
    >
      {cells}
    </div>
  );
}

// ── Main task component ───────────────────────────────────────────────────────

function ColumnArithmeticTask({ task, onCorrect, onMistake, sessionParams }) {
  const [phase, setPhase] = useState("form");
  const [topFilled, setTopFilled] = useState({});
  const [bottomFilled, setBottomFilled] = useState({});
  const [signFilled, setSignFilled] = useState(null);
  const [lineFilled, setLineFilled] = useState(false);
  const [filledCells, setFilledCells] = useState({});
  const [stepIdx, setStepIdx] = useState(0);
  const [formStepIdx, setFormStepIdx] = useState(0);
  const [shakeCell, setShakeCell] = useState(null);
  const [solved, setSolved] = useState(false);
  const [resolvedCompares, setResolvedCompares] = useState(new Set());
  const [crossoutPaths, setCrossoutPaths] = useState({});
  const [showHelper, setShowHelper] = useState(false);
  const [cellSize, setCellSize] = useState(44);

  const rootRef = useRef(null);
  const notebookRef = useRef(null);

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

  // Compute adaptive cell and button sizes after layout.
  // Single cellSize used for both expression and column grid so both snap to the same grid.
  // Constrained by the expression width: top_digits + sign + bottom_digits + eq + result_digits.
  useLayoutEffect(() => {
    function compute() {
      if (!rootRef.current) return;
      const w = rootRef.current.clientWidth;
      const avail = w - 32;
      const digits = task.digits;
      const resultDigits = String(task.result).length;
      const exprCols = 2 * digits + 2 + resultDigits;
      const cs = Math.min(52, Math.max(28, Math.floor(avail / exprCols)));
      setCellSize(cs);
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [task.digits, task.result]);

  // Align full-screen background grid with notebook cell boundaries.
  useLayoutEffect(() => {
    const screen = rootRef.current;
    const notebook = notebookRef.current;
    if (!screen || !notebook) return;
    const cs = cellSize;
    screen.style.backgroundSize = `${cs}px ${cs}px`;
    const sr = screen.getBoundingClientRect();
    const nr = notebook.getBoundingClientRect();
    const offX = ((nr.left - sr.left) % cs + cs) % cs;
    const offY = ((nr.top - sr.top) % cs + cs) % cs;
    screen.style.backgroundPosition = `${offX}px ${offY}px`;
  }, [cellSize, phase, solved]);

  useEffect(() => {
    setPhase("form");
    setTopFilled({});
    setBottomFilled({});
    setSignFilled(null);
    setLineFilled(false);
    setFilledCells({});
    setStepIdx(0);
    setFormStepIdx(0);
    setShakeCell(null);
    setSolved(false);
    setResolvedCompares(new Set());
    setCrossoutPaths({});
  }, [task.cardId, task.top, task.bottom, task.operation]);

  // Advance to phase 2 when column fully built.
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

  // ── Phase 1 tap handler ───────────────────────────────────────────────────

  const handleFormTap = useCallback((value, type) => {
    const step = formActiveStep;
    if (!step) return;

    const ok = step.cellKey === "line"
      ? type === "line"
      : step.cellKey === "sign"
        ? type === "sign" && value === step.value
        : type === "digit" && Number(value) === step.value;

    if (!ok) {
      triggerShake(step.cellKey);
      onMistake?.();
      return;
    }

    const key = step.cellKey;
    if (key.startsWith("top:")) {
      setTopFilled((prev) => ({ ...prev, [key.split(":")[1]]: Number(value) }));
    } else if (key.startsWith("bottom:")) {
      setBottomFilled((prev) => ({ ...prev, [key.split(":")[1]]: Number(value) }));
    } else if (key === "sign") {
      setSignFilled(value);
    } else if (key === "line") {
      setLineFilled(true);
    }
    setFormStepIdx((prev) => prev + 1);
  }, [formActiveStep, triggerShake, onMistake]);

  // ── Phase 2 tap handler ───────────────────────────────────────────────────

  const handleSolveTap = useCallback((digit) => {
    if (!activeStep) return;
    if (Number(digit) !== activeStep.digit) {
      triggerShake(`${activeStep.cellType}:${activeStep.position}`);
      onMistake?.();
      return;
    }
    const key = `${activeStep.cellType}:${activeStep.position}`;
    setFilledCells((prev) => ({ ...prev, [key]: digit }));
    const next = stepIdx + 1;
    setStepIdx(next);
    if (next >= task.steps.length) {
      setSolved(true);
      setTimeout(() => onCorrect?.(), 1200);
    }
  }, [activeStep, stepIdx, task.steps, triggerShake, onMistake, onCorrect]);

  const handleCrossoutComplete = useCallback((pathD) => {
    if (!activeStep || activeStep.cellType !== "crossout") return;
    const key = `${activeStep.cellType}:${activeStep.position}`;
    setCrossoutPaths((prev) => ({ ...prev, [activeStep.position]: pathD }));
    setFilledCells((prev) => ({ ...prev, [key]: true }));
    const next = stepIdx + 1;
    setStepIdx(next);
    if (next >= task.steps.length) {
      setSolved(true);
      setTimeout(() => onCorrect?.(), 1200);
    }
  }, [activeStep, stepIdx, task.steps, onCorrect]);

  const compareMode = resolveCompareMode(sessionParams);
  const showingCompare =
    phase === "solve" &&
    activeStep?.cellType === "borrow" &&
    compareMode !== "off" &&
    taskNeedsBorrowTeaching(task) &&
    !resolvedCompares.has(activeStep.position);

  const compareColumn = showingCompare ? task.columns[POS_INDEX[activeStep.position]] : null;

  const showingCrossout = phase === "solve" && activeStep?.cellType === "crossout";

  return (
    <div className="col-screen" ref={rootRef}>
      <div className="col-notebook" ref={notebookRef} style={{ gap: `${2 * cellSize}px` }}>
        <Expression task={task} result={solved ? task.result : null} cellSize={cellSize} />
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
          cellSize={cellSize}
          crossoutPaths={crossoutPaths}
          onCrossoutComplete={handleCrossoutComplete}
        />
      </div>

      {showHelper && (
        <div className="col-helper-area">
          <HelperPanel maxNumber={20} showMoveHint={false} onClose={() => setShowHelper(false)} />
        </div>
      )}

      {/* TapKeyboard stays mounted (just visually hidden) whenever the compare
          strip or the crossout gesture takes over — this reserves its exact
          footprint so the column above never reflows when .col-screen
          re-centers its flex content. BorrowCompareStrip overlays on top of
          that reserved space instead of adding its own. */}
      <div className="col-controls-area">
        <TapKeyboard
          phase={phase}
          operation={task.operation}
          onDigit={(d) => phase === "form" ? handleFormTap(d, "digit") : handleSolveTap(d)}
          onSign={(s) => handleFormTap(s, "sign")}
          onLine={() => handleFormTap(null, "line")}
          btnSize={cellSize}
          hidden={showingCompare || showingCrossout}
        />
        {showingCompare && compareColumn && (
          <BorrowCompareStrip
            topDigit={compareColumn.compareTopDigit}
            bottomDigit={compareColumn.bottomDigit}
            onResolve={() => setResolvedCompares((prev) => new Set(prev).add(activeStep.position))}
          />
        )}
      </div>

      {!showHelper && !showingCompare && !showingCrossout && !!sessionParams?.showHelper && (
        <button
          type="button"
          className="helper-toggle-btn"
          onClick={() => setShowHelper(true)}
          aria-label="Открыть помощник"
        >
          🧮
        </button>
      )}
    </div>
  );
}

// ── Copy mode numpad (5+5+controls) ──────────────────────────────────────────

function CopyKeyboard({ cellSize, onDigit, onDelete, onRefresh }) {
  const bs        = cellSize;
  const bsStr     = bs + "px";
  const digitFS   = Math.round(bs * 0.72) + "px";
  const iconFS    = Math.round(bs * 0.55) + "px";
  const digitStyle = { width: bsStr, height: bsStr, fontSize: digitFS };
  const ctrlH     = { height: bsStr, fontSize: iconFS };

  return (
    <div className="col-tap-kb">
      <div className="col-tap-row">
        {[1, 2, 3, 4, 5].map((d) => (
          <button key={d} className="col-tap-btn" style={digitStyle} onClick={() => onDigit(d)}>
            <span className="col-slant">{d}</span>
          </button>
        ))}
      </div>
      <div className="col-tap-row">
        {[6, 7, 8, 9, 0].map((d) => (
          <button key={d} className="col-tap-btn" style={digitStyle} onClick={() => onDigit(d)}>
            <span className="col-slant">{d}</span>
          </button>
        ))}
      </div>
      <div className="col-tap-row">
        <button className="col-tap-btn col-copy-kb-del"     style={{ ...ctrlH, flex: 3 }} onClick={onDelete}>⌫</button>
        <button className="col-tap-btn col-copy-kb-refresh" style={{ ...ctrlH, flex: 2 }} onClick={onRefresh}>↻</button>
      </div>
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

  const [examples,   setExamples]   = useState(() => generateExamples(count, { operation, carryMode, digits }));
  const [activeIdx,  setActiveIdx]  = useState(0);
  const [solved,     setSolved]     = useState({});
  const [input,      setInput]      = useState([]);
  const [shake,      setShake]      = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [cellSize,   setCellSize]   = useState(44);

  // Adaptive sizing: fit expression width AND all rows within screen height
  useLayoutEffect(() => {
    function compute() {
      if (!screenRef.current) return;
      const w = screenRef.current.clientWidth;
      const h = screenRef.current.clientHeight;
      // Expression: top_digits + sign + bottom_digits + eq + (digits+1 result digits)
      const exprCols = 3 * digits + 3;
      const cs_w = Math.min(52, Math.max(20, Math.floor((w - 32) / exprCols)));
      // Height: count rows + (count-1) gap rows (each = cs) + keyboard 3 rows + overhead ~80px
      // Total cs rows = count + (count-1) + 3 = 2*count + 2
      const cs_h = Math.floor((h - 80) / (2 * count + 2));
      setCellSize(Math.min(cs_w, Math.max(20, cs_h)));
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [digits, count]);

  // Background grid alignment
  useLayoutEffect(() => {
    const screen = screenRef.current;
    const list   = listRef.current;
    if (!screen || !list) return;
    const cs = cellSize;
    screen.style.backgroundSize = `${cs}px ${cs}px`;
    const sr = screen.getBoundingClientRect();
    const lr = list.getBoundingClientRect();
    const offX = ((lr.left - sr.left) % cs + cs) % cs;
    const offY = ((lr.top  - sr.top)  % cs + cs) % cs;
    screen.style.backgroundPosition = `${offX}px ${offY}px`;
  }, [cellSize, examples]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIdx]);

  const activeEx      = examples[activeIdx] ?? null;
  const correctResult = activeEx
    ? (activeEx.operation === "add" ? activeEx.top + activeEx.bottom : activeEx.top - activeEx.bottom)
    : null;
  const resultStr = correctResult !== null ? String(correctResult) : "";

  function handleDigit(d) {
    if (!activeEx || shake) return;
    const next = [...input, String(d)];
    if (next.length < resultStr.length) { setInput(next); return; }
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

  // Stable identity so a re-render of this view while the reward video is
  // showing doesn't hand RewardVideoModal a new onDismiss every time.
  const handleRewardDismiss = useCallback(() => {
    setShowReward(false);
    onCorrect?.();
  }, [onCorrect]);

  const cs      = cellSize;
  const csStr   = cs + "px";
  const pt      = Math.round(cs * 0.5) + "px";
  const fs      = Math.round(cs * 1.14) + "px";
  const cellSty = { width: csStr, height: csStr, paddingTop: pt, fontSize: fs };

  return (
    <div className="col-screen col-copy-screen" ref={screenRef}>
      <div className="col-copy-list" ref={listRef} style={{ gap: `${cellSize}px` }}>
        {examples.map((ex, i) => {
          const res      = ex.operation === "add" ? ex.top + ex.bottom : ex.top - ex.bottom;
          const resStr   = String(res);
          const sign     = ex.operation === "add" ? "+" : "−";
          const isActive = i === activeIdx;
          const isSolved = !!solved[i];

          return (
            <div key={i} ref={isActive ? activeRef : null} className="col-copy-expr-row">
              {String(ex.top).split("").map((ch, j) => (
                <span key={j} className="col-expr-cell" style={cellSty}><span className="col-slant">{ch}</span></span>
              ))}
              <span className="col-expr-cell col-expr-sign" style={cellSty}><span className="col-slant">{sign}</span></span>
              {String(ex.bottom).split("").map((ch, j) => (
                <span key={`b${j}`} className="col-expr-cell" style={cellSty}><span className="col-slant">{ch}</span></span>
              ))}
              <span className="col-expr-cell col-expr-eq" style={cellSty}><span className="col-slant">=</span></span>
              {isSolved ? (
                resStr.split("").map((ch, j) => (
                  <span key={`r${j}`} className="col-expr-cell col-copy-cell-ok" style={cellSty}>
                    <span className="col-slant">{ch}</span>
                  </span>
                ))
              ) : isActive ? (
                resStr.split("").map((_, j) => (
                  <span key={`inp${j}`} className={`col-expr-cell col-copy-cell-input${shake ? " col-copy-cell-shake" : ""}`} style={cellSty}>
                    {input[j] != null ? <span className="col-slant">{input[j]}</span> : null}
                  </span>
                ))
              ) : (
                resStr.split("").map((_, j) => (
                  <span key={`w${j}`} className="col-expr-cell col-copy-cell-wait" style={cellSty} />
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
          onDismiss={handleRewardDismiss}
        />
      )}

      <CopyKeyboard cellSize={cellSize} onDigit={handleDigit} onDelete={handleDelete} onRefresh={refresh} />
    </div>
  );
}

// ── Renderer entry point ──────────────────────────────────────────────────────

export default function ColumnAdditionRenderer({ task, mode, sessionParams, onCorrect, onPrevious, student, onMistake, onFlashIncorrect }) {
  const strictMistake = sessionParams?.strictStars ? onMistake : undefined;
  if (mode?.type === "column_copy") {
    return <ColumnCopyView sessionParams={sessionParams} onCorrect={onCorrect} student={student} />;
  }
  if (task?.type === "fingers_show") {
    return <FingersShowTask task={task} sessionParams={sessionParams} onCorrect={onCorrect} onPrevious={onPrevious} />;
  }
  if (task?.type === "fingers_count") {
    return <FingersCountTask task={task} onCorrect={onCorrect} onMistake={strictMistake} onFlashIncorrect={onFlashIncorrect} />;
  }
  if (task?.type === "build_number") {
    return (
      <BuildNumberTask
        key={`${task.cardId}-${task.number}`}
        task={task}
        onCorrect={onCorrect}
        onMistake={strictMistake}
        onFlashIncorrect={onFlashIncorrect}
      />
    );
  }
  if (task?.type === "identify_number") {
    return (
      <IdentifyNumberTask
        key={`${task.cardId}-${task.number}`}
        task={task}
        onCorrect={onCorrect}
        onMistake={strictMistake}
        onFlashIncorrect={onFlashIncorrect}
      />
    );
  }
  if (task?.type === "regroup_ten") {
    return (
      <RegroupTenTask
        key={`${task.cardId}-${task.number}`}
        task={task}
        onCorrect={onCorrect}
        onMistake={strictMistake}
      />
    );
  }
  if (!task || task.type !== "column_arithmetic") {
    return <div className="col-screen" style={{ color: "#666", fontSize: 18 }}>Нет задания</div>;
  }
  return (
    <ColumnArithmeticTask
      key={`${task.cardId}-${task.top}-${task.bottom}-${task.operation}`}
      task={task}
      onCorrect={onCorrect}
      onMistake={strictMistake}
      sessionParams={sessionParams}
    />
  );
}
