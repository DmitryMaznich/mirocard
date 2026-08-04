# Emotions v2 — three-mode situation loop (v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the 18 situation texts, and expand the single `situation_emotion` mode into three: a passive `situation_intro` (tap to reveal the emotion), the existing `situation_emotion` drill, and a new reverse `emotion_situation` drill.

**Architecture:** `situation_intro` needs one new small component (`SituationIntroTask`) since nothing existing does "show text, tap, reveal a different card, tap again to advance." `emotion_situation` reuses the existing `ChooseWordTask` component completely unmodified — its task shape already matches (stimulus card + text-label options). Both get their own generator function in the shared `flashcards/engine.js`, following the exact `cardType`-filtered-`displayConcepts` pattern already established for `situation_emotion`.

**Tech Stack:** Same shared `flashcards` renderer/engine; Vitest + the `createRoot`/`act` smoke-test pattern already used for `situationEmotion.smoke.test.jsx`.

## Global Constraints

- `cardType` filtering (the `displayConcepts` computation in `generateTasks`) must not be touched — it already generalizes to any number of modes consuming `cardType: "situation"` cards.
- Version must be bumped simultaneously in `deck.json` meta.version, `catalog.json`, and the ZIP filename — never overwrite an existing versioned ZIP.
- Vitest test discovery must be scoped: `npx vitest run --dir src <exact file path>`.
- Check `git status` before every deploy in this plan — if a concurrent session has left an unrelated uncommitted change (has happened repeatedly with `src/features/session/useSessionEngine.js` and `column_addition/*` in this project), `git stash push -- <that file>` before deploying and `git stash pop` immediately after; confirm with the user before running `deploy:prod` regardless.

---

### Task 1: Replace the 18 situation texts with simplified wording

**Files:**
- Modify: `tools/emotions_v2/deck.json`

**Interfaces:** Content-only change — card `id`, `conceptId`, `cardType`, `answerKey` all stay the same; only `label` text changes. No code depends on the specific wording.

- [ ] **Step 1: Replace each situation card's `label`**

In `tools/emotions_v2/deck.json`, find and replace each of these 18 `label` values (exact current text on the left, new text on the right — every other field on each card object is unchanged):

| id | old label | new label |
|---|---|---|
| situation_joy_1 | Друг пригласил тебя в гости поиграть в новую игру. | Друг подарил тебе игрушку. |
| situation_joy_2 | Учительница похвалила тебя перед всем классом за хорошую работу. | Учитель тебя похвалил. |
| situation_joy_3 | Ты наконец прошёл уровень в игре, который не получался целую неделю. | Ты выиграл в игру. |
| situation_sadness_1 | Твой лучший друг переехал в другой город. | Друг переехал в другой город. |
| situation_sadness_2 | Ты забыл дома тетрадь с домашним заданием, и учитель поставил замечание. | Ты потерял любимую игрушку. |
| situation_sadness_3 | Дождь испортил прогулку, которую ты ждал весь день. | Питомец заболел. |
| situation_anger_1 | Младший брат сломал твою модель, которую ты собирал два часа. | Брат сломал твою игрушку. |
| situation_anger_2 | Одноклассник взял твою вещь без разрешения и не хочет отдавать. | Друг взял твою вещь без спроса. |
| situation_anger_3 | Тебя обвинили в том, чего ты не делал. | Тебя толкнули в очереди. |
| situation_fear_1 | Свет в комнате внезапно погас, и стало совсем темно. | В комнате погас свет. |
| situation_fear_2 | Завтра контрольная работа, а ты ничего не повторил. | Рядом залаяла большая собака. |
| situation_fear_3 | Собака соседей громко залаяла и побежала в твою сторону. | Загремел сильный гром. |
| situation_surprise_1 | Ты открыл дверь, а там друзья устроили тебе сюрприз на день рождения. | Друзья устроили тебе сюрприз. |
| situation_surprise_2 | Учитель неожиданно отменил контрольную работу. | Ты нашёл деньги на полу. |
| situation_surprise_3 | Ты нашёл под кроватью старую игрушку, о которой совсем забыл. | Дверь открылась сама. |
| situation_calm_1 | Ты лежишь в кровати вечером и слушаешь тихую музыку. | Ты слушаешь тихую музыку. |
| situation_calm_2 | Все уроки сделаны, и впереди целый свободный вечер. | Все дела сделаны. |
| situation_calm_3 | Ты гуляешь в парке, и вокруг тихо и спокойно. | Ты гуляешь в парке. |

