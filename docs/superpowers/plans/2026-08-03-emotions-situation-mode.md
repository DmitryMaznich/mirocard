# "Ситуация → эмоция" (situation_emotion mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "situation → emotion" mode to the `emotions_v2` flashcards topic, reusing the existing `find_n` UI unmodified, without letting the new situation-prompt cards leak into the topic's other 6 shared modes.

**Architecture:** Situation cards get a new `cardType: "situation"` field. `generateTasks` in the shared `flashcards/engine.js` strips any `cardType`-tagged card from the concepts pool before every existing mode's generator runs, then builds `find_n`-shaped tasks from the situation cards for the new mode via a dedicated `generateSituationEmotionTasks` generator. `TASK_RENDERERS` maps the new task type straight to the existing `FindNTask` component — no new renderer code. `emotions_v2` currently has no source tree in this repo (only the built ZIP), so the first task establishes one.

**Tech Stack:** Same shared `flashcards` renderer/engine used by every flashcards topic in the app; Vitest for the engine; JSZip via a new `tools/emotions_v2/build.mjs` (mirrors `tools/sentence_puzzle/build.mjs`'s directory-walk pattern) for packaging.

## Global Constraints

- `cardType` must never be set on any existing topic's cards — this change must be a strict no-op for every flashcards topic other than `emotions_v2` once it ships. Verify this explicitly (Task 2).
- Version must be bumped simultaneously in `deck.json` meta.version, `catalog.json`, and the ZIP filename — never overwrite the existing `emotions_v2_v1.2.0.zip`.
- `npm run deploy:prod` auto-bumps the app's own patch version; dirty-worktree deploys need `--allow-dirty`, only after explicit user confirmation. This repo has a known recurring situation where a concurrent session leaves an uncommitted, unrelated change in `src/features/session/useSessionEngine.js` and/or `column_addition/*` — check `git status` before every deploy in this plan; if that foreign change is present, `git stash push -- <that file>` before deploying and `git stash pop` immediately after (established pattern from this same project, confirmed safe twice already).
- Vitest test discovery must be scoped: `npx vitest run --dir src <exact file path>` (stray duplicate-`src` directories elsewhere in the repo otherwise pollute discovery).
- Any throwaway browser-verification HTML/JS files must be deleted before that task's commit.

---

### Task 1: Establish the tools/emotions_v2/ source tree

**Files:**
- Create: `tools/emotions_v2/deck.json`, `tools/emotions_v2/media/*` (50 files), `tools/emotions_v2/audio/*` (10 files)
- Create: `tools/emotions_v2/build.mjs`

**Interfaces:**
- Consumes: the existing `public/decks/emotions_v2_v1.2.0.zip`.
- Produces: `tools/emotions_v2/emotions_v2.zip` (build artifact) that Task 4 copies to a new versioned public filename. No code interface — this is a content/tooling task.

- [ ] **Step 1: Extract the current deck into the new source tree**

```bash
mkdir -p tools/emotions_v2
node -e "
const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');
(async () => {
  const zip = await JSZip.loadAsync(fs.readFileSync('public/decks/emotions_v2_v1.2.0.zip'));
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const outPath = path.join('tools/emotions_v2', name);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, await entry.async('nodebuffer'));
  }
  console.log('extracted', Object.keys(zip.files).filter((n) => !zip.files[n].dir).length, 'files');
})();
"
```

Expected output: `extracted 62 files` (1 `deck.json` + 50 `media/*` + 10 `audio/*` + `generation-report.json`, which is not needed for the deck to function but is harmless to keep as a record of how the deck was originally generated).

- [ ] **Step 2: Write the build script**

Create `tools/emotions_v2/build.mjs`:

```js
import JSZip from "jszip";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const zip = new JSZip();

zip.file("deck.json", readFileSync(join(dir, "deck.json")));

for (const file of readdirSync(join(dir, "media"))) {
  zip.file(`media/${file}`, readFileSync(join(dir, "media", file)));
}
for (const file of readdirSync(join(dir, "audio"))) {
  zip.file(`audio/${file}`, readFileSync(join(dir, "audio", file)));
}

const output = join(dir, "emotions_v2.zip");
writeFileSync(output, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
console.log(`Built ${output}`);
```

- [ ] **Step 3: Build and verify a byte-perfect round trip against the original ZIP**

```bash
node tools/emotions_v2/build.mjs
```

Expected: `Built .../tools/emotions_v2/emotions_v2.zip`

```bash
node -e "
const JSZip = require('jszip');
const fs = require('fs');
(async () => {
  const original = await JSZip.loadAsync(fs.readFileSync('public/decks/emotions_v2_v1.2.0.zip'));
  const rebuilt  = await JSZip.loadAsync(fs.readFileSync('tools/emotions_v2/emotions_v2.zip'));
  const origNames = Object.keys(original.files).filter((n) => !original.files[n].dir && n !== 'generation-report.json').sort();
  const newNames  = Object.keys(rebuilt.files).filter((n) => !rebuilt.files[n].dir).sort();
  const missing = origNames.filter((n) => !newNames.includes(n));
  const extra   = newNames.filter((n) => !origNames.includes(n));
  const mismatched = [];
  for (const name of origNames) {
    if (!newNames.includes(name)) continue;
    const a = await original.files[name].async('nodebuffer');
    const b = await rebuilt.files[name].async('nodebuffer');
    if (!a.equals(b)) mismatched.push(name);
  }
  console.log(JSON.stringify({ origCount: origNames.length, newCount: newNames.length, missing, extra, mismatched }));
})();
"
```

Expected: `{"origCount":61,"newCount":61,"missing":[],"extra":[],"mismatched":[]}` (61 = 1 deck.json + 50 media + 10 audio; `generation-report.json` is intentionally excluded from this comparison since Step 2's `build.mjs` doesn't package it — it's a historical artifact, not something the app reads). A non-empty `mismatched`/`missing`/`extra` means the build script has a bug — fix before continuing; do not proceed to content changes on top of an unverified round trip.

- [ ] **Step 4: Commit**

```bash
git add tools/emotions_v2/
git commit -m "chore(emotions_v2): establish source tree and build script from v1.2.0"
```

---

### Task 2: Add cardType-scoped situation_emotion generator to the flashcards engine

**Files:**
- Modify: `src/topics/renderers/flashcards/engine.js`
- Modify: `src/topics/renderers/flashcards/engine.test.js`
- Modify: `src/topics/renderers/flashcards/index.jsx`

**Interfaces:**
- Consumes: `deriveConcepts`, `pickVariation`, `selectDistractorConceptIds`, `shuffle` (all already imported in `engine.js`).
- Produces: `generateTasks("situation_emotion", concepts, allCards, params)` → tasks shaped `{ type: "situation_emotion", targetConceptId, targetLabel, options: [{conceptId, card, isTarget}] }`. Every other `generateTasks(modeType, ...)` call now receives a `cardType`-filtered concepts pool internally, with identical output to before for any card that never sets `cardType`.

- [ ] **Step 1: Write the failing tests**

Add to `src/topics/renderers/flashcards/engine.test.js`, after the existing `describe("generateTasks — mirror_draw / repeat_draw", ...)` block:

```js
describe("generateTasks — situation_emotion", () => {
  const EMOTION_CARDS = [
    { id: "joy_1", conceptId: "joy", primary: true, label: "радость", image: "media/joy_1.webp" },
    { id: "joy_2", conceptId: "joy", primary: false, image: "media/joy_2.webp" },
    { id: "joy_situation_1", conceptId: "joy", cardType: "situation", label: "Друг подарил тебе подарок." },
    { id: "sad_1", conceptId: "sadness", primary: true, label: "грусть", image: "media/sad_1.webp" },
    { id: "sad_situation_1", conceptId: "sadness", cardType: "situation", label: "Твой друг уехал." },
    { id: "anger_1", conceptId: "anger", primary: true, label: "злость", image: "media/anger_1.webp" },
  ];
  const EMOTION_CONCEPTS = deriveConcepts(EMOTION_CARDS);

  it("produces one task per situation card, with the situation text as targetLabel", () => {
    const tasks = generateTasks("situation_emotion", EMOTION_CONCEPTS, EMOTION_CARDS, {});
    expect(tasks).toHaveLength(2);
    const joyTask = tasks.find((t) => t.targetConceptId === "joy");
    expect(joyTask).toMatchObject({ type: "situation_emotion", targetLabel: "Друг подарил тебе подарок." });
  });

  it("options include the correct emotion concept and never a situation card", () => {
    const tasks = generateTasks("situation_emotion", EMOTION_CONCEPTS, EMOTION_CARDS, { optionCount: 3 });
    for (const task of tasks) {
      expect(task.options.some((o) => o.conceptId === task.targetConceptId && o.isTarget)).toBe(true);
      expect(task.options.every((o) => o.card.cardType !== "situation")).toBe(true);
    }
  });

  it("situation cards never appear as a picture option or a standalone task in the other modes", () => {
    const introTasks = generateTasks("intro", EMOTION_CONCEPTS, EMOTION_CARDS, {});
    expect(introTasks.every((t) => t.card.cardType !== "situation")).toBe(true);
    expect(introTasks).toHaveLength(4); // joy_1, joy_2, sad_1, anger_1 - situation cards excluded

    const findNTasks = generateTasks("find_n", EMOTION_CONCEPTS, EMOTION_CARDS, { optionCount: 3 });
    for (const task of findNTasks) {
      expect(task.options.every((o) => o.card.cardType !== "situation")).toBe(true);
    }
  });

  it("a topic with no cardType field anywhere is completely unaffected (regression guard)", () => {
    const PLAIN_CARDS = [
      { id: "t1", conceptId: "tshirt", primary: true, label: "футболка", image: "media/t1.webp" },
      { id: "j1", conceptId: "jacket", primary: true, label: "куртка", image: "media/j1.webp" },
    ];
    const PLAIN_CONCEPTS = deriveConcepts(PLAIN_CARDS);
    const before = generateTasks("intro", PLAIN_CONCEPTS, PLAIN_CARDS, {});
    expect(before).toHaveLength(2);
    expect(before.map((t) => t.card.id).sort()).toEqual(["j1", "t1"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --dir src src/topics/renderers/flashcards/engine.test.js`
Expected: FAIL — `generateTasks("situation_emotion", ...)` hits the `default: return [];` branch (0 tasks, not 2); the "other modes" test fails because `intro`/`find_n` currently have no `cardType` filtering at all, so situation cards leak straight through as broken picture-less options.

- [ ] **Step 3: Add the cardType filter and the new generator to engine.js**

In `src/topics/renderers/flashcards/engine.js`, add this function right after the existing `generateRepeatDrawTasks` (added in the prior `symmetry_draw` work):

```js
function generateSituationEmotionTasks(displayConcepts, allCards, params) {
  const optionCount = params.optionCount ?? 4;
  const difficulty = params.distractorLevel ?? "medium";
  const situationCards = allCards.filter((c) => c.cardType === "situation");
  const tasks = [];
  for (const situationCard of situationCards) {
    const targetConcept = displayConcepts.find((c) => c.conceptId === situationCard.conceptId);
    if (!targetConcept) continue;
    const distractorCount = Math.min(optionCount - 1, displayConcepts.length - 1);
    const distractorIds = selectDistractorConceptIds(situationCard.conceptId, displayConcepts, distractorCount, difficulty);
    const distractorOptions = distractorIds.map((cid) => {
      const dc = displayConcepts.find((c) => c.conceptId === cid);
      return { conceptId: cid, card: pickVariation(dc), isTarget: false };
    });
    const targetOption = { conceptId: situationCard.conceptId, card: pickVariation(targetConcept), isTarget: true };
    tasks.push({
      type: "situation_emotion",
      targetConceptId: situationCard.conceptId,
      targetLabel: situationCard.label,
      options: shuffle([targetOption, ...distractorOptions]),
    });
  }
  return shuffle(tasks);
}
```

Then replace the `generateTasks` export (find the `export function generateTasks(modeType, concepts, allCards, params = {}) {` block) with:

```js
export function generateTasks(modeType, concepts, allCards, params = {}) {
  // Cards tagged with a cardType (e.g. "situation") aren't an ordinary
  // picture/word variation and must never surface as one - strip them from
  // every mode's card pool except the mode built specifically to consume
  // them. A card that never sets cardType passes through unchanged, so this
  // is a no-op for every flashcards topic other than emotions_v2.
  const displayConcepts = concepts.map((c) => {
    const displayCards = c.cards.filter((card) => !card.cardType);
    if (displayCards.length === c.cards.length) return c;
    return { ...c, cards: displayCards, primary: displayCards.find((card) => card.primary) ?? displayCards[0] ?? c.primary };
  });
  switch (modeType) {
    case "intro":                  return generateIntroTasks(displayConcepts);
    case "mirror_draw":            return generateMirrorDrawTasks(displayConcepts);
    case "repeat_draw":            return generateRepeatDrawTasks(displayConcepts);
    case "situation_emotion":      return generateSituationEmotionTasks(displayConcepts, allCards, params);
    case "question_answer":        return generateIntroTasks(displayConcepts).map((t) => ({ ...t, type: "question_answer" }));
    case "yes_no":                 return generateYesNoTasks(displayConcepts, params);
    case "find_n":                 return generateFindNTasks(displayConcepts, params);
    case "choose_word_by_picture": return generateChooseWordTasks(displayConcepts, params);
    case "choose_all":             return generateChooseAllTasks(displayConcepts, params);
    default:                       return [];
  }
}
```

- [ ] **Step 4: Register the new task type in TASK_RENDERERS**

In `src/topics/renderers/flashcards/index.jsx`, find:

```js
const TASK_RENDERERS = {
  intro:                  IntroTask,
  question_answer:        QuestionAnswerTask,
  yes_no:                 YesNoTask,
  find_n:                 FindNTask,
  choose_word_by_picture: ChooseWordTask,
  choose_all:             ChooseAllTask,
};
```

Replace with:

```js
const TASK_RENDERERS = {
  intro:                  IntroTask,
  question_answer:        QuestionAnswerTask,
  yes_no:                 YesNoTask,
  find_n:                 FindNTask,
  situation_emotion:      FindNTask,
  choose_word_by_picture: ChooseWordTask,
  choose_all:             ChooseAllTask,
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run --dir src src/topics/renderers/flashcards/engine.test.js`
Expected: PASS (all tests in the file, including the 4 new ones and every pre-existing test — `intro`/`yes_no`/`mirror_draw`/`repeat_draw`/etc. — since none of their fixtures ever set `cardType`, `displayConcepts` is a no-op for them).

- [ ] **Step 6: Commit**

```bash
git add src/topics/renderers/flashcards/engine.js src/topics/renderers/flashcards/engine.test.js src/topics/renderers/flashcards/index.jsx
git commit -m "feat(flashcards): add cardType-scoped situation_emotion task generator"
```

---

### Task 3: Add the 18 situation cards and the situation_emotion mode to deck.json

**Files:**
- Modify: `tools/emotions_v2/deck.json`

**Interfaces:**
- Consumes: the `cardType`/mode-type conventions established in Task 2.
- Produces: the actual content Task 2's generator reads at runtime.

- [ ] **Step 1: Append the new mode entry**

In `tools/emotions_v2/deck.json`, add this object to the `modes` array, after the existing `question_answer` mode (the array's current last entry):

```json
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
    }
```

- [ ] **Step 2: Append the 18 situation cards**

Add these objects to the end of the `cards` array in `tools/emotions_v2/deck.json` (each `conceptId` matches an existing emotion concept already present in the deck; `answerKey` matches that concept's own `answerKey`/`label` convention):

```json
    {
      "id": "situation_joy_1",
      "conceptId": "joy",
      "cardType": "situation",
      "label": "Друг пригласил тебя в гости поиграть в новую игру.",
      "answerKey": "радость"
    },
    {
      "id": "situation_joy_2",
      "conceptId": "joy",
      "cardType": "situation",
      "label": "Учительница похвалила тебя перед всем классом за хорошую работу.",
      "answerKey": "радость"
    },
    {
      "id": "situation_joy_3",
      "conceptId": "joy",
      "cardType": "situation",
      "label": "Ты наконец прошёл уровень в игре, который не получался целую неделю.",
      "answerKey": "радость"
    },
    {
      "id": "situation_sadness_1",
      "conceptId": "sadness",
      "cardType": "situation",
      "label": "Твой лучший друг переехал в другой город.",
      "answerKey": "грусть"
    },
    {
      "id": "situation_sadness_2",
      "conceptId": "sadness",
      "cardType": "situation",
      "label": "Ты забыл дома тетрадь с домашним заданием, и учитель поставил замечание.",
      "answerKey": "грусть"
    },
    {
      "id": "situation_sadness_3",
      "conceptId": "sadness",
      "cardType": "situation",
      "label": "Дождь испортил прогулку, которую ты ждал весь день.",
      "answerKey": "грусть"
    },
    {
      "id": "situation_anger_1",
      "conceptId": "anger",
      "cardType": "situation",
      "label": "Младший брат сломал твою модель, которую ты собирал два часа.",
      "answerKey": "злость"
    },
    {
      "id": "situation_anger_2",
      "conceptId": "anger",
      "cardType": "situation",
      "label": "Одноклассник взял твою вещь без разрешения и не хочет отдавать.",
      "answerKey": "злость"
    },
    {
      "id": "situation_anger_3",
      "conceptId": "anger",
      "cardType": "situation",
      "label": "Тебя обвинили в том, чего ты не делал.",
      "answerKey": "злость"
    },
    {
      "id": "situation_fear_1",
      "conceptId": "fear",
      "cardType": "situation",
      "label": "Свет в комнате внезапно погас, и стало совсем темно.",
      "answerKey": "страх"
    },
    {
      "id": "situation_fear_2",
      "conceptId": "fear",
      "cardType": "situation",
      "label": "Завтра контрольная работа, а ты ничего не повторил.",
      "answerKey": "страх"
    },
    {
      "id": "situation_fear_3",
      "conceptId": "fear",
      "cardType": "situation",
      "label": "Собака соседей громко залаяла и побежала в твою сторону.",
      "answerKey": "страх"
    },
    {
      "id": "situation_surprise_1",
      "conceptId": "surprise",
      "cardType": "situation",
      "label": "Ты открыл дверь, а там друзья устроили тебе сюрприз на день рождения.",
      "answerKey": "удивление"
    },
    {
      "id": "situation_surprise_2",
      "conceptId": "surprise",
      "cardType": "situation",
      "label": "Учитель неожиданно отменил контрольную работу.",
      "answerKey": "удивление"
    },
    {
      "id": "situation_surprise_3",
      "conceptId": "surprise",
      "cardType": "situation",
      "label": "Ты нашёл под кроватью старую игрушку, о которой совсем забыл.",
      "answerKey": "удивление"
    },
    {
      "id": "situation_calm_1",
      "conceptId": "calm",
      "cardType": "situation",
      "label": "Ты лежишь в кровати вечером и слушаешь тихую музыку.",
      "answerKey": "спокойствие"
    },
    {
      "id": "situation_calm_2",
      "conceptId": "calm",
      "cardType": "situation",
      "label": "Все уроки сделаны, и впереди целый свободный вечер.",
      "answerKey": "спокойствие"
    },
    {
      "id": "situation_calm_3",
      "conceptId": "calm",
      "cardType": "situation",
      "label": "Ты гуляешь в парке, и вокруг тихо и спокойно.",
      "answerKey": "спокойствие"
    }
```

- [ ] **Step 3: Bump the deck version**

In `tools/emotions_v2/deck.json`, change:

```json
    "version": "1.2.0",
```

to:

```json
    "version": "1.3.0",
```

- [ ] **Step 4: Verify the JSON is well-formed and correctly wired**

```bash
node -e '
const data = require("./tools/emotions_v2/deck.json");
const situationCards = data.cards.filter((c) => c.cardType === "situation");
const byEmotion = {};
for (const c of situationCards) byEmotion[c.conceptId] = (byEmotion[c.conceptId] ?? 0) + 1;
console.log("total cards:", data.cards.length, "situation cards:", situationCards.length);
console.log("per emotion:", JSON.stringify(byEmotion));
console.log("modes:", data.modes.map((m) => `${m.id}:${m.type}`));
console.log("version:", data.meta.version);
'
```

Expected:
```
total cards: 68 situation cards: 18
per emotion: {"joy":3,"sadness":3,"anger":3,"fear":3,"surprise":3,"calm":3}
modes: [ 'intro:intro', 'find_n:find_n', 'yes_no:yes_no', 'choose_word_by_picture:choose_word_by_picture', 'choose_all:choose_all', 'question_answer:question_answer', 'situation_emotion:situation_emotion' ]
version: 1.3.0
```

- [ ] **Step 5: Commit**

```bash
git add tools/emotions_v2/deck.json
git commit -m "content(emotions_v2): add 18 situation cards and the situation_emotion mode"
```

---

### Task 4: Rebuild the ZIP, bump the catalog, and deploy

**Files:**
- Modify: `public/decks/catalog.json`
- Create: `public/decks/emotions_v2_v1.3.0.zip`
- Modify: `tools/emotions_v2/emotions_v2.zip` (build artifact)

**Interfaces:**
- Consumes: the finished `tools/emotions_v2/deck.json` (v1.3.0) from Task 3.
- Produces: a deployed, publicly-servable topic update.

- [ ] **Step 1: Rebuild the ZIP**

```bash
node tools/emotions_v2/build.mjs
```

Expected: `Built .../tools/emotions_v2/emotions_v2.zip`

- [ ] **Step 2: Copy to the versioned public deck filename**

```bash
cp tools/emotions_v2/emotions_v2.zip public/decks/emotions_v2_v1.3.0.zip
```

- [ ] **Step 3: Update `public/decks/catalog.json`**

Find the `emotions_v2` entry and update its `version`/`url`/`zipUrl` fields to `1.3.0` / `./decks/emotions_v2_v1.3.0.zip` / `emotions_v2_v1.3.0.zip`, following the exact same field-replacement pattern used for every prior `symmetry_draw` version bump in this project.

- [ ] **Step 4: Commit**

```bash
git add tools/emotions_v2/emotions_v2.zip public/decks/emotions_v2_v1.3.0.zip public/decks/catalog.json
git commit -m "content(emotions_v2): rebuild deck v1.3.0 with the situation_emotion mode"
```

- [ ] **Step 5: Check for the known concurrent-session dirty state before deploying**

```bash
git status --short
```

If `src/features/session/useSessionEngine.js` (or any other file not part of this feature) shows as modified and it isn't yours, stash it before deploying and restore it after:

```bash
git stash push -m "wip: concurrent session's change (not mine, stashed before deploy)" -- src/features/session/useSessionEngine.js
```

- [ ] **Step 6: Confirm with the user, then deploy**

Ask the user to confirm before running (the worktree is dirty from the known pre-existing unrelated `column_addition` files regardless of the stash above):

```bash
npm run deploy:prod -- --allow-dirty
npm run deploy:verify
```

Both the public and LAN URLs must report the new app version.

- [ ] **Step 7: Restore the stashed change, if any was stashed in Step 5**

```bash
git stash pop
```

---

### Task 5: End-to-end verification

**Files:** none modified — verification only.

- [ ] **Step 1: Run the full relevant vitest suite**

```bash
npx vitest run --dir src src/topics/renderers/flashcards/engine.test.js src/topics/topicLoader.test.js
```

Expected: all pass except the already-known pre-existing unrelated `addition_subtraction` mode-order failure (confirmed pre-existing multiple times earlier in this project's history — do not attempt to fix it as part of this feature).

- [ ] **Step 2: Live browser check — situation_emotion renders and evaluates correctly**

Using a temporary React-mount harness (same pattern used throughout this project's `symmetry_draw` work, deleted after use): build one real `situation_emotion` task from the actual `tools/emotions_v2/deck.json` content via `generateTasks`, mount it through `FindNTask`, and confirm:
1. The situation sentence renders as the on-screen instruction (not an emotion word).
2. Tapping the picture option whose `conceptId` matches `task.targetConceptId` fires `onCorrect`.
3. Tapping any other option fires `onIncorrect`.

- [ ] **Step 3: Live browser check — the other 6 modes are unaffected**

Using the same harness technique, call `generateTasks` for `intro`, `find_n`, `yes_no`, `choose_word_by_picture`, `choose_all`, and `question_answer` against the real (now 68-card) `deck.json` content, and confirm:
- Task counts match what they were before this change (50 image cards' worth — situation cards excluded from every one of these).
- No task's `card`/options ever includes a card with `cardType === "situation"`.

- [ ] **Step 4: Report results to the user**

Summarize pass/fail for each check above. If everything passes, the feature is complete.
