import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { COPY_KINDS, columnTaskOfExample, generateCopySheet, taskNeedsBorrowTeaching, resolveCompareMode } from "./engine.js";
import RewardVideoModal from "@/shared/components/RewardVideoModal";
import CrossoutGesture from "./CrossoutGesture.jsx";
import HelperPanel from "../addition_subtraction/HelperPanel.jsx";
import DigitKeypad from "./DigitKeypad.jsx";
import ColumnHints from "./ColumnHints.jsx";
import FindErrorTask from "./FindErrorTask.jsx";
import { useTapButtonSize } from "./useTapButtonSize.js";
import "./tapKeyboard.css";
import "./column_addition.css";

const POSITIONS = ["units", "tens", "hundreds"];
const POS_INDEX = { units: 0, tens: 1, hundreds: 2 };

// The notebook (Expression + ColumnGrid) and the compare panel render
// larger than the tap keyboard, which stays at today's size — see
// ColumnArithmeticTask's cellSize/gridBaseSize computation below.
const GRID_SCALE = 1.3;
const PANEL_SCALE = 1.5;
// Tap keyboard sizing budget: a fixed 5-button row plus a bit of breathing
// room, independent of how many digits/result columns the current problem
// happens to have — the keyboard is always 5 keys wide regardless of
// whether the task is 2-digit or 3-digit, so its size shouldn't be either.
const KEYBOARD_COLS = 6;
const COLUMN_HINTS_SEEN_KEY = "mirocard:column-arithmetic-hints:v1";

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

// ── Column compare panel ────────────────────────────────────────────────
// Sits to the right of the column (absolutely positioned inside
// .col-problem, rendered from ColumnGrid below), vertically centered on
// the digit rows via the `top` prop. Shown whenever "Сравнение"
// (compareMode) requires the child to judge whether this column needs a
// заём — gating logic lives entirely in ColumnArithmeticTask's
// showingCompare/showingCompareAlways, unchanged by this component.
// The two digits it refers to are highlighted directly in the column
// (.col-digit--comparing, same purple) instead of being repeated as text
// here. The tail is a fixed part of the panel (CSS ::before), not a line
// drawn to the specific column — the active column's distance from the
// panel varies (units/tens/hundreds), so the shared purple color is what
// ties panel and digits together, not a measured connector.

