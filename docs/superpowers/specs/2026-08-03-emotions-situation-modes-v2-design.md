# Design: three-mode situation/emotion loop for emotions_v2 (v2 revision)

## Problem

The first `situation_emotion` mode shipped as a single reinforcement drill
("read a situation, pick the emotion"). Feedback after review:

1. The situations were too elaborate for a first pass — need short, simple,
   literal wording suited to autism spectrum reading comprehension (no
   figurative language, no inferred/implied meaning).
2. A single drill mode isn't enough — the child needs a passive
   introduction step before being tested, and practice in **both**
   directions (situation → emotion, and the reverse, emotion → situation),
   not just one.

## Content — 18 simplified situations (replaces the v1 set)

Short (aim 3–6 words), literal, single unambiguous outcome, no figurative
language — same 6 emotions as before:

**Радость (joy)**
1. Друг подарил тебе игрушку.
2. Учитель тебя похвалил.
3. Ты выиграл в игру.

**Грусть (sadness)**
1. Друг переехал в другой город.
2. Ты потерял любимую игрушку.
3. Питомец заболел.

**Злость (anger)**
1. Брат сломал твою игрушку.
2. Друг взял твою вещь без спроса.
3. Тебя толкнули в очереди.

**Страх (fear)**
1. В комнате погас свет.
2. Рядом залаяла большая собака.
3. Загремел сильный гром.

**Удивление (surprise)**
1. Друзья устроили тебе сюрприз.
2. Ты нашёл деньги на полу.
3. Дверь открылась сама.

**Спокойствие (calm)**
1. Ты слушаешь тихую музыку.
2. Все дела сделаны.
3. Ты гуляешь в парке.

These replace the 18 `cardType: "situation"` cards' `label` text added in the
prior round (same 18 card `id`s, same `conceptId`/`answerKey`, just shorter
wording) — no new cards, no card count change.

## Architecture — three modes instead of one

### 1. "Знакомство" (`situation_intro`) — new, passive, no evaluation

Reads a situation, taps to reveal the matching emotion (image + word), taps
again to advance. Mirrors the deck's existing "Знакомство" mode
(`evaluation: "none"`, tap-anywhere-to-advance) but needs a genuinely new
small component — nothing existing does "show text, tap, reveal a
*different* card, tap again to advance." `IntroTask`
(`flashcards/index.jsx:43`) shows one card and advances on a single tap;
`QuestionAnswerTask` has a `revealed` state but reveals inline next to an
already-visible stimulus card, gated behind manual quality grading, not a
free tap.

New component, same file:

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

New generator in `engine.js`, mirrors `generateSituationEmotionTasks`'s
iteration but no distractors needed (nothing to evaluate):

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

`TASK_RENDERERS.situation_intro = SituationIntroTask`.

CSS: new `.situation-intro__reveal` / `.situation-intro__reveal--shown` in
`src/styles.css`, copying `.qa-reveal`/`.qa-reveal--shown`'s fade-in values
(opacity/translateY transition) — matches this codebase's established
per-family CSS duplication convention rather than cross-referencing another
mode's classes. `.session-hint` already exists and fits the "tap to reveal"
prompt without any new CSS.

### 2. "Ситуация → эмоция" (`situation_emotion`) — already built, content only

No architecture change. Only the 18 situation cards' `label` text changes
(see Content above).

### 3. "Эмоция → Ситуация" (`emotion_situation`) — new, reverse direction

Shows the emotion's own picture, child picks the matching situation
sentence from several text options. This is the exact shape
`ChooseWordTask` (`flashcards/index.jsx:226`) already renders — a stimulus
card via `CardArea`, then `task.options.map(o => <button>{o.label}</button>)`.
**Zero renderer changes needed** — same reuse pattern as `situation_emotion`
reusing `FindNTask`.

New generator, structurally the mirror of `generateSituationEmotionTasks`
but swapping which side is the stimulus and which is the options, matching
`generateChooseWordTasks`'s task shape (`{ type, conceptId, card,
options: [{label, conceptId, isTarget}] }`):

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

`TASK_RENDERERS.emotion_situation = ChooseWordTask`.

### Dispatch and mode entries

Add both new cases to `generateTasks`'s switch (`engine.js`), both fed the
same `displayConcepts` (cardType-filtered pool) established in the prior
round — no changes to that filtering logic, it already generalizes.

Three mode entries in `deck.json`, in this order (matches the pedagogical
progression — passive intro, then practice in each direction):
`situation_intro` → `situation_emotion` → `emotion_situation`, inserted
right after the existing `question_answer` mode (replacing the single
`situation_emotion` entry from the prior round with all three).

## Versioning and rollout

- `tools/emotions_v2/deck.json`: replace the 18 situation cards' `label`
  text, add 2 new mode entries (keep the existing `situation_emotion`
  entry, insert `situation_intro` before it and `emotion_situation` after
  it), bump `meta.version` to `1.4.0` (minor — new modes).
- `src/topics/renderers/flashcards/engine.js`: add
  `generateSituationIntroTasks`, `generateEmotionSituationTasks`, two new
  `switch` cases.
- `src/topics/renderers/flashcards/index.jsx`: add `SituationIntroTask`,
  two new `TASK_RENDERERS` entries.
- `src/styles.css`: add the `.situation-intro__reveal` rules.
- Rebuild, copy to `public/decks/emotions_v2_v1.4.0.zip`, bump
  `catalog.json`.

## Testing / verification plan

- Unit tests in `engine.test.js`: `situation_intro` produces one
  no-evaluation task per situation card with `situationText`/`card`/`label`
  populated; `emotion_situation` produces one task per situation card whose
  options are situation sentences (not emotion words), with exactly one
  `isTarget: true` matching the source situation card's own text.
- Smoke tests (same pattern as `situationEmotion.smoke.test.jsx`, mounting
  the real `FlashcardsRenderer`): `SituationIntroTask` shows the situation
  text first, hides the emotion card until the first tap, reveals it after,
  and calls `onAdvance` only on the second tap. `emotion_situation` mounted
  through the real (unmodified) `ChooseWordTask` renders situation
  sentences as clickable options and fires `onCorrect`/`onIncorrect`
  correctly.
- Content check: verify every one of the 18 situation cards' new `label`
  text is ≤ 6 words (mirrors the "short, simple lexicon" requirement as a
  concrete, checkable constraint).

## Out of scope

- No changes to the `variation_character` image cleanup from the prior
  round.
- `disgust`, `shame`, `boredom`, `tiredness` situations — still deferred.
- No audio/TTS for situation text, consistent with the prior round's
  decision (mirrors `find_n`'s existing no-audio behavior).
