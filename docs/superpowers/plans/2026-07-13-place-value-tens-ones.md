# «Десятки и единицы» (place-value modes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three new modes (`build_number`, `identify_number`, `regroup_ten`) to the existing `column_addition` topic, teaching two-digit place value (tens/ones) through a draggable block model, following the design in `docs/superpowers/specs/2026-07-13-place-value-tens-ones-design.md`.

**Architecture:** Three new React task components share one presentational module (`PlaceValueBlocks.jsx`) and one stylesheet (`place_value.css`). Numbers are generated procedurally by three new functions in the existing `engine.js`, routed through the existing `generateTasks()` dispatcher exactly like `fingers_show`/`fingers_count`. The three new task types are wired into `ColumnAdditionRenderer`'s existing if/else routing in `index.jsx`, and registered as new mode entries in `topicLoader.js` with `evaluation: "instant"` and `orientationLock: "portrait"`. No new reward/streak logic is needed — calling the existing `onCorrect(conceptId, cardId)` / `onMistake(conceptId, cardId)` callbacks is sufficient; `useSessionEngine.js` already handles streak counting and triggers the session-level `RewardVideoModal`.

**Tech Stack:** React (existing project conventions), `@dnd-kit/core` (already a dependency, already used in `sentence_puzzle`), Vitest for engine tests (no React component testing in this codebase — none of `src/topics/renderers/**` has a `.test.jsx` file; component correctness is verified manually via the `run` skill, not automated).

## Global Constraints

- Follow the codebase's existing `column_addition` conventions exactly where they exist (card shape `{ id, conceptId, renderer, params }`, mode shape `{ id, type, evaluation, ui, params }`, `generateTasks(mode, cards, count, params)` dispatch pattern) — do not invent a parallel convention.
- No handwritten/notebook font (`Primo`) anywhere in these three modes — use the app's default sans-serif (no explicit `font-family` override needed; `place_value.css` must not reference `Primo`).
- No text labels under tray items ("десяток"/"единица") and no hint system (no hint button, no hint banner, no revealing the correct answer on a wrong attempt) — wrong answers get a shake + reset only, per `docs/superpowers/specs/2026-07-13-place-value-tens-ones-design.md` §7.
- `orientationLock: "portrait"` on all three new mode definitions — no landscape/two-column layout is built.
- Zones size to their own content (`align-items: flex-start`, not `stretch`) and the whole screen scrolls on overflow (`overflow-y: auto` on the screen root) — never an inner scrollbox per zone.
- Tray / numpad / action controls are pinned to the bottom via a `flex: 1 1 0` spacer between the zones and the bottom controls — never floats up under sparse content.
- Ten = a 2×5 ten-frame grid card (opaque background, border, "10" badge), never a 1×10 column or a bare horizontal strip. Unit cube and ten-frame cell are the same size (20×20).
- Do not touch `dist/column_addition_topic.json` or any `dist/**`/`runtime/**` copy — those are build output. Only edit `public/column_addition_topic.json` and `public/decks/catalog.json`.
- Per CLAUDE.md: any new CSS with `position: fixed | sticky | absolute` that reaches a real screen edge must add the matching `var(--app-safe-*, 0px)` offset. None of the CSS in this plan uses fixed/sticky/absolute positioning pinned to a screen edge — Task 10 includes a grep check to confirm that stays true.

---

## File Structure

```
src/topics/renderers/column_addition/
  engine.js                  (MODIFY — add 3 generator functions + routing)
  engine.test.js             (MODIFY — add tests for the 3 generator functions)
  index.jsx                  (MODIFY — add 3 routing branches + imports)
  PlaceValueBlocks.jsx        (CREATE — shared UnitCube/TenCard + pluralization helpers)
  place_value.css            (CREATE — shared styles for the 3 new modes)
  BuildNumberTask.jsx         (CREATE — "Собери число")
  IdentifyNumberTask.jsx      (CREATE — "Какое это число?")
  RegroupTenTask.jsx          (CREATE — "Размени десяток")

src/topics/topicLoader.js     (MODIFY — 3 new mode defs + 3 new methodology entries)

public/column_addition_topic.json  (MODIFY — 3 new generator cards, version bump)
public/decks/catalog.json          (MODIFY — version + url bump for column_addition)
```

---

### Task 1: Engine — number generators for the 3 modes

**Files:**
- Modify: `src/topics/renderers/column_addition/engine.js:157-166` (insert after `generateFingersCount`, before `generateExamples`)
- Test: `src/topics/renderers/column_addition/engine.test.js`

**Interfaces:**
- Produces: `generateBuildNumberTask(card, level)`, `generateIdentifyNumberTask(card, level)`, `generateRegroupTask(card, level)` — each takes a card object (`{ id, conceptId }`) and a level number (1–5), returns a task object. Exact shapes below. `card.renderer`/`card.params` are not read by these functions.

Number ranges per level (design doc §8): tens is always `randomInt(1, 9)` (guarantees a real two-digit number, and for `regroup_ten` guarantees `tens >= 1` so no extra filtering is needed). Ones digit depends on level:

| Level | Ones rule |
|---|---|
| 1 | `randomInt(1, 2)` |
| 2 | `randomInt(3, 7)` |
| 3 | `randomInt(6, 9)` |
| 4 | `0` |
| 5 (default) | `randomInt(0, 9)` |

- [ ] **Step 1: Write the failing tests**

Open `src/topics/renderers/column_addition/engine.test.js` and add this block at the very end of the file (after the existing `});` that closes the `"generateTasks – fingers_count"` describe block at line 185):

