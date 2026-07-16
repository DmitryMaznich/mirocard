# «Собери число» на монетах — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the `build_number` mode ("Собери число") in `column_addition` so the child assembles tens by dragging individual coins from a heap and manually tapping to group ten of them into a stack, instead of dragging pre-made ten/unit blocks.

**Architecture:** A new `maxTens` generation parameter caps the tens range (existing `tens = randomInt(1,9)` made every number up to 99 reachable, which is too many individual coin-drags). `BuildNumberTask.jsx` is rewritten around a single drop zone (stacks on the left, loose coins on the right) instead of two zones; new presentational components (`Coin`, `TenStack`, `CoinPile`) live in a new file scoped to this mode only — the shared `PlaceValueBlocks.jsx` (`UnitCube`/`TenCard`, used by `IdentifyNumberTask`/`RegroupTenTask`) is untouched. Dragging still uses the existing `dnd-kit` setup; the "10 loose coins → 1 stack" grouping is a separate, imperative fly animation (`element.animate`) triggered by a tap, not by `dnd-kit`.

**Tech Stack:** React 19, `@dnd-kit/core`/`@dnd-kit/utilities` (already a dependency, already used in this exact file), Vitest for the pure-logic layer (`engine.js`, `topicLoader.js`). This codebase does not unit-test presentational React components anywhere in `column_addition` (no `.test.jsx` next to `BuildNumberTask.jsx`/`PlaceValueBlocks.jsx`) — the visual/interaction task is verified manually via a running dev server and Playwright instead, matching how this exact file's original drag-and-drop was validated.

## Global Constraints

- `maxTens` param: `type: "number", min: 1, max: 9, default: 3` — exact values from the spec, §2.
- Only `build_number` changes. `identify_number`, `regroup_ten`, and `PlaceValueBlocks.jsx` (`UnitCube`/`TenCard`, ten-frame 2×5 visual) are not touched — spec §9.
- `randomPlaceValueNumber`'s new second parameter must default to `9` so `identify_number`/`regroup_ten` call sites (which never pass it) keep their current 1–9 tens range.
- New coin visuals (`Coin`, `TenStack`, `CoinPile`) live in a new file, not in `PlaceValueBlocks.jsx` — spec §9.
- Instruction copy for the mode picker/settings screen becomes exactly: `Перетаскивай монетки, пока не наберёшь число` — spec §10. (This string is shown on `ModePickerScreen`/`ParamsScreen`/`ModeMethodology`, not inside the task screen itself — the task screen keeps its own hardcoded "Собери число" heading, unchanged.)
- Tap on a completed ten-stack removes it entirely — no unpacking back into 10 loose coins (spec §6).
- When ≥10 loose coins are present, only the first 10 (by array index) become groupable/highlighted; any beyond that stay normal removable loose coins until the next group (spec §5).
- This repo has stale leftover copies of test files outside the real source tree (`.worktrees/`, `.codex-deploy-backfix-*/`, `codex-deploy-backfix-*/`, `__codex_deploy_reward_fix_*/`) that vitest's substring filter will also match and that contain **pre-existing, unrelated failures**. Every verification command below is written to avoid or filter around them — do not try to fix failures reported from those paths.

---

### Task 1: `maxTens` range parameter in `engine.js`

**Files:**
- Modify: `src/topics/renderers/column_addition/engine.js:190-208` (`randomPlaceValueNumber`, `generateBuildNumberTask`), `src/topics/renderers/column_addition/engine.js:302-311` (the `build_number` branch of `generateTasks`)
- Test: `src/topics/renderers/column_addition/engine.test.js`

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces: `generateBuildNumberTask(card, maxOnes, maxTens, numericBlocks)` (note the new 3rd positional argument — `numericBlocks` moves from 3rd to 4th position) and `task.maxTens` on every `build_number` task object. Task 3 does not read `task.maxTens` directly, but the range it produces (`task.target.tens`) is what Task 3's UI renders.

- [ ] **Step 1: Confirm the current baseline (no code changes yet)**

