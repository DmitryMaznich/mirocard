# Design: "Ситуация → эмоция" — practical mode for the emotions_v2 topic

## Problem

`emotions_v2` (`public/decks/emotions_v2_v1.2.0.zip`) currently teaches pure
recognition: 10 basic emotions × 5 visual variations (photo, illustration,
cartoon, schematic) = 50 cards, exercised only through the standard shared
flashcards modes (intro, find_n, yes_no, choose_word_by_picture, choose_all,
question_answer). Every task boils down to "what emotion is this picture?" —
there is no situational/causal reasoning ("what would this person feel?").
For an 11-year-old with autism spectrum disorder, labeling a face is the
easy end of emotion recognition; connecting a situation to an emotion is the
practically valuable skill this mode adds.

## Content

Text-only situation prompts (no new illustrations), covering 6 of the 10
existing emotion concepts to start, 3 situations each (school/friends/family
contexts suited to an 11-year-old), 18 cards total:

**Радость (joy)**
1. Друг пригласил тебя в гости поиграть в новую игру.
2. Учительница похвалила тебя перед всем классом за хорошую работу.
3. Ты наконец прошёл уровень в игре, который не получался целую неделю.

**Грусть (sadness)**
1. Твой лучший друг переехал в другой город.
2. Ты забыл дома тетрадь с домашним заданием, и учитель поставил замечание.
3. Дождь испортил прогулку, которую ты ждал весь день.

**Злость (anger)**
1. Младший брат сломал твою модель, которую ты собирал два часа.
2. Одноклассник взял твою вещь без разрешения и не хочет отдавать.
3. Тебя обвинили в том, чего ты не делал.

**Страх (fear)**
1. Свет в комнате внезапно погас, и стало совсем темно.
2. Завтра контрольная работа, а ты ничего не повторил.
3. Собака соседей громко залаяла и побежала в твою сторону.

**Удивление (surprise)**
1. Ты открыл дверь, а там друзья устроили тебе сюрприз на день рождения.
2. Учитель неожиданно отменил контрольную работу.
3. Ты нашёл под кроватью старую игрушку, о которой совсем забыл.

**Спокойствие (calm)**
1. Ты лежишь в кровати вечером и слушаешь тихую музыку.
2. Все уроки сделаны, и впереди целый свободный вечер.
3. Ты гуляешь в парке, и вокруг тихо и спокойно.

`disgust`, `shame`, `boredom`, `tiredness` are left for a later round —
starting smaller per explicit request, and shame/disgust situations need
more careful wording than a first pass should risk.

## Architecture

### Reusing find_n's UI as-is

`FindNTask` (`src/topics/renderers/flashcards/index.jsx:198`) renders
`task.targetLabel` as a plain instruction string above a grid of picture
options — it has no assumption that the label is a single word. Setting
`targetLabel` to a full situation sentence instead of an emotion word works
with **zero renderer changes**: no new component, no new CSS. The task
shape produced is otherwise identical to a normal `find_n` task
(`{ type, targetConceptId, targetLabel, options: [{conceptId, card,
isTarget}] }`).

### The real constraint: keeping situation cards out of the other 6 modes

Situation cards need `conceptId` set to the target emotion (e.g. `"joy"`)
so a correct answer can be resolved and so `pickVariation`/distractor
selection can pull picture options from that same concept. But
`deriveConcepts` groups every card sharing a `conceptId` into one
`concept.cards` array indiscriminately, and the existing shared generators
(`generateIntroTasks`, `generateFindNTasks`, `generateYesNoTasks`,
`generateChooseWordTasks`, `generateChooseAllTasks` — all used by many
other topics, not just this one) have no notion of "this card isn't a
displayable picture/word variant." Left alone, a situation card would
surface as a broken, image-less option in the deck's other 6 modes.

Investigated and rejected: giving situation cards their own non-colliding
`conceptId` doesn't help — `deriveConcepts` would still turn each into its
own pseudo-concept that the generic modes iterate over just the same.

**Fix:** tag situation cards with `cardType: "situation"` and strip any
card carrying a truthy `cardType` from the concepts pool inside
`generateTasks` itself, once, before the dispatch switch — every mode
except the new one gets the filtered pool automatically:

```js
export function generateTasks(modeType, concepts, allCards, params = {}) {
  const displayConcepts = concepts.map((c) => {
    const displayCards = c.cards.filter((card) => !card.cardType);
    if (displayCards.length === c.cards.length) return c;
    return { ...c, cards: displayCards, primary: displayCards.find((card) => card.primary) ?? displayCards[0] ?? c.primary };
  });
  switch (modeType) {
    case "situation_emotion":      return generateSituationEmotionTasks(displayConcepts, allCards, params);
    case "intro":                  return generateIntroTasks(displayConcepts);
    // ...every other existing case, unchanged except now fed displayConcepts
  }
}
```