```js

const PLACE_VALUE_CARDS = [
  { id: "build_number",    conceptId: "build_number",    renderer: "column_addition", params: { mode: "build_number" } },
  { id: "identify_number", conceptId: "identify_number", renderer: "column_addition", params: { mode: "identify_number" } },
  { id: "regroup_ten",     conceptId: "regroup_ten",     renderer: "column_addition", params: { mode: "regroup_ten" } },
];

describe("generateTasks – build_number", () => {
  it("returns tasks of type build_number with number matching target", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 10, { level: 1 });
    expect(tasks).toHaveLength(10);
    for (const t of tasks) {
      expect(t.type).toBe("build_number");
      expect(t.number).toBe(t.target.tens * 10 + t.target.ones);
    }
  });

  it("level 1: ones digit is 1 or 2", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 30, { level: 1 });
    for (const t of tasks) expect([1, 2]).toContain(t.target.ones);
  });

  it("level 4: ones digit is always 0", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 20, { level: 4 });
    for (const t of tasks) expect(t.target.ones).toBe(0);
  });

  it("tens digit is always 1-9", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 30, { level: 5 });
    for (const t of tasks) {
      expect(t.target.tens).toBeGreaterThanOrEqual(1);
      expect(t.target.tens).toBeLessThanOrEqual(9);
    }
  });
});

describe("generateTasks – identify_number", () => {
  it("returns tasks of type identify_number with number matching model", () => {
    const tasks = generateTasks("identify_number", PLACE_VALUE_CARDS, 10, { level: 2 });
    expect(tasks).toHaveLength(10);
    for (const t of tasks) {
      expect(t.type).toBe("identify_number");
      expect(t.number).toBe(t.model.tens * 10 + t.model.ones);
    }
  });

  it("showCounters is true only at level 1", () => {
    const l1 = generateTasks("identify_number", PLACE_VALUE_CARDS, 5, { level: 1 });
    const l2 = generateTasks("identify_number", PLACE_VALUE_CARDS, 5, { level: 2 });
    expect(l1.every(t => t.showCounters === true)).toBe(true);
    expect(l2.every(t => t.showCounters === false)).toBe(true);
  });
});

describe("generateTasks – regroup_ten", () => {
  it("returns tasks where after = initial minus one ten plus ten ones", () => {
    const tasks = generateTasks("regroup_ten", PLACE_VALUE_CARDS, 20, { level: 5 });
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

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/topics/renderers/column_addition/engine.test.js`
Expected: FAIL — `generateTasks` returns `[]` for the new modes (they don't exist yet), so `toHaveLength(10)` assertions fail.

- [ ] **Step 3: Implement the generator functions**

In `src/topics/renderers/column_addition/engine.js`, find this exact block (lines 157–166):

```js
export function generateFingersCount(card) {
  const op  = card.params?.op ?? "add";
  const a   = card.params?.a ?? 0;
  const b   = card.params?.b ?? 0;
  const result = op === "add" ? a + b : a - b;
  const base = { type: "fingers_count", cardId: card.id, conceptId: card.conceptId, op, a, b, result };
  if (op === "sub") return { ...base, ...getRemoveMode(a, b) };
  return base;
}

export function generateExamples(count, params) {
```

Replace it with:

```js
export function generateFingersCount(card) {
  const op  = card.params?.op ?? "add";
  const a   = card.params?.a ?? 0;
  const b   = card.params?.b ?? 0;
  const result = op === "add" ? a + b : a - b;
  const base = { type: "fingers_count", cardId: card.id, conceptId: card.conceptId, op, a, b, result };
  if (op === "sub") return { ...base, ...getRemoveMode(a, b) };
  return base;
}

function randomPlaceValueNumber(level) {
  const tens = randomInt(1, 9);
  let ones;
  switch (Number(level)) {
    case 1: ones = randomInt(1, 2); break;
    case 2: ones = randomInt(3, 7); break;
    case 3: ones = randomInt(6, 9); break;
    case 4: ones = 0; break;
    default: ones = randomInt(0, 9); break;
  }
  return { tens, ones };
}

export function generateBuildNumberTask(card, level) {
  const { tens, ones } = randomPlaceValueNumber(level);
  return {
    type: "build_number",
    cardId: card.id,
    conceptId: card.conceptId,
    level: Number(level),
    number: tens * 10 + ones,
    target: { tens, ones },
  };
}

export function generateIdentifyNumberTask(card, level) {
  const { tens, ones } = randomPlaceValueNumber(level);
  return {
    type: "identify_number",
    cardId: card.id,
    conceptId: card.conceptId,
    level: Number(level),
    number: tens * 10 + ones,
    model: { tens, ones },
    showCounters: Number(level) === 1,
  };
}

export function generateRegroupTask(card, level) {
  const { tens, ones } = randomPlaceValueNumber(level);
  return {
    type: "regroup_ten",
    cardId: card.id,
    conceptId: card.conceptId,
    level: Number(level),
    number: tens * 10 + ones,
    initial: { tens, ones },
    after: { tens: tens - 1, ones: ones + 10 },
  };
}

export function generateExamples(count, params) {
```

Note: these tests will still fail after this step alone — `generateTasks()` doesn't route to these functions yet. That's Task 2. Do not skip ahead; commit this step as-is (the functions exist and are directly unit-testable, even though `generateTasks` doesn't call them yet).

- [ ] **Step 4: Run tests to verify they still fail the same way, for the same reason**

Run: `npx vitest run src/topics/renderers/column_addition/engine.test.js`
Expected: FAIL — still `toHaveLength(0)` (or similar), because `generateTasks("build_number", ...)` doesn't recognize the mode yet. This is expected; Task 2 makes it pass.

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/column_addition/engine.js src/topics/renderers/column_addition/engine.test.js
git commit -m "feat(column_addition): add place-value task generators"
```

---

### Task 2: Engine — wire `generateTasks()` routing for the 3 new modes

**Files:**
- Modify: `src/topics/renderers/column_addition/engine.js:191-220`

**Interfaces:**
- Consumes: `generateBuildNumberTask`, `generateIdentifyNumberTask`, `generateRegroupTask` from Task 1.
- Produces: `generateTasks("build_number" | "identify_number" | "regroup_ten", cards, count, { level })` now returns real tasks instead of `[]`.

- [ ] **Step 1: Run the Task 1 tests to confirm they currently fail here**

Run: `npx vitest run src/topics/renderers/column_addition/engine.test.js`
Expected: FAIL on the three new describe blocks (as left off at the end of Task 1).

- [ ] **Step 2: Add routing**

In `src/topics/renderers/column_addition/engine.js`, find this exact block:

```js
  const fingerShowCards  = allCards.filter(c => c.params?.mode === "fingers_show");
  const fingerCountCards = allCards.filter(c => c.params?.mode === "fingers_count");

  if (mode === "fingers_show") {
```

Replace with:

```js
  const fingerShowCards     = allCards.filter(c => c.params?.mode === "fingers_show");
  const fingerCountCards    = allCards.filter(c => c.params?.mode === "fingers_count");
  const buildNumberCards    = allCards.filter(c => c.params?.mode === "build_number");
  const identifyNumberCards = allCards.filter(c => c.params?.mode === "identify_number");
  const regroupTenCards     = allCards.filter(c => c.params?.mode === "regroup_ten");

  if (mode === "fingers_show") {
```

Then find this exact block (the end of the `fingers_count` branch, right before the default column_arithmetic comment):

```js
  if (mode === "fingers_count") {
    const opFilter = params.op;
    let pool = fingerCountCards.length ? fingerCountCards : [];
    if (opFilter && opFilter !== "mixed") {
      pool = pool.filter(c => (c.params?.op ?? "add") === opFilter);
    }
    if (!pool.length) pool = fingerCountCards;
    const tasks = [];
    for (let i = 0; tasks.length < count && i < pool.length * 3; i++) {
      tasks.push(generateFingersCount(pool[i % pool.length]));
    }
    return tasks;
  }

  // Default: column_arithmetic — exclude finger cards
```

Replace with:

```js
  if (mode === "fingers_count") {
    const opFilter = params.op;
    let pool = fingerCountCards.length ? fingerCountCards : [];
    if (opFilter && opFilter !== "mixed") {
      pool = pool.filter(c => (c.params?.op ?? "add") === opFilter);
    }
    if (!pool.length) pool = fingerCountCards;
    const tasks = [];
    for (let i = 0; tasks.length < count && i < pool.length * 3; i++) {
      tasks.push(generateFingersCount(pool[i % pool.length]));
    }
    return tasks;
  }

  if (mode === "build_number") {
    if (!buildNumberCards.length) return [];
    const level = Number(params.level ?? 1);
    const tasks = [];
    for (let i = 0; i < count; i++) {
      tasks.push(generateBuildNumberTask(buildNumberCards[i % buildNumberCards.length], level));
    }
    return tasks;
  }

  if (mode === "identify_number") {
    if (!identifyNumberCards.length) return [];
    const level = Number(params.level ?? 1);
    const tasks = [];
    for (let i = 0; i < count; i++) {
      tasks.push(generateIdentifyNumberTask(identifyNumberCards[i % identifyNumberCards.length], level));
    }
    return tasks;
  }

  if (mode === "regroup_ten") {
    if (!regroupTenCards.length) return [];
    const level = Number(params.level ?? 1);
    const tasks = [];
    for (let i = 0; i < count; i++) {
      tasks.push(generateRegroupTask(regroupTenCards[i % regroupTenCards.length], level));
    }
    return tasks;
  }

  // Default: column_arithmetic — exclude finger cards
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run src/topics/renderers/column_addition/engine.test.js`
Expected: PASS — all tests, including the full pre-existing suite (make sure nothing in `column_arithmetic`/`fingers_show`/`fingers_count` broke).

- [ ] **Step 4: Commit**

```bash
git add src/topics/renderers/column_addition/engine.js
git commit -m "feat(column_addition): route generateTasks() to place-value generators"
```

---

### Task 3: Shared visual components — `PlaceValueBlocks.jsx` + `place_value.css`

**Files:**
- Create: `src/topics/renderers/column_addition/PlaceValueBlocks.jsx`
- Create: `src/topics/renderers/column_addition/place_value.css`

**Interfaces:**
- Produces: `UnitCube()`, `TenCard({ dim })`, `pluralTens(n)`, `pluralOnes(n)` — all named exports from `PlaceValueBlocks.jsx`. `TenCard` renders a 2×5 grid of 10 cells (a "ten-frame"), not a 1×10 column. `place_value.css` defines every `.pv-*` class referenced by Tasks 4–6.

No automated test for this task — this codebase has no React component test setup (`.test.jsx` files don't exist anywhere under `src/topics/renderers/`). Correctness is verified visually in Task 10.

- [ ] **Step 1: Create `PlaceValueBlocks.jsx`**

```jsx
export function pluralTens(n) {
  return n === 1 ? "десяток" : n >= 2 && n <= 4 ? "десятка" : "десятков";
}

export function pluralOnes(n) {
  return n === 1 ? "единица" : n >= 2 && n <= 4 ? "единицы" : "единиц";
}

export function UnitCube() {
  return <div className="pv-cube" />;
}

export function TenCard({ dim = false }) {
  return (
    <div className={`pv-ten-card${dim ? " pv-ten-card--dim" : ""}`}>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="pv-ten-seg" />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `place_value.css`**

```css
.pv-screen {
  position: relative;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  background-color: #f0f6ff;
  background-image:
    linear-gradient(rgba(140, 190, 255, 0.35) 1px, transparent 1px),
    linear-gradient(90deg, rgba(140, 190, 255, 0.35) 1px, transparent 1px);
  background-size: 32px 32px;
  display: flex;
  flex-direction: column;
  padding: 20px 16px 16px;
  overflow-y: auto;
}

.pv-instruction {
  text-align: center;
  font-size: 16px;
  color: #475569;
  margin-bottom: 2px;
  flex-shrink: 0;
}

.pv-number {
  text-align: center;
  font-size: 54px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  color: #1a1a2e;
  line-height: 1;
  margin-bottom: 14px;
  flex-shrink: 0;
}

.pv-zones {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex: 0 0 auto;
}

.pv-zone {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  border: 2.5px dashed #94a3b8;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.55);
  padding: 8px 6px;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}

.pv-zone--drag-over {
  border-color: #3b82f6;
  border-style: solid;
  background: #eff6ff;
  box-shadow: 0 0 14px rgba(59, 130, 246, 0.35);
}

.pv-zone--error {
  animation: pv-shake 0.4s ease-in-out;
  border-color: #ef4444;
}

@keyframes pv-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}

.pv-zone-label {
  text-align: center;
  font-size: 13px;
  letter-spacing: 0.08em;
  color: #64748b;
  font-weight: 600;
  margin-bottom: 6px;
}

.pv-zone-body {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  justify-content: center;
  gap: 14px;
  min-height: 60px;
}

.pv-zone-counter {
  text-align: center;
  font-size: 15px;
  color: #334155;
  margin-top: 4px;
  font-weight: 700;
  min-height: 20px;
  flex-shrink: 0;
}

.pv-cube {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: linear-gradient(145deg, #93c5fd, #60a5fa);
  border: 1.5px solid #2563eb;
  box-shadow: inset 0 -2px 0 rgba(30, 64, 175, 0.35), 0 1px 2px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
  cursor: pointer;
}

.pv-ten-card {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 2px;
  padding: 4px;
  border-radius: 10px;
  background: #fffaf0;
  border: 2px solid #d9a441;
  box-shadow: 0 2px 6px rgba(180, 120, 20, 0.28), inset 0 0 0 1px rgba(255, 255, 255, 0.6);
  flex-shrink: 0;
  width: max-content;
  position: relative;
  cursor: pointer;
}

.pv-ten-card::after {
  content: "10";
  position: absolute;
  top: -7px;
  right: -7px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #92400e;
  color: #fff7e6;
  font-size: 8.5px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.pv-ten-card--dim { opacity: 0.35; }
.pv-ten-card--dim::after { display: none; }

.pv-ten-seg {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: linear-gradient(145deg, #fcd34d, #f59e0b);
  border: 1px solid #b45309;
  box-shadow: inset 0 -1.5px 0 rgba(146, 64, 14, 0.35);
}

.pv-spacer {
  flex: 1 1 0;
  min-height: 0;
}

.pv-tray {
  display: flex;
  justify-content: center;
  gap: 28px;
  padding: 14px 0 6px;
  flex-shrink: 0;
}

.pv-tray-item {
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.pv-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  padding-top: 10px;
  flex-shrink: 0;
}

.pv-answer-row {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin: 10px 0 6px;
  flex-shrink: 0;
}

.pv-answer-slot {
  width: 52px;
  height: 60px;
  border: 2.5px dashed #94a3b8;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  background: rgba(255, 255, 255, 0.6);
  color: #1a1a2e;
}

.pv-answer-slot--filled {
  border-style: solid;
  border-color: #1d4ed8;
  background: #eff6ff;
}

.pv-answer-slot--shake {
  border-color: #ef4444;
  animation: pv-shake 0.4s ease-in-out;
}

.pv-numpad {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  padding: 8px 0;
  flex-shrink: 0;
}

.pv-numkey {
  font-family: inherit;
  font-size: 20px;
  font-weight: 700;
  padding: 10px 0;
  border-radius: 10px;
  border: 2px solid #dbeafe;
  background: white;
  box-shadow: 0 3px 0 #c7d2fe;
  cursor: pointer;
  color: #1a1a2e;
}

.pv-numkey:active { transform: translateY(2px); box-shadow: none; }

.pv-caption {
  text-align: center;
  font-size: 13px;
  color: #475569;
  margin-top: 4px;
  flex-shrink: 0;
}

.pv-question {
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 8px;
}

.pv-yesno-row {
  display: flex;
  justify-content: center;
  gap: 14px;
  flex-shrink: 0;
}

.pv-result-panel {
  text-align: center;
  padding: 14px;
  flex-shrink: 0;
}

.pv-result-line {
  font-size: 20px;
  color: #1a1a2e;
}

.pv-result-line--sum {
  color: #059669;
  font-weight: 700;
}

.pv-cube-pop {
  animation: pv-pop 0.3s ease-out both;
}

@keyframes pv-pop {
  from { transform: scale(0.3); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
```

- [ ] **Step 3: Confirm no unsafe fixed/sticky/absolute positioning was introduced**

Run: `grep -nE "position:\s*(fixed|sticky|absolute)" src/topics/renderers/column_addition/place_value.css`
Expected: only `.pv-ten-card::after` (the "10" badge) and nothing else — `position: relative` on `.pv-ten-card` and `position: absolute` on its own `::after` badge, which is positioned relative to the ten-card itself, not the screen edge. No safe-area variables needed (per CLAUDE.md's rule, that rule only applies to elements anchored to a real screen edge — this one is anchored to a small in-flow card).

- [ ] **Step 4: Commit**

```bash
git add src/topics/renderers/column_addition/PlaceValueBlocks.jsx src/topics/renderers/column_addition/place_value.css
git commit -m "feat(column_addition): add shared place-value visual components"
```

---

### Task 4: `BuildNumberTask.jsx` — «Собери число»

**Files:**
- Create: `src/topics/renderers/column_addition/BuildNumberTask.jsx`

**Interfaces:**
- Consumes: `UnitCube`, `TenCard`, `pluralTens`, `pluralOnes` from `./PlaceValueBlocks.jsx` (Task 3); `Button` from `@/shared/components/Button` (existing, props `{ children, variant, onClick, disabled, fullWidth, type }`); `useSpeech` from `@/shared/hooks/useSpeech` (existing, named export, returns `{ speak, cancel }`, `speak(text, { rate, pitch } = {})`); `task` shape `{ type: "build_number", cardId, conceptId, number, target: { tens, ones } }` (Task 1/2).
- Produces: default export `BuildNumberTask({ task, onCorrect, onMistake })`. Calls `onCorrect(task.conceptId, task.cardId)` when the built composition matches `task.target`; calls `onMistake?.(task.conceptId, task.cardId)` otherwise (no-op if `onMistake` is undefined, matching the existing `strictMistake` convention in `index.jsx`).

- [ ] **Step 1: Create the file**

```jsx
import React, { useState } from "react";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import Button from "@/shared/components/Button";
import { useSpeech } from "@/shared/hooks/useSpeech";
import { UnitCube, TenCard, pluralTens, pluralOnes } from "./PlaceValueBlocks.jsx";
import "./place_value.css";

function TrayItem({ id, kind, children }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { kind } });
  return (
    <div
      ref={setNodeRef}
      className="pv-tray-item"
      style={{ opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}

export default function BuildNumberTask({ task, onCorrect, onMistake }) {
  const [placed, setPlaced] = useState({ tens: 0, ones: 0 });
  const [errorZones, setErrorZones] = useState({ tens: false, ones: false });
  const { speak } = useSpeech();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const { setNodeRef: setWorkspaceRef, isOver } = useDroppable({ id: "pv-workspace" });

  function handleDragEnd({ active, over }) {
    if (!over) return;
    const kind = active.data.current?.kind;
    setErrorZones({ tens: false, ones: false });
    if (kind === "ten") {
      setPlaced((p) => ({ ...p, tens: p.tens + 1 }));
    } else if (kind === "unit") {
      setPlaced((p) => ({ ...p, ones: p.ones + 1 }));
    }
  }

  function removeTen() {
    setPlaced((p) => ({ ...p, tens: Math.max(0, p.tens - 1) }));
  }

  function removeOne() {
    setPlaced((p) => ({ ...p, ones: Math.max(0, p.ones - 1) }));
  }

  function handleDone() {
    const okTens = placed.tens === task.target.tens;
    const okOnes = placed.ones === task.target.ones;
    if (okTens && okOnes) {
      speak("Верно!");
      onCorrect(task.conceptId, task.cardId);
    } else {
      setErrorZones({ tens: !okTens, ones: !okOnes });
      onMistake?.(task.conceptId, task.cardId);
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="pv-screen">
        <div className="pv-instruction">Собери число</div>
        <div className="pv-number">{task.number}</div>

        <div className="pv-zones" ref={setWorkspaceRef}>
          <div className={`pv-zone${errorZones.tens ? " pv-zone--error" : ""}${isOver ? " pv-zone--drag-over" : ""}`}>
            <div className="pv-zone-label">ДЕСЯТКИ</div>
            <div className="pv-zone-body">
              {Array.from({ length: placed.tens }, (_, i) => (
                <div key={i} onClick={removeTen}>
                  <TenCard />
                </div>
              ))}
            </div>
          </div>
          <div className={`pv-zone${errorZones.ones ? " pv-zone--error" : ""}${isOver ? " pv-zone--drag-over" : ""}`}>
            <div className="pv-zone-label">ЕДИНИЦЫ</div>
            <div className="pv-zone-body">
              {Array.from({ length: placed.ones }, (_, i) => (
                <div key={i} onClick={removeOne}>
                  <UnitCube />
                </div>
              ))}
            </div>
          </div>
        </div>

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
          <TrayItem id="tray-ten" kind="ten">
            <TenCard />
          </TrayItem>
          <TrayItem id="tray-unit" kind="unit">
            <UnitCube />
          </TrayItem>
        </div>

        <div className="pv-footer">
          <Button variant="primary" onClick={handleDone}>ГОТОВО</Button>
        </div>
      </div>
    </DndContext>
  );
}
```

- [ ] **Step 2: Sanity-check it builds**

Run: `npx vite build --mode development 2>&1 | tail -40`
Expected: no errors mentioning `BuildNumberTask.jsx` (import resolution, JSX syntax). If the project doesn't already have a green baseline build, instead run `npx eslint src/topics/renderers/column_addition/BuildNumberTask.jsx` and confirm no parse errors.

- [ ] **Step 3: Commit**

```bash
git add src/topics/renderers/column_addition/BuildNumberTask.jsx
git commit -m "feat(column_addition): add BuildNumberTask component"
```

---

### Task 5: `IdentifyNumberTask.jsx` — «Какое это число?»

**Files:**
- Create: `src/topics/renderers/column_addition/IdentifyNumberTask.jsx`

**Interfaces:**
- Consumes: same shared imports as Task 4 plus `useSpeech`; `task` shape `{ type: "identify_number", cardId, conceptId, number, model: { tens, ones }, showCounters }`.
- Produces: default export `IdentifyNumberTask({ task, onCorrect, onMistake })`. No ГОТОВО button — checks automatically the instant the second digit (ones) is entered.

- [ ] **Step 1: Create the file**

```jsx
import React, { useState } from "react";
import Button from "@/shared/components/Button";
import { useSpeech } from "@/shared/hooks/useSpeech";
import { UnitCube, TenCard, pluralTens, pluralOnes } from "./PlaceValueBlocks.jsx";
import "./place_value.css";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

export default function IdentifyNumberTask({ task, onCorrect, onMistake }) {
  const [val, setVal] = useState({ tens: null, ones: null });
  const [shake, setShake] = useState({ tens: false, ones: false });
  const { speak } = useSpeech();

  function checkAnswer(next) {
    const okTens = next.tens === task.model.tens;
    const okOnes = next.ones === task.model.ones;
    if (okTens && okOnes) {
      speak("Верно!");
      onCorrect(task.conceptId, task.cardId);
      return;
    }
    setShake({ tens: !okTens, ones: !okOnes });
    onMistake?.(task.conceptId, task.cardId);
    setTimeout(() => {
      setShake({ tens: false, ones: false });
      setVal({ tens: null, ones: null });
    }, 500);
  }

  function handleDigit(d) {
    if (val.tens === null) {
      setVal({ tens: d, ones: null });
      return;
    }
    if (val.ones === null) {
      const next = { tens: val.tens, ones: d };
      setVal(next);
      checkAnswer(next);
    }
  }

  function handleClear() {
    setVal({ tens: null, ones: null });
  }

  return (
    <div className="pv-screen">
      <div className="pv-instruction">Какое это число?</div>

      <div className="pv-zones">
        <div className="pv-zone">
          <div className="pv-zone-label">ДЕСЯТКИ</div>
          <div className="pv-zone-body">
            {Array.from({ length: task.model.tens }, (_, i) => (
              <TenCard key={i} />
            ))}
          </div>
        </div>
        <div className="pv-zone">
          <div className="pv-zone-label">ЕДИНИЦЫ</div>
          <div className="pv-zone-body">
            {Array.from({ length: task.model.ones }, (_, i) => (
              <UnitCube key={i} />
            ))}
          </div>
        </div>
      </div>

      {task.showCounters && (
        <div className="pv-zones" style={{ flex: 0 }}>
          <div style={{ flex: 1 }} className="pv-zone-counter">
            {task.model.tens} {pluralTens(task.model.tens)}
          </div>
          <div style={{ flex: 1 }} className="pv-zone-counter">
            {task.model.ones} {pluralOnes(task.model.ones)}
          </div>
        </div>
      )}

      <div className="pv-answer-row">
        <div className={`pv-answer-slot${val.tens !== null ? " pv-answer-slot--filled" : ""}${shake.tens ? " pv-answer-slot--shake" : ""}`}>
          {val.tens ?? "?"}
        </div>
        <div className={`pv-answer-slot${val.ones !== null ? " pv-answer-slot--filled" : ""}${shake.ones ? " pv-answer-slot--shake" : ""}`}>
          {val.ones ?? "?"}
        </div>
      </div>

      <div className="pv-spacer" />

      <div className="pv-numpad">
        {DIGITS.map((d) => (
          <button key={d} className="pv-numkey" onClick={() => handleDigit(d)}>
            {d}
          </button>
        ))}
      </div>
      <div className="pv-footer">
        <Button variant="secondary" onClick={handleClear}>Стереть</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Sanity-check it builds**

Run: `npx eslint src/topics/renderers/column_addition/IdentifyNumberTask.jsx`
Expected: no parse errors.

- [ ] **Step 3: Commit**

```bash
git add src/topics/renderers/column_addition/IdentifyNumberTask.jsx
git commit -m "feat(column_addition): add IdentifyNumberTask component"
```

---

### Task 6: `RegroupTenTask.jsx` — «Размени десяток»

**Files:**
- Create: `src/topics/renderers/column_addition/RegroupTenTask.jsx`

**Interfaces:**
- Consumes: same shared imports as Task 4 plus `useSpeech`; `task` shape `{ type: "regroup_ten", cardId, conceptId, number, initial: { tens, ones }, after: { tens, ones } }`.
- Produces: default export `RegroupTenTask({ task, onCorrect, onMistake })`. Drag a ten-card directly onto the ЕДИНИЦЫ zone (no separate exchange zone) → it becomes 10 unit cubes there. Then a ДА/НЕТ comprehension question; "НЕТ" (number didn't change) is correct.

- [ ] **Step 1: Create the file**

```jsx
import React, { useState } from "react";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import Button from "@/shared/components/Button";
import { useSpeech } from "@/shared/hooks/useSpeech";
import { UnitCube, TenCard, pluralTens, pluralOnes } from "./PlaceValueBlocks.jsx";
import "./place_value.css";

function DraggableTenCard({ id }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { kind: "ten" } });
  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.4 : 1, cursor: "grab" }} {...listeners} {...attributes}>
      <TenCard />
    </div>
  );
}

export default function RegroupTenTask({ task, onCorrect, onMistake }) {
  const [tens, setTens] = useState(task.initial.tens);
  const [ones, setOnes] = useState(task.initial.ones);
  const [exchanged, setExchanged] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false);
  const { speak } = useSpeech();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const { setNodeRef: setOnesDropRef, isOver } = useDroppable({ id: "pv-ones-zone" });

  function handleDragEnd({ over }) {
    if (!over || over.id !== "pv-ones-zone" || tens < 1 || exchanged) return;
    setTens((t) => t - 1);
    setOnes((o) => o + 10);
    setExchanged(true);
    speak("Один десяток разменяли на десять единиц");
  }

  function handleAnswer(saysChanged) {
    if (saysChanged) {
      setWrongFlash(true);
      setTimeout(() => setWrongFlash(false), 500);
      onMistake?.(task.conceptId, task.cardId);
      return;
    }
    setAnswered(true);
    speak("Верно! Число не изменилось");
    onCorrect(task.conceptId, task.cardId);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="pv-screen">
        <div className="pv-instruction">Размени один десяток на единицы</div>
        <div className="pv-number">{task.number}</div>

        <div className="pv-zones">
          <div className="pv-zone">
            <div className="pv-zone-label">ДЕСЯТКИ</div>
            <div className="pv-zone-body">
              {Array.from({ length: tens }, (_, i) =>
                !exchanged && i === tens - 1 ? (
                  <DraggableTenCard key={i} id={`ten-${i}`} />
                ) : (
                  <TenCard key={i} />
                )
              )}
            </div>
          </div>
          <div className={`pv-zone${isOver ? " pv-zone--drag-over" : ""}`} ref={setOnesDropRef}>
            <div className="pv-zone-label">ЕДИНИЦЫ</div>
            <div className="pv-zone-body">
              {Array.from({ length: ones }, (_, i) => {
                const isNew = exchanged && i >= task.initial.ones;
                return (
                  <div
                    key={i}
                    className={isNew ? "pv-cube-pop" : undefined}
                    style={isNew ? { animationDelay: `${(i - task.initial.ones) * 45}ms` } : undefined}
                  >
                    <UnitCube />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="pv-zones" style={{ flex: 0 }}>
          <div style={{ flex: 1 }} className="pv-zone-counter">
            {tens} {pluralTens(tens)}
          </div>
          <div style={{ flex: 1 }} className="pv-zone-counter">
            {ones} {pluralOnes(ones)}
          </div>
        </div>

        {!exchanged && <div className="pv-caption">перетащи десяток в ЕДИНИЦЫ, чтобы разменять</div>}

        <div className="pv-spacer" />

        {exchanged && !answered && (
          <div className="pv-footer" style={{ flexDirection: "column", gap: 8 }}>
            <div className="pv-question">Число изменилось?</div>
            <div className="pv-yesno-row">
              <Button variant={wrongFlash ? "primary" : "secondary"} onClick={() => handleAnswer(true)}>ДА</Button>
              <Button variant="secondary" onClick={() => handleAnswer(false)}>НЕТ</Button>
            </div>
          </div>
        )}

        {answered && (
          <div className="pv-result-panel">
            <div className="pv-result-line">
              {task.initial.tens * 10} + {task.initial.ones} = {task.number}
            </div>
            <div className="pv-result-line pv-result-line--sum">
              {task.after.tens * 10} + {task.after.ones} = {task.number}
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
}
```

- [ ] **Step 2: Sanity-check it builds**

Run: `npx eslint src/topics/renderers/column_addition/RegroupTenTask.jsx`
Expected: no parse errors.

- [ ] **Step 3: Commit**

```bash
git add src/topics/renderers/column_addition/RegroupTenTask.jsx
git commit -m "feat(column_addition): add RegroupTenTask component"
```

---

### Task 7: Wire the 3 new task types into `ColumnAdditionRenderer`

**Files:**
- Modify: `src/topics/renderers/column_addition/index.jsx:1-7` (imports), `:738-761` (routing)

**Interfaces:**
- Consumes: default exports from `BuildNumberTask.jsx`, `IdentifyNumberTask.jsx`, `RegroupTenTask.jsx` (Tasks 4–6).

- [ ] **Step 1: Add imports**

Find this exact block at the top of `src/topics/renderers/column_addition/index.jsx`:

```jsx
import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { generateExamples } from "./engine.js";
import RewardVideoModal from "@/shared/components/RewardVideoModal";
import FingersShowTask from "./FingersShowTask.jsx";
import FingersCountTask from "./FingersCountTask.jsx";
import HelperPanel from "../addition_subtraction/HelperPanel.jsx";
import "./column_addition.css";
```

Replace with:

```jsx
import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { generateExamples } from "./engine.js";
import RewardVideoModal from "@/shared/components/RewardVideoModal";
import FingersShowTask from "./FingersShowTask.jsx";
import FingersCountTask from "./FingersCountTask.jsx";
import BuildNumberTask from "./BuildNumberTask.jsx";
import IdentifyNumberTask from "./IdentifyNumberTask.jsx";
import RegroupTenTask from "./RegroupTenTask.jsx";
import HelperPanel from "../addition_subtraction/HelperPanel.jsx";
import "./column_addition.css";
```

- [ ] **Step 2: Add routing branches**

Find this exact block:

```jsx
  if (task?.type === "fingers_count") {
    return <FingersCountTask task={task} onCorrect={onCorrect} onMistake={strictMistake} />;
  }
  if (!task || task.type !== "column_arithmetic") {
```

Replace with:

```jsx
  if (task?.type === "fingers_count") {
    return <FingersCountTask task={task} onCorrect={onCorrect} onMistake={strictMistake} />;
  }
  if (task?.type === "build_number") {
    return (
      <BuildNumberTask
        key={`${task.cardId}-${task.number}`}
        task={task}
        onCorrect={onCorrect}
        onMistake={strictMistake}
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
```

The `key={...task.cardId}-${task.number}}` forces React to remount the component (resetting local state like `placed`/`val`/`tens`/`ones`) whenever the session hands it a fresh task — this is the same technique already used for `ColumnArithmeticTask` a few lines below (`key={`${task.cardId}-${task.top}-${task.bottom}-${task.operation}`}`).

- [ ] **Step 3: Run the full engine test suite to confirm nothing broke**

Run: `npx vitest run src/topics/renderers/column_addition/`
Expected: PASS (all existing + new tests).

- [ ] **Step 4: Commit**

```bash
git add src/topics/renderers/column_addition/index.jsx
git commit -m "feat(column_addition): route build_number/identify_number/regroup_ten tasks"
```

---

### Task 8: Register the 3 new modes in `topicLoader.js`

**Files:**
- Modify: `src/topics/topicLoader.js:1052-1082` (append to `DEFAULT_MODES.column_addition`)
- Modify: `src/topics/topicLoader.js:623-635` (append to `DEFAULT_MODE_METHODOLOGY.column_addition`)

**Interfaces:**
- Produces: mode ids `build_number`, `identify_number`, `regroup_ten` become selectable in the topic's mode picker, each with `evaluation: "instant"` (same as `fingers_count` — matches Task 1/2's per-card correct/incorrect flow) and `orientationLock: "portrait"` (first production use of this existing-but-unused capability, per `src/shared/utils/orientationLock.js`).

- [ ] **Step 1: Add the 3 mode definitions**

Find this exact block in `src/topics/topicLoader.js` (the end of `fingers_count` and the closing of `DEFAULT_MODES.column_addition`):

```js
    {
      id: "fingers_count",
      type: "fingers_count",
      evaluation: "instant",
      ui: { title: "Считаем на пальцах", instruction: "Поднимай пальцы и считай", icon: "media/icons/fingers_count_mode.svg" },
      params: {
        op: {
          type: "enum",
          values: ["add", "sub", "mixed"],
          labels: { ru: { add: "Сложение", sub: "Вычитание", mixed: "Микс" } },
          default: "add",
          label: { ru: "Операция" },
        },
      },
    },
  ],
```

Replace with:

```js
    {
      id: "fingers_count",
      type: "fingers_count",
      evaluation: "instant",
      ui: { title: "Считаем на пальцах", instruction: "Поднимай пальцы и считай", icon: "media/icons/fingers_count_mode.svg" },
      params: {
        op: {
          type: "enum",
          values: ["add", "sub", "mixed"],
          labels: { ru: { add: "Сложение", sub: "Вычитание", mixed: "Микс" } },
          default: "add",
          label: { ru: "Операция" },
        },
      },
    },
    {
      id: "build_number",
      type: "build_number",
      evaluation: "instant",
      orientationLock: "portrait",
      ui: { title: "Собери число", instruction: "Перетащи десятки и единицы на свои места", icon: "media/icons/column_addition_mode.svg" },
      params: {
        level: {
          type: "enum",
          values: [1, 2, 3, 4, 5],
          labels: { ru: { "1": "1 — одна-две единицы", "2": "2 — разные единицы", "3": "3 — много единиц", "4": "4 — без единиц", "5": "5 — вперемешку" } },
          default: 1,
          label: { ru: "Уровень" },
        },
      },
    },
    {
      id: "identify_number",
      type: "identify_number",
      evaluation: "instant",
      orientationLock: "portrait",
      ui: { title: "Какое это число?", instruction: "Посмотри на десятки и единицы и введи число", icon: "media/icons/column_addition_mode.svg" },
      params: {
        level: {
          type: "enum",
          values: [1, 2, 3, 4, 5],
          labels: { ru: { "1": "1 — одна-две единицы", "2": "2 — разные единицы", "3": "3 — много единиц", "4": "4 — без единиц", "5": "5 — вперемешку" } },
          default: 1,
          label: { ru: "Уровень" },
        },
      },
    },
    {
      id: "regroup_ten",
      type: "regroup_ten",
      evaluation: "instant",
      orientationLock: "portrait",
      ui: { title: "Размени десяток", instruction: "Перетащи десяток в единицы", icon: "media/icons/column_addition_mode.svg" },
      params: {
        level: {
          type: "enum",
          values: [1, 2, 3, 4, 5],
          labels: { ru: { "1": "1 — одна-две единицы", "2": "2 — разные единицы", "3": "3 — много единиц", "4": "4 — без единиц", "5": "5 — вперемешку" } },
          default: 1,
          label: { ru: "Уровень" },
        },
      },
    },
  ],
```

- [ ] **Step 2: Add the 3 methodology entries**

Find this exact block:

```js
    fingers_count: {
      summary: "Поднимай пальцы, считай вместе с ребёнком.",
      text: "Экран показывает пример. Ребёнок поднимает пальцы левой руки (первое слагаемое), затем правой (второе), соединяет и считает все. При вычитании — выставляет число и убирает пальцы.",
      settings: [
        "«Операция» — сложение, вычитание или оба.",
      ],
      goal: "Ребёнок понимает сложение как объединение двух групп пальцев, вычитание — как убирание части.",
      tips: [
        "Проговаривайте вслух: «Три пальца плюс четыре пальца — считаем вместе!»",
        "Для вычитания начинайте с примеров где вычитаемое совпадает с одной рукой — убрать целую руку наглядно.",
      ],
    },
  },
```

Replace with:

```js
    fingers_count: {
      summary: "Поднимай пальцы, считай вместе с ребёнком.",
      text: "Экран показывает пример. Ребёнок поднимает пальцы левой руки (первое слагаемое), затем правой (второе), соединяет и считает все. При вычитании — выставляет число и убирает пальцы.",
      settings: [
        "«Операция» — сложение, вычитание или оба.",
      ],
      goal: "Ребёнок понимает сложение как объединение двух групп пальцев, вычитание — как убирание части.",
      tips: [
        "Проговаривайте вслух: «Три пальца плюс четыре пальца — считаем вместе!»",
        "Для вычитания начинайте с примеров где вычитаемое совпадает с одной рукой — убрать целую руку наглядно.",
      ],
    },
    build_number: {
      summary: "Собери число из десятков и единиц.",
      text: "Сверху показано число. Ребёнок перетаскивает столбики-десятки (карточка 2×5) в зону ДЕСЯТКИ и кубики-единицы в зону ЕДИНИЦЫ, пока состав не совпадёт с числом, затем нажимает ГОТОВО.",
      settings: [
        "«Уровень» — от 1-2 единиц (уровень 1) до полного смешанного набора (уровень 5). Уровень 4 (без единиц) вводите не первым.",
      ],
      goal: "Ребёнок понимает, что число — это конкретное количество десятков и отдельных единиц, а не просто две цифры подряд.",
      tips: [
        "Проговаривайте: «Тридцать два — это три десятка и две единицы».",
        "Ошибку не объясняем — приложение просто подсвечивает неверную зону, пусть ребёнок сам пересчитает.",
      ],
    },
    identify_number: {
      summary: "По готовой модели определи число.",
      text: "На экране уже собрана предметная модель (десятки и единицы). Ребёнок вводит число с клавиатуры: сначала десятки, потом единицы — проверка происходит сразу после второй цифры.",
      settings: [
        "«Уровень» — на уровне 1 под моделью видны счётчики («3 десятка», «2 единицы»); с уровня 2 они скрываются.",
      ],
      goal: "Ребёнок связывает предметную модель с записью числа и с тем, что первая цифра — десятки, вторая — единицы.",
      tips: [
        "Если ребёнок вводит цифры в обратном порядке, не подсказывайте словами — пусть посмотрит на модель ещё раз.",
      ],
    },
    regroup_ten: {
      summary: "Размени один десяток на десять единиц.",
      text: "Число уже собрано. Ребёнок перетаскивает один столбик-десяток прямо в зону ЕДИНИЦЫ — он рассыпается на 10 кубиков. Число сверху не меняется. Затем вопрос «Число изменилось?» — правильный ответ «НЕТ».",
      settings: [
        "«Уровень» — как в «Собери число»; режим имеет смысл только для чисел, где десятков ≥ 1 (гарантировано генератором).",
      ],
      goal: "Ребёнок понимает, что 1 десяток = 10 единиц, и что разное разложение (3 дес. 2 ед. / 2 дес. 12 ед.) — одно и то же число.",
      tips: [
        "После размена дайте ребёнку время рассмотреть обе кучки, прежде чем отвечать на вопрос.",
        "Если ребёнок отвечает «Да» (число изменилось) — не поясняйте, просто дайте попробовать ещё раз.",
      ],
    },
  },
```

- [ ] **Step 3: Confirm the file still parses**

Run: `node --experimental-vm-modules -e "import('./src/topics/topicLoader.js').then(() => console.log('OK')).catch(e => { console.error(e); process.exit(1); })"`

If that fails due to unrelated module resolution (e.g. `@/` aliases not resolvable outside Vite), instead run:

Run: `npx eslint src/topics/topicLoader.js`
Expected: no parse errors (unmatched braces, trailing commas, etc.) around the edited regions.

- [ ] **Step 4: Commit**

```bash
git add src/topics/topicLoader.js
git commit -m "feat(column_addition): register build_number/identify_number/regroup_ten modes"
```

---

### Task 9: Catalog cards, version bump, and ZIP rebuild

**Files:**
- Modify: `public/column_addition_topic.json`
- Modify: `public/decks/catalog.json`

**Interfaces:**
- Produces: three new catalog cards (`build_number`, `identify_number`, `regroup_ten`, each `params.mode` matching the mode id) that `generateTasks()` (Task 2) filters on when a session picks one of the new modes. Bumps `column_addition` from `1.2.0` to `1.3.0` (per the project's versioning convention — every deck content change bumps the version, and the ZIP filename + catalog URL change together, never overwriting the old URL).

- [ ] **Step 1: Add the 3 cards and bump the version**

In `public/column_addition_topic.json`, find:

```json
  "meta": {
    "id": "column_addition",
    "renderer": "column_addition",
    "version": "1.2.0",
    "title": { "ru": "Сложение и вычитание в столбик" }
  },
  "cards": [
    { "id": "col_add", "conceptId": "col_add", "renderer": "column_addition", "params": { "operation": "add" } },
    { "id": "col_sub", "conceptId": "col_sub", "renderer": "column_addition", "params": { "operation": "subtract" } },
```

Replace with:

```json
  "meta": {
    "id": "column_addition",
    "renderer": "column_addition",
    "version": "1.3.0",
    "title": { "ru": "Сложение и вычитание в столбик" }
  },
  "cards": [
    { "id": "col_add", "conceptId": "col_add", "renderer": "column_addition", "params": { "operation": "add" } },
    { "id": "col_sub", "conceptId": "col_sub", "renderer": "column_addition", "params": { "operation": "subtract" } },
    { "id": "build_number", "conceptId": "build_number", "renderer": "column_addition", "params": { "mode": "build_number" } },
    { "id": "identify_number", "conceptId": "identify_number", "renderer": "column_addition", "params": { "mode": "identify_number" } },
    { "id": "regroup_ten", "conceptId": "regroup_ten", "renderer": "column_addition", "params": { "mode": "regroup_ten" } },
```

- [ ] **Step 2: Confirm the JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/column_addition_topic.json', 'utf8')); console.log('valid JSON')"`
Expected: `valid JSON`

- [ ] **Step 3: Rebuild the ZIP**

Run: `node scripts/make_column_addition_zip.mjs`
Expected: `✓ Created .../public/decks/column_addition_v1.3.0.zip`

- [ ] **Step 4: Update the catalog entry**

In `public/decks/catalog.json`, find:

```json
    {
      "id": "column_addition",
      "version": "1.2.0",
      "url": "./decks/column_addition_v1.2.0.zip",
      "title": {
        "ru": "Сложение и вычитание в столбик"
      },
      "status": "release",
      "access": "free"
    },
```

Replace with:

```json
    {
      "id": "column_addition",
      "version": "1.3.0",
      "url": "./decks/column_addition_v1.3.0.zip",
      "title": {
        "ru": "Сложение и вычитание в столбик"
      },
      "status": "release",
      "access": "free"
    },
```

Do not delete `public/decks/column_addition_v1.2.0.zip` — per project convention, old versioned ZIPs stay in place so any cached client pointing at the old URL keeps working.

- [ ] **Step 5: Commit**

```bash
git add public/column_addition_topic.json public/decks/catalog.json public/decks/column_addition_v1.3.0.zip
git commit -m "content(column_addition): add place-value cards, bump to v1.3.0"
```

---

### Task 10: Manual verification in the browser

**Files:** none (verification only)

- [ ] **Step 1: Run the app**

Use the project's `run` skill (or `npm run dev` if no project-specific script exists) to launch the app locally, then open a session on the `column_addition` topic.

- [ ] **Step 2: Verify «Собери число» (`build_number`)**

- Drag the ten-card and unit-cube from the tray into the workspace repeatedly; confirm counters update and multiple ten-cards stay visually distinct (not merged into one blob).
- Tap a placed ten-card / unit-cube; confirm it's removed and the counter decrements.
- Build the wrong composition and press ГОТОВО; confirm the wrong zone(s) shake — no text hint appears anywhere.
- Build the correct composition and press ГОТОВО; confirm the session's reward/streak flow fires normally after enough correct answers (same as any other `evaluation: "instant"` mode) — do not expect a reward on every single correct answer, only after a streak.
- Resize the browser to a narrow/short viewport (e.g. ~375×667); confirm the tray and ГОТОВО button sit at the bottom of the screen when the zones are empty, and the whole screen scrolls (not an inner scrollbox) once several tens are placed.

- [ ] **Step 3: Verify «Какое это число?» (`identify_number`)**

- Confirm the model (tens/units) is shown and, on level 1, the counters below it are visible.
- Tap two digits on the numpad; confirm the check fires automatically (no ГОТОВО button present).
- Enter a wrong pair; confirm the wrong slot(s) shake and the input clears itself for a retry, without any text explanation.

- [ ] **Step 4: Verify «Размени десяток» (`regroup_ten`)**

- Confirm the number label at the top never changes throughout the task.
- Drag the last ten-card straight onto the ЕДИНИЦЫ zone (there is no separate "РАЗМЕН" drop target); confirm it disappears from ДЕСЯТКИ and ten new unit cubes appear with a staggered pop-in animation in ЕДИНИЦЫ.
- Answer "ДА" (number changed); confirm it flashes as wrong and does not advance.
- Answer "НЕТ"; confirm the conservation equations (`initial.tens*10 + initial.ones = number` and `after.tens*10 + after.ones = number`) are shown and the task completes.

- [ ] **Step 5: Verify portrait lock**

- Rotate the device/emulator (or resize the browser to a landscape aspect ratio) while on any of the 3 new modes; confirm the existing `OrientationGuard` overlay ("Поверните экран вертикально") appears, and that no landscape-specific layout was built for these modes.

- [ ] **Step 6: Verify the settings screen**

- Open the mode's settings/methodology screen for each of the 3 new modes; confirm the "Уровень" selector and the methodology text (summary/goal/tips from Task 8) render correctly.

No commit for this task — if any check fails, fix the relevant earlier task's file and re-run the affected step above.