Run: `npx vitest run src/topics/renderers/column_addition/engine.test.js --exclude "**/.worktrees/**" -t "build_number"`
Expected: `Test Files  1 passed (1)` / `Tests  7 passed`

- [ ] **Step 2: Write the failing tests**

Open `src/topics/renderers/column_addition/engine.test.js`. Replace this existing test (around line 286):

```js
  it("tens digit is always 1-9", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 30, { maxOnes: 9 });
    for (const t of tasks) {
      expect(t.target.tens).toBeGreaterThanOrEqual(1);
      expect(t.target.tens).toBeLessThanOrEqual(9);
    }
  });
```

with this (renamed to make explicit it's testing the ceiling with `maxTens` passed):

```js
  it("maxTens 9: tens digit spans the full 1-9 range", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 30, { maxOnes: 9, maxTens: 9 });
    for (const t of tasks) {
      expect(t.target.tens).toBeGreaterThanOrEqual(1);
      expect(t.target.tens).toBeLessThanOrEqual(9);
    }
  });

  it("maxTens not specified: tens digit defaults to the 1-3 range", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 30, { maxOnes: 9 });
    for (const t of tasks) {
      expect(t.target.tens).toBeGreaterThanOrEqual(1);
      expect(t.target.tens).toBeLessThanOrEqual(3);
    }
  });

  it("maxTens 1: tens digit is always 1", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 20, { maxOnes: 9, maxTens: 1 });
    for (const t of tasks) expect(t.target.tens).toBe(1);
  });

  it("task.maxTens reflects the configured value", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 5, { maxOnes: 9, maxTens: 5 });
    expect(tasks.every((t) => t.maxTens === 5)).toBe(true);
  });
```

- [ ] **Step 3: Run the new tests to verify they fail**

Run: `npx vitest run src/topics/renderers/column_addition/engine.test.js --exclude "**/.worktrees/**" -t "maxTens"`
Expected: FAIL — `maxTens not specified: tens digit defaults to the 1-3 range` fails because tens still goes up to 9; `task.maxTens reflects the configured value` fails because `t.maxTens` is `undefined`.

- [ ] **Step 4: Implement `maxTens` support**

In `src/topics/renderers/column_addition/engine.js`, replace:

```js
function randomPlaceValueNumber(maxOnes) {
  const tens = randomInt(1, 9);
  const max = Number(maxOnes);
  const ones = max === 0 ? 0 : randomInt(1, max);
  return { tens, ones };
}

export function generateBuildNumberTask(card, maxOnes, numericBlocks) {
  const { tens, ones } = randomPlaceValueNumber(maxOnes);
  return {
    type: "build_number",
    cardId: card.id,
    conceptId: card.conceptId,
    maxOnes: Number(maxOnes),
    numericBlocks: Boolean(numericBlocks),
    number: tens * 10 + ones,
    target: { tens, ones },
  };
}
```

with:

```js
function randomPlaceValueNumber(maxOnes, maxTens = 9) {
  const tens = randomInt(1, Number(maxTens));
  const max = Number(maxOnes);
  const ones = max === 0 ? 0 : randomInt(1, max);
  return { tens, ones };
}

export function generateBuildNumberTask(card, maxOnes, maxTens, numericBlocks) {
  const { tens, ones } = randomPlaceValueNumber(maxOnes, maxTens);
  return {
    type: "build_number",
    cardId: card.id,
    conceptId: card.conceptId,
    maxOnes: Number(maxOnes),
    maxTens: Number(maxTens),
    numericBlocks: Boolean(numericBlocks),
    number: tens * 10 + ones,
    target: { tens, ones },
  };
}
```

Then, in the `mode === "build_number"` branch of `generateTasks`, replace:

```js
  if (mode === "build_number") {
    if (!buildNumberCards.length) return [];
    const maxOnes = Number(params.maxOnes ?? 9);
    const numericBlocks = params.numericBlocks ?? false;
    const tasks = [];
    for (let i = 0; i < count; i++) {
      tasks.push(generateBuildNumberTask(buildNumberCards[i % buildNumberCards.length], maxOnes, numericBlocks));
    }
    return tasks;
  }
```

with:

```js
  if (mode === "build_number") {
    if (!buildNumberCards.length) return [];
    const maxOnes = Number(params.maxOnes ?? 9);
    const maxTens = Number(params.maxTens ?? 3);
    const numericBlocks = params.numericBlocks ?? false;
    const tasks = [];
    for (let i = 0; i < count; i++) {
      tasks.push(generateBuildNumberTask(buildNumberCards[i % buildNumberCards.length], maxOnes, maxTens, numericBlocks));
    }
    return tasks;
  }
```

Leave `generateIdentifyNumberTask`/`generateRegroupTask` and their call sites untouched — they call `randomPlaceValueNumber(maxOnes)` with one argument, so `maxTens` keeps defaulting to `9`.

- [ ] **Step 5: Run all four groups of tests to verify they pass**

Run: `npx vitest run src/topics/renderers/column_addition/engine.test.js --exclude "**/.worktrees/**" -t "build_number"`
Expected: all `generateTasks – build_number` tests pass (11 tests: the original 7 minus the one renamed, plus 5 new ones — net 11).

Run: `npx vitest run src/topics/renderers/column_addition/engine.test.js --exclude "**/.worktrees/**" -t "identify_number|regroup_ten"`
Expected: unchanged, all still passing — confirms the `maxTens = 9` default didn't affect the other two modes.

- [ ] **Step 6: Commit**

```bash
git add src/topics/renderers/column_addition/engine.js src/topics/renderers/column_addition/engine.test.js
git commit -m "feat(column_addition): add maxTens range param to build_number"
```

---

### Task 2: `maxTens` setting + instruction copy in `topicLoader.js`

**Files:**
- Modify: `src/topics/topicLoader.js:1140-1161` (`build_number` mode definition)
- Test: `src/topics/topicLoader.test.js`

**Interfaces:**
- Consumes: nothing from Task 1 directly (this is config, not generation code) — but the `maxTens` param name/shape here must match what Task 1's `generateTasks` reads from `params.maxTens`.
- Produces: the `build_number` mode's `params.maxTens` definition, read by whatever settings screen renders `mode.params` (already generic — no separate change needed there, it iterates `params` by shape).

- [ ] **Step 1: Confirm the baseline**

Run: `npx vitest run src/topics/topicLoader.test.js --exclude "**/.worktrees/**" --exclude "**/.codex-deploy-backfix*/**" --exclude "**/codex-deploy-backfix*/**" --exclude "**/__codex_deploy_reward_fix*/**"`
Expected: `Test Files  1 failed (1)` / `Tests  1 failed | 25 passed (26)` — the one pre-existing failure is `imports addition/subtraction procedural cards with default modes` (an unrelated topic's mode ordering), not anything you're about to touch.

- [ ] **Step 2: Write the failing test**

Add this test to `src/topics/topicLoader.test.js`, after the "refreshes a mode's param widget type..." test (after line 438):

```js
  it("adds the new maxTens param to a build_number record saved before it existed", async () => {
    // Simulates a device that installed build_number before maxTens/the coin
    // mechanic existed — on the next load, the new range param and the updated
    // instruction copy must both appear.
    const db = await freshDb();
    const staleRecord = {
      id: "column_addition",
      meta: { id: "column_addition", renderer: "column_addition", version: "1.3.0", title: { ru: "Сложение и вычитание в столбик" } },
      modes: [
        {
          id: "build_number",
          type: "build_number",
          evaluation: "instant",
          ui: { title: "Собери число", instruction: "Перетащи десятки и единицы на свои места", icon: "media/icons/place_value_build.svg" },
          params: {
            maxOnes: { type: "number", min: 0, max: 9, default: 2, label: { ru: "Максимум единиц" } },
            numericBlocks: { type: "visual_boolean", default: false, offLabel: { ru: "Десятки" }, label: { ru: "Блоки с цифрами вместо кубиков" } },
          },
        },
      ],
      cards: [{ id: "build_number", conceptId: "build_number", renderer: "column_addition", params: { mode: "build_number" } }],
      installedAt: new Date().toISOString(),
    };

    await kv.set(db, "topic:column_addition", staleRecord);
    await kv.set(db, "installedTopicIds", ["column_addition"]);

    const record = await getTopicRecord(db, "column_addition");
    const buildNumber = record.modes.find((m) => m.id === "build_number");
    expect(buildNumber.params.maxTens).toEqual({
      type: "number", min: 1, max: 9, default: 3, label: { ru: "Максимум десятков" },
    });
    expect(buildNumber.ui.instruction).toBe("Перетаскивай монетки, пока не наберёшь число");
  });
```

- [ ] **Step 3: Run the new test to verify it fails**

Run: `npx vitest run src/topics/topicLoader.test.js --exclude "**/.worktrees/**" --exclude "**/.codex-deploy-backfix*/**" --exclude "**/codex-deploy-backfix*/**" --exclude "**/__codex_deploy_reward_fix*/**" -t "maxTens"`
Expected: FAIL — `buildNumber.params.maxTens` is `undefined`.

- [ ] **Step 4: Implement the config change**

In `src/topics/topicLoader.js`, replace the `build_number` mode entry:

```js
    {
      id: "build_number",
      type: "build_number",
      evaluation: "instant",
      orientationLock: "portrait",
      ui: { title: "Собери число", instruction: "Перетащи десятки и единицы на свои места", icon: "media/icons/place_value_build.svg" },
      params: {
        maxOnes: {
          type: "number",
          min: 0,
          max: 9,
          default: 2,
          label: { ru: "Максимум единиц" },
        },
        numericBlocks: {
          type: "visual_boolean",
          default: false,
          offLabel: { ru: "Десятки" },
          label: { ru: "Блоки с цифрами вместо кубиков" },
        },
      },
    },
```

with:

```js
    {
      id: "build_number",
      type: "build_number",
      evaluation: "instant",
      orientationLock: "portrait",
      ui: { title: "Собери число", instruction: "Перетаскивай монетки, пока не наберёшь число", icon: "media/icons/place_value_build.svg" },
      params: {
        maxOnes: {
          type: "number",
          min: 0,
          max: 9,
          default: 2,
          label: { ru: "Максимум единиц" },
        },
        maxTens: {
          type: "number",
          min: 1,
          max: 9,
          default: 3,
          label: { ru: "Максимум десятков" },
        },
        numericBlocks: {
          type: "visual_boolean",
          default: false,
          offLabel: { ru: "Десятки" },
          label: { ru: "Блоки с цифрами вместо кубиков" },
        },
      },
    },
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/topics/topicLoader.test.js --exclude "**/.worktrees/**" --exclude "**/.codex-deploy-backfix*/**" --exclude "**/codex-deploy-backfix*/**" --exclude "**/__codex_deploy_reward_fix*/**"`
Expected: `Tests  1 failed | 26 passed (27)` — same single pre-existing unrelated failure as the baseline, one more passing test than before.

- [ ] **Step 6: Commit**

```bash
git add src/topics/topicLoader.js src/topics/topicLoader.test.js
git commit -m "feat(column_addition): add maxTens setting to build_number mode config"
```

---

### Task 3: Coin visuals + `BuildNumberTask.jsx` rewrite

**Files:**
- Create: `src/topics/renderers/column_addition/CoinBlocks.jsx`
- Create: `src/topics/renderers/column_addition/coins.css`
- Modify (full rewrite): `src/topics/renderers/column_addition/BuildNumberTask.jsx`

**Interfaces:**
- Consumes: `task.number`, `task.target.{tens,ones}`, `task.numericBlocks`, `task.conceptId`, `task.cardId` (all already produced by Task 1's `generateBuildNumberTask` — unchanged shape except the added `task.maxTens`, which this task doesn't need to read). `onCorrect(conceptId, cardId)` / `onMistake(conceptId, cardId)` props, called exactly as before — `index.jsx`'s routing (`src/topics/renderers/column_addition/index.jsx:854-863`) is unchanged, no other file needs to change to pick this up.
- Produces: nothing consumed by later tasks — this is the last task.

This task has no dedicated automated test (this codebase doesn't unit-test presentational `column_addition` components — see Tech Stack above); it ends with a manual verification pass instead of a `vitest run`.

- [ ] **Step 1: Create `CoinBlocks.jsx`**

Write `src/topics/renderers/column_addition/CoinBlocks.jsx`:

```jsx
// Fixed heap layout (not randomized per render) so the pile's silhouette
// stays recognizable across reloads — wide base narrowing to one coin at
// the apex, which gets the idle "pick me" bob.
const PILE_LAYOUT = [
  { x: 4, y: 40, r: -8 },
  { x: 30, y: 44, r: 6 },
  { x: 56, y: 42, r: -4 },
  { x: 82, y: 40, r: 10 },
  { x: 18, y: 24, r: -10 },
  { x: 46, y: 26, r: 5 },
  { x: 72, y: 22, r: -6 },
  { x: 44, y: 6, r: 3, top: true },
];

export function Coin({ numeric = false, groupable = false }) {
  return (
    <div className={`cb-coin${groupable ? " cb-coin--groupable" : ""}`}>
      {numeric ? "1" : null}
    </div>
  );
}

export function TenStack({ numeric = false }) {
  return (
    <div className="cb-ten-stack">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="cb-stack-coin" />
      ))}
      {numeric && <div className="cb-stack-badge">10</div>}
    </div>
  );
}

export function CoinPile() {
  return (
    <div className="cb-coin-pile">
      {PILE_LAYOUT.map(({ x, y, r, top }, i) => (
        <div
          key={i}
          className={`cb-pile-coin${top ? " cb-pile-coin--top" : ""}`}
          style={{ left: `${x}px`, top: `${y}px`, transform: `rotate(${r}deg)` }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `coins.css`**

Write `src/topics/renderers/column_addition/coins.css`:

```css
/* Coin visuals for build_number's "Собери число" — scoped to this mode
   only. Reuses .pv-zone / .pv-zone--drag-over / --error / --correct chrome
   and the pv-shake / pv-pop keyframes already defined in place_value.css
   (loaded alongside this file by BuildNumberTask.jsx); only the coin
   shapes and the single-zone split layout are new. */

.cb-zone-split {
  display: flex;
  flex: 1;
  gap: 10px;
}

.cb-stacks-area {
  width: 40%;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 10px;
  border-right: 1.5px dashed rgba(148, 163, 184, 0.6);
  padding-right: 10px;
}

.cb-loose-area {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 8px;
}

.cb-area--error {
  animation: pv-shake 0.4s ease-in-out;
}

.cb-coin {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, #fff6da, #f6c94e 45%, #e0a72c 85%);
  border: 2px solid #9a6414;
  box-shadow: inset 0 -2px 3px rgba(154, 100, 20, 0.45), 0 2px 4px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 12px;
  color: #7a4e10;
  animation: pv-pop 0.22s ease-out both;
}

.cb-coin--groupable {
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.55), inset 0 -2px 3px rgba(154, 100, 20, 0.45), 0 2px 4px rgba(0, 0, 0, 0.15);
  animation: pv-pop 0.22s ease-out both, cb-groupable-pulse 1.1s ease-in-out infinite;
}

@keyframes cb-groupable-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

.cb-ten-stack {
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  cursor: pointer;
  flex-shrink: 0;
  position: relative;
  padding-top: 6px;
  animation: pv-pop 0.3s ease-out both;
}

.cb-stack-coin {
  width: 34px;
  height: 13px;
  border-radius: 50%;
  background: radial-gradient(circle at 32% 22%, #fff6da, #f6c94e 45%, #e0a72c 85%);
  border: 2px solid #9a6414;
  margin-top: -6px;
  box-shadow: 0 1.5px 0 rgba(0, 0, 0, 0.12);
}
.cb-ten-stack .cb-stack-coin:last-child { margin-top: 0; }

.cb-stack-badge {
  position: absolute;
  top: -4px;
  right: -8px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #8a5a1c;
  color: #fff6da;
  font-size: 9px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.cb-pile-drag {
  cursor: grab;
  touch-action: none;
}

.cb-coin-pile {
  position: relative;
  width: 132px;
  height: 74px;
}

.cb-pile-coin {
  position: absolute;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, #fff6da, #f6c94e 45%, #e0a72c 85%);
  border: 2px solid #9a6414;
  box-shadow: inset 0 -2px 2px rgba(154, 100, 20, 0.4), 0 2px 3px rgba(0, 0, 0, 0.25);
}

.cb-pile-coin--top {
  box-shadow: inset 0 -2px 2px rgba(154, 100, 20, 0.4), 0 3px 6px rgba(0, 0, 0, 0.3), 0 0 0 5px rgba(230, 190, 90, 0.16);
  animation: cb-pile-top-bob 2.4s ease-in-out infinite;
}

@keyframes cb-pile-top-bob {
  0%, 100% { transform: rotate(3deg) translateY(0); }
  50% { transform: rotate(3deg) translateY(-3px); }
}

@media (prefers-reduced-motion: reduce) {
  .cb-pile-coin--top { animation: none; }
  .cb-coin--groupable { animation: pv-pop 0.22s ease-out both; }
}

/* Ghost element for the tap-to-group fly animation only. Appended directly
   to document.body by BuildNumberTask.jsx and removed when the animation
   finishes — it is not part of React's render tree. */
.cb-stack-ghost {
  position: fixed;
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  pointer-events: none;
  z-index: 200;
  transform: translate(-50%, -50%);
}
.cb-stack-ghost .cb-stack-coin {
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
}
```

- [ ] **Step 3: Rewrite `BuildNumberTask.jsx`**

Replace the full contents of `src/topics/renderers/column_addition/BuildNumberTask.jsx` with:

```jsx
import { useRef, useState } from "react";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Button from "@/shared/components/Button";
import { useSpeech } from "@/shared/hooks/useSpeech";
import { Coin, TenStack, CoinPile } from "./CoinBlocks.jsx";
import { pluralTens, pluralOnes } from "./placeValueLabels.js";
import "./place_value.css";
import "./coins.css";

function PileSource() {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: "coin-pile", data: { kind: "coin" } });
  return (
    <div
      ref={setNodeRef}
      className="cb-pile-drag"
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 10 : "auto" }}
      {...listeners}
      {...attributes}
    >
      <CoinPile />
    </div>
  );
}

