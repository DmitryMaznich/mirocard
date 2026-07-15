# Column Subtraction Borrow Teaching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach "заём десятка" (borrowing a ten) inside the existing "Столбик" mode, at the exact column where it's needed, by fixing a real digit-crossing bug and adding a child-driven comparison + input-square sequence — all gated to only affect subtraction tasks that actually need a borrow.

**Architecture:** Two engine-level changes (repositioning the existing `borrow` step, adding a new `adjust` step) in `engine.js`, matched by a rendering fix + a small new comparison component in `index.jsx`, plus one new mode param in `topicLoader.js`. No new files beyond the plan's CSS additions; everything reuses the real, already-shipped `.col-carry-cell` / `.col-digit--top-borrowed` / `.col-digit-adjusted` visual language.

**Tech Stack:** React function components, plain CSS (no CSS-in-JS), Vitest for pure-logic tests, Playwright (touch-emulated, per this project's established convention) for UI verification since this codebase has no React component test harness.

## Global Constraints

- The new UI applies **only** when `task.operation === "subtract"` **and** at least one of `task.columns` has `borrowOut === 1`. Every other case (addition, subtraction without a borrow) must render byte-for-byte identical to today — verify by comparing screenshots of an addition-with-carry task before and after this change.
- Every mark the child sees (the comparison sign, the borrowed-count digit, the reduced digit, the result digits) must be entered by the child's own tap — nothing is auto-computed and displayed for them.
- New "Сравнение" mode param defaults to `true` (comparison step shown), matching `docs/superpowers/specs/2026-07-15-column-borrow-teaching-design.md`.
- The borrow-count square renders at the **receiving** column's position (e.g. "units"), the reduced-digit square at the **source** column's position (e.g. "tens") — confirmed against the validated mockup, not the pre-existing (differently-positioned) behavior.
- Reuse `.col-carry-cell` for both new input squares — do not invent a new square visual.
- Playwright verification must use real touch events (`Input.dispatchTouchEvent` via CDP), not `page.mouse`, per `[[feedback_playwright_touch_vs_mouse_dnd]]` — this mode's tap targets are plain buttons (not drag), so this mostly matters for confirming tap targets are large/reliable enough, but use touch context (`hasTouch: true`) throughout regardless.

---

### Task 1: Reposition the `borrow` step and add the `adjust` step (engine.js)

**Files:**
- Modify: `src/topics/renderers/column_addition/engine.js:58-69` (`buildSubSteps`)
- Modify: `src/topics/renderers/column_addition/engine.js` (add `taskNeedsBorrowTeaching` export near the bottom, before `generateTasks`)
- Test: `src/topics/renderers/column_addition/engine.test.js`

**Interfaces:**
- Consumes: `columns` array from `buildSubColumns` — each entry has `{ position, topDigit, bottomDigit, borrowIn, borrowOut, effectiveTopDigit, writeDigit }` (unchanged by this task).
- Produces: `buildSubSteps(columns)` now returns steps shaped `{ cellType: "borrow"|"adjust"|"result", position, digit }`, where a borrow situation produces `borrow` (at the *lower/receiving* column's position, digit `1`) immediately followed by `adjust` (at the *next/source* column's position, digit `next.topDigit - 1`), before the existing `result` step for the lower column. `export function taskNeedsBorrowTeaching(task)` returns `boolean`, consumed by Task 4.

- [ ] **Step 1: Write the failing tests**

Open `src/topics/renderers/column_addition/engine.test.js` and add this new `describe` block right after the existing `describe("generateTasks – column_arithmetic", ...)` block (after its closing `});` on line 91, before `describe("FingerSystem", ...)`  on line 93):

```js
describe("buildSubSteps borrow/adjust step shape", () => {
  it("borrow step sits at the receiving (lower) column's own position", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 30, { operation: "subtract", carryMode: "carry", digits: 2 });
    const t = tasks.find((task) => task.columns[0].borrowOut > 0);
    expect(t).toBeDefined();
    const borrowStep = t.steps.find((s) => s.cellType === "borrow");
    expect(borrowStep.position).toBe("units");
    expect(borrowStep.digit).toBe(1);
  });

  it("adjust step sits at the source (higher) column's position with topDigit-1", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 30, { operation: "subtract", carryMode: "carry", digits: 2 });
    const t = tasks.find((task) => task.columns[0].borrowOut > 0);
    const adjustStep = t.steps.find((s) => s.cellType === "adjust");
    expect(adjustStep.position).toBe("tens");
    expect(adjustStep.digit).toBe(t.columns[1].topDigit - 1);
  });

  it("step order is borrow, adjust, result(lower), result(higher)", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 30, { operation: "subtract", carryMode: "carry", digits: 2 });
    const t = tasks.find((task) => task.columns[0].borrowOut > 0);
    expect(t.steps.map((s) => s.cellType)).toEqual(["borrow", "adjust", "result", "result"]);
  });

  it("no adjust step when the column doesn't need a borrow", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 30, { operation: "subtract", carryMode: "none", digits: 2 });
    for (const t of tasks) {
      expect(t.steps.some((s) => s.cellType === "adjust")).toBe(false);
      expect(t.steps.some((s) => s.cellType === "borrow")).toBe(false);
    }
  });
});

describe("taskNeedsBorrowTeaching", () => {
  it("true for subtraction tasks with a borrow", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 30, { operation: "subtract", carryMode: "carry", digits: 2 });
    expect(tasks.every(taskNeedsBorrowTeaching)).toBe(true);
  });

  it("false for addition tasks, even with carry", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "add", carryMode: "carry", digits: 2 });
    expect(tasks.every((t) => !taskNeedsBorrowTeaching(t))).toBe(true);
  });

  it("false for subtraction tasks without a borrow", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "subtract", carryMode: "none", digits: 2 });
    expect(tasks.every((t) => !taskNeedsBorrowTeaching(t))).toBe(true);
  });
});
```

Also update the import line at the top of the file (currently `import { generateTasks } from "./engine.js";`) to:

```js
import { generateTasks, taskNeedsBorrowTeaching } from "./engine.js";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/topics/renderers/column_addition/engine.test.js --exclude "**/.worktrees/**" --exclude "**/runtime/**" --exclude "**/__codex_deploy*/**" --exclude "**/.codex-deploy*/**" --exclude "**/codex-deploy*/**"`
Expected: FAIL — `taskNeedsBorrowTeaching is not a function` (import error) and/or the borrow-step-position assertions fail (currently `borrowStep.position` is `"tens"`, not `"units"`).

- [ ] **Step 3: Implement `buildSubSteps` change**

In `src/topics/renderers/column_addition/engine.js`, replace the current `buildSubSteps` function (lines 58-69):

```js
function buildSubSteps(columns) {
  const steps = [];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const next = columns[i + 1];
    if (col.borrowOut > 0 && next) {
      steps.push({ cellType: "borrow", position: next.position, digit: 1 });
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
      // "adjust" sits at the SOURCE column (one place higher) — the child
      // computes and types its own reduced digit (topDigit - 1) themselves.
      steps.push({ cellType: "adjust", position: next.position, digit: next.topDigit - 1 });
    }
    steps.push({ cellType: "result", position: col.position, digit: col.writeDigit });
  }
  return steps;
}
```

- [ ] **Step 4: Add `taskNeedsBorrowTeaching`**

In `src/topics/renderers/column_addition/engine.js`, add this exported function directly above `export function generateTasks(...)`:

```js
// Gate for the borrow-teaching UI (comparison strip + borrow/adjust squares):
// only subtraction tasks that actually contain a borrow qualify. Addition,
// and subtraction tasks generated without a borrow, are untouched by it.
export function taskNeedsBorrowTeaching(task) {
  return task?.operation === "subtract" && (task?.columns ?? []).some((c) => c.borrowOut > 0);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/topics/renderers/column_addition/engine.test.js --exclude "**/.worktrees/**" --exclude "**/runtime/**" --exclude "**/__codex_deploy*/**" --exclude "**/.codex-deploy*/**" --exclude "**/codex-deploy*/**"`
Expected: PASS (all tests in the two new `describe` blocks, plus every pre-existing test — none of them asserted on borrow step position, so none should have broken).

- [ ] **Step 6: Lint**

Run: `npx eslint src/topics/renderers/column_addition/engine.js src/topics/renderers/column_addition/engine.test.js`
Expected: no output (clean).

- [ ] **Step 7: Commit**

```bash
git add src/topics/renderers/column_addition/engine.js src/topics/renderers/column_addition/engine.test.js
git commit -m "$(cat <<'EOF'
feat(column_addition): reposition borrow step, add adjust step

borrow now sits at the receiving column's own position (matches the
validated mockup: the "1" appears with the digit that needed it, not
the digit that gave it away). New adjust step lets the child type the
reduced source digit themselves instead of it being auto-computed.
Addition's carry steps are untouched (separate function).
EOF
)"
```

---

### Task 2: Fix the crossed-out-digit bug and unify aux-cell rendering (index.jsx)

**Files:**
- Modify: `src/topics/renderers/column_addition/index.jsx:119-160` (aux-cell loop), `:186-201` (top-row crossed-digit rendering)
- Modify: `src/topics/renderers/column_addition/column_addition.css` (remove now-dead `.col-effective-label` rule)

**Interfaces:**
- Consumes: `task.steps` shape from Task 1 (`borrow`/`adjust`/`result`/`carry` entries with `position`), `task.columns[i].borrowOut`.
- Produces: `ColumnGrid` renders one `.col-carry-cell` per aux step (carry, borrow, or adjust) at that step's own position; the top-row digit at position `i` gets `.col-digit--top-borrowed` once the *lower* column's `borrow` cell is filled, and shows its own filled `adjust` value (not an auto-computed one) once that's filled too.

Currently there is no automated test harness for React components in this codebase — verify this task with Playwright screenshots (Step 5) rather than Vitest.

- [ ] **Step 1: Replace the aux-cell (carry/borrow/adjust) rendering block**

In `src/topics/renderers/column_addition/index.jsx`, replace lines 119-160 (from `// ── Carry / borrow row (phase 2 only) ────` through the closing `}` of the `if (phase === "solve") {` block that contains the old `hasAux` logic) with:

```js
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
```

- [ ] **Step 2: Fix the crossed-out-digit condition**

In the same file, find the top-row rendering `else` branch (originally lines 186-201, now shifted up slightly by Step 1's edit — search for `wasBorrowedFrom`):

```js
    } else {
      const wasBorrowedFrom =
        operation === "subtract" &&
        col.borrowOut === 1 &&
        filledCells[`borrow:${POSITIONS[i + 1]}`] !== undefined;
      cells.push(
        <div
          key={`top:${pos}`}
          className={["col-digit", wasBorrowedFrom ? "col-digit--top-borrowed" : ""].filter(Boolean).join(" ")}
          style={{ ...digitStyle, gridColumn: gridCol, gridRow: 2 }}
        >
          {col.topDigit}
          {wasBorrowedFrom && <span className="col-digit-adjusted">{col.topDigit - 1}</span>}
        </div>
      );
    }
```

Replace with:

```js
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

- [ ] **Step 3: Remove the now-dead `.col-effective-label` CSS rule**

In `src/topics/renderers/column_addition/column_addition.css`, find and delete the `.col-effective-label` rule (it was only ever referenced by the code just removed in Step 1 — grep to confirm before deleting):

```bash
grep -n "col-effective-label" src/topics/renderers/column_addition/*.css src/topics/renderers/column_addition/*.jsx
```

Expected: after Step 1's edit, zero matches in `index.jsx` — only the CSS rule itself remains. Delete that rule block from `column_addition.css`.

- [ ] **Step 4: Lint**

Run: `npx eslint src/topics/renderers/column_addition/index.jsx`
Expected: no output.

- [ ] **Step 5: Verify with Playwright (real touch, real interaction)**

Create `C:\Users\dmazn\AppData\Local\Temp\claude\c--Users-dmazn-Projects-Mirocard2\35adf863-6e21-444f-9660-d0d0f049497e\scratchpad\pw_verify_borrow_fix.cjs`:

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

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
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
    await page.fill('input[placeholder="Имя ученика"]', "Тест3");
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
  if (!needBorrow) { console.log("Random example had no borrow — re-run to get one."); await browser.close(); return; }

  // Build the column
  await tapDigit(page, topTens);
  await tapDigit(page, topOnes);
  await page.locator(".col-tap-btn--sign").first().click();
  await page.waitForTimeout(350);
  await tapDigit(page, botTens);
  await tapDigit(page, botOnes);
  await page.locator(".col-tap-btn--line").click();
  await page.waitForTimeout(900);

  // Solve step: borrow now expects "1" typed while the ONES digit is highlighted
  await tapDigit(page, 1);
  await page.waitForTimeout(500);
  await page.screenshot({ path: SC("300_after_borrow_entry.png") });

  const crossedIsTens = await page.evaluate(() => {
    const digits = Array.from(document.querySelectorAll(".col-digit"));
    // top row is grid-row:2; tens is the leftmost of the two top-row cells for a 2-digit number
    const topRow = digits.filter(d => getComputedStyle(d).gridRowStart === "2");
    return topRow.some(d => d.classList.contains("col-digit--top-borrowed") && d.textContent.trim().startsWith(String(top).slice(0,1)));
  });
  console.log("Tens digit (source) is the one crossed out:", crossedIsTens);

  const adjustDigit = (topTens - 1) - botTens >= 0 ? topTens - 1 : null; // just the reduced value, not the final result
  await tapDigit(page, topTens - 1);
  await page.waitForTimeout(500);
  await page.screenshot({ path: SC("301_after_adjust_entry.png") });

  const onesResult = (topOnes + 10 - botOnes) % 10;
  await tapDigit(page, onesResult);
  await page.waitForTimeout(500);
  const tensResult = (topTens - 1) - botTens;
  await tapDigit(page, tensResult);
  await page.waitForTimeout(900);
  await page.screenshot({ path: SC("302_solved.png") });
  const solvedText = await page.locator(".col-expr-result").allInnerTexts();
  console.log("Result digits shown:", JSON.stringify(solvedText), "expected:", top - bottom);

  await browser.close();
  console.log("DONE");
})();
```

Run:
```bash
node "C:\Users\dmazn\AppData\Local\Temp\claude\c--Users-dmazn-Projects-Mirocard2\35adf863-6e21-444f-9660-d0d0f049497e\scratchpad\pw_verify_borrow_fix.cjs"
```

Expected console output: `needBorrow=true`, `Tens digit (source) is the one crossed out: true`. Read `300_after_borrow_entry.png` and `301_after_adjust_entry.png` with the Read tool and visually confirm: the borrow square with "1" sits above the **units** digit, the **tens** digit (not units) is crossed out with a red line, and after Step "301" a small badge showing the reduced tens digit appears attached to that crossed-out tens digit. If the example generated doesn't need a borrow, re-run — `carryMode: "carry"` guarantees one eventually within a couple of tries.

- [ ] **Step 6: Verify addition is untouched**

Re-run the same kind of flow but select `Только +` and `С переносом / займом` on the params screen instead, solve one carry example, and confirm visually the carry cell still appears above the correct (higher) position exactly as before — take a screenshot and eyeball it against the pre-change behavior (no aux-cell should be crossed out for addition; `.col-digit--top-borrowed` never applies when `operation !== "subtract"`).

- [ ] **Step 7: Commit**

```bash
git add src/topics/renderers/column_addition/index.jsx src/topics/renderers/column_addition/column_addition.css
git commit -m "$(cat <<'EOF'
fix(column_addition): cross out the borrow SOURCE digit, not the receiver

wasBorrowedFrom was checking this column's own borrowOut and the next
column's filled state, which flagged the receiving digit (e.g. units)
instead of the column that actually gave up a ten (tens). Verified on
a live example (71-19) that the wrong digit was being struck through
with a nonsensical adjusted value. Also unifies carry/borrow/adjust
aux-cell rendering into one loop driven by task.steps instead of a
fixed position range, and drops the now-redundant col-effective-label
(the fixed adjusted-digit badge already shows the same information,
now filled by the child's own entry).
EOF
)"
```

---

### Task 3: Add the "Сравнение" mode param

**Files:**
- Modify: `src/topics/topicLoader.js:1034-1063` (column_arithmetic `params`), `:583-596` (column_arithmetic methodology)

**Interfaces:**
- Produces: `sessionParams.showCompare` (boolean, default `true`), read by Task 4's gating logic in `ColumnArithmeticTask`.

- [ ] **Step 1: Add the param**

In `src/topics/topicLoader.js`, inside the `column_arithmetic` mode's `params` object (after the `showHelper` entry, before the closing `},` at line 1062), add:

```js
        showCompare: {
          type: "enum",
          values: [true, false],
          labels: { ru: { "true": "Показывать", "false": "Скрыт" } },
          default: true,
          label: { ru: "Сравнение" },
        },
```

- [ ] **Step 2: Update the methodology text**

In the same file, find the `column_arithmetic` entry inside `DEFAULT_MODE_METHODOLOGY` (starts at line 583). Update the `settings` array to add a line about the new param, and the `tips` array to explain the new borrow flow. Replace:

```js
    column_arithmetic: {
      summary: "Реши пример в столбик.",
      text: "На экране — пример в столбик на клетчатом фоне. Ребёнок перетаскивает цифры из лотка: сначала результат единиц, затем перенос (или заём), затем результат десятков.",
      settings: [
        "«Операция» — выберите сложение, вычитание или оба.",
        "«Перенос / заём» — упражняйте сначала без переноса, потом с переносом, потом микс.",
        "«Разрядность» — начинайте с 2-значных чисел.",
      ],
      goal: "Ребёнок решает пример по правильному алгоритму, шаг за шагом, без ошибок в порядке действий.",
      tips: [
        "Проговаривайте вслух каждый шаг: «Сначала единицы: 7 + 5 = 12, пишем 2, переносим 1».",
        "Если ребёнок тянет цифру в неверную клетку, клетка вибрирует — не сердитесь, это подсказка.",
      ],
    },
```

with:

```js
    column_arithmetic: {
      summary: "Реши пример в столбик.",
      text: "На экране — пример в столбик на клетчатом фоне. Ребёнок перетаскивает цифры из лотка: сначала результат единиц, затем перенос (или заём), затем результат десятков. При вычитании с займом: сначала ребёнок сравнивает цифры разряда и решает, хватает ли единиц, затем сам вводит количество занятых десятков и сам считает и вводит уменьшенную цифру соседнего разряда — ничего не подставляется за него.",
      settings: [
        "«Операция» — выберите сложение, вычитание или оба.",
        "«Перенос / заём» — упражняйте сначала без переноса, потом с переносом, потом микс.",
        "«Разрядность» — начинайте с 2-значных чисел.",
        "«Сравнение» — перед займом ребёнок сравнивает цифры разряда и решает, хватает ли единиц; выключите этот шаг, когда ребёнок перестанет в нём нуждаться.",
      ],
      goal: "Ребёнок решает пример по правильному алгоритму, шаг за шагом, без ошибок в порядке действий, и понимает, откуда берётся каждая цифра при займе.",
      tips: [
        "Проговаривайте вслух каждый шаг: «Сначала единицы: 7 + 5 = 12, пишем 2, переносим 1».",
        "Если ребёнок тянет цифру в неверную клетку, клетка вибрирует — не сердитесь, это подсказка.",
        "При займе: не подсказывайте уменьшенную цифру десятка — дайте ребёнку самому вычесть единицу и ввести результат.",
      ],
    },
```

- [ ] **Step 3: Lint**

Run: `npx eslint src/topics/topicLoader.js`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/topics/topicLoader.js
git commit -m "$(cat <<'EOF'
feat(column_addition): add "Сравнение" param for the borrow-teaching flow

Boolean mode param, default on, consumed by the comparison strip
added in the next task. Also documents the new borrow flow in the
mode's parent-facing methodology text.
EOF
)"
```

---

### Task 4: Build the comparison strip and wire it into the solve flow

**Files:**
- Modify: `src/topics/renderers/column_addition/index.jsx` (new `BorrowCompareStrip` component + wiring into `ColumnArithmeticTask`)
- Modify: `src/topics/renderers/column_addition/column_addition.css` (new `.col-borrow-compare*` rules)

**Interfaces:**
- Consumes: `taskNeedsBorrowTeaching` from `./engine.js` (Task 1), `task.columns`, `activeStep` (existing local state in `ColumnArithmeticTask`), `sessionParams.showCompare` (Task 3).
- Produces: no new exports — purely internal to this renderer.

- [ ] **Step 1: Import `taskNeedsBorrowTeaching`**

In `src/topics/renderers/column_addition/index.jsx`, change the top import line:

```js
import { generateExamples } from "./engine.js";
```

to:

```js
import { generateExamples, taskNeedsBorrowTeaching } from "./engine.js";
```

- [ ] **Step 2: Add the `BorrowCompareStrip` component**

In the same file, add this new component directly after the `TapKeyboard` component definition (after its closing `}` and before the `// ── Column grid ──` comment):

```js
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
```

- [ ] **Step 3: Add `resolvedCompares` state to `ColumnArithmeticTask`**

In the same file, inside `function ColumnArithmeticTask(...)`, find the state declarations (starting `const [phase, setPhase] = useState("form");`) and add one more line right after `const [solved, setSolved] = useState(false);`:

```js
  const [resolvedCompares, setResolvedCompares] = useState(new Set());
```

- [ ] **Step 4: Reset `resolvedCompares` when the task changes**

In the same file, find the `useEffect` that resets state on task change (starts `useEffect(() => { setPhase("form"); ...`, has `[task.cardId, task.top, task.bottom, task.operation]` as its dependency array). Add one line inside it, after `setSolved(false);`:

```js
    setResolvedCompares(new Set());
```

- [ ] **Step 5: Compute the gating condition and render the strip**

In the same file, inside `ColumnArithmeticTask`'s function body, right before the `return (` statement, add:

```js
  const showCompareParam = sessionParams?.showCompare ?? true;
  const showingCompare =
    phase === "solve" &&
    activeStep?.cellType === "borrow" &&
    showCompareParam &&
    taskNeedsBorrowTeaching(task) &&
    !resolvedCompares.has(activeStep.position);

  const compareColumn = showingCompare ? task.columns[POS_INDEX[activeStep.position]] : null;
```

Then, in the `return (...)` JSX, change:

```jsx
      {showHelper && (
        <div className="col-helper-area">
          <HelperPanel maxNumber={20} showMoveHint={false} onClose={() => setShowHelper(false)} />
        </div>
      )}

      <TapKeyboard
        phase={phase}
        operation={task.operation}
        onDigit={(d) => phase === "form" ? handleFormTap(d, "digit") : handleSolveTap(d)}
        onSign={(s) => handleFormTap(s, "sign")}
        onLine={() => handleFormTap(null, "line")}
        btnSize={cellSize}
      />

      {!showHelper && !!sessionParams?.showHelper && (
```

to:

```jsx
      {showHelper && (
        <div className="col-helper-area">
          <HelperPanel maxNumber={20} showMoveHint={false} onClose={() => setShowHelper(false)} />
        </div>
      )}

      {showingCompare && compareColumn && (
        <BorrowCompareStrip
          topDigit={compareColumn.topDigit}
          bottomDigit={compareColumn.bottomDigit}
          onResolve={() => setResolvedCompares((prev) => new Set(prev).add(activeStep.position))}
        />
      )}

      {!showingCompare && (
        <TapKeyboard
          phase={phase}
          operation={task.operation}
          onDigit={(d) => phase === "form" ? handleFormTap(d, "digit") : handleSolveTap(d)}
          onSign={(s) => handleFormTap(s, "sign")}
          onLine={() => handleFormTap(null, "line")}
          btnSize={cellSize}
        />
      )}

      {!showHelper && !showingCompare && !!sessionParams?.showHelper && (
```

(Only the two conditions on the last line and the keyboard's wrapping changed — the button's own JSX body is unchanged.)

- [ ] **Step 6: Add CSS for the comparison strip**

In `src/topics/renderers/column_addition/column_addition.css`, add this block (a good spot is right after the `.col-tap-btn--line:active { ... }` rule, before `/* ── Helper panel wrapper ───────────────────── */`):

```css
/* ── Borrow comparison strip ─────────────────── */

.col-borrow-compare {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  flex-shrink: 0;
}

.col-borrow-compare-expr {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
  font-family: 'Primo', cursive;
}

.col-borrow-compare-blank {
  min-width: 20px;
  text-align: center;
  color: #94a3b8;
}

.col-borrow-compare-btns {
  display: flex;
  gap: 8px;
}

.col-borrow-compare-btn {
  width: 40px;
  height: 40px;
  font-size: 18px;
  font-weight: 700;
  font-family: 'Primo', cursive;
  border-radius: 10px;
  border: 2px solid #dbeafe;
  background: #fff;
  box-shadow: 0 3px 0 #c7d2fe;
  cursor: pointer;
  color: #1a1a2e;
}

.col-borrow-compare-btn:active {
  transform: translateY(2px);
  box-shadow: none;
}

.col-borrow-compare-btn--shake {
  animation: col-shake 0.4s ease-in-out;
}
```

- [ ] **Step 7: Lint**

Run: `npx eslint src/topics/renderers/column_addition/index.jsx`
Expected: no output.

- [ ] **Step 8: Verify with Playwright (real touch)**

Extend `pw_verify_borrow_fix.cjs` from Task 2 (or copy it to a new file `pw_verify_compare_strip.cjs`): after building the column and before typing the borrow digit, take a screenshot and confirm the comparison strip is visible with the two ones-digits and three sign buttons, tap the *wrong* sign first (expect a shake, no crash, still on the strip), then tap the correct sign and confirm the strip disappears and the keyboard reappears, then continue exactly as Task 2's script did (borrow → adjust → results) and confirm it still reaches the correct final answer.

Concretely, insert this block right after the `await page.waitForTimeout(900);` that follows building the column (before `// Solve step: borrow now expects "1"...`):

```js
  await page.screenshot({ path: SC("310_compare_strip_shown.png") });
  const wrongSign = topOnes < botOnes ? ">" : "<"; // deliberately wrong for this example
  await page.locator(".col-borrow-compare-btn").filter({ hasText: wrongSign }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: SC("311_compare_strip_shake.png") });
  const correctSign = topOnes < botOnes ? "<" : topOnes > botOnes ? ">" : "=";
  await page.locator(".col-borrow-compare-btn").filter({ hasText: correctSign }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: SC("312_compare_strip_resolved.png") });
  const stripGone = await page.locator(".col-borrow-compare").count();
  console.log("Compare strip gone after resolving:", stripGone === 0);
```

Run the script, read `310_compare_strip_shown.png` through `312_compare_strip_resolved.png` with the Read tool, and confirm: the strip shows the correct two digits, the wrong-sign tap shakes without crashing, the correct-sign tap makes the strip disappear and the keyboard reappear, and the console prints `Compare strip gone after resolving: true`.

- [ ] **Step 9: Verify the `showCompare: false` path**

Repeat Step 8 but first select `Скрыт` for the new «Сравнение» param on the params screen (it will be the 5th param row, alongside `Операция`/`Перенос / заём`/`Разрядность`/`Помощник (палка)`). Confirm the comparison strip never appears and the flow goes straight from the built column to the borrow square being active on the keyboard.

- [ ] **Step 10: Commit**

```bash
git add src/topics/renderers/column_addition/index.jsx src/topics/renderers/column_addition/column_addition.css
git commit -m "$(cat <<'EOF'
feat(column_addition): add borrow comparison strip, gated by Сравнение

Before a borrow step becomes active, the child compares the column's
own top/bottom digits and taps the correct sign (reusing the same
tap-a-sign interaction as Сравнение чисел's ComparePutSign, scaled
down) — resolving it is what reveals the borrow square, not an
automatic transition. Gated on taskNeedsBorrowTeaching(task) and the
new showCompare param so addition and non-borrow subtraction are
completely unaffected.
EOF
)"
```

---

### Task 5: Full end-to-end verification and regression check

**Files:** none (verification only)

- [ ] **Step 1: Run the full column_addition test suite**

Run: `npx vitest run src/topics/renderers/column_addition/engine.test.js src/topics/topicLoader.test.js --exclude "**/.worktrees/**" --exclude "**/runtime/**" --exclude "**/__codex_deploy*/**" --exclude "**/.codex-deploy*/**" --exclude "**/codex-deploy*/**"`
Expected: all new tests pass; any pre-existing failures must be the same ones already known to be unrelated to this feature (cross-check against `git stash` + re-run if any unexpected failure appears, per this project's established practice of verifying pre-existing-vs-introduced failures before assuming a regression).

- [ ] **Step 2: Playwright — full 2-digit borrow example, comparison on (default)**

Re-run `pw_verify_compare_strip.cjs` from Task 4 two or three times (regenerating a fresh example each time, since it's randomly generated) until you've observed at least one full pass with a real borrow-needing example end to end, confirming: correct final answer shown, tens digit crossed out (not units), comparison strip appeared and gated the borrow square correctly.

- [ ] **Step 3: Playwright — addition-with-carry regression check**

Run a variant selecting `Только +` / `С переносом / займом` instead of subtraction, solve one full example, and confirm: the comparison strip never appears (addition doesn't call `taskNeedsBorrowTeaching` as true), the carry cell behaves exactly as it did before this change (same position, same fill behavior), and the final sum is correct.

- [ ] **Step 4: Playwright — subtraction without a borrow regression check**

Run a variant with `Только −` / `Без переноса / займа`, solve one example, and confirm: no comparison strip, no aux cells at all, identical to pre-change behavior.

- [ ] **Step 5: Report findings**

Summarize pass/fail for each of the three flows (subtraction+borrow, addition+carry, subtraction without borrow) before moving to the finishing-a-development-branch step.

---

## After all tasks

Once all 5 tasks are complete and verified, use the **superpowers:finishing-a-development-branch** skill to decide how to integrate the work (this repo has no long-lived feature branches in its normal workflow — confirm with the user whether these commits should be deployed via `npm run deploy:prod` directly on `main`, matching how every other change in this session was shipped).
