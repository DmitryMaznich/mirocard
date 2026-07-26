# Place-value visual unification: «Какое это число?» и «Разменяй десяток» → стиль «Собери число» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `IdentifyNumberTask.jsx` («Какое это число?») and `RegroupTenTask.jsx` («Разменяй десяток») to visual/mechanical parity with the just-polished `BuildNumberTask.jsx` («Собери число»): coins instead of cubes/ten-cards, no TTS, no live counter, a phased checklist, and (for identify_number) a wrong-answer model that keeps the correct digit and hints direction on the wrong one.

**Architecture:** Both components keep their existing top-level shape (own state machine, own JSX tree) — this is a rewrite-in-place of two files, not a new abstraction. `hintDirectionFor` moves from `BuildNumberTask.jsx` to `placeValueLabels.js` so all three components import it from one place. `PlaceValueBlocks.jsx` becomes fully dead once both files stop importing it, and is deleted. Dead params (`showCounters`, and `numericBlocks` for these two modes only) are removed end-to-end: topic schema → `engine.js` generators → `generateTasks` dispatch → task object → component.

**Tech Stack:** React 19 function components/hooks, `@dnd-kit/core` (regroup_ten's single drag), Vitest 4 + raw `react-dom/client` mount tests (no `@testing-library`).

## Global Constraints

- No live TTS (`useSpeech`/`speak`) and no live tens/ones text counter in either file — established build_number principle: the UI never counts or answers for the child.
- `AnswerSlot`/`ChecklistItem`/`CheckIcon` are copied into each file, not imported from `BuildNumberTask.jsx` — this codebase's established rule is duplicate-per-family-file so one mode's visuals can be retouched without risk to its siblings ([designing-mirocard-screens](../../../.claude/skills/designing-mirocard-screens/SKILL.md) — "Why duplicated, not shared").
- `RegroupTenTask.jsx`'s result panel (before/after equation + «Далее →» button) stays as-is — the one deliberate exception to "auto-advance like build_number", per the approved spec.
- Every new/changed file that touches `.pv-screen`/`.cb-screen` reuses existing classes from `place_value.css`/`coins.css` (`pv-checklist*`, `pv-answer-slot*`, `cb-area--focus`, `pv-zone*`) — no new CSS in this plan.

---

### Task 1: Move `hintDirectionFor` into `placeValueLabels.js`

**Files:**
- Modify: `src/topics/renderers/column_addition/placeValueLabels.js`
- Modify: `src/topics/renderers/column_addition/BuildNumberTask.jsx:218-222` (remove local definition, import instead)
- Modify: `src/topics/renderers/column_addition/buildNumber.smoke.test.jsx:4` (import source)

**Interfaces:**
- Produces: `export function hintDirectionFor(guess, target)` from `placeValueLabels.js`, returning `"more"` when `guess < target`, else `"less"`. Task 3 (`IdentifyNumberTask.jsx`) imports this.

- [ ] **Step 1: Add `hintDirectionFor` to `placeValueLabels.js`**

Find (end of file, after `pluralCoins`):
```js
export function pluralCoins(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "монет";
  const mod10 = n % 10;
  if (mod10 === 1) return "монету";
  if (mod10 >= 2 && mod10 <= 4) return "монеты";
  return "монет";
}
```

Replace with:
```js
export function pluralCoins(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "монет";
  const mod10 = n % 10;
  if (mod10 === 1) return "монету";
  if (mod10 >= 2 && mod10 <= 4) return "монеты";
  return "монет";
}

// Shared by every place-value mode with a digit-entry answer step
// (BuildNumberTask, IdentifyNumberTask): direction is purely a function of
// the wrong digit vs the target, no component state involved.
export function hintDirectionFor(guess, target) {
  return guess < target ? "more" : "less";
}
```

- [ ] **Step 2: Remove the local definition from `BuildNumberTask.jsx` and import it instead**

Find:
```js
import { Coin, TenStack, PILE_LAYOUT } from "./CoinBlocks.jsx";
import { pluralCoins } from "./placeValueLabels.js";
import { useFitOneLine } from "./textFit.js";
```

Replace with:
```js
import { Coin, TenStack, PILE_LAYOUT } from "./CoinBlocks.jsx";
import { pluralCoins, hintDirectionFor } from "./placeValueLabels.js";
import { useFitOneLine } from "./textFit.js";
```

Find:
```js
// Exported for its own unit test — direction is purely a function of the
// wrong digit vs the target, no component state involved.
export function hintDirectionFor(guess, target) {
  return guess < target ? "more" : "less";
}

export default function BuildNumberTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
```

Replace with:
```js
export default function BuildNumberTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
```

- [ ] **Step 3: Update the smoke test's import source**

Find (`buildNumber.smoke.test.jsx`):
```js
import BuildNumberTask, { hintDirectionFor } from "./BuildNumberTask.jsx";
```

Replace with:
```js
import BuildNumberTask from "./BuildNumberTask.jsx";
import { hintDirectionFor } from "./placeValueLabels.js";
```

- [ ] **Step 4: Run the build_number tests to confirm nothing broke**

Run: `npx vitest run src/topics/renderers/column_addition/buildNumber.smoke.test.jsx --exclude "**/.worktrees/**" --exclude "**/codex-deploy*/**" --exclude "**/.codex-deploy*/**" --exclude "**/__codex_deploy*/**"`
Expected: PASS (3 tests: 2 `hintDirectionFor`, 1 mount).

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/column_addition/placeValueLabels.js src/topics/renderers/column_addition/BuildNumberTask.jsx src/topics/renderers/column_addition/buildNumber.smoke.test.jsx
git commit -m "refactor(place_value): move hintDirectionFor into placeValueLabels.js"
```

---

### Task 2: Remove dead `showCounters`/`numericBlocks` params for identify_number and regroup_ten

**Files:**
- Modify: `src/topics/renderers/column_addition/engine.js:222-248,338-359`
- Modify: `src/topics/renderers/column_addition/engine.test.js:410-455`
- Modify: `src/topics/topicLoader.js:1110-1166`

**Interfaces:**
- Produces: `generateIdentifyNumberTask(card, maxOnes)` → task object without `numericBlocks`/`showCounters` fields. `generateRegroupTask(card, maxOnes)` → task object without `numericBlocks`. Task 3 and Task 4's rewritten components rely on task objects NOT carrying these fields (they no longer read them).

Both `showCounters` (identify_number's live counter, being removed) and `numericBlocks` (already unconfigurable for these two modes — no schema param sets it, so `params.numericBlocks` is always `undefined` → `false`; confirmed by grepping `topicLoader.js`'s `identify_number`/`regroup_ten` param blocks, neither declares it) are being deleted, not just defaulted differently.

- [ ] **Step 1: Simplify `generateIdentifyNumberTask` and `generateRegroupTask` in `engine.js`**

Find:
```js
export function generateIdentifyNumberTask(card, maxOnes, showCounters, numericBlocks) {
  const { tens, ones } = randomPlaceValueNumber(maxOnes);
  return {
    type: "identify_number",
    cardId: card.id,
    conceptId: card.conceptId,
    maxOnes: Number(maxOnes),
    numericBlocks: Boolean(numericBlocks),
    number: tens * 10 + ones,
    model: { tens, ones },
    showCounters: Boolean(showCounters),
  };
}

export function generateRegroupTask(card, maxOnes, numericBlocks) {
  const { tens, ones } = randomPlaceValueNumber(maxOnes);
  return {
    type: "regroup_ten",
    cardId: card.id,
    conceptId: card.conceptId,
    maxOnes: Number(maxOnes),
    numericBlocks: Boolean(numericBlocks),
    number: tens * 10 + ones,
    initial: { tens, ones },
    after: { tens: tens - 1, ones: ones + 10 },
  };
}
```

Replace with:
```js
export function generateIdentifyNumberTask(card, maxOnes) {
  const { tens, ones } = randomPlaceValueNumber(maxOnes);
  return {
    type: "identify_number",
    cardId: card.id,
    conceptId: card.conceptId,
    maxOnes: Number(maxOnes),
    number: tens * 10 + ones,
    model: { tens, ones },
  };
}

export function generateRegroupTask(card, maxOnes) {
  const { tens, ones } = randomPlaceValueNumber(maxOnes);
  return {
    type: "regroup_ten",
    cardId: card.id,
    conceptId: card.conceptId,
    maxOnes: Number(maxOnes),
    number: tens * 10 + ones,
    initial: { tens, ones },
    after: { tens: tens - 1, ones: ones + 10 },
  };
}
```

- [ ] **Step 2: Update the `generateTasks` dispatch for both modes**

Find:
```js
  if (mode === "identify_number") {
    if (!identifyNumberCards.length) return [];
    const maxOnes = Number(params.maxOnes ?? 9);
    const showCounters = params.showCounters ?? true;
    const numericBlocks = params.numericBlocks ?? false;
    const tasks = [];
    for (let i = 0; i < count; i++) {
      tasks.push(generateIdentifyNumberTask(identifyNumberCards[i % identifyNumberCards.length], maxOnes, showCounters, numericBlocks));
    }
    return tasks;
  }

  if (mode === "regroup_ten") {
    if (!regroupTenCards.length) return [];
    const maxOnes = Number(params.maxOnes ?? 9);
    const numericBlocks = params.numericBlocks ?? false;
    const tasks = [];
    for (let i = 0; i < count; i++) {
      tasks.push(generateRegroupTask(regroupTenCards[i % regroupTenCards.length], maxOnes, numericBlocks));
    }
    return tasks;
  }
```

Replace with:
```js
  if (mode === "identify_number") {
    if (!identifyNumberCards.length) return [];
    const maxOnes = Number(params.maxOnes ?? 9);
    const tasks = [];
    for (let i = 0; i < count; i++) {
      tasks.push(generateIdentifyNumberTask(identifyNumberCards[i % identifyNumberCards.length], maxOnes));
    }
    return tasks;
  }

  if (mode === "regroup_ten") {
    if (!regroupTenCards.length) return [];
    const maxOnes = Number(params.maxOnes ?? 9);
    const tasks = [];
    for (let i = 0; i < count; i++) {
      tasks.push(generateRegroupTask(regroupTenCards[i % regroupTenCards.length], maxOnes));
    }
    return tasks;
  }
```

- [ ] **Step 3: Remove the now-invalid `showCounters`/`numericBlocks` tests from `engine.test.js`**

Find:
```js
  it("showCounters follows the showCounters param, independent of maxOnes", () => {
    const withCounters = generateTasks("identify_number", PLACE_VALUE_CARDS, 5, { maxOnes: 9, showCounters: true });
    const withoutCounters = generateTasks("identify_number", PLACE_VALUE_CARDS, 5, { maxOnes: 9, showCounters: false });
    expect(withCounters.every(t => t.showCounters === true)).toBe(true);
    expect(withoutCounters.every(t => t.showCounters === false)).toBe(true);
  });

  it("showCounters defaults to true when not specified", () => {
    const tasks = generateTasks("identify_number", PLACE_VALUE_CARDS, 5, { maxOnes: 9 });
    expect(tasks.every(t => t.showCounters === true)).toBe(true);
  });

  it("numericBlocks follows the numericBlocks param, independent of showCounters", () => {
    const tasks = generateTasks("identify_number", PLACE_VALUE_CARDS, 5, { maxOnes: 9, numericBlocks: true });
    expect(tasks.every(t => t.numericBlocks === true)).toBe(true);
  });
});

