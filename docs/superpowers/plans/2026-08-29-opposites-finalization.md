# Opposites Topic Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap between the `opposites` topic's own design intent (`opposites_cards_TZ.md` + the "Противоположности: методика и дизайн" audit) and what actually ships in `public/decks/opposites_v2.5.1.zip` / `src/topics/renderers/opposites/*` — grammatical concord, instruction phrasing, acquisition-order-aware task sequencing, and visual design-system parity — plus the two worst content mismatches already on the audit's exhibit list. Explicitly **not** in this plan: adding new antonym pairs, reshooting `hot_cold`/`wet_dry`, or building an expressive-practice task type — those need a product decision first (see "Decisions needed" below) before they can be turned into tasks.

**Architecture:** Code changes are confined to `src/topics/renderers/opposites/engine.js` (task generation) and its five task components (`ChooseTwoTask.jsx`, `FindAllTask.jsx`, `FindOppositeTask.jsx`, `SortTask.jsx`, `PairComparisonTask.jsx`) plus `Opposites.css`. Content changes are confined to `public/decks/opposites_draft/topic.json` + `public/decks/opposites_draft/media/` — the hand-maintained source folder every `public/decks/opposites_v*.zip` has been zipped from since the topic's very first commit (`git log --oneline -- public/decks/opposites_draft/topic.json` shows 18 releases through it). Unlike `emotions_v2` or `comparison`, there is **no** `tools/opposites/build.mjs` — this topic has never had a scripted content pipeline, so content tasks below use the same manual zip step the prior 18 releases used, not `node build.mjs`.

**Tech Stack:** React 18, Vitest (existing convention in `src/topics/renderers/opposites/engine.test.js`), plain CSS, manual `zip` for deck packaging.

**Spec:** "Противоположности: методика и дизайн" — https://claude.ai/code/artifact/d2244ea6-2e52-4d31-987a-b66c6860a0e7 (Parts I–III: implementation-vs-ТЗ audit, design audit, and ТЗ-vs-international-sources revision, agreed with the user across this conversation) — and `opposites_cards_TZ.md` in the repo root.

## Global Constraints

- Universal correct/wrong colors app-wide: correct `#22c55e`/`#16a34a`, wrong `#ef4444` (per `.claude/skills/designing-mirocard-screens`) — `opposites` currently uses Material colors (`#4caf50`/`#f44336`) instead; Task 5 below fixes this.
- Minimum practical tap target ~48px (same skill).
- **`left` pole = the positive/unmarked term for every one of the 9 shipped concepts** — confirmed directly from `public/decks/opposites_draft/topic.json`: большой, высокий, длинный, широкий, полный, чистый, мокрый, горячий, новый are all `"pole": "left"`. Every task below that depends on "which pole is positive" relies on this already-consistent data convention — no new field needed.
- `mode` is already passed as a prop to every topic renderer by the shared session chrome (`src/features/session/SessionScreen.jsx:378`) — `OppositeRenderer` (`src/topics/renderers/opposites/index.jsx`) just doesn't currently destructure or forward it to any of its five task components. Task 4 below is the first to need it.
- Every push to `main` that changes app behavior needs a `package.json` version bump in its own commit (root `CLAUDE.md`). Deck-content changes (Tasks 6–7) additionally need: bump `meta.version` in `opposites_draft/topic.json`, re-zip, and update both `version` and `url` for the `"id": "opposites"` entry in `public/decks/catalog.json` — in the same push.
- `git push origin main` deploys to production immediately (Railway auto-deploy, no review gate) — do not run it without the user's explicit go-ahead at execution time.

---

## Decisions needed before this plan can be extended (not tasks — resolve with the user first)

These came out of the audit but can't be turned into "No Placeholders"-compliant tasks yet — each needs a scope call only the user can make. Once decided, extend this plan with new tasks the same way the file structure below does.

1. **Expressive practice.** The whole topic — ТЗ included — is receptive-only: every one of the 6 modes has the child point, drag, or tap; none asks the child to say the word. This is likely the single highest-value gap (Part III §3.2), but designing it (in-app mic input vs. an explicit "adult elicits the word out loud" convention baked into the UI copy) is a new feature, not a fix — needs its own brainstorming pass.
2. **Hint/prompt-ladder system.** ТЗ §14 specifies 5 prompt levels; `grep -r "promptLevel" src/` returns nothing — it doesn't exist anywhere in the app yet, for any topic. Building it is a cross-topic feature. Decide: build now as a separate plan, or leave as a ТЗ aspiration for later.
3. **Which of the 9 still-unshipped ТЗ pairs to add**, if any: ТЗ's own "Level 2" (толстый/тонкий, много/мало, открытый/закрытый, целый/сломанный) and "Level 3" (включённый/выключенный, светлый/тёмный, внутри/снаружи, наверху/внизу, прямой/кривой). Each needs 5 new photo variations, shot to the composition rule from Task 6 below from the very first shot, not retrofitted.
4. **`hot_cold` / `wet_dry` — keep as-is, reshoot, or drop.** ТЗ explicitly deferred both (§5) as unsuited to static cards; the commit history (`v2.4.0` → `v2.5.0`) shows one prior attempt to make `hot_cold` fully same-object that partly reverted to symbolic pairs (fire/ice, sun/snowflake, volcano/iceberg) because temperature has no camera-visible static cue without a prop like steam or ice. If the call is "drop them," Decision 3's pair list should grow by two to fill the resulting content gap.

---

### Task 1: Wire grammatical concord into `choose_two`

`buildChooseTwoTask` (`engine.js`) currently puts `target.poleLabelNeutral` on the task, and `ChooseTwoTask.jsx` renders it as `Покажи, что большое?` — a fixed neuter form, regardless of whether the object on screen is «кошка» (ж.р.), «мяч» (м.р.), or «торт» (м.р.). Every card already carries `instructionLabel`, the accusative form agreed with that specific object's gender (e.g. `"большую"` for «кошку», `"большой"` for «мяч») — it's just never read anywhere in the renderer. ТЗ's own worked example (§11.3) is exactly this form used alone: *«Покажи большую.»*

**Files:**
- Modify: `src/topics/renderers/opposites/engine.js` (`buildChooseTwoTask`, currently the block returning `{ type: "choose_two", targetPole, poleLabelNeutral, options }`)
- Modify: `src/topics/renderers/opposites/ChooseTwoTask.jsx` (the `opp-choose__instruction` div)
- Test: `src/topics/renderers/opposites/engine.test.js`

