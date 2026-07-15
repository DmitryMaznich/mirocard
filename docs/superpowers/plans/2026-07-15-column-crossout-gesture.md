# Column Subtraction Crossout Gesture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the borrow-source digit's cross-out mark in the "Столбик" borrow-teaching flow from an automatic side effect of typing the borrow count into its own explicit, child-drawn gesture (a left-to-right finger swipe across the digit).

**Architecture:** One new `crossout` step type inserted into `buildSubSteps` (`engine.js`) between the existing `borrow` and `adjust` steps. A new self-contained `CrossoutGesture.jsx` component captures the swipe via Pointer Events on a transparent SVG overlay sized to match the plain `.col-digit` cell, and reports the finished hand-drawn path back up. `ColumnArithmeticTask` stores that finished path so it survives after the gesture step's own component unmounts (once the flow advances to `adjust`), and `ColumnGrid` renders either the live gesture-capturer (while active) or the frozen finished mark (once done).

**Tech Stack:** React function components, plain CSS (no CSS-in-JS), Vitest for pure-logic tests, Playwright with real touch events (CDP `Input.dispatchTouchEvent`) for the drag-gesture verification since this codebase has no React component test harness.

## Global Constraints

- The digit being crossed out stays a completely ordinary `.col-digit` cell — no border, no background, no visual hint of interactivity before the gesture starts. The SVG overlay is transparent.
- The gesture must require net left-to-right movement covering most of the cell's width (~70%) — checked continuously during the drag, not only on release.
- On an incomplete gesture (released early, or insufficient rightward spread), the drawn line disappears and the child can retry immediately — no shake animation, no mistake penalty (`onMistake` must NOT be called for this).
- On success, the child's own drawn path — not a synthetic straight line — is what stays on screen permanently, styled `#ef4444`, matching the existing dimmed digit text color `#9ca3af` (already used by `.col-digit--top-borrowed`).
- This is a mechanics-only change to a flow already gated by `taskNeedsBorrowTeaching(task)` and (for the earlier comparison step) the `Сравнение` param. No new mode param.
- Addition tasks and subtraction tasks without a borrow must render byte-for-byte identical to today — this change only ever activates on the `crossout` step, which only exists when a borrow exists.

---

### Task 1: Insert the `crossout` step (`engine.js`)

**Files:**
- Modify: `src/topics/renderers/column_addition/engine.js:58-74` (`buildSubSteps`)
- Test: `src/topics/renderers/column_addition/engine.test.js:93-123` (extend existing `describe("buildSubSteps borrow/adjust step shape", ...)` block)