describe("generateTasks – regroup_ten", () => {
  it("returns tasks where after = initial minus one ten plus ten ones", () => {
    const tasks = generateTasks("regroup_ten", PLACE_VALUE_CARDS, 20, { maxOnes: 9 });
    expect(tasks).toHaveLength(20);
    for (const t of tasks) {
      expect(t.type).toBe("regroup_ten");
      expect(t.initial.tens).toBeGreaterThanOrEqual(1);
      expect(t.after.tens).toBe(t.initial.tens - 1);
      expect(t.after.ones).toBe(t.initial.ones + 10);
      expect(t.after.tens * 10 + t.after.ones).toBe(t.number);
    }
  });

  it("numericBlocks follows the numericBlocks param", () => {
    const tasks = generateTasks("regroup_ten", PLACE_VALUE_CARDS, 5, { maxOnes: 9, numericBlocks: true });
    expect(tasks.every(t => t.numericBlocks === true)).toBe(true);
  });
});
```

Replace with:
```js
});

describe("generateTasks – regroup_ten", () => {
  it("returns tasks where after = initial minus one ten plus ten ones", () => {
    const tasks = generateTasks("regroup_ten", PLACE_VALUE_CARDS, 20, { maxOnes: 9 });
    expect(tasks).toHaveLength(20);
    for (const t of tasks) {
      expect(t.type).toBe("regroup_ten");
      expect(t.initial.tens).toBeGreaterThanOrEqual(1);
      expect(t.after.tens).toBe(t.initial.tens - 1);
      expect(t.after.ones).toBe(t.initial.ones + 10);
      expect(t.after.tens * 10 + t.after.ones).toBe(t.number);
    }
  });
});
```

- [ ] **Step 4: Remove the `showCounters` param from `identify_number`'s schema in `topicLoader.js`**

Find:
```js
        maxOnes: {
          type: "number",
          min: 0,
          max: 9,
          default: 2,
          label: { ru: "Максимум единиц" },
          info: {
            ru: {
              text: "Максимальное число единиц в загаданном числе, которое нужно опознать — 0 означает, что единиц не будет (круглые десятки).",
              tip: "Начните с малых значений, чтобы ребёнку было легко посчитать блоки; увеличивайте по мере уверенности.",
            },
          },
        },
        showCounters: {
          type: "boolean",
          default: true,
          label: { ru: "Счётные точки" },
          section: "Отображение",
          info: {
            ru: {
              text: "Показывает счётные точки рядом с блоками — дополнительная опора для подсчёта количества.",
              tip: "Выключайте, когда ребёнок уже считает блоки на глаз, без точек.",
            },
          },
        },
      },
    },
    {
      id: "regroup_ten",
```

Replace with:
```js
        maxOnes: {
          type: "number",
          min: 0,
          max: 9,
          default: 2,
          label: { ru: "Максимум единиц" },
          info: {
            ru: {
              text: "Максимальное число единиц в загаданном числе, которое нужно опознать — 0 означает, что единиц не будет (круглые десятки).",
              tip: "Начните с малых значений, чтобы ребёнку было легко посчитать блоки; увеличивайте по мере уверенности.",
            },
          },
        },
      },
    },
    {
      id: "regroup_ten",
```

- [ ] **Step 5: Run the engine tests**

Run: `npx vitest run src/topics/renderers/column_addition/engine.test.js --exclude "**/.worktrees/**" --exclude "**/codex-deploy*/**" --exclude "**/.codex-deploy*/**" --exclude "**/__codex_deploy*/**"`
Expected: PASS, no failures. (build_number's own `numericBlocks` tests at lines ~399-407 are untouched and still pass — only identify_number/regroup_ten lost the param.)

- [ ] **Step 6: Commit**

```bash
git add src/topics/renderers/column_addition/engine.js src/topics/renderers/column_addition/engine.test.js src/topics/topicLoader.js
git commit -m "refactor(place_value): drop dead showCounters/numericBlocks params from identify_number and regroup_ten"
```

---

### Task 3: Rewrite `IdentifyNumberTask.jsx` — coins, checklist, aligned error hints

**Files:**
- Modify: `src/topics/renderers/column_addition/IdentifyNumberTask.jsx` (full rewrite)
- Create: `src/topics/renderers/column_addition/identifyNumber.smoke.test.jsx`

**Interfaces:**
- Consumes: `Coin`, `TenStack` from `./CoinBlocks.jsx` (no props needed — static display, not draggable). `hintDirectionFor(guess, target)` from `./placeValueLabels.js` (Task 1). `useFitOneLine(text, {min, max})` from `./textFit.js` — returns `{ ref, fontSize }`.
- Produces: Default export `IdentifyNumberTask({ task, onCorrect, onMistake, onFlashIncorrect })`. `task` shape (from Task 2's `generateIdentifyNumberTask`): `{ cardId, conceptId, maxOnes, number, model: { tens, ones } }` — no `showCounters`/`numericBlocks` fields anymore.

- [ ] **Step 1: Replace the full contents of `IdentifyNumberTask.jsx`**

```jsx
import { useState } from "react";
import { Coin, TenStack } from "./CoinBlocks.jsx";
import { hintDirectionFor } from "./placeValueLabels.js";
import { useFitOneLine } from "./textFit.js";
import "./place_value.css";
import "./coins.css";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="pv-check-icon" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Same tap-to-confirm-row idiom as BuildNumberTask's ChecklistItem, kept as
// its own copy (not a shared import) so retouching one mode's checklist
// never touches the other's. Both rows here are ticked by the numpad, not
// by tapping the row itself, so unlike BuildNumberTask's collect/group rows
// there's no onTap/clickable path at all — a row is always "is-pending"
// until it's done or (briefly) wrong.
function ChecklistItem({ text, state, textRef, fontSize }) {
  const done = state === "done";
  const wrong = state === "wrong";
  return (
    <div className={`pv-checklist-item${done ? " is-done" : ""}${wrong ? " is-wrong" : ""}${!done && !wrong ? " is-pending" : ""}`}>
      <span className="pv-checklist-box">{done && <CheckIcon />}</span>
      <span ref={textRef} className="pv-checklist-text" style={fontSize ? { fontSize } : undefined}>
        {text}
      </span>
    </div>
  );
}

function AnswerSlot({ state, value, hint }) {
  const cls = (state ?? "").split(" ").filter(Boolean).map((s) => ` pv-answer-slot--${s}`).join("");
  return (
    <div className={`pv-answer-slot${cls}`}>
      {value ?? "?"}
      {hint && <div className="pv-answer-hint">{hint === "more" ? "Больше ↑" : "Меньше ↓"}</div>}
    </div>
  );
}

export default function IdentifyNumberTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  // answerTens -> answerOnes -> done. No collect/group phase here (unlike
  // build_number): the tens/ones blocks are already laid out for the child
  // to read, not assembled by them first.
  const [phase, setPhase] = useState("answerTens");
  const [rowWrong, setRowWrong] = useState({ tens: false, ones: false });
  const [hintDirection, setHintDirection] = useState({ tens: null, ones: null });

  // Same shape as BuildNumberTask's flashRowWrong, minus the zone-error
  // callback build_number needs for its drag/drop error zones — this mode
  // only ever flashes a checklist row + its answer slot.
  function flashRowWrong(key, direction) {
    setRowWrong((w) => ({ ...w, [key]: true }));
    setHintDirection((h) => ({ ...h, [key]: direction }));
    onMistake?.(task.conceptId, task.cardId);
    onFlashIncorrect?.();
    setTimeout(() => setRowWrong((w) => ({ ...w, [key]: false })), 500);
    setTimeout(() => setHintDirection((h) => ({ ...h, [key]: null })), 1300);
  }

  function handleDigit(d) {
    if (phase === "answerTens") {
      if (d === task.model.tens) {
        setPhase("answerOnes");
      } else {
        flashRowWrong("tens", hintDirectionFor(d, task.model.tens));
      }
      return;
    }
    if (phase === "answerOnes") {
      if (d === task.model.ones) {
        setPhase("done");
        setTimeout(() => onCorrect(task.conceptId, task.cardId), 900);
      } else {
        flashRowWrong("ones", hintDirectionFor(d, task.model.ones));
      }
    }
  }

  const tensDone = phase === "answerOnes" || phase === "done";
  const onesDone = phase === "done";
  const tensAnswer = {
    value: tensDone ? task.model.tens : null,
    state: tensDone ? "filled correct" : rowWrong.tens ? "shake" : phase === "answerTens" ? "active" : undefined,
    hint: hintDirection.tens,
  };
  const onesAnswer = {
    value: onesDone ? task.model.ones : null,
    state: onesDone ? "filled correct" : rowWrong.ones ? "shake" : phase === "answerOnes" ? "active" : undefined,
    hint: hintDirection.ones,
  };

  const { ref: tensQRef, fontSize: tensQFontSize } = useFitOneLine("Сколько десятков?", { max: 45, min: 13 });
  const { ref: onesQRef, fontSize: onesQFontSize } = useFitOneLine("Сколько единиц?", { max: 45, min: 13 });

  return (
    <div className="pv-screen cb-screen">
      <div className="pv-instruction">Какое это число?</div>

      <div className="pv-checklist pv-checklist--focused">
        <ChecklistItem
          text="Сколько десятков?"
          state={phase === "answerTens" ? (rowWrong.tens ? "wrong" : "active") : "done"}
          textRef={tensQRef}
          fontSize={tensQFontSize}
        />
        {(phase === "answerOnes" || phase === "done") && (
          <ChecklistItem
            text="Сколько единиц?"
            state={phase === "answerOnes" ? (rowWrong.ones ? "wrong" : "active") : "done"}
            textRef={onesQRef}
            fontSize={onesQFontSize}
          />
        )}
      </div>

      {/* Zone highlight (cb-area--focus) marks which side the currently-
          asked question refers to — same pulse AnswerSlot's own "active"
          state uses, so the question, the zone, and where to type the
          answer are all visually tied together. */}
      <div className="pv-zones">
        <div className={`pv-zone${tensAnswer.state === "active" ? " cb-area--focus" : ""}${phase === "done" ? " pv-zone--correct" : ""}`}>
          <div className="pv-zone-label">ДЕСЯТКИ</div>
          <div className="pv-zone-body">
            {Array.from({ length: task.model.tens }, (_, i) => (
              <TenStack key={i} />
            ))}
          </div>
          <AnswerSlot state={tensAnswer.state} value={tensAnswer.value} hint={tensAnswer.hint} />
        </div>
        <div className={`pv-zone${onesAnswer.state === "active" ? " cb-area--focus" : ""}${phase === "done" ? " pv-zone--correct" : ""}`}>
          <div className="pv-zone-label">ЕДИНИЦЫ</div>
          <div className="pv-zone-body">
            {Array.from({ length: task.model.ones }, (_, i) => (
              <Coin key={i} />
            ))}
          </div>
          <AnswerSlot state={onesAnswer.state} value={onesAnswer.value} hint={onesAnswer.hint} />
        </div>
      </div>

      <div className="pv-spacer" />

      <div className="pv-numpad">
        {DIGITS.map((d) => (
          <button key={d} className="pv-numkey" onClick={() => handleDigit(d)} disabled={phase === "done"}>
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the smoke test**

Create `src/topics/renderers/column_addition/identifyNumber.smoke.test.jsx`:

```jsx
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import IdentifyNumberTask from "./IdentifyNumberTask.jsx";

// jsdom has no ResizeObserver; useFitOneLine (textFit.js, used by both
// checklist rows' text sizing) needs one. No-op stub — this test doesn't
// assert on live-resize font shrinking.
if (typeof window.ResizeObserver === "undefined") {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

describe("IdentifyNumberTask", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
  });

  function mount(task, handlers = {}) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <IdentifyNumberTask
          task={task}
          onCorrect={handlers.onCorrect ?? (() => {})}
          onMistake={handlers.onMistake ?? (() => {})}
          onFlashIncorrect={handlers.onFlashIncorrect ?? (() => {})}
        />
      );
    });
  }

  function digitButton(d) {
    return Array.from(container.querySelectorAll(".pv-numkey")).find((b) => b.textContent === String(d));
  }

  it("mounts without crashing, showing only the tens question first", () => {
    mount({ cardId: "x", conceptId: "x", type: "identify_number", number: 23, model: { tens: 2, ones: 3 } });
    expect(container.querySelectorAll(".pv-checklist-item").length).toBe(1);
  });

  it("keeps the tens row marked done after a wrong ones digit", () => {
    mount({ cardId: "x", conceptId: "x", type: "identify_number", number: 23, model: { tens: 2, ones: 3 } });

    act(() => { digitButton(2).click(); }); // correct tens
    expect(container.querySelectorAll(".pv-checklist-item").length).toBe(2);

    act(() => { digitButton(9).click(); }); // wrong ones
    const items = container.querySelectorAll(".pv-checklist-item");
    expect(items[0].className).toContain("is-done");
    expect(items[1].className).toContain("is-wrong");
  });
});
```

- [ ] **Step 3: Run the new test**

Run: `npx vitest run src/topics/renderers/column_addition/identifyNumber.smoke.test.jsx --exclude "**/.worktrees/**" --exclude "**/codex-deploy*/**" --exclude "**/.codex-deploy*/**" --exclude "**/__codex_deploy*/**"`
Expected: PASS (2 tests).

- [ ] **Step 4: Commit**

```bash
git add src/topics/renderers/column_addition/IdentifyNumberTask.jsx src/topics/renderers/column_addition/identifyNumber.smoke.test.jsx
git commit -m "feat(place_value): rebuild IdentifyNumberTask with coins, checklist, aligned error hints"
```

---

### Task 4: Rewrite `RegroupTenTask.jsx` — coins, single checklist row

**Files:**
- Modify: `src/topics/renderers/column_addition/RegroupTenTask.jsx` (full rewrite)
- Create: `src/topics/renderers/column_addition/regroupTen.smoke.test.jsx`

**Interfaces:**
- Consumes: `Coin`, `TenStack` from `./CoinBlocks.jsx`. `task` shape (from Task 2's `generateRegroupTask`): `{ cardId, conceptId, maxOnes, number, initial: { tens, ones }, after: { tens, ones } }` — no `numericBlocks` field anymore.
- Produces: Default export `RegroupTenTask({ task, onCorrect })` (unchanged signature).

- [ ] **Step 1: Replace the full contents of `RegroupTenTask.jsx`**

```jsx
import { useState } from "react";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Button from "@/shared/components/Button";
import { Coin, TenStack } from "./CoinBlocks.jsx";
import { useFitOneLine } from "./textFit.js";
import "./place_value.css";
import "./coins.css";

function DraggableTenStack({ id }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, data: { kind: "ten" } });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 10 : "auto", cursor: "grab", touchAction: "none" }}
      {...listeners}
      {...attributes}
    >
      <TenStack />
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="pv-check-icon" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Single-row checklist: this mode has exactly one action (drag the ten into
// ЕДИНИЦЫ), so there's no active/wrong state to track — only pending until
// the drag succeeds, then done. The row's own text replaces what used to be
// a separate .pv-caption line below the zones.
function ChecklistItem({ text, done, textRef, fontSize }) {
  return (
    <div className={`pv-checklist-item${done ? " is-done" : " is-pending"}`}>
      <span className="pv-checklist-box">{done && <CheckIcon />}</span>
      <span ref={textRef} className="pv-checklist-text" style={fontSize ? { fontSize } : undefined}>
        {text}
      </span>
    </div>
  );
}

// Must be a child of <DndContext>, not a sibling call in the component that renders
// <DndContext> itself — useDroppable() only registers with the nearest DndContext
// ancestor found via React context, which doesn't exist yet while the parent's own
// render body is still executing.
function Zones({ tens, ones, exchanged, initialOnes }) {
  const { setNodeRef, isOver } = useDroppable({ id: "pv-ones-zone" });
  return (
    <div className="pv-zones">
      <div className="pv-zone">
        <div className="pv-zone-label">ДЕСЯТКИ</div>
        <div className="pv-zone-body">
          {Array.from({ length: tens }, (_, i) =>
            !exchanged && i === tens - 1 ? (
              <DraggableTenStack key={i} id={`ten-${i}`} />
            ) : (
              <TenStack key={i} />
            )
          )}
        </div>
      </div>
      <div className={`pv-zone${isOver ? " pv-zone--drag-over" : ""}`} ref={setNodeRef}>
        <div className="pv-zone-label">ЕДИНИЦЫ</div>
        <div className="pv-zone-body">
          {Array.from({ length: ones }, (_, i) => {
            const isNew = exchanged && i >= initialOnes;
            return (
              <div
                key={i}
                className={isNew ? "pv-cube-pop" : undefined}
                style={isNew ? { animationDelay: `${(i - initialOnes) * 45}ms` } : undefined}
              >
                <Coin />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function RegroupTenTask({ task, onCorrect }) {
  const [tens, setTens] = useState(task.initial.tens);
  const [ones, setOnes] = useState(task.initial.ones);
  const [exchanged, setExchanged] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  function handleDragEnd({ over }) {
    if (!over || over.id !== "pv-ones-zone" || tens < 1 || exchanged) return;
    setTens((t) => t - 1);
    setOnes((o) => o + 10);
    setExchanged(true);
  }

  function handleContinue() {
    onCorrect(task.conceptId, task.cardId);
  }

  const { ref: checklistRef, fontSize: checklistFontSize } = useFitOneLine("Разменяй десяток в единицы", { max: 45, min: 13 });

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="pv-screen cb-screen">
        <div className="pv-checklist">
          <ChecklistItem text="Разменяй десяток в единицы" done={exchanged} textRef={checklistRef} fontSize={checklistFontSize} />
        </div>

        <Zones tens={tens} ones={ones} exchanged={exchanged} initialOnes={task.initial.ones} />

        <div className="pv-spacer" />

        {/* Kept as a deliberate exception to "auto-advance like
            build_number": the point of this mode is for the child to see
            and read the before/after equation, not to be swept past it. */}
        {exchanged && (
          <div className="pv-result-panel">
            <div className="pv-result-line">
              {task.initial.tens * 10} + {task.initial.ones} = {task.number}
            </div>
            <div className="pv-result-line pv-result-line--sum">
              {task.after.tens * 10} + {task.after.ones} = {task.number}
            </div>
            <Button variant="secondary" onClick={handleContinue}>Далее →</Button>
          </div>
        )}
      </div>
    </DndContext>
  );
}
```

- [ ] **Step 2: Write the smoke test**

Create `src/topics/renderers/column_addition/regroupTen.smoke.test.jsx`:

```jsx
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import RegroupTenTask from "./RegroupTenTask.jsx";

// jsdom has no ResizeObserver; useFitOneLine (textFit.js, used by the
// checklist row's text sizing) needs one. No-op stub.
if (typeof window.ResizeObserver === "undefined") {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

describe("RegroupTenTask", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
  });

  it("mounts without crashing, showing one pending checklist row", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const task = { cardId: "x", conceptId: "x", type: "regroup_ten", number: 23, initial: { tens: 2, ones: 3 }, after: { tens: 1, ones: 13 } };
    act(() => {
      root.render(<RegroupTenTask task={task} onCorrect={() => {}} />);
    });
    const items = container.querySelectorAll(".pv-checklist-item");
    expect(items.length).toBe(1);
    expect(items[0].className).toContain("is-pending");
  });
});
```

- [ ] **Step 3: Run the new test**

Run: `npx vitest run src/topics/renderers/column_addition/regroupTen.smoke.test.jsx --exclude "**/.worktrees/**" --exclude "**/codex-deploy*/**" --exclude "**/.codex-deploy*/**" --exclude "**/__codex_deploy*/**"`
Expected: PASS (1 test).

- [ ] **Step 4: Commit**

```bash
git add src/topics/renderers/column_addition/RegroupTenTask.jsx src/topics/renderers/column_addition/regroupTen.smoke.test.jsx
git commit -m "feat(place_value): rebuild RegroupTenTask with coins and a single checklist row"
```

---

### Task 5: Delete the now-dead `PlaceValueBlocks.jsx`

**Files:**
- Delete: `src/topics/renderers/column_addition/PlaceValueBlocks.jsx`

**Interfaces:**
- Consumes: nothing (this task only runs after Task 3 and Task 4 have removed the last two importers).

- [ ] **Step 1: Confirm nothing imports it anymore**

Run: `git grep -l "PlaceValueBlocks" -- src`
Expected: no output (empty — Task 3/4 already removed the only two importers).

- [ ] **Step 2: Delete the file**

```bash
git rm src/topics/renderers/column_addition/PlaceValueBlocks.jsx
```

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(place_value): remove PlaceValueBlocks.jsx, unused after the coins migration"
```

---

### Task 6: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run (redirect to a log file, don't pipe through `tail` — truncates captured output before analysis):
```bash
npx vitest run --exclude "**/.worktrees/**" --exclude "**/codex-deploy*/**" --exclude "**/.codex-deploy*/**" --exclude "**/__codex_deploy*/**" > /tmp/vitest-place-value.log 2>&1
```
Then read the log file. Expected: all suites pass, 0 failures.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: build succeeds with no errors (confirms no stray import of the deleted `PlaceValueBlocks.jsx` or the removed `numericBlocks`/`showCounters` params survives anywhere, e.g. in admin/settings UI code not covered by the grep in Task 5).

- [ ] **Step 3: If both pass, proceed to superpowers:finishing-a-development-branch**

This plan was executed directly on `main` (per this session's established, explicitly-confirmed working mode — no feature branch/worktree was created). Finishing-a-development-branch's branch-merge options don't apply; instead, confirm with the user whether to deploy now (`npm run deploy:prod` + `npm run deploy:verify`), matching how every prior change this session was shipped.