function ColumnComparePanel({ topDigit, bottomDigit, onResolve, top, panelCellSize = 66 }) {
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

  // Ratios reproduce today's fixed 38px/16px/8px-10px/6px/12px/18px values
  // at panelCellSize=66 (gridBaseSize 44 × PANEL_SCALE 1.5) — the panel
  // scales from there exactly like the notebook scales from cellSize.
  const pcs = panelCellSize;
  const btnSize = Math.round(pcs * 0.576) + "px";
  const btnFontSize = Math.round(pcs * 0.242) + "px";
  const qFontSize = Math.round(pcs * 0.182) + "px";
  const panelStyle = {
    top,
    marginLeft: Math.round(pcs * 0.273) + "px",
    padding: `${Math.round(pcs * 0.121)}px ${Math.round(pcs * 0.152)}px`,
    gap: Math.round(pcs * 0.091) + "px",
  };
  const btnsStyle = { gap: Math.round(pcs * 0.091) + "px" };
  const btnStyle = { width: btnSize, height: btnSize, fontSize: btnFontSize };

  return (
    <div className="col-compare-panel" style={panelStyle}>
      <div className="col-compare-panel-q" style={{ fontSize: qFontSize }}>?</div>
      <div className="col-compare-panel-btns" style={btnsStyle}>
        {["<", ">", "="].map((sign) => (
          <button
            key={sign}
            className={["col-compare-panel-btn", shakeSign === sign ? "col-compare-panel-btn--shake" : ""].filter(Boolean).join(" ")}
            style={btnStyle}
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

function ColumnGrid({ task, phase, topFilled, bottomFilled, signFilled, lineFilled, filledCells, activeStep, formActiveKey, shakeCell, cellSize = 44, panelCellSize, crossoutPaths = {}, onCrossoutComplete, compareColumn, onCompareResolve }) {
  const { digits, operation } = task;
  const totalCols = digits + 2;
  const cells = [];

  const cs = cellSize;
  const csStr = cs + "px";
  // Vertical center of the top+bottom digit rows (grid rows 2-3), used to
  // anchor .col-compare-panel at the same height regardless of which column
  // (units/tens/hundreds) is currently being compared. Every non-line grid
  // row (including row 1, the carry row) is sized to the full `cs` via the
  // inline gridTemplateRows below. Row 1 spans 0..cs, rows 2-3 span
  // cs..3*cs, so their midpoint is cs + cs = 2*cs.
  const comparePanelTop = 2 * cs;
  const comparingPosition = compareColumn?.position ?? null;
  const digitPT = Math.round(cs * 0.45) + "px";
  const digitFS = Math.round(cs * 1.02) + "px";
  const signFS = Math.round(cs * 1.14) + "px";
  // Same ratio .col-digit-corner uses (0.42em of the digit's own font-size)
  // — the carry corner has no big digit to sit next to in its own row, so
  // it's computed directly off `cs` instead of inherited via em.
  const carryCornerFS = Math.round(cs * 0.42) + "px";

  const digitStyle = { width: csStr, height: csStr, paddingTop: digitPT, fontSize: digitFS };
  const signCellStyle = { width: csStr, height: csStr, fontSize: signFS };
  const formCellStyle = { width: csStr, height: csStr, paddingTop: digitPT, fontSize: digitFS };
  const resultCellStyle = { width: csStr, height: csStr, paddingTop: digitPT, fontSize: digitFS };
  const carryStyle = { width: csStr, height: csStr, fontSize: carryCornerFS };

  // ── Carry row (addition only, phase 2) ───────────────────────────────────
  // Subtraction's "borrow"/"adjust" no longer render here — they render as a
  // corner mark on the relevant column's own top digit cell instead (see the
  // top-row loop below), so this row is addition-only now.
  if (phase === "solve") {
    const auxSteps = task.steps.filter((s) => s.cellType === "carry");
    for (const step of auxSteps) {
      const i = POS_INDEX[step.position];
      const gridCol = digits + 2 - i;
      const key = `${step.cellType}:${step.position}`;
      const filled = filledCells[key] !== undefined;
      const active = activeStep?.cellType === step.cellType && activeStep?.position === step.position;
      // Not yet reached — stays invisible, same reasoning as the corner mark:
      // an empty box sitting on screen ahead of time would give away that a
      // carry is coming before the child gets there.
      if (!filled && !active) continue;
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

      // Corner mark: "borrow" (this column received a ten — reads like a
      // small tens-digit tucked before the main digit, e.g. small "1" +
      // main "2" = "12") and "adjust" (this column was a source and got
      // reduced) both land here, in the SAME upper-left corner of this
      // column's own top digit cell — no separate row. If a column is ever
      // both (a cascading borrow: reduced as a source, then later needs its
      // own borrow), "borrow" simply overwrites "adjust" once typed — see
      // cornerFilledValue below.
      const borrowKey = `borrow:${pos}`;
      const borrowFilled = operation === "subtract" && filledCells[borrowKey] !== undefined;
      const borrowActive =
        operation === "subtract" && activeStep?.cellType === "borrow" && activeStep?.position === pos;
      const adjustKey = `adjust:${pos}`;
      const adjustFilled = operation === "subtract" && filledCells[adjustKey] !== undefined;
      const adjustActive =
        operation === "subtract" && activeStep?.cellType === "adjust" && activeStep?.position === pos;

      const cornerActive = borrowActive || adjustActive;
      // Only "borrow" is ever gated by an unresolved compare question
      // ("adjust" never is) — while gated, the corner must not jump ahead
      // to an empty/pulsing "ready to type" state; it just keeps showing
      // whatever was already settled (or nothing, on a first-time borrow).
      const cornerGatedByCompare = borrowActive && !!compareColumn;
      const cornerReady = cornerActive && !cornerGatedByCompare;
      const cornerFilledValue = borrowFilled
        ? filledCells[borrowKey]
        : adjustFilled
          ? filledCells[adjustKey]
          : null;
      const showCornerPulsing = cornerReady;
      const showCornerValue = !cornerReady && cornerFilledValue !== null;
      const showCorner = showCornerPulsing || showCornerValue;
      // Once a digit has already been reduced by an earlier borrow, its
      // current value lives in this corner mark — so the comparing
      // highlight goes on the corner (when it's showing a settled value) or
      // on the whole cell (a first-time borrow, nothing in the corner yet).
      const isComparingCorner = pos === comparingPosition && wasBorrowedFrom && showCornerValue;
      const isComparingHere = pos === comparingPosition && !wasBorrowedFrom;

      cells.push(
        <div
          key={`top:${pos}`}
          className={["col-digit", wasBorrowedFrom ? "col-digit--top-borrowed" : "", isComparingHere ? "col-digit--comparing" : ""].filter(Boolean).join(" ")}
          style={{ ...digitStyle, gridColumn: gridCol, gridRow: 2 }}
        >
          {col.topDigit}
          {showCorner && (
            <div
              data-cell-key={`corner:${pos}`}
              className={[
                "col-digit-corner",
                showCornerPulsing ? "col-digit-corner--active" : "",
                showCornerValue ? "col-digit-corner--filled" : "",
                isComparingCorner ? "col-digit-corner--comparing" : "",
              ].filter(Boolean).join(" ")}
            >
              {showCornerValue ? <span className="col-slant">{cornerFilledValue}</span> : ""}
            </div>
          )}
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
    // A shorter bottom number has no digit here at all — leave the grid
    // cell empty (no box), same as it would look on paper, rather than
    // drawing a "0" that was never written.
    if (col.hasBottomDigit === false) continue;

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
          className={["col-digit", pos === comparingPosition ? "col-digit--comparing" : ""].filter(Boolean).join(" ")}
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
      // 102 − 7 = 95, 52 − 47 = 5: a leading zero is not written — no cell.
      if (!task.steps.some((st) => st.cellType === "result" && st.position === pos)) continue;
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
      {compareColumn && (
        <ColumnComparePanel
          topDigit={compareColumn.compareTopDigit}
          bottomDigit={compareColumn.bottomDigit}
          top={`${comparePanelTop}px`}
          onResolve={onCompareResolve}
          panelCellSize={panelCellSize}
        />
      )}
    </div>
  );
}

// ── Main task component ───────────────────────────────────────────────────────

// noHints — an example of «Контрольная работа» solved on the tablet: no 💡,
// no first-time hints card.
function ColumnArithmeticTask({ task, onCorrect, onMistake, sessionParams, noHints = false }) {
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
  const [gridBaseSize, setGridBaseSize] = useState(44);
  const [showHints, setShowHints] = useState(false);
  const [firstHintRun, setFirstHintRun] = useState(false);
  const hintUsedRef = useRef(false);

  const rootRef = useRef(null);
  const notebookRef = useRef(null);

  useEffect(() => {
    if (noHints) return;
    try {
      if (!window.localStorage.getItem(COLUMN_HINTS_SEEN_KEY)) {
        window.localStorage.setItem(COLUMN_HINTS_SEEN_KEY, "1");
        hintUsedRef.current = true;
        setFirstHintRun(true);
        setShowHints(true);
      }
    } catch { /* Help remains available manually. */ }
  }, [noHints]);

  // Sequential form-fill order: top left→right, sign, bottom left→right, line.
  const formSteps = useMemo(() => {
    const positions = POSITIONS.slice(0, task.digits).reverse();
    const steps = [];
    for (const pos of positions) {
      steps.push({ cellKey: `top:${pos}`, value: task.columns[POS_INDEX[pos]].topDigit });
    }
    steps.push({ cellKey: "sign", value: task.operation === "add" ? "+" : "−" });
    for (const pos of positions) {
      const col = task.columns[POS_INDEX[pos]];
      // A shorter bottom number (e.g. "2-зн. + 1-зн.") has no digit to place
      // at this position at all — skip it rather than asking the child to
      // drag in a "0" that was never written on paper.
      if (col.hasBottomDigit === false) continue;
      steps.push({ cellKey: `bottom:${pos}`, value: col.bottomDigit });
    }
    steps.push({ cellKey: "line", value: null });
    return steps;
  }, [task]);

  const formActiveStep = phase === "form" && formStepIdx < formSteps.length ? formSteps[formStepIdx] : null;
  const formActiveKey = formActiveStep?.cellKey ?? null;
  const activeStep = phase === "solve" && stepIdx < task.steps.length ? task.steps[stepIdx] : null;

  // Compute adaptive cell and button sizes after layout.
  // cellSize (tap keyboard) has its OWN scaling now — a fixed 5-button-row
  // budget, completely independent of how many digits/result columns the
  // current problem has, so the keyboard never changes size between a
  // 2-digit and a 3-digit task.
  // gridBaseSize (notebook: Expression + ColumnGrid, rendered GRID_SCALE×
  // bigger) is the one that must fit the actual expression width —
  // top_digits + sign + bottom_digits + eq + result_digits — including the
  // final result once solved, which is why the floor here is low (18, not
  // 28): a 3-digit example with a carried result can need up to 11 columns
  // (2*3 + 2 + 3), and a 28px floor was wide enough on its own — once
  // multiplied by GRID_SCALE — to overflow every common phone width (e.g.
  // 11 × 28 × 1.3 ≈ 400px, wider than the ~340-360px a 375-390px-wide
  // screen actually has available).
  useLayoutEffect(() => {
    function compute() {
      if (!rootRef.current) return;
      const w = rootRef.current.clientWidth;
      const avail = w - 32;

      const cs = Math.min(52, Math.max(28, Math.floor(avail / KEYBOARD_COLS)));
      setCellSize(cs);

      const digits = task.digits;
      const resultDigits = String(task.result).length;
      const exprCols = 2 * digits + 2 + resultDigits;
      const gridBase = Math.min(52, Math.max(18, Math.floor(avail / (GRID_SCALE * exprCols))));
      setGridBaseSize(gridBase);
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [task.digits, task.result]);

  const gridCellSize = gridBaseSize * GRID_SCALE;
  const panelCellSize = gridBaseSize * PANEL_SCALE;

  // Align full-screen background grid with notebook cell boundaries.
  useLayoutEffect(() => {
    const screen = rootRef.current;
    const notebook = notebookRef.current;
    if (!screen || !notebook) return;
    const cs = gridCellSize;
    screen.style.backgroundSize = `${cs}px ${cs}px`;
    const sr = screen.getBoundingClientRect();
    const nr = notebook.getBoundingClientRect();
    const offX = ((nr.left - sr.left) % cs + cs) % cs;
    const offY = ((nr.top - sr.top) % cs + cs) % cs;
    screen.style.backgroundPosition = `${offX}px ${offY}px`;
    // Keep the .session-renderer-wrap background (fills the reserved header
    // gap above this screen, see column_addition.css) in the same phase/size.
    const wrap = screen.parentElement;
    if (wrap) {
      wrap.style.backgroundSize = `${cs}px ${cs}px`;
      const wr = wrap.getBoundingClientRect();
      const wOffX = ((nr.left - wr.left) % cs + cs) % cs;
      const wOffY = ((nr.top - wr.top) % cs + cs) % cs;
      wrap.style.backgroundPosition = `${wOffX}px ${wOffY}px`;
    }
  }, [gridCellSize, phase, solved]);

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

  // Real count of bottom-row positions — a shorter bottom operand (e.g.
  // "2-зн. + 1-зн.") has fewer than task.digits, since its missing high
  // position is never filled in (see formSteps above).
  const bottomDigitsCount = useMemo(
    () => task.columns.filter((c) => c.hasBottomDigit !== false).length,
    [task]
  );

  // Advance to phase 2 when column fully built.
  useEffect(() => {
    if (
      phase === "form" &&
      Object.keys(topFilled).length === task.digits &&
      Object.keys(bottomFilled).length === bottomDigitsCount &&
      signFilled !== null &&
      lineFilled
    ) {
      const t = setTimeout(() => setPhase("solve"), 500);
      return () => clearTimeout(t);
    }
  }, [phase, topFilled, bottomFilled, signFilled, lineFilled, task.digits, bottomDigitsCount]);

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
      setTimeout(() => onCorrect?.(undefined, undefined, { assisted: hintUsedRef.current }), 1200);
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
      setTimeout(() => onCorrect?.(undefined, undefined, { assisted: hintUsedRef.current }), 1200);
    }
  }, [activeStep, stepIdx, task.steps, onCorrect]);

  const compareMode = resolveCompareMode(sessionParams);

  const showingCompareOnBorrow =
    phase === "solve" &&
    activeStep?.cellType === "borrow" &&
    compareMode !== "off" &&
    taskNeedsBorrowTeaching(task) &&
    !resolvedCompares.has(activeStep.position);

  const showingCompareAlways =
    phase === "solve" &&
    compareMode === "always" &&
    task.operation === "subtract" &&
    activeStep?.cellType === "result" &&
    // A column with no real bottom digit (shorter bottom number) has
    // nothing to compare against — there's no borrow decision to make.
    task.columns[POS_INDEX[activeStep.position]]?.hasBottomDigit !== false &&
    !resolvedCompares.has(activeStep.position);

  const showingCompare = showingCompareOnBorrow || showingCompareAlways;

  const compareColumn = showingCompare ? task.columns[POS_INDEX[activeStep.position]] : null;

  const showingCrossout = phase === "solve" && activeStep?.cellType === "crossout";

  const closeHints = useCallback(() => {
    hintUsedRef.current = true;
    setShowHints(false);
    setFirstHintRun(false);
  }, []);

  const hintTargetSelector = useMemo(() => {
    if (showingCompare) return ".col-compare-panel";
    if (showingCrossout) return ".col-crossout-gesture";
    if (phase === "form") return formActiveKey ? `[data-cell-key="${formActiveKey}"]` : null;
    if (!activeStep) return null;
    if (activeStep.cellType === "borrow" || activeStep.cellType === "adjust") return `[data-cell-key="corner:${activeStep.position}"]`;
    return `[data-cell-key="${activeStep.cellType}:${activeStep.position}"]`;
  }, [activeStep, formActiveKey, phase, showingCompare, showingCrossout]);

  return (
    <div className="col-screen" ref={rootRef}>
      <div className="col-notebook" ref={notebookRef} style={{ gap: `${2 * gridCellSize}px` }}>
        <Expression task={task} result={solved ? task.result : null} cellSize={gridCellSize} />
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
          cellSize={gridCellSize}
          panelCellSize={panelCellSize}
          crossoutPaths={crossoutPaths}
          onCrossoutComplete={handleCrossoutComplete}
          compareColumn={compareColumn}
          onCompareResolve={() => setResolvedCompares((prev) => new Set(prev).add(activeStep.position))}
        />
      </div>

      {showHelper && (
        <div className="col-helper-area">
          <HelperPanel maxNumber={20} showMoveHint={false} onClose={() => setShowHelper(false)} />
        </div>
      )}

      {/* TapKeyboard stays mounted (just visually hidden) whenever the compare
          panel or the crossout gesture takes over — this reserves its exact
          footprint so the column above never reflows when .col-screen
          re-centers its flex content. The compare panel itself now renders
          inside ColumnGrid, next to the column — it no longer reuses this
          reserved space, but the keyboard still has to stay hidden while a
          compare question is pending (tapping a digit shouldn't register
          against the not-yet-resolved borrow/result step underneath). */}
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
      {!showHints && !noHints && <button type="button" className="col-hint-toggle" onClick={() => { hintUsedRef.current = true; setFirstHintRun(false); setShowHints(true); }} aria-label="Показать подсказку">💡</button>}
      {showHints && <ColumnHints task={task} phase={phase} formActiveStep={formActiveStep} activeStep={activeStep} showingCompare={showingCompare} solved={solved} isFirstRun={firstHintRun} onClose={closeHints} onShown={() => { hintUsedRef.current = true; }} screenElement={rootRef.current} targetSelector={hintTargetSelector} avoidSelector=".col-notebook .col-digit, .col-notebook [data-cell-key], .col-expression, .col-controls-area" />}
    </div>
  );
}

// ── Copy mode numpad (5+5+controls) ──────────────────────────────────────────

function CopyKeyboard({ cellSize, onDigit, onDelete, onRefresh, onCheck, canCheck }) {
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
        <button className="col-tap-btn col-copy-kb-del"     style={{ ...ctrlH, flex: 2 }} aria-label="Стереть цифру" onClick={onDelete}>⌫</button>
        <button className="col-tap-btn col-copy-kb-refresh" style={{ ...ctrlH, flex: 1 }} aria-label="Новый лист" onClick={onRefresh}>↻</button>
        <button className="col-tap-btn col-copy-kb-check"   style={{ ...ctrlH, flex: 2 }} aria-label="Проверить" disabled={!canCheck} onClick={onCheck}>✓</button>
      </div>
    </div>
  );
}

// ── Copy mode (column_copy) ───────────────────────────────────────────────────
// «Контрольная работа»: a sheet of examples written in a line («347 + 5 =»);
// the child sets each one up in a column in the notebook — where the 5 goes is
// half the test — solves it and types the answer. The answer field has no
// fixed cells (they would tell how many digits the answer has: 95 + 7 → three)
// and is checked by «✓», once: right stays green, wrong stays red with the
// child's answer, and the next example starts. After the last one — the
// adult's result: how many right, by kind, and each mistake with the right
// answer. The kinds of examples are the adult's ticks (COPY_KINDS, engine.js).
// «Где решаем: на планшете» (no notebook at hand; only in the settings, never
// during the lesson): no keypad on the sheet — a tap on an example opens it in
// the trainer (set up in the column and solved, no 💡), the example counts
// once solved there; its slips on the way are counted for the adult.
const MAX_ANSWER = 4;
const pluralSlips = (n) => (n % 10 === 1 && n % 100 !== 11 ? "ошибка" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "ошибки" : "ошибок");
const signOf = (op) => (op === "add" ? "+" : "−");
const width10 = (n) => String(n).length;
const answerOf = (ex) => (ex.operation === "add" ? ex.top + ex.bottom : ex.top - ex.bottom);

function CopyResult({ examples, answers, slips, onTablet, onAgain, onDone }) {
  // On the tablet every example ends right; what tells is a clean solve.
  const clean = (ex, i) => (onTablet ? !slips[i] : answers[i] === answerOf(ex));
  const right = examples.filter(clean).length;
  const kinds = COPY_KINDS.filter((k) => examples.some((ex) => ex.kind === k.id));
  const mistakes = onTablet ? [] : examples.map((ex, i) => ({ ex, given: answers[i] })).filter(({ ex, given }) => given !== answerOf(ex));
  const slipped = onTablet ? examples.map((ex, i) => ({ ex, n: slips[i] ?? 0 })).filter(({ n }) => n > 0) : [];
  return (
    <div className="col-copy-result" role="status">
      <div className="col-copy-result-total">{onTablet ? `Без ошибок ${right} из ${examples.length}` : `Верно ${right} из ${examples.length}`}</div>
      {onTablet && <div className="col-copy-result-note">Решено на планшете</div>}
      {kinds.length > 1 && (
        <div className="col-copy-result-kinds">
          {kinds.map((k) => {
            const own = examples.map((ex, i) => [ex, i]).filter(([ex]) => ex.kind === k.id);
            const ok = own.filter(([ex, i]) => clean(ex, i)).length;
            return (
              <div key={k.id} className={`col-copy-result-kind${ok < own.length ? " col-copy-result-kind--weak" : ""}`}>
                <span>{k.label}</span><b>{ok} из {own.length}</b>
              </div>
            );
          })}
        </div>
      )}
      {mistakes.length > 0 && (
        <div className="col-copy-result-mistakes">
          <div className="col-copy-result-head">Ошибки</div>
          {mistakes.map(({ ex, given }, i) => (
            <div key={i} className="col-copy-result-mistake">
              {ex.top} {signOf(ex.operation)} {ex.bottom} = <s>{given}</s> <b>{answerOf(ex)}</b>
            </div>
          ))}
        </div>
      )}
      {slipped.length > 0 && (
        <div className="col-copy-result-mistakes">
          <div className="col-copy-result-head">С ошибками по ходу</div>
          {slipped.map(({ ex, n }, i) => (
            <div key={i} className="col-copy-result-mistake">
              {ex.top} {signOf(ex.operation)} {ex.bottom} = {answerOf(ex)} <span className="col-copy-result-slips">— {n} {pluralSlips(n)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="col-copy-result-actions">
        <button type="button" className="col-copy-result-btn col-copy-result-btn--again" onClick={onAgain}>Новый лист</button>
        <button type="button" className="col-copy-result-btn" onClick={onDone}>Готово</button>
      </div>
    </div>
  );
}

function ColumnCopyView({ sessionParams, onCorrect, student }) {
  const count     = Number(sessionParams?.count     ?? 6);
  const operation = sessionParams?.operation ?? "mixed";
  const carryMode = sessionParams?.carryMode ?? "none";
  const kindKeys  = COPY_KINDS.map((k) => (sessionParams?.[k.key] ?? k.key === "kind_22") ? "1" : "0").join("");
  const sheetParams = () => ({ operation, carryMode, ...Object.fromEntries(COPY_KINDS.map((k, i) => [k.key, kindKeys[i] === "1"])) });
  const onTablet  = sessionParams?.solveOn === "tablet";
  const screenRef = useRef(null);
  const listRef   = useRef(null);
  const activeRef = useRef(null);

  const [examples,   setExamples]   = useState(() => generateCopySheet(count, sheetParams()));
  const [activeIdx,  setActiveIdx]  = useState(0);
  const [answers,    setAnswers]    = useState({});
  const [input,      setInput]      = useState([]);
  const [showReward, setShowReward] = useState(false);
  const [cellSize,   setCellSize]   = useState(44);
  const [openIdx,    setOpenIdx]    = useState(null);
  const [slips,      setSlips]      = useState({});
  const finished = onTablet ? examples.every((_, i) => answers[i] !== undefined) : activeIdx >= examples.length;

  // The widest line of the sheet: both numbers, sign, «=», room for the answer.
  const exprCols = Math.max(...examples.map((ex) => width10(ex.top) + width10(ex.bottom)), 4) + 2 + MAX_ANSWER;

  // Adaptive sizing: fit expression width AND all rows within screen height
  useLayoutEffect(() => {
    function compute() {
      if (!screenRef.current) return;
      const w = screenRef.current.clientWidth;
      const h = screenRef.current.clientHeight;
      const cs_w = Math.min(52, Math.max(20, Math.floor((w - 32) / exprCols)));
      // Height: count rows + (count-1) gap rows (each = cs) + keyboard 3 rows + overhead ~80px
      // Total cs rows = count + (count-1) + 3 = 2*count + 2
      const cs_h = Math.floor((h - 80) / (2 * count + 2));
      setCellSize(Math.min(cs_w, Math.max(20, cs_h)));
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [exprCols, count]);

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
    // Keep the .session-renderer-wrap background (fills the reserved header
    // gap above this screen, see column_addition.css) in the same phase/size.
    const wrap = screen.parentElement;
    if (wrap) {
      wrap.style.backgroundSize = `${cs}px ${cs}px`;
      const wr = wrap.getBoundingClientRect();
      const wOffX = ((lr.left - wr.left) % cs + cs) % cs;
      const wOffY = ((lr.top  - wr.top)  % cs + cs) % cs;
      wrap.style.backgroundPosition = `${wOffX}px ${wOffY}px`;
    }
  }, [cellSize, examples, finished, openIdx]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIdx]);

  function handleDigit(d) {
    if (finished || input.length >= MAX_ANSWER) return;
    setInput([...input, String(d)]);
  }

  function handleDelete() {
    setInput(prev => prev.slice(0, -1));
  }

  // One answer per example: right or wrong, the next one starts.
  function handleCheck() {
    if (finished || !input.length) return;
    setAnswers(prev => ({ ...prev, [activeIdx]: Number(input.join("")) }));
    setInput([]);
    setActiveIdx(activeIdx + 1);
  }

  function refresh() {
    setExamples(generateCopySheet(count, sheetParams()));
    setActiveIdx(0);
    setAnswers({});
    setSlips({});
    setOpenIdx(null);
    setInput([]);
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
  const digitCells = (text, key, className = "") => String(text).split("").map((ch, j) => (
    <span key={`${key}${j}`} className={`col-expr-cell${className}`} style={cellSty}><span className="col-slant">{ch}</span></span>
  ));

  return (
    <div className="col-screen col-copy-screen" ref={screenRef}>
      <div className="col-copy-list" ref={listRef} style={{ gap: `${cellSize}px` }}>
        {examples.map((ex, i) => {
          const isActive = i === activeIdx;
          const given    = answers[i];
          const verdict  = given === undefined ? null : given === answerOf(ex) ? " col-copy-cell-ok" : " col-copy-cell-wrong";

          const canOpen  = onTablet && given === undefined;

          return (
            <div key={i} ref={isActive ? activeRef : null}
              className={`col-copy-expr-row${canOpen ? " col-copy-expr-row--open" : ""}`}
              {...(canOpen ? { role: "button", tabIndex: 0, "aria-label": `Решить ${ex.top} ${signOf(ex.operation)} ${ex.bottom}`, onClick: () => setOpenIdx(i) } : {})}>
              {digitCells(ex.top, "t")}
              <span className="col-expr-cell col-expr-sign" style={cellSty}><span className="col-slant">{signOf(ex.operation)}</span></span>
              {digitCells(ex.bottom, "b")}
              <span className="col-expr-cell col-expr-eq" style={cellSty}><span className="col-slant">=</span></span>
              {verdict ? digitCells(given, "r", verdict)
                : canOpen ? <span className="col-expr-cell col-copy-cell-ask" style={cellSty}><span className="col-slant">?</span></span>
                : isActive ? <>
                  {digitCells(input.join(""), "i", " col-copy-cell-typed")}
                  {input.length < MAX_ANSWER && <span className="col-expr-cell col-copy-cell-input" style={cellSty} />}
                </>
                  : null}
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

      {finished
        ? <CopyResult examples={examples} answers={answers} slips={slips} onTablet={onTablet} onAgain={refresh} onDone={() => setShowReward(true)} />
        : onTablet ? <div className="col-copy-tap-note">Нажми на пример, чтобы решить его в столбик</div>
          : <CopyKeyboard cellSize={cellSize} onDigit={handleDigit} onDelete={handleDelete} onRefresh={refresh} onCheck={handleCheck} canCheck={input.length > 0} />}

      {openIdx !== null && (
        <div className="col-copy-solve">
          <button type="button" className="col-copy-solve-back" onClick={() => setOpenIdx(null)}>← К листу</button>
          <ColumnArithmeticTask
            key={openIdx}
            task={columnTaskOfExample(examples[openIdx])}
            noHints
            sessionParams={{}}
            onMistake={() => setSlips((prev) => ({ ...prev, [openIdx]: (prev[openIdx] ?? 0) + 1 }))}
            onCorrect={() => {
              setAnswers((prev) => ({ ...prev, [openIdx]: answerOf(examples[openIdx]) }));
              setOpenIdx(null);
            }}
          />
        </div>
      )}
    </div>
  );
}


// ── Renderer entry point ──────────────────────────────────────────────────────

export default function ColumnAdditionRenderer({ task, mode, sessionParams, onCorrect, student, onMistake, onFlashIncorrect }) {
  const strictMistake = sessionParams?.strictStars ? onMistake : undefined;
  if (mode?.type === "column_copy") {
    return <ColumnCopyView sessionParams={sessionParams} onCorrect={onCorrect} student={student} />;
  }
  if (task?.type === "column_find_error") {
    return <FindErrorTask key={`${task.cardId}-${task.top}-${task.bottom}-${task.operation}`} task={task} onCorrect={onCorrect} onMistake={strictMistake} />;
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