// Must be a child of <DndContext>, not a sibling call in the component that renders
// <DndContext> itself — useDroppable() only registers with the nearest DndContext
// ancestor found via React context, which doesn't exist yet while the parent's own
// render body is still executing.
function Workspace({ placed, groupableCount, errorZones, solved, numeric, onRemoveOne, onGroup, onRemoveTen, stacksAreaRef, looseAreaRef }) {
  const { setNodeRef, isOver } = useDroppable({ id: "cb-workspace" });
  return (
    <div className="pv-zones">
      <div
        ref={setNodeRef}
        className={`pv-zone${solved ? " pv-zone--correct" : ""}${isOver ? " pv-zone--drag-over" : ""}`}
      >
        <div className="cb-zone-split">
          <div className={`cb-stacks-area${errorZones.tens ? " cb-area--error" : ""}`} ref={stacksAreaRef}>
            {Array.from({ length: placed.tens }, (_, i) => (
              <div key={i} onClick={onRemoveTen}>
                <TenStack numeric={numeric} />
              </div>
            ))}
          </div>
          <div className={`cb-loose-area${errorZones.ones ? " cb-area--error" : ""}`} ref={looseAreaRef}>
            {Array.from({ length: placed.ones }, (_, i) => (
              <div key={i} onClick={i < groupableCount ? onGroup : onRemoveOne}>
                <Coin numeric={numeric} groupable={i < groupableCount} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function rectCenter(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export default function BuildNumberTask({ task, onCorrect, onMistake }) {
  const [placed, setPlaced] = useState({ tens: 0, ones: 0 });
  const [errorZones, setErrorZones] = useState({ tens: false, ones: false });
  const [solved, setSolved] = useState(false);
  const { speak } = useSpeech();
  const stacksAreaRef = useRef(null);
  const looseAreaRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  function handleDragEnd({ over }) {
    if (!over) return;
    setErrorZones({ tens: false, ones: false });
    setPlaced((p) => ({ ...p, ones: p.ones + 1 }));
  }

  function removeOne() {
    setPlaced((p) => ({ ...p, ones: Math.max(0, p.ones - 1) }));
  }

  function removeTen() {
    setPlaced((p) => ({ ...p, tens: Math.max(0, p.tens - 1) }));
  }

  function handleGroup() {
    if (placed.ones < 10) return;
    const looseRect = looseAreaRef.current.getBoundingClientRect();
    const stacksRect = stacksAreaRef.current.getBoundingClientRect();
    const from = rectCenter(looseRect);
    const to = { x: stacksRect.left + 24 + (placed.tens % 4) * 46, y: stacksRect.bottom - 30 };

    setPlaced((p) => ({ ...p, ones: p.ones - 10 }));

    const ghost = document.createElement("div");
    ghost.className = "cb-stack-ghost";
    ghost.style.left = `${from.x}px`;
    ghost.style.top = `${from.y}px`;
    for (let i = 0; i < 6; i++) {
      const c = document.createElement("div");
      c.className = "cb-stack-coin";
      ghost.appendChild(c);
    }
    document.body.appendChild(ghost);

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const anim = ghost.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.9) rotate(0deg)", offset: 0 },
        { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 40}px)) scale(1.05) rotate(-6deg)`, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(3deg)`, offset: 1 },
      ],
      { duration: 550, easing: "cubic-bezier(.3,.6,.4,1)" },
    );
    anim.onfinish = () => {
      ghost.remove();
      setPlaced((p) => ({ ...p, tens: p.tens + 1 }));
    };
  }

  function handleDone() {
    const okTens = placed.tens === task.target.tens;
    const okOnes = placed.ones === task.target.ones;
    if (okTens && okOnes) {
      speak("Верно!");
      setSolved(true);
    } else {
      setErrorZones({ tens: !okTens, ones: !okOnes });
      onMistake?.(task.conceptId, task.cardId);
    }
  }

  function handleContinue() {
    onCorrect(task.conceptId, task.cardId);
  }

  const groupableCount = placed.ones >= 10 ? 10 : 0;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="pv-screen">
        <div className="pv-instruction">Собери число</div>
        <div className="pv-number">{task.number}</div>

        <Workspace
          placed={placed}
          groupableCount={groupableCount}
          errorZones={errorZones}
          solved={solved}
          numeric={task.numericBlocks}
          onRemoveOne={removeOne}
          onGroup={handleGroup}
          onRemoveTen={removeTen}
          stacksAreaRef={stacksAreaRef}
          looseAreaRef={looseAreaRef}
        />

        <div className="pv-zones" style={{ flex: 0 }}>
          <div style={{ flex: 1 }} className="pv-zone-counter">
            {placed.tens} {pluralTens(placed.tens)}
          </div>
          <div style={{ flex: 1 }} className="pv-zone-counter">
            {placed.ones} {pluralOnes(placed.ones)}
          </div>
        </div>

        <div className="pv-spacer" />

        <div className="pv-tray">
          <PileSource />
        </div>
        <div className="pv-caption">тяни монету из кучи</div>

        <div className="pv-footer">
          {solved ? (
            <Button variant="secondary" onClick={handleContinue}>Далее →</Button>
          ) : (
            <Button variant="primary" onClick={handleDone}>ГОТОВО</Button>
          )}
        </div>
      </div>
    </DndContext>
  );
}
```

- [ ] **Step 4: Start the dev server**

Run: `npm run dev` (leave running; it serves on `http://localhost:8080` per `package.json`)