**Interfaces:**
- Consumes: `card.instructionLabel` (already present on every card in `topic.json`, unused until now).
- Produces: `choose_two` tasks now carry `instructionLabel` instead of `poleLabelNeutral`. No other mode reads `poleLabelNeutral` from a `choose_two` task, so this is a clean rename, not an addition.

- [ ] **Step 1: Extend the test fixture with the fields this task needs**

In `src/topics/renderers/opposites/engine.test.js`, the shared `CARDS` array (lines 4–15) is missing `instructionLabel`, `poleLabelNeutral`, and `poleLabelPlural` on every card. Replace the array with:

```js
const CARDS = [
  { id: "big_dog",    conceptId: "big_small", pole: "left",  objectId: "dog",   objectLabel: "собака", poleLabel: "большой",   nominativeLabel: "большая",   instructionLabel: "большую",    poleLabelNeutral: "большое",   poleLabelPlural: "большие",   image: "media/big_dog.webp" },
  { id: "small_dog",  conceptId: "big_small", pole: "right", objectId: "dog",   objectLabel: "собака", poleLabel: "маленький", nominativeLabel: "маленькая", instructionLabel: "маленькую",  poleLabelNeutral: "маленькое", poleLabelPlural: "маленькие", image: "media/small_dog.webp" },
  { id: "big_cat",    conceptId: "big_small", pole: "left",  objectId: "cat",   objectLabel: "кошка",  poleLabel: "большой",   nominativeLabel: "большая",   instructionLabel: "большую",    poleLabelNeutral: "большое",   poleLabelPlural: "большие",   image: "media/big_cat.webp" },
  { id: "small_cat",  conceptId: "big_small", pole: "right", objectId: "cat",   objectLabel: "кошка",  poleLabel: "маленький", nominativeLabel: "маленькая", instructionLabel: "маленькую",  poleLabelNeutral: "маленькое", poleLabelPlural: "маленькие", image: "media/small_cat.webp" },
  { id: "big_ball",   conceptId: "big_small", pole: "left",  objectId: "ball",  objectLabel: "мяч",    poleLabel: "большой",   nominativeLabel: "большой",   instructionLabel: "большой",    poleLabelNeutral: "большое",   poleLabelPlural: "большие",   image: "media/big_ball.webp" },
  { id: "small_ball", conceptId: "big_small", pole: "right", objectId: "ball",  objectLabel: "мяч",    poleLabel: "маленький", nominativeLabel: "маленький", instructionLabel: "маленький",  poleLabelNeutral: "маленькое", poleLabelPlural: "маленькие", image: "media/small_ball.webp" },
  { id: "wet_stone",  conceptId: "wet_dry",   pole: "left",  objectId: "stone", objectLabel: "камень", poleLabel: "мокрый",    nominativeLabel: "мокрый",    instructionLabel: "мокрый",     poleLabelNeutral: "мокрое",    poleLabelPlural: "мокрые",    image: "media/wet_stone.webp" },
  { id: "dry_stone",  conceptId: "wet_dry",   pole: "right", objectId: "stone", objectLabel: "камень", poleLabel: "сухой",     nominativeLabel: "сухой",     instructionLabel: "сухой",      poleLabelNeutral: "сухое",     poleLabelPlural: "сухие",     image: "media/dry_stone.webp" },
  { id: "wet_leaf",   conceptId: "wet_dry",   pole: "left",  objectId: "leaf",  objectLabel: "лист",   poleLabel: "мокрый",    nominativeLabel: "мокрый",    instructionLabel: "мокрый",     poleLabelNeutral: "мокрое",    poleLabelPlural: "мокрые",    image: "media/wet_leaf.webp" },
  { id: "dry_leaf",   conceptId: "wet_dry",   pole: "right", objectId: "leaf",  objectLabel: "лист",   poleLabel: "сухой",     nominativeLabel: "сухой",     instructionLabel: "сухой",      poleLabelNeutral: "сухое",     poleLabelPlural: "сухие",     image: "media/dry_leaf.webp" },
];
```

(Additive only — every existing assertion in the file reads fields that are still present with the same values, so none of the current 15 tests change behavior.)

- [ ] **Step 2: Write the failing test**

Append a new `describe` block to `src/topics/renderers/opposites/engine.test.js`:

```js
describe("generateTasks — choose_two, grammatical concord", () => {
  it("instructs using the target card's own instructionLabel, not a fixed neuter form", () => {
    const tasks = generateTasks({ type: "choose_two" }, CARDS, 10, {});
    const dogTask = tasks.find(t => t.options.some(o => o.card.objectId === "dog" && o.isTarget));
    expect(dogTask.instructionLabel).toBe("большую"); // big_dog, feminine "собака"
    const ballTask = tasks.find(t => t.options.some(o => o.card.objectId === "ball" && o.isTarget));
    expect(ballTask.instructionLabel).toBe("большой"); // big_ball, masculine "мяч"
    expect(dogTask.poleLabelNeutral).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

```bash
npx vitest run src/topics/renderers/opposites/engine.test.js
```

Expected: FAIL — `dogTask.instructionLabel` is `undefined` (the task currently carries `poleLabelNeutral` instead).

- [ ] **Step 4: Fix `buildChooseTwoTask`**

In `src/topics/renderers/opposites/engine.js`, in `buildChooseTwoTask`, replace:

```js
  return {
    type:             "choose_two",
    targetPole:       target.pole,
    poleLabelNeutral: target.poleLabelNeutral,
    options:          shuffle(options.slice(0, optionCount)),
  };
```

with:

```js
  return {
    type:             "choose_two",
    targetPole:       target.pole,
    instructionLabel: target.instructionLabel,
    options:          shuffle(options.slice(0, optionCount)),
  };
```

- [ ] **Step 5: Run the test again to confirm it passes**

```bash
npx vitest run src/topics/renderers/opposites/engine.test.js
```

Expected: PASS, all 16 tests (15 existing + 1 new).

- [ ] **Step 6: Update `ChooseTwoTask.jsx`**

In `src/topics/renderers/opposites/ChooseTwoTask.jsx`, replace:

```jsx
      <div className="opp-choose__instruction">
        Покажи, что {task.poleLabelNeutral}?
      </div>
```

with:

```jsx
      <div className="opp-choose__instruction">
        Покажи {task.instructionLabel}.
      </div>