No existing topic anywhere in the app ever sets `cardType` on a card today,
so `displayConcepts` is byte-for-byte identical to `concepts` for every
topic except emotions_v2 once this ships — this is a strictly additive,
opt-in change with no risk to `symmetry_draw` (which uses an unrelated
`taskKind` field) or any other flashcards topic.

### New generator

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

Reuses `pickVariation`, `selectDistractorConceptIds`, `shuffle` — already
imported in `engine.js`, no new dependencies.

### One line in the FlashcardsRenderer dispatch

`TASK_RENDERERS` in `flashcards/index.jsx` maps `task.type` to a component;
`situation_emotion` isn't `find_n`, so it needs its own entry pointing at
the same component:

```js
const TASK_RENDERERS = {
  ...
  find_n:                 FindNTask,
  situation_emotion:      FindNTask,
  ...
};
```

### Mode entry and icon

New mode object in `deck.json`'s `modes` array:

```json
{
  "id": "situation_emotion",
  "type": "situation_emotion",
  "evaluation": "auto",
  "ui": {
    "title": "Ситуация → эмоция",
    "instruction": "Прочитай ситуацию и выбери подходящую эмоцию",
    "icon": "media/icons/flashcards_find_n.svg"
  }
}
```

`media/icons/flashcards_find_n.svg` is a **built-in** app asset
(`src/topics/builtinAssets.js`), not something that needs to ship inside
the emotions_v2 ZIP — `ModeIcon.jsx` falls back to
`getBuiltinTopicAsset()` when a topic doesn't carry the file itself, so
this works with zero new asset files. A distinct custom icon (like
`repeat_draw` got) can follow later if wanted; not needed for this first
pass.

## Necessary setup: this topic has no source tree in the repo

Unlike `symmetry_draw` (`tools/symmetry_draw/`), `emotions_v2` has **no**
unpacked source directory checked into this repo — only the built ZIP in
`public/decks/`. `deck.json` is confirmed to be the exact same manifest
schema as `topic.json` (`topicLoader.js:29` accepts either filename), so
before any content can be added, the current v1.2.0 ZIP must be unpacked
into a new `tools/emotions_v2/` source tree (deck.json + media/ + audio/)
with a small `build.mjs` (JSZip, mirroring the pattern in
`tools/symmetry_draw/build.mjs` and `scripts/build-word-formation-deck.mjs`)
so the deck has the same edit → rebuild → version-bump workflow as every
other topic going forward.

## Versioning and rollout

- Unpack v1.2.0 into `tools/emotions_v2/`, write `build.mjs`, verify it
  reproduces a byte-equivalent-content ZIP before making any content
  changes (proves the round-trip is safe).
- Add the 18 situation cards (`cardType: "situation"`) and the new mode
  entry to `deck.json`, bump `meta.version` to `1.3.0` (minor — new mode).
- Rebuild, copy to `public/decks/emotions_v2_v1.3.0.zip`, update
  `public/decks/catalog.json`, never overwrite the existing `v1.2.0` ZIP.

## Testing / verification plan

- Unit tests in `src/topics/renderers/flashcards/engine.test.js`: a mixed
  fixture (image cards + a `cardType: "situation"` card sharing a
  concept) proves (a) `find_n`/`intro`/etc. never receive the situation
  card as an option or a standalone task, and (b) `situation_emotion`
  produces one task per situation card with the situation text as
  `targetLabel` and the correct emotion concept present among shuffled
  options.
- Live check (temporary browser harness, deleted after use, same method
  used throughout `symmetry_draw`'s development): mount `FindNTask` with a
  real `situation_emotion` task built from the actual `deck.json` content,
  confirm the sentence renders as the instruction and tapping the correct
  emotion's picture fires `onCorrect`.
- Confirm the deck's other 6 existing modes still produce exactly the same
  task counts as before this change (regression check for the
  `displayConcepts` filtering).

## Out of scope

- Audio/TTS narration for situation text — the existing `find_n` component
  has no audio playback at all today (confirmed by reading
  `FindNTask.jsx`), so this doesn't regress anything; can be added later
  as a separate, deliberate enhancement if wanted.
- `disgust`, `shame`, `boredom`, `tiredness` situations — deferred to a
  follow-up round once this first batch is validated in use.
- The other two practical-value ideas raised earlier (emotion → coping
  strategy, self-recognition) — explicitly deferred; this spec covers only
  situation → emotion.