**Interfaces:**
- Consumes: `columns` array from `buildSubColumns` (unchanged shape: `{ position, topDigit, bottomDigit, borrowIn, borrowOut, effectiveTopDigit, writeDigit }`).
- Produces: `buildSubSteps(columns)` now returns steps shaped `{ cellType: "borrow"|"crossout"|"adjust"|"result", position, digit }`, where a borrow situation produces, in order: `borrow` (digit `1`, at the receiving column's position), `crossout` (digit `null` — no numeric input, just a gesture; at the *source* column's position, same position `adjust` uses), `adjust` (digit `next.topDigit - 1`, source column's position), then the existing `result` step. Consumed by Task 2's `ColumnArithmeticTask`/`ColumnGrid` (`activeStep.cellType === "crossout"` gates the gesture UI).

- [ ] **Step 1: Update the existing step-order test and add crossout-specific tests**

Open `src/topics/renderers/column_addition/engine.test.js`. Replace the existing test (lines 111-115):

```js
  it("step order is borrow, adjust, result(lower), result(higher)", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 30, { operation: "subtract", carryMode: "carry", digits: 2 });
    const t = tasks.find((task) => task.columns[0].borrowOut > 0);
    expect(t.steps.map((s) => s.cellType)).toEqual(["borrow", "adjust", "result", "result"]);
  });
```

with:

```js
  it("step order is borrow, crossout, adjust, result(lower), result(higher)", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 30, { operation: "subtract", carryMode: "carry", digits: 2 });
    const t = tasks.find((task) => task.columns[0].borrowOut > 0);
    expect(t.steps.map((s) => s.cellType)).toEqual(["borrow", "crossout", "adjust", "result", "result"]);
  });

  it("crossout step sits at the source column's position, between borrow and adjust", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 30, { operation: "subtract", carryMode: "carry", digits: 2 });
    const t = tasks.find((task) => task.columns[0].borrowOut > 0);
    const crossoutStep = t.steps.find((s) => s.cellType === "crossout");
    expect(crossoutStep).toBeDefined();
    expect(crossoutStep.position).toBe("tens");
  });

  it("no crossout step when the column doesn't need a borrow", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 30, { operation: "subtract", carryMode: "none", digits: 2 });
    for (const t of tasks) {
      expect(t.steps.some((s) => s.cellType === "crossout")).toBe(false);
    }
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/topics/renderers/column_addition/engine.test.js --exclude "**/.worktrees/**" --exclude "**/runtime/**" --exclude "**/__codex_deploy*/**" --exclude "**/.codex-deploy*/**" --exclude "**/codex-deploy*/**"`
Expected: FAIL for two tests — the updated step-order test (no `"crossout"` in the array yet) and "crossout step sits at the source column's position" (`crossoutStep` is `undefined`, fails `toBeDefined()`). The third new test, "no crossout step when the column doesn't need a borrow", trivially PASSES even before implementation (there are no `crossout` steps anywhere yet) — that's expected; it becomes a meaningful regression guard only after Step 3 lands.

- [ ] **Step 3: Implement the `crossout` step**

In `src/topics/renderers/column_addition/engine.js`, replace `buildSubSteps` (lines 58-74):

```js
function buildSubSteps(columns) {
  const steps = [];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const next = columns[i + 1];
    if (col.borrowOut > 0 && next) {
      // "borrow" sits at the column that RECEIVES the extra ten (the one that
      // was short) — the child types "1" here to acknowledge the borrow.
      steps.push({ cellType: "borrow", position: col.position, digit: 1 });
      // "adjust" sits at the SOURCE column (one place higher) — the child
      // computes and types its own reduced digit (topDigit - 1) themselves.
      steps.push({ cellType: "adjust", position: next.position, digit: next.topDigit - 1 });
    }
    steps.push({ cellType: "result", position: col.position, digit: col.writeDigit });
  }
  return steps;
}
```

with:

```js
function buildSubSteps(columns) {
  const steps = [];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const next = columns[i + 1];
    if (col.borrowOut > 0 && next) {
      // "borrow" sits at the column that RECEIVES the extra ten (the one that
      // was short) — the child types "1" here to acknowledge the borrow.
      steps.push({ cellType: "borrow", position: col.position, digit: 1 });
      // "crossout" sits at the SOURCE column (one place higher), same
      // position "adjust" uses — the child must draw a left-to-right swipe
      // across that digit themselves before it counts as crossed out.
      // digit:null because this step isn't a numeric input, it's a gesture.
      steps.push({ cellType: "crossout", position: next.position, digit: null });
      // "adjust" sits at the SOURCE column too — the child computes and
      // types its own reduced digit (topDigit - 1) themselves.
      steps.push({ cellType: "adjust", position: next.position, digit: next.topDigit - 1 });
    }
    steps.push({ cellType: "result", position: col.position, digit: col.writeDigit });
  }
  return steps;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/topics/renderers/column_addition/engine.test.js --exclude "**/.worktrees/**" --exclude "**/runtime/**" --exclude "**/__codex_deploy*/**" --exclude "**/.codex-deploy*/**" --exclude "**/codex-deploy*/**"`
Expected: PASS for every test in `describe("buildSubSteps borrow/adjust step shape", ...)` and `describe("taskNeedsBorrowTeaching", ...)`. `taskNeedsBorrowTeaching` itself is untouched (it only checks `columns[].borrowOut`, not `steps`) so it needs no changes and its tests should already pass. Pre-existing `FingerSystem`-related failures (6 tests, unrelated to this feature — confirmed pre-existing earlier today) are expected to remain; no other new failures should appear.

- [ ] **Step 5: Lint**

Run: `npx eslint src/topics/renderers/column_addition/engine.js src/topics/renderers/column_addition/engine.test.js`
Expected: no output (the one pre-existing `getFingerConfig` unused-import error in `engine.js` is out of scope for this change and was already present before it — confirm it's the *only* line reported, if any).

- [ ] **Step 6: Commit**

```bash
git add src/topics/renderers/column_addition/engine.js src/topics/renderers/column_addition/engine.test.js
git commit -m "$(cat <<'EOF'
feat(column_addition): insert crossout step between borrow and adjust

The borrow-source digit's cross-out mark stops being an automatic
consequence of filling the borrow count. A new "crossout" step (no
numeric digit — it's a gesture, not a tap) sits at the source
column's position, same as "adjust", so the UI layer can gate a
dedicated swipe-gesture step before the reduced-digit input appears.
EOF
)"
```

---

### Task 2: Build `CrossoutGesture.jsx` and wire it into the solve flow

**Files:**
- Create: `src/topics/renderers/column_addition/CrossoutGesture.jsx`
- Modify: `src/topics/renderers/column_addition/index.jsx:1` (import), `:389-402` (state), `:459-471` (reset effect), `:525-540` (add `handleCrossoutComplete`, area right after `handleSolveTap`), `:542-548` (add `showingCrossout`), `:556-568` (`<ColumnGrid>` props), `:585-594` (`TapKeyboard` gating), `:596` (helper-button gating), `:141` (`ColumnGrid` signature), `:217-240` (top-row `else` branch)
- Modify: `src/topics/renderers/column_addition/column_addition.css:92-96` (simplify `.col-digit--top-borrowed`), add new `.col-crossout-gesture` / `.col-crossout-mark` rules

**Interfaces:**
- Consumes: `crossout` steps from Task 1's `buildSubSteps` output (`activeStep.cellType === "crossout"`, `activeStep.position`).
- Produces: `CrossoutGesture({ cellWidth, cellHeight, onComplete })` — a default-exported component; `onComplete` is called with one argument, the finished path's SVG `d` string, the instant the completion condition is met (mid-gesture, not only on release). No other file needs to know its internals beyond this prop contract.

Currently there is no automated test harness for React components in this codebase — verify this task with a real-touch-drag Playwright script (Step 5) rather than Vitest.

- [ ] **Step 1: Create `CrossoutGesture.jsx`**

Create `src/topics/renderers/column_addition/CrossoutGesture.jsx`:

```jsx
import { useRef, useState } from "react";

const STROKE_COLOR = "#ef4444";
const STROKE_WIDTH = 4;
// How much of the cell's width the drag must span, left to right, before
// the gesture counts as a completed cross-out.
const COMPLETE_SPREAD_RATIO = 0.7;

function pointsToPath(points) {
  if (points.length < 2) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

// Transparent gesture-capture overlay for one digit cell. Renders nothing
// visible until the child starts dragging — the underlying .col-digit cell
// looks completely ordinary until then. Reports the finished hand-drawn
// path (not a synthetic straight line) back to the caller via onComplete
// the instant the completion condition is met, so success can fire
// mid-gesture rather than waiting for pointer-up.
export default function CrossoutGesture({ cellWidth, cellHeight, onComplete }) {
  const svgRef = useRef(null);
  const isDrawing = useRef(false);
  const completed = useRef(false);
  const [points, setPoints] = useState([]);

  function toLocalPoint(e) {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }

  function isComplete(pts) {
    if (pts.length < 2) return false;
    const xs = pts.map((p) => p.x);
    const spread = Math.max(...xs) - Math.min(...xs);
    const netRightward = pts[pts.length - 1].x > pts[0].x;
    return spread >= cellWidth * COMPLETE_SPREAD_RATIO && netRightward;
  }

  function handlePointerDown(e) {
    e.preventDefault();
    const pt = toLocalPoint(e);
    if (!pt) return;
    isDrawing.current = true;
    completed.current = false;
    setPoints([pt]);
  }

  function handlePointerMove(e) {
    e.preventDefault();
    if (!isDrawing.current || completed.current) return;
    const pt = toLocalPoint(e);
    if (!pt) return;
    setPoints((prev) => {
      const next = [...prev, pt];
      if (isComplete(next)) {
        completed.current = true;
        isDrawing.current = false;
        onComplete?.(pointsToPath(next));
      }
      return next;
    });
  }

  function handlePointerUp() {
    isDrawing.current = false;
    // Incomplete attempt: the line disappears, no penalty, retry immediately.
    if (!completed.current) setPoints([]);
  }

  const d = pointsToPath(points);

  return (
    <svg
      ref={svgRef}
      className="col-crossout-gesture"
      width={cellWidth}
      height={cellHeight}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {d && (
        <path d={d} fill="none" stroke={STROKE_COLOR} strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
```

- [ ] **Step 2: Import it in `index.jsx`**

In `src/topics/renderers/column_addition/index.jsx`, change line 1's neighboring imports — add right after the existing `RegroupTenTask` import (line 8):

```js
import RegroupTenTask from "./RegroupTenTask.jsx";
import CrossoutGesture from "./CrossoutGesture.jsx";
```

- [ ] **Step 3: Add `crossoutPaths` state and reset it on task change**

In `ColumnArithmeticTask` (starts line 389), find `const [resolvedCompares, setResolvedCompares] = useState(new Set());` (line 400) and add right after it:

```js
  const [resolvedCompares, setResolvedCompares] = useState(new Set());
  const [crossoutPaths, setCrossoutPaths] = useState({});
```

Find the reset `useEffect` (starts line 459, has `setResolvedCompares(new Set());` at line 470) and add right after that line:

```js
    setResolvedCompares(new Set());
    setCrossoutPaths({});
```

- [ ] **Step 4: Add `handleCrossoutComplete`**

In the same file, right after `handleSolveTap`'s closing (ends at line 540, `}, [activeStep, stepIdx, task.steps, triggerShake, onMistake, onCorrect]);`), add:

```js
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
```

- [ ] **Step 5: Add `showingCrossout` and gate the keyboard/helper button**

Find `const showCompareParam = sessionParams?.showCompare ?? true;` (line 542) through `const compareColumn = ...` (line 550). Add right after that block:

```js
  const showingCrossout = phase === "solve" && activeStep?.cellType === "crossout";
```

Then change the `<ColumnGrid>` call (lines 556-568) from:

```jsx
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
        />
```

to:

```jsx
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
```

Then change (line 585):

```jsx
      {!showingCompare && (
```

to:

```jsx
      {!showingCompare && !showingCrossout && (
```

Then change (line 596):

```jsx
      {!showHelper && !showingCompare && !!sessionParams?.showHelper && (
```

to:

```jsx
      {!showHelper && !showingCompare && !showingCrossout && !!sessionParams?.showHelper && (
```

- [ ] **Step 6: Update `ColumnGrid`'s signature and top-row rendering**

In the same file, change `ColumnGrid`'s signature (line 141) from:

```jsx
function ColumnGrid({ task, phase, topFilled, bottomFilled, signFilled, lineFilled, filledCells, activeStep, formActiveKey, shakeCell, cellSize = 44 }) {
```

to:

```jsx
function ColumnGrid({ task, phase, topFilled, bottomFilled, signFilled, lineFilled, filledCells, activeStep, formActiveKey, shakeCell, cellSize = 44, crossoutPaths = {}, onCrossoutComplete }) {
```

Then replace the top-row `else` branch (lines 217-240):

```jsx
    } else {
      // The digit that gets crossed out is the SOURCE of a borrow — the
      // column one place lower (i-1) is the one that was short and borrowed
      // from THIS digit. Cross it out once that lower column's own borrow
      // cell is filled, and show the child's own typed reduced value (not
      // an auto-computed one) once their "adjust" entry is filled too.
      const lowerCol = i > 0 ? task.columns[i - 1] : null;
      const wasBorrowedFrom =
        operation === "subtract" &&
        lowerCol?.borrowOut === 1 &&
        filledCells[`borrow:${lowerCol?.position}`] !== undefined;
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
        </div>
      );
    }
```

with:

```jsx
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
```

- [ ] **Step 7: Update CSS**

In `src/topics/renderers/column_addition/column_addition.css`, replace (lines 92-96):

```css
.col-digit--top-borrowed {
  text-decoration: line-through;
  text-decoration-color: #ef4444;
  color: #9ca3af;
}
```

with:

```css
.col-digit--top-borrowed {
  /* No CSS line-through here — the cross-out line is the child's own
     hand-drawn gesture (.col-crossout-mark), not an automatic decoration. */
  color: #9ca3af;
}

.col-crossout-gesture {
  position: absolute;
  top: 0;
  left: 0;
  touch-action: none;
  cursor: crosshair;
}

.col-crossout-mark {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}
```

- [ ] **Step 8: Lint**

Run: `npx eslint src/topics/renderers/column_addition/index.jsx src/topics/renderers/column_addition/CrossoutGesture.jsx`
Expected: only the pre-existing `React`/`getDigitAt` unused-var errors and the pre-existing `set-state-in-effect` warning in `index.jsx` (all confirmed pre-existing earlier today) — no new errors from `CrossoutGesture.jsx` or the modified blocks.

- [ ] **Step 9: Verify with Playwright (real touch drag via CDP)**

Create `C:\Users\dmazn\AppData\Local\Temp\claude\c--Users-dmazn-Projects-Mirocard2\35adf863-6e21-444f-9660-d0d0f049497e\scratchpad\pw_verify_crossout_gesture.cjs`:

```js
const { chromium } = require("C:/Users/dmazn/AppData/Roaming/npm/node_modules/playwright");
const SC = (n) => `C:/Users/dmazn/AppData/Local/Temp/claude/c--Users-dmazn-Projects-Mirocard2/35adf863-6e21-444f-9660-d0d0f049497e/scratchpad/${n}`;

async function enterPin(page, digits) {
  const gateVisible = await page.locator(".pin-gate").count();
  if (!gateVisible) return;
  for (const d of digits) {
    await page.click(`.pin-gate button:text-is("${d}")`).catch(() => {});
    await page.waitForTimeout(150);
  }
}

async function tapDigit(page, d) {
  await page.locator(".col-tap-row .col-tap-btn").filter({ hasText: new RegExp(`^${d}$`) }).first().click();
  await page.waitForTimeout(350);
}

// Real touch drag via CDP — page.mouse dispatches pointerType:"mouse" and
// would still fire pointer events, but this project's convention is to
// verify touch gestures with real touch events (Input.dispatchTouchEvent).
async function touchDrag(cdp, points) {
  for (let i = 0; i < points.length; i++) {
    const type = i === 0 ? "touchStart" : "touchMove";
    await cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: [{ x: points[i].x, y: points[i].y }],
    });
    await new Promise((r) => setTimeout(r, 40));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const cdp = await page.context().newCDPSession(page);
  page.on("pageerror", (err) => console.log("[pageerror]", err.message));

  await page.route("**/api/decks/*/claim", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "granted" }) });
  });
  await page.goto("http://localhost:8080/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.click("text=Без аккаунта (локальный режим)").catch(() => {});
  await page.waitForTimeout(1000);
  await page.click("text=Выбрать в настройках").catch(() => {});
  await page.waitForTimeout(800);
  await page.click("text=Выбрать ученика").catch(() => {});
  await page.waitForTimeout(800);
  const addBtn = page.locator("text=Добавить ученика");
  if (await addBtn.count()) {
    await addBtn.click();
    await page.waitForTimeout(800);
    await page.fill('input[placeholder="Имя ученика"]', "ТестКроссаут");
    await page.click("text=Сохранить");
    await page.waitForTimeout(1000);
  }
  await page.locator("text=Тест").first().click().catch(() => {});
  await page.waitForTimeout(1200);
  await page.click("text=ТЕМА").catch(() => {});
  await page.waitForTimeout(1000);
  await page.click("text=Открыть").catch(() => {});
  await page.waitForTimeout(1000);
  const target = page.locator("xpath=//*[contains(text(),'Сложение и вычитание в столбик')]/following::*[contains(text(),'Установить')][1]");
  if (await target.count()) { await target.click(); await page.waitForTimeout(2000); }
  await page.click('button.back-btn, [aria-label="Назад"]').catch(() => {});
  await page.waitForTimeout(1000);
  await page.locator("text=Сложение и вычитание в столбик").first().waitFor({ state: "visible", timeout: 15000 });
  await page.click("text=Сложение и вычитание в столбик");
  await page.waitForTimeout(1000);

  await page.locator('text="Режим"').first().waitFor({ state: "visible", timeout: 15000 });
  await page.click('text="Режим"');
  await page.waitForTimeout(1000);
  await page.locator('text="Столбик"').first().click();
  await page.waitForTimeout(1200);

  await page.locator('button:has-text("Только −")').click();
  await page.waitForTimeout(300);
  await page.locator('button:has-text("С переносом / займом")').click();
  await page.waitForTimeout(300);
  const compareRow = page.locator("xpath=//*[contains(text(),'Сравнение')]/following::button[contains(text(),'Скрыт')][1]");
  await compareRow.click(); // simplify this run: skip the comparison strip
  await page.waitForTimeout(300);

  await page.locator('button:visible:has-text("Начать занятие")').first().click();
  await page.waitForTimeout(1000);
  await enterPin(page, "1234");
  await page.waitForTimeout(800);
  await enterPin(page, "1234");
  await page.waitForTimeout(1500);

  const nums = await page.evaluate(() => {
    const el = document.querySelector(".col-expression");
    const text = el ? el.innerText.replace(/\s+/g, "") : "";
    const m = text.match(/(\d+)[−-](\d+)/);
    return m ? [m[1], m[2]] : null;
  });
  const top = parseInt(nums[0], 10), bottom = parseInt(nums[1], 10);
  const topOnes = top % 10, topTens = Math.floor(top / 10) % 10;
  const botOnes = bottom % 10, botTens = Math.floor(bottom / 10) % 10;
  const needBorrow = topOnes < botOnes;
  console.log(`top=${top} bottom=${bottom} needBorrow=${needBorrow}`);
  if (!needBorrow) { console.log("Random example had no borrow — re-run."); await browser.close(); return; }

  await tapDigit(page, topTens);
  await tapDigit(page, topOnes);
  await page.locator(".col-tap-btn--sign").first().click();
  await page.waitForTimeout(350);
  await tapDigit(page, botTens);
  await tapDigit(page, botOnes);
  await page.locator(".col-tap-btn--line").click();
  await page.waitForTimeout(900);

  // Fill the borrow-count square (types "1")
  await tapDigit(page, 1);
  await page.waitForTimeout(500);

  // Keyboard must now be hidden — the crossout step is active, waiting for a gesture
  const kbVisibleDuringCrossout = await page.locator(".col-tap-kb").count();
  console.log("Keyboard hidden during crossout step (expect 0):", kbVisibleDuringCrossout);
  await page.screenshot({ path: SC("600_crossout_active_no_kb.png") });

  // Locate the tens digit cell (the crossout target) via its bounding box
  const cellBox = await page.evaluate(() => {
    const svg = document.querySelector(".col-crossout-gesture");
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  console.log("Crossout gesture overlay bounding box:", JSON.stringify(cellBox));
  if (!cellBox) { console.log("!!! No .col-crossout-gesture overlay found !!!"); await browser.close(); return; }

  // Attempt 1: too short a drag — should NOT complete, keyboard should stay hidden, line should vanish
  const midY = cellBox.top + cellBox.height / 2;
  await touchDrag(cdp, [
    { x: cellBox.left + cellBox.width * 0.3, y: midY },
    { x: cellBox.left + cellBox.width * 0.5, y: midY },
  ]);
  await page.waitForTimeout(400);
  const afterShortDrag = await page.evaluate(() => ({
    kb: document.querySelectorAll(".col-tap-kb").length,
    crossed: document.querySelectorAll(".col-digit--top-borrowed").length,
  }));
  console.log("After short (incomplete) drag:", JSON.stringify(afterShortDrag));

  // Attempt 2: full left-to-right drag — should complete
  await touchDrag(cdp, [
    { x: cellBox.left + cellBox.width * 0.05, y: midY },
    { x: cellBox.left + cellBox.width * 0.3,  y: midY - 3 },
    { x: cellBox.left + cellBox.width * 0.6,  y: midY + 3 },
    { x: cellBox.left + cellBox.width * 0.95, y: midY },
  ]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: SC("601_after_full_drag.png") });

  const afterFullDrag = await page.evaluate(() => ({
    kb: document.querySelectorAll(".col-tap-kb").length,
    crossed: document.querySelectorAll(".col-digit--top-borrowed").length,
    markPath: document.querySelector(".col-crossout-mark path")?.getAttribute("d") ?? null,
  }));
  console.log("After full drag:", JSON.stringify({ ...afterFullDrag, markPath: afterFullDrag.markPath ? "present" : null }));

  // Continue the flow: adjust digit, then results
  await tapDigit(page, topTens - 1);
  await page.waitForTimeout(500);
  const onesResult = (topOnes + 10 - botOnes) % 10;
  await tapDigit(page, onesResult);
  await page.waitForTimeout(500);
  const tensResult = (topTens - 1) - botTens;
  await tapDigit(page, tensResult);
  await page.waitForTimeout(900);
  await page.screenshot({ path: SC("602_solved.png") });
  const solvedText = await page.locator(".col-expr-result").allInnerTexts();
  console.log("Result digits shown:", JSON.stringify(solvedText), "expected:", top - bottom);

  await browser.close();
  console.log("DONE");
})();
```

Run:
```bash
node "C:\Users\dmazn\AppData\Local\Temp\claude\c--Users-dmazn-Projects-Mirocard2\35adf863-6e21-444f-9660-d0d0f049497e\scratchpad\pw_verify_crossout_gesture.cjs"
```

Expected console output: `needBorrow=true`; `Keyboard hidden during crossout step (expect 0): 0`; a non-null `Crossout gesture overlay bounding box`; after the short drag, `{"kb":0,"crossed":0}` (still waiting, nothing crossed, keyboard still hidden — the incomplete attempt did *not* advance the flow); after the full drag, `{"kb":1,"crossed":1,"markPath":"present"}` (keyboard reappeared for the `adjust` step, the digit is crossed out, and the permanent hand-drawn mark is present); finally `Result digits shown` matching `top - bottom`. Read `600_crossout_active_no_kb.png` and `601_after_full_drag.png` with the Read tool and visually confirm: before the drag, the tens digit looks completely ordinary (no border/highlight); after, a visibly hand-drawn (not perfectly straight) red line crosses it and the digit text is dimmed gray. If the generated example doesn't need a borrow, re-run — `carryMode: "carry"` guarantees one within a couple of tries.

- [ ] **Step 10: Commit**

```bash
git add src/topics/renderers/column_addition/CrossoutGesture.jsx src/topics/renderers/column_addition/index.jsx src/topics/renderers/column_addition/column_addition.css
git commit -m "$(cat <<'EOF'
feat(column_addition): child draws the borrow-source cross-out gesture

The tens (source) digit no longer gets crossed out automatically the
instant the borrow count is filled. A new CrossoutGesture component
captures a left-to-right finger swipe on a transparent SVG overlay
over the ordinary .col-digit cell — no border or highlight hints at
interactivity beforehand. Completion requires ~70% horizontal spread
with net rightward motion, checked continuously during the drag; an
incomplete attempt just vanishes, no penalty. The finished hand-drawn
path (not a synthetic straight line) is kept permanently once the
gesture step completes and the flow moves on to the adjust-digit
input, matching every other mark in this flow being the child's own.
EOF
)"
```

---

### Task 3: Regression checks and report

**Files:** none (verification only)

- [ ] **Step 1: Run the full column_addition test suite**

Run: `npx vitest run src/topics/renderers/column_addition/engine.test.js --exclude "**/.worktrees/**" --exclude "**/runtime/**" --exclude "**/__codex_deploy*/**" --exclude "**/.codex-deploy*/**" --exclude "**/codex-deploy*/**"`
Expected: all Task 1 tests pass; only the pre-existing `FingerSystem` failures remain (verify count matches what was already confirmed earlier today, not a higher count).

- [ ] **Step 2: Playwright — comparison strip still works alongside the new crossout step**

Re-run a variant of `pw_verify_crossout_gesture.cjs` (Task 2, Step 9) but *without* clicking the `Сравнение` "Скрыт" button (leave the default `Показывать` in effect). After building the column, confirm the comparison strip (`.col-borrow-compare`) appears first; tap the correct sign; confirm the strip disappears and the borrow-count square becomes active; type `1`; confirm the keyboard hides again for the crossout step; perform the full-width touch drag; confirm the digit crosses out and the flow proceeds through `adjust` and the two result digits to the correct final answer. This confirms the two flow enhancements (comparison strip from `docs/superpowers/specs/2026-07-15-column-borrow-teaching-design.md` and the crossout gesture from this spec) compose correctly rather than conflicting.

- [ ] **Step 3: Playwright — addition-with-carry regression check**

Run a variant selecting `Только +` / `С переносом / займом`, solve one full example, and confirm: no `.col-crossout-gesture` or `.col-crossout-mark` element ever appears, no `.col-digit--top-borrowed` class appears, the carry cell behaves exactly as before (same position, same fill behavior), and the final sum is correct.

- [ ] **Step 4: Playwright — subtraction without a borrow regression check**

Run a variant with `Только −` / `Без переноса / займа`, solve one example, and confirm: no comparison strip, no aux cells, no crossout overlay or mark, identical to pre-change behavior.

- [ ] **Step 5: Report findings**

Summarize pass/fail for each of the four flows (subtract+borrow with crossout alone, subtract+borrow with comparison strip *and* crossout composed together, addition+carry, subtraction without borrow) before moving to the finishing-a-development-branch step.

---

## After all tasks

Once all 3 tasks are complete and verified, use the **superpowers:finishing-a-development-branch** skill to decide how to integrate the work (this repo has no long-lived feature branches in its normal workflow — confirm with the user whether these commits should be deployed via `npm run deploy:prod` directly on `main`, matching every other change shipped this session).