- [ ] **Step 5: Navigate to the build_number task screen**

In a browser (headed — screenshots alone can miss drag-and-drop bugs, verify visually), open the app, pick the `column_addition` topic, select the "Собери число" mode, start a session. Confirm on load:
- One dashed zone (not two), coin heap at the bottom, no "ДЕСЯТКИ"/"ЕДИНИЦЫ" boxes.
- The heap's top coin gently bobs.

- [ ] **Step 6: Manually verify the coin-drag interaction**

Using mouse drag (click-hold on the heap, move onto the zone, release): confirm a coin lands in the right-hand loose area with a small pop-in, and the "N единиц" counter increments. Repeat until 10 loose coins are present — confirm all 10 start pulsing with a green outline and nothing groups automatically.

- [ ] **Step 7: Manually verify touch drag specifically**

Repeat step 6 using touch emulation (devtools device toolbar, or CDP `Input.dispatchTouchEvent` if scripting) rather than mouse — mouse-only testing has previously missed drag-and-drop bugs specific to touch in this codebase.

- [ ] **Step 8: Manually verify grouping, removal, and completion**

- Tap one of the 10 pulsing coins → confirm a coin-stack visibly flies from the loose area to the stacks area and lands there; "N десятков" increments, "N единиц" drops by 10.
- Tap a loose (non-pulsing) coin → confirm it's removed, counter decrements by 1.
- Tap a stack → confirm it's removed entirely, counter decrements by 1 (not by 10).
- Build a wrong total and press ГОТОВО → confirm the mismatched side(s) shake red.
- Build the exact `task.target` (visible via the number at the top) and press ГОТОВО → confirm the zone highlights green and the button becomes "Далее →".