(Note `situation_fear_2`/`situation_fear_3`'s new text swaps content — the old "контрольная работа" prompt is dropped in favor of two clearly physical/sensory fear triggers, matching the simplification brief better than a school-anxiety scenario.)

- [ ] **Step 2: Verify the replacement — every situation label is ≤6 words, count unchanged**

```bash
node -e '
const data = require("./tools/emotions_v2/deck.json");
const situations = data.cards.filter((c) => c.cardType === "situation");
console.log("count:", situations.length);
for (const c of situations) {
  const words = c.label.trim().split(/\s+/).length;
  console.log(c.id, words, "words:", c.label);
}
console.log("max words:", Math.max(...situations.map((c) => c.label.trim().split(/\s+/).length)));
'
```

Expected: `count: 18`, every line ≤6 words, `max words: 6`.

- [ ] **Step 3: Commit**

```bash
git add tools/emotions_v2/deck.json
git commit -m "content(emotions_v2): simplify situation wording for autism-spectrum reading comprehension"
```

---

### Task 2: Add the situation_intro mode (new component + generator)

**Files:**
- Modify: `src/topics/renderers/flashcards/engine.js`
- Modify: `src/topics/renderers/flashcards/engine.test.js`
- Modify: `src/topics/renderers/flashcards/index.jsx`
- Modify: `src/styles.css`
- Create: `src/topics/renderers/flashcards/situationIntro.smoke.test.jsx`

**Interfaces:**
- Consumes: `pickVariation`, `shuffle` (already imported in `engine.js`); `CardArea` (already defined in `index.jsx`).
- Produces: `generateTasks("situation_intro", concepts, allCards, params)` → `{ type: "situation_intro", conceptId, situationText, card, label }[]`; `TASK_RENDERERS.situation_intro`.

- [ ] **Step 1: Write the failing engine test**

Add to `src/topics/renderers/flashcards/engine.test.js`, inside the existing `describe("generateTasks — situation_emotion", ...)` block's fixture scope — add a new sibling `describe` right after that block:

```js
describe("generateTasks — situation_intro", () => {
  const EMOTION_CARDS = [
    { id: "joy_1", conceptId: "joy", primary: true, label: "радость", image: "media/joy_1.webp" },
    { id: "joy_situation_1", conceptId: "joy", cardType: "situation", label: "Друг подарил тебе игрушку." },
    { id: "sad_1", conceptId: "sadness", primary: true, label: "грусть", image: "media/sad_1.webp" },
    { id: "sad_situation_1", conceptId: "sadness", cardType: "situation", label: "Питомец заболел." },
  ];
  const EMOTION_CONCEPTS = deriveConcepts(EMOTION_CARDS);

  it("produces one no-evaluation task per situation card", () => {
    const tasks = generateTasks("situation_intro", EMOTION_CONCEPTS, EMOTION_CARDS, {});
    expect(tasks).toHaveLength(2);
    const joyTask = tasks.find((t) => t.conceptId === "joy");
    expect(joyTask).toMatchObject({
      type: "situation_intro",
      situationText: "Друг подарил тебе игрушку.",
      label: "радость",
    });
    expect(joyTask.card.cardType).not.toBe("situation");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --dir src src/topics/renderers/flashcards/engine.test.js`
Expected: FAIL — `generateTasks("situation_intro", ...)` hits `default: return [];`.

- [ ] **Step 3: Implement the generator**

In `src/topics/renderers/flashcards/engine.js`, add right after `generateSituationEmotionTasks`:

```js
function generateSituationIntroTasks(displayConcepts, allCards) {
  const situationCards = allCards.filter((c) => c.cardType === "situation");
  const tasks = [];
  for (const situationCard of situationCards) {
    const targetConcept = displayConcepts.find((c) => c.conceptId === situationCard.conceptId);
    if (!targetConcept) continue;
    tasks.push({
      type: "situation_intro",
      conceptId: situationCard.conceptId,
      situationText: situationCard.label,
      card: pickVariation(targetConcept),
      label: targetConcept.primary?.label ?? targetConcept.conceptId,
    });
  }
  return shuffle(tasks);
}
```

Add the dispatch case in `generateTasks`, right after `case "situation_emotion":`:

```js
    case "situation_intro":        return generateSituationIntroTasks(displayConcepts, allCards);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run --dir src src/topics/renderers/flashcards/engine.test.js`
Expected: PASS (all tests, including the new one).

- [ ] **Step 5: Add the SituationIntroTask component**

In `src/topics/renderers/flashcards/index.jsx`, add right after the existing `IntroTask` function (currently lines 43-57):

```js
function SituationIntroTask({ task, topicId, onAdvance }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { setRevealed(false); }, [task]);

  function handleTap() {
    if (!revealed) { setRevealed(true); return; }
    onAdvance();
  }

  return (
    <button className="session-full-tap situation-intro" onClick={handleTap}>
      <div className="session-instruction">{task.situationText}</div>
      <div className={`situation-intro__reveal${revealed ? " situation-intro__reveal--shown" : ""}`}>
        <CardArea topicId={topicId} card={task.card} />
        <div className="session-label">{task.label}</div>
      </div>
      {!revealed && <div className="session-hint">Нажми, чтобы узнать эмоцию</div>}
    </button>
  );
}
```

- [ ] **Step 6: Register it in TASK_RENDERERS**

Find `TASK_RENDERERS` (already has a `situation_emotion` entry from the prior round) and add:

```js
const TASK_RENDERERS = {
  intro:                  IntroTask,
  question_answer:        QuestionAnswerTask,
  yes_no:                 YesNoTask,
  find_n:                 FindNTask,
  situation_emotion:      FindNTask,
  situation_intro:        SituationIntroTask,
  choose_word_by_picture: ChooseWordTask,
  choose_all:             ChooseAllTask,
};
```

- [ ] **Step 7: Add the reveal-transition CSS**

In `src/styles.css`, right after the existing `.qa-reveal--shown { ... }` rule (search for it — it's near the `.qa-btn:disabled` rule), add:

```css
.situation-intro__reveal {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.25s ease, transform 0.25s ease;
  pointer-events: none;
}
.situation-intro__reveal--shown {
  opacity: 1;
  transform: translateY(0);
}
```

- [ ] **Step 8: Write the smoke test**

Create `src/topics/renderers/flashcards/situationIntro.smoke.test.jsx`:

```jsx
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import FlashcardsRenderer from "./index.jsx";
import { generateTasks } from "./engine.js";
import { deriveConcepts } from "@/shared/utils/topicUtils";

const CARDS = [
  { id: "joy_1", conceptId: "joy", primary: true, label: "радость", image: "media/joy_1.webp" },
  { id: "joy_2", conceptId: "joy", primary: false, image: "media/joy_2.webp" },
  { id: "situation_joy_1", conceptId: "joy", cardType: "situation", label: "Друг подарил тебе игрушку." },
];
const CONCEPTS = deriveConcepts(CARDS);

describe("situation_intro — mounted through the real SituationIntroTask", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
  });

  function mount(task, onAdvance) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <FlashcardsRenderer task={task} mode={{ type: "situation_intro" }} onAdvance={onAdvance} />
      );
    });
  }

  it("shows the situation text, hides the emotion label until the first tap", () => {
    const [task] = generateTasks("situation_intro", CONCEPTS, CARDS, {});
    mount(task, () => {});
    expect(container.querySelector(".session-instruction")?.textContent).toBe("Друг подарил тебе игрушку.");
    expect(container.querySelector(".situation-intro__reveal")?.className).not.toContain("--shown");
  });

  it("first tap reveals the emotion, does not advance; second tap advances", () => {
    const [task] = generateTasks("situation_intro", CONCEPTS, CARDS, {});
    let advanceCalls = 0;
    mount(task, () => { advanceCalls++; });

    const btn = container.querySelector("button.situation-intro");
    act(() => btn.click());
    expect(container.querySelector(".situation-intro__reveal")?.className).toContain("--shown");
    expect(container.querySelector(".session-label")?.textContent).toBe("радость");
    expect(advanceCalls).toBe(0);

    act(() => btn.click());
    expect(advanceCalls).toBe(1);
  });
});
```

- [ ] **Step 9: Run the full flashcards test suite**

Run: `npx vitest run --dir src src/topics/renderers/flashcards/engine.test.js src/topics/renderers/flashcards/situationIntro.smoke.test.jsx src/topics/renderers/flashcards/situationEmotion.smoke.test.jsx`
Expected: PASS, all files.

- [ ] **Step 10: Commit**

```bash
git add src/topics/renderers/flashcards/engine.js src/topics/renderers/flashcards/engine.test.js src/topics/renderers/flashcards/index.jsx src/topics/renderers/flashcards/situationIntro.smoke.test.jsx src/styles.css
git commit -m "feat(flashcards): add situation_intro mode (tap-to-reveal, no evaluation)"
```

---

### Task 3: Add the emotion_situation mode (reverse direction, reuses ChooseWordTask)

**Files:**
- Modify: `src/topics/renderers/flashcards/engine.js`
- Modify: `src/topics/renderers/flashcards/engine.test.js`
- Modify: `src/topics/renderers/flashcards/index.jsx`
- Create: `src/topics/renderers/flashcards/emotionSituation.smoke.test.jsx`

**Interfaces:**
- Consumes: `pickVariation`, `selectDistractorConceptIds`, `shuffle` (already imported).
- Produces: `generateTasks("emotion_situation", concepts, allCards, params)` → `{ type: "emotion_situation", conceptId, card, options: [{label, conceptId, isTarget}] }[]`; `TASK_RENDERERS.emotion_situation`.

- [ ] **Step 1: Write the failing engine tests**

Add to `engine.test.js`, after the `situation_intro` describe block added in Task 2:

```js
describe("generateTasks — emotion_situation", () => {
  const EMOTION_CARDS = [
    { id: "joy_1", conceptId: "joy", primary: true, label: "радость", image: "media/joy_1.webp" },
    { id: "joy_situation_1", conceptId: "joy", cardType: "situation", label: "Друг подарил тебе игрушку." },
    { id: "sad_1", conceptId: "sadness", primary: true, label: "грусть", image: "media/sad_1.webp" },
    { id: "sad_situation_1", conceptId: "sadness", cardType: "situation", label: "Питомец заболел." },
    { id: "anger_1", conceptId: "anger", primary: true, label: "злость", image: "media/anger_1.webp" },
    { id: "anger_situation_1", conceptId: "anger", cardType: "situation", label: "Брат сломал твою игрушку." },
  ];
  const EMOTION_CONCEPTS = deriveConcepts(EMOTION_CARDS);

  it("produces one task per situation card, stimulus card belongs to the target emotion", () => {
    const tasks = generateTasks("emotion_situation", EMOTION_CONCEPTS, EMOTION_CARDS, { optionCount: 2 });
    expect(tasks).toHaveLength(3);
    const joyTask = tasks.find((t) => t.conceptId === "joy");
    expect(joyTask.card.conceptId).toBe("joy");
    expect(joyTask.card.cardType).not.toBe("situation");
  });

  it("options are situation sentences (not emotion words), exactly one isTarget matching the source text", () => {
    const tasks = generateTasks("emotion_situation", EMOTION_CONCEPTS, EMOTION_CARDS, { optionCount: 2 });
    const joyTask = tasks.find((t) => t.conceptId === "joy");
    const targets = joyTask.options.filter((o) => o.isTarget);
    expect(targets).toHaveLength(1);
    expect(targets[0].label).toBe("Друг подарил тебе игрушку.");
    expect(joyTask.options.every((o) => !["радость", "грусть", "злость"].includes(o.label))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run --dir src src/topics/renderers/flashcards/engine.test.js`
Expected: FAIL — `emotion_situation` hits the `default: return [];` branch.

- [ ] **Step 3: Implement the generator**

Add to `engine.js`, right after `generateSituationIntroTasks`:

```js
function generateEmotionSituationTasks(displayConcepts, allCards, params) {
  const optionCount = params.optionCount ?? 4;
  const difficulty = params.distractorLevel ?? "medium";
  const situationCards = allCards.filter((c) => c.cardType === "situation");
  const tasks = [];
  for (const situationCard of situationCards) {
    const targetConcept = displayConcepts.find((c) => c.conceptId === situationCard.conceptId);
    if (!targetConcept) continue;
    const distractorCount = Math.min(optionCount - 1, displayConcepts.length - 1);
    const distractorIds = selectDistractorConceptIds(situationCard.conceptId, displayConcepts, distractorCount, difficulty);
    const distractorOptions = distractorIds
      .map((cid) => {
        const candidates = situationCards.filter((sc) => sc.conceptId === cid);
        if (candidates.length === 0) return null;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        return { label: pick.label, conceptId: cid, isTarget: false };
      })
      .filter(Boolean);
    const targetOption = { label: situationCard.label, conceptId: situationCard.conceptId, isTarget: true };
    tasks.push({
      type: "emotion_situation",
      conceptId: situationCard.conceptId,
      card: pickVariation(targetConcept),
      options: shuffle([targetOption, ...distractorOptions]),
    });
  }
  return shuffle(tasks);
}
```

Add the dispatch case right after `case "situation_intro":`:

```js
    case "emotion_situation":      return generateEmotionSituationTasks(displayConcepts, allCards, params);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run --dir src src/topics/renderers/flashcards/engine.test.js`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Register in TASK_RENDERERS**

In `index.jsx`, add `emotion_situation: ChooseWordTask,` to the `TASK_RENDERERS` object (right after the `situation_intro` line added in Task 2).

- [ ] **Step 6: Write the smoke test**

Create `src/topics/renderers/flashcards/emotionSituation.smoke.test.jsx`:

```jsx
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import FlashcardsRenderer from "./index.jsx";
import { generateTasks } from "./engine.js";
import { deriveConcepts } from "@/shared/utils/topicUtils";

const CARDS = [
  { id: "joy_1", conceptId: "joy", primary: true, label: "радость", image: "media/joy_1.webp" },
  { id: "situation_joy_1", conceptId: "joy", cardType: "situation", label: "Друг подарил тебе игрушку." },
  { id: "sad_1", conceptId: "sadness", primary: true, label: "грусть", image: "media/sad_1.webp" },
  { id: "situation_sad_1", conceptId: "sadness", cardType: "situation", label: "Питомец заболел." },
  { id: "anger_1", conceptId: "anger", primary: true, label: "злость", image: "media/anger_1.webp" },
  { id: "situation_anger_1", conceptId: "anger", cardType: "situation", label: "Брат сломал твою игрушку." },
];
const CONCEPTS = deriveConcepts(CARDS);

describe("emotion_situation — mounted through the real (unmodified) ChooseWordTask", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
  });

  function mount(task, { onCorrect, onIncorrect }) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <FlashcardsRenderer task={task} mode={{ type: "emotion_situation" }} onCorrect={onCorrect} onIncorrect={onIncorrect} />
      );
    });
  }

  it("renders situation sentences as clickable text options, not emotion words", () => {
    const tasks = generateTasks("emotion_situation", CONCEPTS, CARDS, { optionCount: 2 });
    mount(tasks[0], { onCorrect: () => {}, onIncorrect: () => {} });
    const buttons = Array.from(container.querySelectorAll(".choose-word-btn"));
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((b) => !["радость", "грусть", "злость"].includes(b.textContent))).toBe(true);
  });

  it("clicking the correct situation option fires onCorrect", () => {
    const tasks = generateTasks("emotion_situation", CONCEPTS, CARDS, { optionCount: 2 });
    const task = tasks.find((t) => t.conceptId === "joy");
    let correctCall = null;
    mount(task, { onCorrect: (...args) => { correctCall = args; }, onIncorrect: () => { throw new Error("should not fire"); } });

    const targetLabel = task.options.find((o) => o.isTarget).label;
    const btn = Array.from(container.querySelectorAll(".choose-word-btn")).find((b) => b.textContent === targetLabel);
    expect(btn, "target option button not found").toBeTruthy();
    act(() => btn.click());

    expect(correctCall).toEqual(["joy", task.card.id]);
  });
});
```

- [ ] **Step 7: Run the full flashcards test suite**

Run: `npx vitest run --dir src src/topics/renderers/flashcards/engine.test.js src/topics/renderers/flashcards/situationIntro.smoke.test.jsx src/topics/renderers/flashcards/situationEmotion.smoke.test.jsx src/topics/renderers/flashcards/emotionSituation.smoke.test.jsx`
Expected: PASS, all files.

- [ ] **Step 8: Commit**

```bash
git add src/topics/renderers/flashcards/engine.js src/topics/renderers/flashcards/engine.test.js src/topics/renderers/flashcards/index.jsx src/topics/renderers/flashcards/emotionSituation.smoke.test.jsx
git commit -m "feat(flashcards): add emotion_situation mode, reusing ChooseWordTask unmodified"
```

---

### Task 4: Wire the three mode entries into deck.json

**Files:**
- Modify: `tools/emotions_v2/deck.json`

**Interfaces:** Consumes the `situation_intro`/`emotion_situation` mode types from Tasks 2-3.

- [ ] **Step 1: Insert `situation_intro` before the existing `situation_emotion` mode, and `emotion_situation` after it**

In `tools/emotions_v2/deck.json`'s `modes` array, the current last entry is `situation_emotion` (added in the prior round). Replace it with all three, in this order:

```json
    {
      "id": "situation_intro",
      "type": "situation_intro",
      "evaluation": "none",
      "ui": {
        "title": "Знакомство: ситуации",
        "instruction": "Прочитай и узнай эмоцию"
      },
      "methodology": {
        "text": "Ребёнок читает короткую ситуацию и по нажатию видит, какую эмоцию испытывает человек в этой ситуации. Без задания и оценки — знакомит с причиной эмоции перед практикой.",
        "tips": [
          "Прочитайте ситуацию вслух вместе с ребёнком",
          "После открытия эмоции обсудите: «Почему именно так?»",
          "Используйте перед режимами «Ситуация → эмоция» и «Эмоция → Ситуация»"
        ],
        "duration": "3–5 минут"
      }
    },
    {
      "id": "situation_emotion",
      "type": "situation_emotion",
      "evaluation": "auto",
      "ui": {
        "title": "Ситуация → эмоция",
        "instruction": "Прочитай ситуацию и выбери подходящую эмоцию"
      },
      "methodology": {
        "text": "Ребёнок читает короткое описание ситуации и выбирает картинку с подходящей эмоцией среди вариантов. В отличие от «Найди картинку», здесь нет слова-подсказки — нужно самому понять, что почувствовал бы человек в этой ситуации. Первый шаг от узнавания эмоции к пониманию её причины.",
        "tips": [
          "После ответа обсудите: «А ты сам как бы себя чувствовал в такой ситуации?»",
          "Если ребёнок ошибся, проговорите ситуацию ещё раз медленно, выделяя ключевые слова",
          "Не торопите — на осмысление ситуации нужно больше времени, чем на узнавание лица"
        ],
        "duration": "5-8 минут"
      },
      "params": {
        "optionCount": {
          "type": "enum",
          "label": { "ru": "Вариантов" },
          "values": [2, 4, 6],
          "default": 4
        }
      }
    },
    {
      "id": "emotion_situation",
      "type": "emotion_situation",
      "evaluation": "auto",
      "ui": {
        "title": "Эмоция → Ситуация",
        "instruction": "Выбери, когда бывает такая эмоция"
      },
      "methodology": {
        "text": "Ребёнок видит картинку эмоции и выбирает подходящую ситуацию из нескольких текстов. Обратное направление к «Ситуация → эмоция» — тренирует применение эмоции, а не только её узнавание по описанию.",
        "tips": [
          "Используйте после уверенного прохождения «Ситуация → эмоция»",
          "Если ребёнок ошибся, прочитайте вместе все варианты и обсудите, чем они отличаются",
          "Хорошо дополняет «Ситуация → эмоция» — закрепляет связь в обе стороны"
        ],
        "duration": "5-8 минут"
      },
      "params": {
        "optionCount": {
          "type": "enum",
          "label": { "ru": "Вариантов" },
          "values": [2, 4, 6],
          "default": 4
        }
      }
    }
```

- [ ] **Step 2: Bump the deck version**

Change `"version": "1.3.1",` to `"version": "1.4.0",`.

- [ ] **Step 3: Verify**

```bash
node -e '
const data = require("./tools/emotions_v2/deck.json");
console.log("modes:", data.modes.map((m) => `${m.id}:${m.type}`));
console.log("version:", data.meta.version);
'
```

Expected:
```
modes: [ 'intro:intro', 'find_n:find_n', 'yes_no:yes_no', 'choose_word_by_picture:choose_word_by_picture', 'choose_all:choose_all', 'question_answer:question_answer', 'situation_intro:situation_intro', 'situation_emotion:situation_emotion', 'emotion_situation:emotion_situation' ]
version: 1.4.0
```

- [ ] **Step 4: Commit**

```bash
git add tools/emotions_v2/deck.json
git commit -m "content(emotions_v2): wire situation_intro and emotion_situation modes, bump v1.4.0"
```

---

### Task 5: Rebuild the ZIP, bump the catalog, and deploy

**Files:**
- Modify: `public/decks/catalog.json`
- Create: `public/decks/emotions_v2_v1.4.0.zip`
- Modify: `tools/emotions_v2/emotions_v2.zip`

- [ ] **Step 1: Rebuild**

```bash
node tools/emotions_v2/build.mjs
cp tools/emotions_v2/emotions_v2.zip public/decks/emotions_v2_v1.4.0.zip
```

- [ ] **Step 2: Update `public/decks/catalog.json`**

Update the `emotions_v2` entry's `version` to `1.4.0` and `url` to `./decks/emotions_v2_v1.4.0.zip`.

- [ ] **Step 3: Commit**

```bash
git add tools/emotions_v2/emotions_v2.zip public/decks/emotions_v2_v1.4.0.zip public/decks/catalog.json
git commit -m "content(emotions_v2): rebuild deck v1.4.0 with situation_intro and emotion_situation"
```

- [ ] **Step 4: Check for concurrent-session dirty state, confirm with the user, then deploy**

```bash
git status --short
```

If an unrelated file is dirty (not part of this feature), stash it (`git stash push -- <file>`) before deploying and restore it (`git stash pop`) immediately after. Ask the user to confirm before running:

```bash
npm run deploy:prod -- --allow-dirty
npm run deploy:verify
```

---

### Task 6: End-to-end verification

**Files:** none modified — verification only.

- [ ] **Step 1: Run the full relevant vitest suite**

```bash
npx vitest run --dir src src/topics/renderers/flashcards/engine.test.js src/topics/renderers/flashcards/situationIntro.smoke.test.jsx src/topics/renderers/flashcards/situationEmotion.smoke.test.jsx src/topics/renderers/flashcards/emotionSituation.smoke.test.jsx
```

Expected: all pass.

- [ ] **Step 2: Verify against the real deck.json content**

```bash
node -e '
const data = require("./tools/emotions_v2/deck.json");
const situations = data.cards.filter((c) => c.cardType === "situation");
console.log("situation cards:", situations.length);
console.log("modes:", data.modes.map((m) => m.id));
'
```

Expected: `situation cards: 18`, `modes:` includes `situation_intro`, `situation_emotion`, `emotion_situation` alongside the original 6.

- [ ] **Step 3: Report results to the user**

Summarize pass/fail. If everything passes, the feature is complete.