```

- [ ] **Step 7: Manual check in the browser**

Start the dev server, open `opposites` → «Покажи» on `big_small`, and confirm the instruction reads «Покажи большую.» when a кошка/машина/чашка pair is target, and «Покажи большой.» when a мяч/торт pair is target — not a single fixed phrase across every object.

- [ ] **Step 8: Commit**

```bash
git add src/topics/renderers/opposites/engine.js src/topics/renderers/opposites/engine.test.js src/topics/renderers/opposites/ChooseTwoTask.jsx
git commit -m "fix(opposites): wire grammatically-agreed instructionLabel into choose_two"
```

---

### Task 2: Fix `find_all`'s singular instruction for a multi-select task

`generateFindAllTasks` picks `targetLabel` as `poleLabelNeutral ?? poleLabelPlural ?? targetPole` — since `poleLabelNeutral` is always present, `poleLabelPlural` (the plural form the task actually needs — the child must select *several* cards, then press «Готово») is dead code. `FindAllTask.jsx` then renders «Покажи, что маленькое» — singular, with no hint that multiple cards are expected.

**Files:**
- Modify: `src/topics/renderers/opposites/engine.js` (`generateFindAllTasks`)
- Modify: `src/topics/renderers/opposites/FindAllTask.jsx`
- Test: `src/topics/renderers/opposites/engine.test.js`

**Interfaces:**
- Consumes: `card.poleLabelPlural` (already present on every card, unused until now).
- Produces: no shape change — `targetLabel` is still a string, just sourced from a different field with a different grammatical number.

- [ ] **Step 1: Write the failing test**

Append to `src/topics/renderers/opposites/engine.test.js`:

```js
describe("generateTasks — find_all, plural instruction", () => {
  it("targetLabel is the plural form, not the singular neuter form", () => {
    const tasks = generateTasks({ type: "find_all" }, CARDS, 10, { gridSize: 4 });
    for (const t of tasks) {
      const expectedPlural = t.targetPole === "left" ? "большие" : "маленькие";
      expect(t.targetLabel).toBe(expectedPlural);
    }
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run src/topics/renderers/opposites/engine.test.js
```

Expected: FAIL — `targetLabel` is currently `"большое"`/`"маленькое"` (singular neuter), not `"большие"`/`"маленькие"`.

- [ ] **Step 3: Fix `generateFindAllTasks`**

In `src/topics/renderers/opposites/engine.js`, replace:

```js
      targetLabel:    selectedTargets[0]?.poleLabelNeutral ?? selectedTargets[0]?.poleLabelPlural ?? targetPole,
```

with:

```js
      targetLabel:    selectedTargets[0]?.poleLabelPlural ?? selectedTargets[0]?.poleLabelNeutral ?? targetPole,
```

- [ ] **Step 4: Run the test again to confirm it passes**

```bash
npx vitest run src/topics/renderers/opposites/engine.test.js
```

Expected: PASS.

- [ ] **Step 5: Update `FindAllTask.jsx`'s instruction copy**

In `src/topics/renderers/opposites/FindAllTask.jsx`, replace:

```jsx
      <div className="session-instruction">Покажи, что {targetLabel}</div>
```

with:

```jsx
      <div className="session-instruction">Найди все {targetLabel}</div>
```

(Matches ТЗ §11.6's own worked example verbatim: «Найди все маленькие.»)

- [ ] **Step 6: Manual check in the browser**

Start the dev server, open `opposites` → «Найди все», confirm the instruction now reads «Найди все большие» / «Найди все маленькие» (plural), matching that the task requires selecting several cards before «Готово» is enabled.

- [ ] **Step 7: Commit**

```bash
git add src/topics/renderers/opposites/engine.js src/topics/renderers/opposites/engine.test.js src/topics/renderers/opposites/FindAllTask.jsx
git commit -m "fix(opposites): find_all instruction now plural, matching the multi-select task"
```

---

### Task 3: Ask for the positive (left) pole first

H.H. Clark's "positive pole" finding (children reliably acquire the unmarked term of a dimensional pair — big, tall, long, full, clean, hot, new, wet — before its marked counterpart) is cited in Part III §3.1 of the audit as something ТЗ's own design already gestures toward without naming the source. `generateChooseTwoTasks` currently shuffles `[left, right]` before picking the target for a `repsPerPair: 1` task, so a brand-new pair has even odds of being introduced through its *harder*, marked term first.

**Files:**
- Modify: `src/topics/renderers/opposites/engine.js` (`generateChooseTwoTasks`)
- Test: `src/topics/renderers/opposites/engine.test.js`

**Interfaces:**
- Consumes: nothing new — relies on the existing `pole: "left"|"right"` convention (see Global Constraints).
- Produces: no shape change to `choose_two` tasks, only a different (no longer random) selection of which pole is asked at `repsPerPair: 1`.

- [ ] **Step 1: Write the failing test**

Append to `src/topics/renderers/opposites/engine.test.js`:

```js
describe("generateTasks — choose_two, positive-pole-first sequencing", () => {
  it("repsPerPair=1 (default): always asks for the left (positive) pole", () => {
    const tasks = generateTasks({ type: "choose_two" }, CARDS, 10, {});
    for (const t of tasks) {
      expect(t.targetPole).toBe("left");
    }
  });

  it("repsPerPair=2: asks both poles for every object", () => {
    const tasks = generateTasks({ type: "choose_two" }, CARDS, 10, { repsPerPair: 2 });
    const polesByObject = {};
    for (const t of tasks) {
      const targetCard = t.options.find(o => o.isTarget).card;
      (polesByObject[targetCard.objectId] ??= new Set()).add(t.targetPole);
    }
    for (const poles of Object.values(polesByObject)) {
      expect([...poles].sort()).toEqual(["left", "right"]);
    }
  });
});
```

- [ ] **Step 2: Run it to confirm the first test fails**

```bash
npx vitest run src/topics/renderers/opposites/engine.test.js
```

Expected: the `repsPerPair=1` test FAILs intermittently/always depending on the random seed for that run (`shuffle([left, right])` currently picks either pole); the `repsPerPair=2` test already PASSes (both poles are already asked at reps=2, just not in a guaranteed order — this test doesn't check order, only coverage, so it's a baseline, not a regression check).

- [ ] **Step 3: Fix `generateChooseTwoTasks`**

In `src/topics/renderers/opposites/engine.js`, replace:

```js
function generateChooseTwoTasks(cards, params) {
  const repsPerPair = params.repsPerPair ?? 1;
  const byObject    = groupByObjectId(cards);
  const entries     = [...byObject.entries()];
  const tasks       = [];
  for (const [, { left, right }] of entries) {
    if (!left || !right) continue;
    // Each rep = 1 task. Randomise pole order so both get asked when repsPerPair >= 2.
    const poles = shuffle([left, right]);
    for (let i = 0; i < Math.min(repsPerPair, 2); i++) {
      const target   = poles[i];
      const opposite = target === left ? right : left;
      tasks.push(buildChooseTwoTask(target, opposite, entries, 2));
    }
  }
  return shuffle(tasks);
}
```

with:

```js
function generateChooseTwoTasks(cards, params) {
  const repsPerPair = params.repsPerPair ?? 1;
  const byObject    = groupByObjectId(cards);
  const entries     = [...byObject.entries()];
  const tasks       = [];
  for (const [, { left, right }] of entries) {
    if (!left || !right) continue;
    // left = the positive/unmarked pole for every shipped concept (большой,
    // высокий, длинный... — see Global Constraints in the plan this came
    // from). Children acquire the unmarked term before its marked
    // counterpart (H.H. Clark's "positive pole" finding), so a single rep
    // always asks for it first; only repsPerPair=2 also asks the marked
    // (right) pole.
    const poles = [left, right];
    for (let i = 0; i < Math.min(repsPerPair, 2); i++) {
      const target   = poles[i];
      const opposite = target === left ? right : left;
      tasks.push(buildChooseTwoTask(target, opposite, entries, 2));
    }
  }
  return shuffle(tasks);
}
```

- [ ] **Step 4: Run the tests again to confirm both pass**

```bash
npx vitest run src/topics/renderers/opposites/engine.test.js
```

Expected: PASS, all 18 tests.

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/opposites/engine.js src/topics/renderers/opposites/engine.test.js
git commit -m "feat(opposites): ask the positive/unmarked pole first in choose_two (Clark's positive-pole finding)"
```

---

### Task 4: Replace "Найди неприятеля" with the topic's own instruction copy

`FindOppositeTask.jsx` hardcodes «Найди неприятеля — перетащи!» and never reads `mode.ui.instruction` — even though `topic.json`'s `find_opposite` mode already has better copy sitting unused: `"instruction": "Перетащи противоположную карточку"`. `OppositeRenderer` doesn't currently forward `mode` to any task component (it's already passed into `OppositeRenderer` itself by `SessionScreen.jsx:378` — see Global Constraints — just not threaded further). This is the same class of bug the `emotions_v2` audit found and fixed for `situation_emotion` (that mode's instruction line was also never rendered) — same fix here.

**Files:**
- Modify: `src/topics/renderers/opposites/index.jsx` (`OppositeRenderer`)
- Modify: `src/topics/renderers/opposites/FindOppositeTask.jsx`
- Modify: `public/decks/opposites_draft/topic.json` (catalog description text, see Step 4)
- Modify: `public/decks/catalog.json`

**Interfaces:**
- Consumes: `mode.ui.instruction` (already present in `topic.json` for every mode, unused until now for `find_opposite`).
- Produces: `FindOppositeTask` now requires a `mode` prop; `OppositeRenderer` must supply it.

- [ ] **Step 1: Forward `mode` through `OppositeRenderer`**

In `src/topics/renderers/opposites/index.jsx`, replace:

```jsx
export default function OppositeRenderer({ task, topicId, onAdvance, onCorrect, onIncorrect, onMistake }) {
  switch (task?.type) {
    case "pair_comparison": return <PairComparisonTask task={task} topicId={topicId} onAdvance={onAdvance} />;
    case "choose_two":      return <ChooseTwoTask task={task} topicId={topicId} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    case "find_all":        return <FindAllTask task={task} topicId={topicId} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    case "sort":            return <SortTask task={task} topicId={topicId} onCorrect={onCorrect} onMistake={onMistake} />;
    case "find_opposite":   return <FindOppositeTask task={task} topicId={topicId} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
```

with:

```jsx
export default function OppositeRenderer({ task, mode, topicId, onAdvance, onCorrect, onIncorrect, onMistake }) {
  switch (task?.type) {
    case "pair_comparison": return <PairComparisonTask task={task} topicId={topicId} onAdvance={onAdvance} />;
    case "choose_two":      return <ChooseTwoTask task={task} topicId={topicId} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    case "find_all":        return <FindAllTask task={task} topicId={topicId} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    case "sort":            return <SortTask task={task} topicId={topicId} onCorrect={onCorrect} onMistake={onMistake} />;
    case "find_opposite":   return <FindOppositeTask task={task} mode={mode} topicId={topicId} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
```

(Only `find_opposite` needs `mode` right now — the other four cases are untouched; don't thread `mode` into them speculatively.)

- [ ] **Step 2: Read `mode.ui.instruction` in `FindOppositeTask`**

In `src/topics/renderers/opposites/FindOppositeTask.jsx`, replace:

```jsx
export default function FindOppositeTask({ task, topicId, onCorrect, onIncorrect }) {
```

with:

```jsx
export default function FindOppositeTask({ task, mode, topicId, onCorrect, onIncorrect }) {
```

then replace:

```jsx
      <div className="opp-fo__instruction">
        Найди неприятеля — перетащи!
      </div>
```

with:

```jsx
      <div className="opp-fo__instruction">
        {mode?.ui?.instruction ?? "Найди противоположность и перетащи её сюда"}
      </div>
```

(The fallback string only fires if a future test or caller ever mounts `FindOppositeTask` without a `mode` prop — production always has one, per Global Constraints.)

- [ ] **Step 3: Manual check in the browser**

Start the dev server, open `opposites` → «Найди неприятеля» (still the tile's current label on the mode-picker screen until Step 4), start it, and confirm the in-task instruction now reads «Перетащи противоположную карточку» — no mention of «неприятель».

- [ ] **Step 4: Rename the mode itself, everywhere it's user-facing**

`mode.ui.title` for `find_opposite` in `public/decks/opposites_draft/topic.json` is also `"Найди неприятеля"` — this is what shows on the mode-picker tile, so Step 1–3 alone leaves the tile itself unchanged. In `public/decks/opposites_draft/topic.json`, find the `find_opposite` mode's `ui` block and change:

```json
    "ui": {
      "title": "Найди неприятеля",
```

to:

```json
    "ui": {
      "title": "Найди пару",
```

Also in `public/decks/catalog.json`, the `"id": "opposites"` entry's `description.ru` ends with `"...найди все, найди неприятеля."` — change that trailing phrase to `"...найди все, найди пару."`.

- [ ] **Step 5: Bump the deck version and re-zip**

In `public/decks/opposites_draft/topic.json`, bump `meta.version` from `"2.5.1"` to `"2.6.0"` (content/copy change, not a schema change — minor bump, matching the versioning convention visible in the commit history, e.g. `v2.5.0` → `v2.5.1`).

```bash
cd public/decks/opposites_draft
zip -r ../opposites_v2.6.0.zip . -x ".*"
cd ../../..
```

- [ ] **Step 6: Point the catalog at the new ZIP**

In `public/decks/catalog.json`, on the `"id": "opposites"` entry, update:

```json
"version": "2.6.0",
"url": "./decks/opposites_v2.6.0.zip",
```

Sanity-check the new ZIP actually contains the rename:

```bash
unzip -p public/decks/opposites_v2.6.0.zip topic.json | grep -o '"title": "Найди пару"'
```

Expected: one match.

- [ ] **Step 7: Commit**

```bash
git add src/topics/renderers/opposites/index.jsx src/topics/renderers/opposites/FindOppositeTask.jsx public/decks/opposites_draft/topic.json public/decks/opposites_v2.6.0.zip public/decks/catalog.json
git commit -m "fix(opposites): rename find_opposite away from \"неприятель\", read its instruction from topic.json"
```

(Do not delete `public/decks/opposites_v2.5.1.zip` yet — remove a superseded deck ZIP only after the new version is confirmed live, per project convention.)

---

### Task 5: Show both cards at once in "Сравниваем"

`PairComparisonTask.jsx` renders the left card immediately but withholds the right card behind a tap (`{step === 2 && <PairCard ... card={pair.rightCard} .../>}`), with a "Нажмите, чтобы открыть пару" hint below it. ТЗ §11.2 specifies both cards on screen together from the start — the entire pedagogical point of parallel comparison is that the child can look back and forth between both poles without holding one in memory. The two-step reveal turns a passive side-by-side comparison into a memory task, right at the one stage of the ТЗ's own learning route (§12) meant to carry no cognitive load at all.

**Files:**
- Modify: `src/topics/renderers/opposites/PairComparisonTask.jsx`
- Modify: `src/topics/renderers/opposites/Opposites.css` (remove two now-dead rules)

- [ ] **Step 1: Show both cards immediately, drop the two-step reveal state**

Replace the whole component body in `src/topics/renderers/opposites/PairComparisonTask.jsx`:

```jsx
export default function PairComparisonTask({ task, topicId, onAdvance }) {
  const { pairs, showLabels } = task;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep]                 = useState(1);

  const pair    = pairs[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast  = currentIndex === pairs.length - 1;

  function handleContentTap() {
    if (step === 1) setStep(2);
  }

  function handlePrev() {
    if (isFirst) return;
    setCurrentIndex(i => i - 1);
    setStep(1);
  }

  function handleNext() {
    if (!isLast) {
      setCurrentIndex(i => i + 1);
      setStep(1);
    } else {
      onAdvance();
    }
  }

  return (
    <div className="session-body opp-pair-v2">
      <div className="opp-pair-v2__content" onClick={handleContentTap}>
        <PairCard topicId={topicId} card={pair.leftCard}  showLabels={showLabels} visible />
        {step === 2 && <PairCard topicId={topicId} card={pair.rightCard} showLabels={showLabels} visible />}
      </div>

      {step === 1 && (
        <div className="opp-pair-v2__tap-hint">Нажмите, чтобы открыть пару</div>
      )}

      <div className="opp-pair-v2__nav">
```

with:

```jsx
export default function PairComparisonTask({ task, topicId, onAdvance }) {
  const { pairs, showLabels } = task;
  const [currentIndex, setCurrentIndex] = useState(0);

  const pair    = pairs[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast  = currentIndex === pairs.length - 1;

  function handlePrev() {
    if (isFirst) return;
    setCurrentIndex(i => i - 1);
  }

  function handleNext() {
    if (!isLast) {
      setCurrentIndex(i => i + 1);
    } else {
      onAdvance();
    }
  }

  return (
    <div className="session-body opp-pair-v2">
      <div className="opp-pair-v2__content">
        <PairCard topicId={topicId} card={pair.leftCard}  showLabels={showLabels} />
        <PairCard topicId={topicId} card={pair.rightCard} showLabels={showLabels} />
      </div>

      <div className="opp-pair-v2__nav">
```

(Leave everything from `<span className="opp-pair-v2__progress">` down to the end of the file untouched — only the state declarations, the two handlers that referenced `step`, and the JSX block shown above change.)

- [ ] **Step 2: Drop the now-dead `visible` prop from `PairCard`**

`PairCard` received `visible` as a hardcoded `true` even before Step 1 — Step 1's call sites no longer pass it at all, so the prop and its ternary are both dead. In the same file, replace:

```jsx
function PairCard({ topicId, card, showLabels, visible }) {
  const url = useTopicFile(topicId, card?.image);
  return (
    <div className={`opp-pair__side${visible ? "" : " opp-pair__side--hidden"}`}>
```

with:

```jsx
function PairCard({ topicId, card, showLabels }) {
  const url = useTopicFile(topicId, card?.image);
  return (
    <div className="opp-pair__side">
```

- [ ] **Step 3: Remove the now-dead CSS**

In `src/topics/renderers/opposites/Opposites.css`, delete these two rules — after Steps 1–2, nothing in the codebase references either class:

```css
.opp-pair-v2__tap-hint {
  text-align: center;
  color: #aaa;
  font-size: clamp(0.75rem, 2.5vw, 0.9rem);
  padding: 4px 0;
  flex-shrink: 0;
}
```

```css
/* Приглушённый полюс: виден как силуэт, layout не прыгает */
.opp-pair__side--hidden {
  opacity: 0.2;
  filter: grayscale(1);
  pointer-events: none;
  transition: opacity 0.3s ease, filter 0.3s ease;
}
```

(Leave the separate `.opp-pair__side { transition: opacity 0.3s ease; }` rule right after it — that one isn't tied to `--hidden` and stays harmless either way.)

- [ ] **Step 4: Manual check in the browser**

Start the dev server, open `opposites` → «Сравниваем», confirm both cards of the first pair render immediately with no tap required, and that the назад/вперёд buttons still page through every pair correctly, ending on «Готово».

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/opposites/PairComparisonTask.jsx src/topics/renderers/opposites/Opposites.css
git commit -m "fix(opposites): show both cards at once in pair_comparison, matching ТЗ §11.2"
```

---

### Task 6: Bring colors and buttons to the canonical Mirocard design tokens

`Opposites.css` uses Material Design colors (`#4caf50`/`#f44336`/`#2196f3`) instead of the app-wide correct/wrong palette, and its buttons/drop-zones don't use the app's "3D shadow that collapses on `:active`" pattern (`src/shared/components/Button.jsx` + `.btn`/`.btn-primary` in `src/styles.css:10984-11009`). CSS-only — no test, matches the precedent of CSS-only tasks elsewhere in this project's plans (verified by manual check, not a unit test).

**Files:**
- Modify: `src/topics/renderers/opposites/Opposites.css`

- [ ] **Step 1: Fix the correct/wrong colors**

Replace every occurrence of the Material palette with the canonical one:

```css
.opp-grid-card--correct  { background: #e8f5e9; border-color: #4caf50; }
.opp-grid-card--wrong    { background: #ffebee; border-color: #f44336; }
```

→

```css
.opp-grid-card--correct  { background: #dcfce7; border-color: #22c55e; }
.opp-grid-card--wrong    { background: #fef2f2; border-color: #ef4444; }
```

and:

```css
.opp-grid-card--correct.opp-choose__card  { background: #e8f5e9; border-color: #4caf50; }
.opp-grid-card--wrong.opp-choose__card    { background: #ffebee; border-color: #f44336; }
```

→

```css
.opp-grid-card--correct.opp-choose__card  { background: #dcfce7; border-color: #22c55e; }
.opp-grid-card--wrong.opp-choose__card    { background: #fef2f2; border-color: #ef4444; }
```

and:

```css
.opp-fo__slot--correct {
  border-color: #66bb6a;
  border-style: solid;
  background: #e8f5e9;
}
```

→

```css
.opp-fo__slot--correct {
  border-color: #22c55e;
  border-style: solid;
  background: #dcfce7;
}
```

and:

```css
.opp-fo__slot--wrong {
  border-color: #e57373;
  border-style: solid;
  background: #ffebee;
  animation: opp-fo-shake 0.35s ease;
}
```

→

```css
.opp-fo__slot--wrong {
  border-color: #ef4444;
  border-style: solid;
  background: #fef2f2;
  animation: opp-fo-shake 0.35s ease;
}
```

- [ ] **Step 2: Give the submit/nav buttons the app's 3D-shadow press feedback**

Replace:

```css
.opp-submit-btn {
  padding: 12px 36px;
  font-size: 1.1rem;
  background: #2196f3;
  color: #fff;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  flex-shrink: 0;
}
.opp-submit-btn:disabled { background: #ccc; cursor: default; }
```

with:

```css
.opp-submit-btn {
  padding: 12px 36px;
  font-size: 1.1rem;
  background: #4a9b8f;
  color: #fff;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  flex-shrink: 0;
  box-shadow: 0 5px 0 #2a6b60, 0 8px 20px rgba(42, 107, 96, 0.35);
  transition: transform 0.1s ease;
}
.opp-submit-btn:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 2px 0 #2a6b60, 0 4px 10px rgba(42, 107, 96, 0.25); }
.opp-submit-btn:disabled { background: #ccc; box-shadow: none; cursor: default; }
```

and replace:

```css
.opp-pair-v2__nav-btn--next {
  background: #e3f2fd;
  border-color: #90caf9;
}
.opp-pair-v2__nav-btn--next:hover:not(:disabled) {
  background: #bbdefb;
}
```

with:

```css
.opp-pair-v2__nav-btn--next {
  background: #4a9b8f;
  border-color: #2a6b60;
  color: #fff;
  box-shadow: 0 3px 0 #2a6b60;
  transition: transform 0.1s ease;
}
.opp-pair-v2__nav-btn--next:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 #2a6b60; }
```

- [ ] **Step 3: Give the sort drop-zones the app's dashed-idle → solid-confirmed convention**

Replace:

```css
.opp-sort__zone {
  border: 2.5px solid #ccc;
  border-radius: 14px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  overflow-y: auto;
  transition: border-color 0.15s, background 0.15s;
}
.opp-sort__zone--left  { background: #e3f2fd; border-color: #90caf9; }
.opp-sort__zone--right { background: #fff3e0; border-color: #ffcc80; }
.opp-sort__zone--active { border-color: #1565c0; background: #bbdefb; }
```

with:

```css
.opp-sort__zone {
  border: 2.5px dashed #cbd5e1;
  border-radius: 14px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  overflow-y: auto;
  background: #f8fafc;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
.opp-sort__zone--active {
  border-style: solid;
  border-color: #3b82f6;
  background: #eff6ff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}
```

(This drops the pre-tinted blue/left, orange/right idle backgrounds in favor of the app-wide neutral-dashed idle state — both zones now start visually equal, and only the one currently under the dragged card highlights, matching `place_value.css`'s `.pv-zone` reference pattern from `.claude/skills/designing-mirocard-screens`. The `--left`/`--right` modifier classes become unused by this rule; leave the class names on the JSX alone — `SortTask.jsx` doesn't need a change, an unused CSS selector target is harmless.)

- [ ] **Step 4: Manual check in the browser**

Start the dev server and check, across `choose_two`, `find_all`, `sort`, and `find_opposite`: correct feedback is green `#22c55e`/`#dcfce7`, wrong feedback is red `#ef4444`/`#fef2f2` (matching any other topic, e.g. `column_addition`), the «Готово» button and the pair-comparison «next» button both depress with a visible 3D shadow collapse on tap, and the sort zones start dashed-grey and turn solid blue only while a card is being dragged over them.

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/opposites/Opposites.css
git commit -m "style(opposites): match colors and button press feedback to the app-wide design tokens"
```

---

### Task 7: Fix `tall_short`'s three cross-object variations

Three of `tall_short`'s five variations pair genuinely different objects across the pole, not the same object at two heights: `tree_bush` (дерево vs куст), `mountain_hill` (гора vs холм), `building_house` (дом vs домик). This is the exact anti-pattern ТЗ §7.3 names as wrong with its own worked example, «большой слон — маленькая мышь» — confirmed live in the audit (side-by-side photos of a pine forest with an adult next to a full-grown tree vs. a garden with a different adult next to a clipped boxwood shrub). `dog` and `person`, the other two `tall_short` variations, are already same-object pairs (`tall_dog_1.webp`/`short_dog_1.webp`, `tall_person_1.webp`/`short_person_1.webp`) — leave those two untouched.

**Files:**
- Modify: `public/decks/opposites_draft/topic.json` (6 `tall_short` card entries — 3 objectIds × 2 poles)
- Modify: `public/decks/opposites_draft/media/` (6 new image files)
- Modify: `public/decks/catalog.json`

**Asset brief — produce 3 new same-object variations, replacing `tree_bush`, `mountain_hill`, `building_house`.** ТЗ §10.2 already lists same-object dimensional pairs for «высокий — низкий» beyond the two already shipped (tower, tall glass/short glass, tall fence/short fence — dog and person are the two ТЗ doesn't mention, added separately). Use three of them:

| New `objectId` | `objectLabel` | left (`tall`) shot | right (`short`) shot |
|---|---|---|---|
| `tree` | дерево | a tall pine/spruce, full frame, no person for scale (avoids repeating the `person` variation's use of a human referent) | a short/young tree of the same species, same framing, same setting |
| `tower` | башня | a tall tower/lighthouse-style structure | a short tower of the same architectural style |
| `fence` | забор | a tall fence/wall | a low fence of the same material and style |

Each new pair must satisfy the composition-consistency rule from the audit's Part III §3.5: **same backdrop, same camera angle/framing, same lighting, same time of day — the only element that changes between the two shots is the object's height.** If a person appears in one shot of a pair, the same person (or no person at all) must appear in the other — do not let the referent-for-scale itself become an uncontrolled variable, which is what broke the original `tree_bush` and `mountain_hill` pairs. Save the new files as `media/tall_tree_1.webp`, `media/short_tree_1.webp`, `media/tall_tower_1.webp`, `media/short_tower_1.webp`, `media/tall_fence_1.webp`, `media/short_fence_1.webp`.

- [ ] **Step 1: Verify current state before editing**

```bash
unzip -p public/decks/opposites_v2.5.1.zip topic.json | node -e "
const j = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(j.cards.filter(c => c.conceptId === 'tall_short').map(c => c.objectId + ':' + c.pole + ' -> ' + c.image).join('\n'));
"
```

Expected output includes exactly these 6 lines to be replaced (interleaved with the 4 `dog`/`person` lines to leave alone):

```
tree_bush:left -> media/tall_tree_1.webp
tree_bush:right -> media/short_bush_1.webp
mountain_hill:left -> media/tall_mountain_1.webp
mountain_hill:right -> media/short_hill_1.webp
building_house:left -> media/tall_building_1.webp
building_house:right -> media/short_house_1.webp
```

- [ ] **Step 2: Produce and place the 6 new image files**

Following the asset brief above, add `tall_tree_1.webp`, `short_tree_1.webp`, `tall_tower_1.webp`, `short_tower_1.webp`, `tall_fence_1.webp`, `short_fence_1.webp` into `public/decks/opposites_draft/media/`. Remove the 6 superseded files from that folder (`tall_tree_1.webp`/`short_bush_1.webp`/`tall_mountain_1.webp`/`short_hill_1.webp`/`tall_building_1.webp`/`short_house_1.webp` — note the old `tall_tree_1.webp` filename is being reused for a different, corrected image, so it gets overwritten rather than freed up).

- [ ] **Step 3: Edit the 6 card entries in `topic.json`**

In `public/decks/opposites_draft/topic.json`, find the 6 `tall_short` cards whose `objectId` is `tree_bush`, `mountain_hill`, or `building_house`. Each currently looks like (left-pole example):

```json
{
  "id": "tall_tree",
  "conceptId": "tall_short",
  "pole": "left",
  "objectId": "tree_bush",
  "objectLabel": "дерево",
  "poleLabel": "высокий",
  "nominativeLabel": "высокое",
  "instructionLabel": "высокое",
  "poleLabelPlural": "высокие",
  "primary": false,
  "image": "media/tall_tree_1.webp",
  "poleLabelNeutral": "высокое"
}
```

Replace the 3 `objectId`/`objectLabel` pairs (keeping every other field — `poleLabel`, `nominativeLabel`, `instructionLabel`, `poleLabelPlural`, `poleLabelNeutral` are all about the concept's shared grammar, not the object, so they don't change):

| Old `objectId` / `objectLabel` (left, right) | New `objectId` / `objectLabel` (left, right) |
|---|---|
| `tree_bush` / дерево, куст | `tree` / дерево, дерево |
| `mountain_hill` / гора, холм | `tower` / башня, башня |
| `building_house` / дом, домик | `fence` / забор, забор |

Update each card's `"image"` field to match the new filenames from Step 2 (`media/tall_tree_1.webp`, `media/short_tree_1.webp`, `media/tall_tower_1.webp`, `media/short_tower_1.webp`, `media/tall_fence_1.webp`, `media/short_fence_1.webp`).

- [ ] **Step 4: Verify the edit with a script, not by eye**

```bash
node -e "
const j = require('./public/decks/opposites_draft/topic.json');
const ts = j.cards.filter(c => c.conceptId === 'tall_short');
const objects = [...new Set(ts.map(c => c.objectId))].sort();
console.log('objectIds:', objects.join(', '));
if (JSON.stringify(objects) !== JSON.stringify(['dog','fence','person','tower','tree'])) {
  throw new Error('unexpected objectId set: ' + objects.join(', '));
}
for (const oid of ['tree', 'tower', 'fence']) {
  const pair = ts.filter(c => c.objectId === oid);
  if (pair.length !== 2) throw new Error(oid + ' does not have exactly 2 cards');
  if (pair[0].objectLabel !== pair[1].objectLabel) throw new Error(oid + ' left/right objectLabel mismatch: ' + pair[0].objectLabel + ' vs ' + pair[1].objectLabel);
}
console.log('OK: tree/tower/fence are same-objectLabel pairs, dog/person untouched');
"
```

Expected: prints `OK: ...` with no thrown error.

- [ ] **Step 5: Bump the deck version and re-zip**

In `public/decks/opposites_draft/topic.json`, bump `meta.version` to `"2.7.0"` (content data change — minor bump; if Task 4's `2.6.0` hasn't landed yet, bump from `2.5.1` to `2.6.0` here instead and adjust Task 8's version forward by one accordingly).

```bash
cd public/decks/opposites_draft
zip -r ../opposites_v2.7.0.zip . -x ".*"
cd ../../..
```

- [ ] **Step 6: Point the catalog at the new ZIP**

In `public/decks/catalog.json`, update the `"id": "opposites"` entry's `version` and `url` to `"2.7.0"` / `"./decks/opposites_v2.7.0.zip"`.

```bash
unzip -p public/decks/opposites_v2.7.0.zip topic.json | grep -c '"objectId": "tree"\|"objectId": "tower"\|"objectId": "fence"'
```

Expected: `6` (2 cards each for tree/tower/fence).

- [ ] **Step 7: Commit**

```bash
git add public/decks/opposites_draft/topic.json public/decks/opposites_draft/media public/decks/opposites_v2.7.0.zip public/decks/catalog.json
git commit -m "content(opposites): fix tall_short's 3 cross-object variations (tree/bush, mountain/hill, house/domik)"
```

---

### Task 8: Fix `full_empty`'s bucket pair

`full_bucket_1.webp` and `empty_bucket_1.webp` show two different buckets — blue metal (full, garden setting, one child) vs. yellow plastic (empty, indoor setting, a different child) — not the same bucket with and without water. A child can pass this variation by matching bucket color instead of judging fullness.

**Files:**
- Modify: `public/decks/opposites_draft/topic.json` (2 `full_empty`/`bucket` card entries)
- Modify: `public/decks/opposites_draft/media/` (2 replacement image files)
- Modify: `public/decks/catalog.json`

**Asset brief.** Reshoot both `full_bucket_1.webp` and `empty_bucket_1.webp` as the same physical bucket (same color, material, handle, size), same setting, same camera angle, same lighting — the only difference between the two shots is the presence of water. This is the same fix pattern the topic's own `hot_soup_3.webp`/`cold_soup_2.webp` pair already gets right (same bowl, same food, only the steam differs) — use that pair as the visual reference for "what a correctly-matched pair in this deck looks like."

- [ ] **Step 1: Verify current state before editing**

```bash
unzip -p public/decks/opposites_v2.5.1.zip topic.json | node -e "
const j = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(j.cards.filter(c => c.conceptId === 'full_empty' && c.objectId === 'bucket').map(c => c.pole + ' -> ' + c.image).join('\n'));
"
```

Expected:

```
left -> media/full_bucket_1.webp
right -> media/empty_bucket_1.webp
```

- [ ] **Step 2: Produce and place the 2 replacement images**

Following the asset brief above, replace `public/decks/opposites_draft/media/full_bucket_1.webp` and `empty_bucket_1.webp` in place (same filenames — no `topic.json` image-path edit needed for this task, unlike Task 6).

- [ ] **Step 3: Bump the deck version and re-zip**

In `public/decks/opposites_draft/topic.json`, bump `meta.version` to the next minor version after whatever Task 4/7 last left it at (e.g. `"2.8.0"` if Task 7 landed `2.7.0`).

```bash
cd public/decks/opposites_draft
zip -r ../opposites_v2.8.0.zip . -x ".*"
cd ../../..
```

- [ ] **Step 4: Point the catalog at the new ZIP and verify**

In `public/decks/catalog.json`, update the `"id": "opposites"` entry's `version`/`url` to match. Then confirm the new ZIP's bucket images actually changed (different file size/hash than the old ones, since the filenames themselves didn't change):

```bash
unzip -p public/decks/opposites_v2.5.1.zip media/full_bucket_1.webp | sha256sum
unzip -p public/decks/opposites_v2.8.0.zip media/full_bucket_1.webp | sha256sum
```

Expected: the two hashes differ (confirms the new ZIP isn't accidentally still packaging the old photo).

- [ ] **Step 5: Commit**

```bash
git add public/decks/opposites_draft/media public/decks/opposites_v2.8.0.zip public/decks/catalog.json
git commit -m "content(opposites): reshoot full_empty's bucket pair as the same bucket, water added/removed"
```

(Don't bump `topic.json`'s own `meta.version` in this commit if Task 7's edit already bumped it in the same batch — bump once per actual release, not once per task, if these are being executed back-to-back before a single push.)

---

### Task 9: Ship it

- [ ] **Step 1: Run the full test suite**

```bash
npx vitest run
```

Expected: everything passes, including every change to `src/topics/renderers/opposites/engine.test.js` across Tasks 1–3.

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: builds cleanly with no errors.

- [ ] **Step 3: Confirm only one deck ZIP release actually ships**

If Tasks 4, 7, and 8 were each executed with their own version bump, only the *last* one actually needs to be live — earlier intermediate versions (e.g. `2.6.0`, `2.7.0`) were only ever committed as stepping stones. Before shipping, make sure `public/decks/catalog.json`'s `opposites` entry points at the final version produced by the last content task actually executed, and that `meta.version` inside that same ZIP's `topic.json` matches it exactly.

- [ ] **Step 4: Bump the app version**

```bash
npm version patch --no-git-tag-version
git add package.json
git commit -m "chore: release v$(node -p "require('./package.json').version")"
```

- [ ] **Step 5: Push — only with the user's explicit go-ahead at execution time**

```bash
git push origin main
```

`git push origin main` deploys to production immediately (Railway auto-deploy, no review gate) — confirm with the user before running this step.

- [ ] **Step 6: Verify the deploy**

After the push, confirm `https://app.mironium.com/api/version` returns the new version and `https://app.mironium.com/` responds. Then open the `opposites` topic live and spot-check: «Покажи» asks for the object's correctly-agreed form (Task 1), «Найди все» phrases the instruction in the plural (Task 2), the first «Покажи» question for a brand-new pair asks for its positive pole (Task 3), the mode formerly called «Найди неприятеля» is now «Найди пару» with the ТЗ's own instruction copy (Task 4), «Сравниваем» shows both cards at once with no tap required (Task 5), correct/wrong colors and button press feedback match the rest of the app (Task 6), and — if Tasks 7/8 shipped — the `tall_short` tree/tower/fence variations and the `full_empty` bucket pair show a single consistent object per pair.

---

## Deferred (needs a decision first, see "Decisions needed" above)

- An expressive-practice task type (Decision 1).
- The ТЗ's 5-level hint/prompt-ladder system — doesn't exist anywhere in the app yet, for any topic (Decision 2).
- Adding any of the 9 still-unshipped ТЗ pairs (Decision 3).
- Reshooting or dropping `hot_cold`/`wet_dry` (Decision 4).
- Occasionally mixing in a cross-pair distractor at `choose_two`'s Level 2, before full Level 3–4 review (audit Part III §3.4) — worth doing, but depends on how session-level concept selection is orchestrated outside this renderer (`cardsForRenderer` in `src/features/session/useSessionEngine.js`), which this plan's investigation didn't trace far enough to turn into a safe, concrete task.