- [ ] **Step 9: Toggle numeric mode**

In the mode's settings screen (`ParamsScreen`), enable "Блоки с цифрами вместо кубиков", start a new session, confirm each coin shows "1" and each stack shows "10".

- [ ] **Step 10: Regression-check the untouched modes**

Open "Какое это число?" and "Разменяй десяток" — confirm their two-zone ten-frame (2×5) layout is visually unchanged from before this task.

- [ ] **Step 11: Commit**

```bash
git add src/topics/renderers/column_addition/CoinBlocks.jsx src/topics/renderers/column_addition/coins.css src/topics/renderers/column_addition/BuildNumberTask.jsx
git commit -m "feat(column_addition): rework build_number as a coin-heap/tap-to-group mechanic"
```

---

## Self-Review Notes

- **Spec coverage:** §1 (rationale) is architecture-level context, not a task. §2 (maxTens) → Task 1 + Task 2. §3 (single zone) → Task 3. §4 (coin heap source) → Task 3 (`CoinPile`). §5 (manual grouping) → Task 3 (`handleGroup`, `groupableCount`). §6 (removal) → Task 3 (`removeOne`/`removeTen`, no unpacking). §7 (completion) → Task 3 (`handleDone`, unchanged). §8 (`numericBlocks`) → Task 3 (`numeric` prop threaded through `Coin`/`TenStack`). §9 (architecture boundary) → Task 3 (new file, `PlaceValueBlocks.jsx` untouched — confirmed no import of it in the rewritten file). §10 (copy) → Task 2. §11 (out of scope) → nothing to build. §12 (testing) → Task 1/2 vitest steps, Task 3 manual steps.
- **Placeholder scan:** no TBD/TODO; every step has literal code or an exact command with expected output.
- **Type consistency:** `generateBuildNumberTask(card, maxOnes, maxTens, numericBlocks)` signature is consistent between Task 1's implementation and its only call site (same task, same file). `task.maxTens` is produced in Task 1 and intentionally unused by Task 3 (noted explicitly, not a dangling reference). `Coin`/`TenStack`/`CoinPile` names and props (`numeric`, `groupable`) match between their definition in Step 1 and their usage in Step 3 of Task 3.

---

Plan complete and saved to `docs/superpowers/plans/2026-07-16-build-number-coins.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
