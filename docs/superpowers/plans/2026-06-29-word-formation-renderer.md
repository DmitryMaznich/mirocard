# Word Formation (Словообразование) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `word_formation` built-in renderer for teaching relative adjective formation from nouns, using soup pairs (суп из рыбы → рыбный суп). 4 modes: pair_intro, form_it, yes_no, question_ask.

**Architecture:** New built-in renderer registered in `src/topics/registry.js` and `src/topics/renderers/engineRegistry.js`, following the `opposites` pattern. Each concept card is a flat object with both language forms (nounPhrase + adjPhrase) and difficulty. Engine generates task objects; React components render them. Deck packaged as ZIP (placeholder images) for immediate browser testing.

**Tech Stack:** React 18 (via `__Mirocard.React`), Vite, JSZip, `useTopicFile` hook, `useAudio` hook.

## Global Constraints

- Engine signature MUST be: `generateTasks(mode, cards, _sessionSize, params = {})`  — `mode` is the full mode object, `cards` is the flat array from `topic.json`
- Renderer default export props: `{ task, topicId, onAdvance, onCorrect, onIncorrect }`
- CSS class names prefixed `wf-` to avoid collisions with other renderers
- Wrong answer feedback: brief red flash on the button, NO penalty text, retry allowed (do NOT call `onIncorrect` on first wrong tap — just flash and re-enable)
- `yes_no` correct-phrase bias: show `isCorrect: true` in ~60% of tasks (not 50%) to reduce refusal-bias in ASD children
- Difficulty ordering: easy → medium → hard concepts in `pair_intro` and `question_ask`; shuffle within each level for `form_it` and `yes_no`
- Media loaded via `useTopicFile(topicId, path)` → blob URL (existing hook, no changes needed)
- Audio loaded via `playTopicFile(topicId, path)` from `useAudio()` hook
- All imports use `@/` alias (e.g. `@/shared/hooks/useTopicFile`)

---

### Task 1: Engine + Tests

**Files:**
- Create: `src/topics/renderers/word_formation/engine.js`
- Create: `src/topics/renderers/word_formation/engine.test.js`

**Interfaces:**
- Produces: `generateTasks(mode, cards, _sessionSize, params)` — consumed by `engineRegistry.js` and by tests

**Task shapes produced (used by Task 2–5 components):**

```js
// pair_intro — ONE task per session containing all concept cards
{ type: "pair_intro", cards: [/* all concepts, sorted easy→hard */] }

// form_it — one task per concept
{
  type: "form_it",
  conceptId: "ryba",
  stimulus: "phrase" | "image",      // resolved from params.stimulus
  stimulusImage: "media/ryba.webp",   // always present
  stimulusText: "суп из рыбы",        // always present (nounPhrase)
  stimulusAudio: "audio/ryba_noun.mp3",
  correctAdjPhrase: "рыбный суп",
  correctAudio: "audio/ryba_adj.mp3",
  options: [
    { adjPhrase: "рыбный суп", isTarget: true },
    { adjPhrase: "мясной суп", isTarget: false },
    // ... optionCount-1 distractors
  ]
}

// yes_no — repsPerConcept tasks per concept
{
  type: "yes_no",
  conceptId: "ryba",
  image: "media/ryba.webp",
  displayPhrase: "рыбный суп",   // correct or distractor adjPhrase
  isCorrect: true | false,
  correctAudio: "audio/ryba_adj.mp3",
}

// question_ask — one task per concept
{
  type: "question_ask",
  conceptId: "ryba",
  stimulusImage: "media/ryba.webp",
  stimulusText: "суп из рыбы",
  correctAdjPhrase: "рыбный суп",
}
```

- [ ] **Step 1: Write failing tests**

```js
// src/topics/renderers/word_formation/engine.test.js
import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine";

const CARDS = [
  { id: "ryba",     noun: "рыба",    nounPhrase: "суп из рыбы",    adjPhrase: "рыбный суп",    image: "media/ryba.webp",    audioNounPhrase: "audio/ryba_noun.mp3",    audioAdjPhrase: "audio/ryba_adj.mp3",    difficulty: "easy"   },
  { id: "myaso",    noun: "мясо",    nounPhrase: "суп из мяса",     adjPhrase: "мясной суп",    image: "media/myaso.webp",   audioNounPhrase: "audio/myaso_noun.mp3",   audioAdjPhrase: "audio/myaso_adj.mp3",   difficulty: "easy"   },
  { id: "grib",     noun: "гриб",    nounPhrase: "суп из грибов",   adjPhrase: "грибной суп",   image: "media/grib.webp",    audioNounPhrase: "audio/grib_noun.mp3",    audioAdjPhrase: "audio/grib_adj.mp3",    difficulty: "easy"   },
  { id: "kapusta",  noun: "капуста", nounPhrase: "суп из капусты",  adjPhrase: "капустный суп", image: "media/kapusta.webp", audioNounPhrase: "audio/kapusta_noun.mp3", audioAdjPhrase: "audio/kapusta_adj.mp3", difficulty: "easy"   },
  { id: "kuritsa",  noun: "курица",  nounPhrase: "суп из курицы",   adjPhrase: "куриный суп",   image: "media/kuritsa.webp", audioNounPhrase: "audio/kuritsa_noun.mp3", audioAdjPhrase: "audio/kuritsa_adj.mp3", difficulty: "medium" },
  { id: "goroh",    noun: "горох",   nounPhrase: "суп из гороха",   adjPhrase: "гороховый суп", image: "media/goroh.webp",   audioNounPhrase: "audio/goroh_noun.mp3",   audioAdjPhrase: "audio/goroh_adj.mp3",   difficulty: "medium" },
];

describe("pair_intro", () => {
  it("returns one task with all cards sorted easy→hard", () => {
    const tasks = generateTasks({ type: "pair_intro" }, CARDS, 6, {});
    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe("pair_intro");
    expect(tasks[0].cards).toHaveLength(6);
    expect(tasks[0].cards[0].difficulty).toBe("easy");
    expect(tasks[0].cards[tasks[0].cards.length - 1].difficulty).toBe("medium");
  });
});

describe("form_it", () => {
  it("returns one task per concept", () => {
    const tasks = generateTasks({ type: "form_it" }, CARDS, 6, { stimulus: "phrase", optionCount: 4 });
    expect(tasks).toHaveLength(6);
  });

  it("each task has a correct option", () => {
    const tasks = generateTasks({ type: "form_it" }, CARDS, 6, { stimulus: "phrase", optionCount: 4 });
    for (const task of tasks) {
      const correct = task.options.filter(o => o.isTarget);
      expect(correct).toHaveLength(1);
      expect(correct[0].adjPhrase).toBe(CARDS.find(c => c.id === task.conceptId).adjPhrase);
    }
  });

  it("stimulus phrase uses nounPhrase when params.stimulus is 'phrase'", () => {
    const tasks = generateTasks({ type: "form_it" }, CARDS, 6, { stimulus: "phrase", optionCount: 4 });
    expect(tasks[0].stimulus).toBe("phrase");
    expect(tasks[0].stimulusText).toBeTruthy();
  });

  it("stimulus image uses image when params.stimulus is 'image'", () => {
    const tasks = generateTasks({ type: "form_it" }, CARDS, 6, { stimulus: "image", optionCount: 4 });
    expect(tasks[0].stimulus).toBe("image");
    expect(tasks[0].stimulusImage).toBeTruthy();
  });

  it("mixed alternates stimuli", () => {
    const tasks = generateTasks({ type: "form_it" }, CARDS, 6, { stimulus: "mixed", optionCount: 4 });
    const stimuli = tasks.map(t => t.stimulus);
    expect(stimuli).toContain("phrase");
    expect(stimuli).toContain("image");
  });
});

describe("yes_no", () => {
  it("returns repsPerConcept tasks per concept", () => {
    const tasks = generateTasks({ type: "yes_no" }, CARDS, 6, { repsPerConcept: 2 });
    expect(tasks).toHaveLength(12);
  });

  it("roughly 60% of tasks are correct", () => {
    const tasks = generateTasks({ type: "yes_no" }, CARDS, 6, { repsPerConcept: 10 });
    const correctCount = tasks.filter(t => t.isCorrect).length;
    expect(correctCount).toBeGreaterThan(tasks.length * 0.4);
    expect(correctCount).toBeLessThan(tasks.length * 0.9);
  });
});

describe("question_ask", () => {
  it("returns one task per concept sorted easy→hard", () => {
    const tasks = generateTasks({ type: "question_ask" }, CARDS, 6, {});
    expect(tasks).toHaveLength(6);
    expect(tasks[0].difficulty).toBe("easy");
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```
npx vitest run src/topics/renderers/word_formation/engine.test.js
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement engine.js**

```js
// src/topics/renderers/word_formation/engine.js
import { shuffle } from "@/shared/utils/shuffle";

const DIFFICULTY_ORDER = { easy: 0, medium: 1, hard: 2 };

function sortByDifficulty(cards) {
  return [...cards].sort((a, b) =>
    (DIFFICULTY_ORDER[a.difficulty] ?? 99) - (DIFFICULTY_ORDER[b.difficulty] ?? 99)
  );
}

function pickDistractors(targetId, cards, count) {
  const others = cards.filter(c => c.id !== targetId);
  return shuffle(others).slice(0, count);
}

function generatePairIntroTasks(cards) {
  return [{ type: "pair_intro", cards: sortByDifficulty(cards) }];
}

function generateFormItTasks(cards, params) {
  const optionCount = params.optionCount ?? 4;
  const stimulusParam = params.stimulus ?? "mixed";
  const stimuli = shuffle(cards.map((_, i) =>
    stimulusParam === "mixed"
      ? (i % 2 === 0 ? "phrase" : "image")
      : stimulusParam
  ));

  return shuffle(cards.map((card, i) => {
    const distractors = pickDistractors(card.id, cards, Math.min(optionCount - 1, cards.length - 1));
    const options = shuffle([
      { adjPhrase: card.adjPhrase, isTarget: true },
      ...distractors.map(d => ({ adjPhrase: d.adjPhrase, isTarget: false })),
    ]);
    return {
      type: "form_it",
      conceptId: card.id,
      difficulty: card.difficulty,
      stimulus: stimuli[i],
      stimulusImage: card.image,
      stimulusText: card.nounPhrase,
      stimulusAudio: card.audioNounPhrase,
      correctAdjPhrase: card.adjPhrase,
      correctAudio: card.audioAdjPhrase,
      options,
    };
  }));
}

function generateYesNoTasks(cards, params) {
  const reps = params.repsPerConcept ?? 1;
  const tasks = [];
  for (const card of cards) {
    for (let i = 0; i < reps; i++) {
      const isCorrect = Math.random() < 0.6;
      let displayPhrase;
      if (isCorrect) {
        displayPhrase = card.adjPhrase;
      } else {
        const distractor = shuffle(cards.filter(c => c.id !== card.id))[0];
        displayPhrase = distractor?.adjPhrase ?? card.adjPhrase;
      }
      tasks.push({
        type: "yes_no",
        conceptId: card.id,
        image: card.image,
        displayPhrase,
        isCorrect: displayPhrase === card.adjPhrase,
        correctAudio: card.audioAdjPhrase,
      });
    }
  }
  return shuffle(tasks);
}

function generateQuestionAskTasks(cards) {
  return sortByDifficulty(cards).map(card => ({
    type: "question_ask",
    conceptId: card.id,
    difficulty: card.difficulty,
    stimulusImage: card.image,
    stimulusText: card.nounPhrase,
    correctAdjPhrase: card.adjPhrase,
  }));
}

export function generateTasks(mode, cards, _sessionSize, params = {}) {
  switch (mode.type) {
    case "pair_intro":   return generatePairIntroTasks(cards);
    case "form_it":      return generateFormItTasks(cards, params);
    case "yes_no":       return generateYesNoTasks(cards, params);
    case "question_ask": return generateQuestionAskTasks(cards);
    default:             return [];
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```
npx vitest run src/topics/renderers/word_formation/engine.test.js
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```
git add src/topics/renderers/word_formation/engine.js src/topics/renderers/word_formation/engine.test.js
git commit -m "feat(word-formation): engine with pair_intro, form_it, yes_no, question_ask"
```

---

### Task 2: PairIntroTask Component

**Files:**
- Create: `src/topics/renderers/word_formation/PairIntroTask.jsx`

**Interfaces:**
- Consumes: `task.cards` (array of concept cards, sorted easy→hard)
- Consumes: `topicId` (string), `onAdvance` (fn)
- Uses: `useTopicFile(topicId, path)`, `useAudio().playTopicFile`

- [ ] **Step 1: Create PairIntroTask.jsx**

```jsx
// src/topics/renderers/word_formation/PairIntroTask.jsx
import { useEffect, useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { useAudio } from "@/shared/hooks/useAudio";

function ConceptImage({ topicId, path }) {
  const url = useTopicFile(topicId, path);
  return url
    ? <img className="wf-pair__img" src={url} alt="" draggable={false} />
    : <div className="wf-pair__img wf-pair__img--loading" />;
}

export default function PairIntroTask({ task, topicId, onAdvance }) {
  const { cards } = task;
  const [index, setIndex]   = useState(0);
  const [arrowVisible, setArrowVisible] = useState(false);
  const { playTopicFile } = useAudio();

  const card = cards[index];
  const isLast = index === cards.length - 1;

  useEffect(() => {
    setArrowVisible(false);
    if (!card) return;
    // Play nounPhrase, then after 1.2s animate arrow + play adjPhrase
    playTopicFile(topicId, card.audioNounPhrase);
    const t = setTimeout(() => {
      setArrowVisible(true);
      playTopicFile(topicId, card.audioAdjPhrase);
    }, 1200);
    return () => clearTimeout(t);
  }, [index, card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNext() {
    if (!isLast) {
      setIndex(i => i + 1);
    } else {
      onAdvance();
    }
  }

  function handlePrev() {
    if (index > 0) setIndex(i => i - 1);
  }

  if (!card) return null;

  return (
    <div className="wf-pair">
      <div className="wf-pair__content">
        <div className="wf-pair__side">
          <ConceptImage topicId={topicId} path={card.image} />
          <div className="wf-pair__phrase wf-pair__phrase--noun">{card.nounPhrase}</div>
        </div>

        <div className={`wf-pair__arrow${arrowVisible ? " wf-pair__arrow--visible" : ""}`}>→</div>

        <div className={`wf-pair__side${arrowVisible ? "" : " wf-pair__side--hidden"}`}>
          <div className="wf-pair__adj-box">
            <span className="wf-pair__phrase wf-pair__phrase--adj">{card.adjPhrase}</span>
          </div>
        </div>
      </div>

      <div className="wf-pair__nav">
        <button className="wf-nav-btn" onClick={handlePrev} disabled={index === 0}>←</button>
        <span className="wf-pair__progress">{index + 1} / {cards.length}</span>
        <button className="wf-nav-btn wf-nav-btn--next" onClick={handleNext}>
          {isLast ? "Готово" : "→"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add src/topics/renderers/word_formation/PairIntroTask.jsx
git commit -m "feat(word-formation): PairIntroTask component"
```

---

### Task 3: FormItTask Component

**Files:**
- Create: `src/topics/renderers/word_formation/FormItTask.jsx`

**Interfaces:**
- Consumes: `task` shape from Task 1 (`form_it` type)
- Consumes: `topicId`, `onCorrect`, `onIncorrect`
- Uses: `useTopicFile`, `useAudio`

- [ ] **Step 1: Create FormItTask.jsx**

```jsx
// src/topics/renderers/word_formation/FormItTask.jsx
import { useEffect, useRef, useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { useAudio } from "@/shared/hooks/useAudio";

function StimulusImage({ topicId, path }) {
  const url = useTopicFile(topicId, path);
  return url
    ? <img className="wf-form__stimulus-img" src={url} alt="" draggable={false} />
    : <div className="wf-form__stimulus-img wf-form__stimulus-img--loading" />;
}

export default function FormItTask({ task, topicId, onCorrect, onIncorrect }) {
  const [answered, setAnswered] = useState(false);
  const [flash, setFlash]       = useState(null); // { adjPhrase, state: "correct"|"wrong" }
  const answeredRef = useRef(false);
  const { playTopicFile, playFeedback } = useAudio();

  useEffect(() => {
    setAnswered(false);
    setFlash(null);
    answeredRef.current = false;
    if (task.stimulus === "phrase") {
      playTopicFile(topicId, task.stimulusAudio);
    }
  }, [task.conceptId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleOption(opt) {
    if (answeredRef.current) return;
    if (opt.isTarget) {
      answeredRef.current = true;
      setAnswered(true);
      setFlash({ adjPhrase: opt.adjPhrase, state: "correct" });
      playFeedback("correct");
      playTopicFile(topicId, task.correctAudio);
      setTimeout(() => onCorrect(task.conceptId), 1000);
    } else {
      setFlash({ adjPhrase: opt.adjPhrase, state: "wrong" });
      playFeedback("incorrect");
      setTimeout(() => setFlash(null), 600);
    }
  }

  function buttonState(opt) {
    if (!flash || flash.adjPhrase !== opt.adjPhrase) return "idle";
    return flash.state;
  }

  return (
    <div className="wf-form">
      <div className="wf-form__stimulus">
        {task.stimulus === "image"
          ? <StimulusImage topicId={topicId} path={task.stimulusImage} />
          : (
            <div className="wf-form__stimulus-phrase">
              <span>{task.stimulusText}</span>
              <button
                className="wf-audio-btn"
                onClick={() => playTopicFile(topicId, task.stimulusAudio)}
                aria-label="Прослушать"
              >🔊</button>
            </div>
          )
        }
      </div>

      <div className="wf-form__options">
        {task.options.map((opt) => {
          const state = buttonState(opt);
          return (
            <button
              key={opt.adjPhrase}
              className={`wf-option wf-option--${state}`}
              onClick={() => handleOption(opt)}
              disabled={answered}
            >
              {opt.adjPhrase}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add src/topics/renderers/word_formation/FormItTask.jsx
git commit -m "feat(word-formation): FormItTask component"
```

---

### Task 4: YesNoTask + QuestionAskTask

**Files:**
- Create: `src/topics/renderers/word_formation/YesNoTask.jsx`
- Create: `src/topics/renderers/word_formation/QuestionAskTask.jsx`

- [ ] **Step 1: Create YesNoTask.jsx**

```jsx
// src/topics/renderers/word_formation/YesNoTask.jsx
import { useEffect, useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { useAudio } from "@/shared/hooks/useAudio";

function ConceptImage({ topicId, path }) {
  const url = useTopicFile(topicId, path);
  return url
    ? <img className="wf-yn__img" src={url} alt="" draggable={false} />
    : <div className="wf-yn__img wf-yn__img--loading" />;
}

export default function YesNoTask({ task, topicId, onCorrect, onIncorrect }) {
  const [answered, setAnswered] = useState(false);
  const [result, setResult]     = useState(null); // "correct" | "wrong"
  const { playTopicFile, playFeedback } = useAudio();

  useEffect(() => {
    setAnswered(false);
    setResult(null);
    playTopicFile(topicId, task.correctAudio);
  }, [task.conceptId, task.displayPhrase]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAnswer(userSaysYes) {
    if (answered) return;
    setAnswered(true);
    const isRight = userSaysYes === task.isCorrect;
    setResult(isRight ? "correct" : "wrong");
    playFeedback(isRight ? "correct" : "incorrect");
    setTimeout(() => {
      if (isRight) onCorrect(task.conceptId);
      else onIncorrect(task.conceptId);
    }, 900);
  }

  return (
    <div className="wf-yn">
      <div className="wf-yn__stimulus">
        <ConceptImage topicId={topicId} path={task.image} />
        <div className="wf-yn__phrase">{task.displayPhrase}</div>
      </div>

      <div className={`wf-yn__feedback wf-yn__feedback--${result ?? "idle"}`}>
        {result === "correct" && "✓"}
        {result === "wrong"   && "✗"}
      </div>

      <div className="wf-yn__buttons">
        <button
          className="wf-yn__btn wf-yn__btn--yes"
          onClick={() => handleAnswer(true)}
          disabled={answered}
        >
          ДА
        </button>
        <button
          className="wf-yn__btn wf-yn__btn--no"
          onClick={() => handleAnswer(false)}
          disabled={answered}
        >
          НЕТ
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create QuestionAskTask.jsx**

```jsx
// src/topics/renderers/word_formation/QuestionAskTask.jsx
import { useTopicFile } from "@/shared/hooks/useTopicFile";

function ConceptImage({ topicId, path }) {
  const url = useTopicFile(topicId, path);
  return url
    ? <img className="wf-qa__img" src={url} alt="" draggable={false} />
    : <div className="wf-qa__img wf-qa__img--loading" />;
}

export default function QuestionAskTask({ task, topicId, onAdvance, onCorrect }) {
  function handleCorrect() {
    onCorrect(task.conceptId);
  }

  function handleRetry() {
    // No state change — just let logopedist try again
  }

  return (
    <div className="wf-qa">
      <div className="wf-qa__instruction">Как называется суп?</div>

      <div className="wf-qa__stimulus">
        <ConceptImage topicId={topicId} path={task.stimulusImage} />
        <div className="wf-qa__noun-phrase">{task.stimulusText}</div>
      </div>

      <div className="wf-qa__answer-hint">
        <span className="wf-qa__arrow">→</span>
        <span className="wf-qa__adj-phrase">{task.correctAdjPhrase}</span>
      </div>

      <div className="wf-qa__buttons">
        <button className="wf-qa__btn wf-qa__btn--retry" onClick={handleRetry}>
          ↺ Ещё раз
        </button>
        <button className="wf-qa__btn wf-qa__btn--correct" onClick={handleCorrect}>
          ✓ Правильно
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```
git add src/topics/renderers/word_formation/YesNoTask.jsx src/topics/renderers/word_formation/QuestionAskTask.jsx
git commit -m "feat(word-formation): YesNoTask and QuestionAskTask components"
```

---

### Task 5: Renderer index + CSS + Registration

**Files:**
- Create: `src/topics/renderers/word_formation/index.jsx`
- Create: `src/topics/renderers/word_formation/WordFormation.css`
- Modify: `src/topics/registry.js` — add `word_formation: WordFormationRenderer`
- Modify: `src/topics/renderers/engineRegistry.js` — add `word_formation: wordFormationEngine`

- [ ] **Step 1: Create index.jsx**

```jsx
// src/topics/renderers/word_formation/index.jsx
import PairIntroTask    from "./PairIntroTask";
import FormItTask       from "./FormItTask";
import YesNoTask        from "./YesNoTask";
import QuestionAskTask  from "./QuestionAskTask";
import "./WordFormation.css";

export default function WordFormationRenderer({ task, topicId, onAdvance, onCorrect, onIncorrect }) {
  switch (task?.type) {
    case "pair_intro":   return <PairIntroTask   task={task} topicId={topicId} onAdvance={onAdvance} />;
    case "form_it":      return <FormItTask      task={task} topicId={topicId} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    case "yes_no":       return <YesNoTask       task={task} topicId={topicId} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    case "question_ask": return <QuestionAskTask task={task} topicId={topicId} onAdvance={onAdvance} onCorrect={onCorrect} />;
    default:
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#aaa" }}>
          Неизвестный тип задания: {task?.type}
        </div>
      );
  }
}
```

- [ ] **Step 2: Create WordFormation.css**

```css
/* src/topics/renderers/word_formation/WordFormation.css */

/* ── shared ─────────────────────────────────────────── */
.wf-nav-btn {
  min-width: 48px; min-height: 48px;
  border-radius: 12px; border: none;
  background: #e0e0e0; font-size: 1.4rem;
  cursor: pointer; transition: background 0.15s;
}
.wf-nav-btn:disabled { opacity: 0.3; cursor: default; }
.wf-nav-btn--next { background: #4caf50; color: #fff; }
.wf-nav-btn--next:not(:disabled):active { background: #388e3c; }

.wf-audio-btn {
  border: none; background: transparent;
  font-size: 1.4rem; cursor: pointer; padding: 4px 8px;
  vertical-align: middle;
}

/* ── pair_intro ─────────────────────────────────────── */
.wf-pair {
  display: flex; flex-direction: column;
  height: 100%; padding: 16px; gap: 16px;
  box-sizing: border-box;
}
.wf-pair__content {
  flex: 1; display: flex; align-items: center;
  justify-content: center; gap: 12px;
}
.wf-pair__side {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  flex: 1; transition: opacity 0.3s;
}
.wf-pair__side--hidden { opacity: 0; pointer-events: none; }
.wf-pair__img {
  width: min(180px, 40vw); height: min(180px, 40vw);
  object-fit: contain; border-radius: 16px;
  background: #f5f5f5;
}
.wf-pair__img--loading {
  background: #e0e0e0; animation: wf-pulse 1.2s ease-in-out infinite;
}
.wf-pair__phrase {
  font-size: clamp(1rem, 4vw, 1.5rem);
  font-weight: 600; text-align: center;
  line-height: 1.3;
}
.wf-pair__phrase--noun { color: #555; }
.wf-pair__phrase--adj  { color: #1565c0; }
.wf-pair__adj-box {
  background: #e3f2fd; border-radius: 16px;
  padding: 20px 28px;
}
.wf-pair__arrow {
  font-size: 2.5rem; color: #bbb;
  opacity: 0; transition: opacity 0.4s, color 0.4s;
  flex-shrink: 0;
}
.wf-pair__arrow--visible { opacity: 1; color: #4caf50; }
.wf-pair__nav {
  display: flex; align-items: center;
  justify-content: space-between; padding: 0 8px;
}
.wf-pair__progress { font-size: 0.9rem; color: #888; }

/* ── form_it ────────────────────────────────────────── */
.wf-form {
  display: flex; flex-direction: column;
  height: 100%; padding: 16px; gap: 16px;
  box-sizing: border-box;
}
.wf-form__stimulus {
  flex: 0 0 auto; display: flex; align-items: center;
  justify-content: center; min-height: 160px;
}
.wf-form__stimulus-img {
  width: min(200px, 45vw); height: min(200px, 45vw);
  object-fit: contain; border-radius: 16px;
  background: #f5f5f5;
}
.wf-form__stimulus-img--loading {
  background: #e0e0e0; animation: wf-pulse 1.2s ease-in-out infinite;
}
.wf-form__stimulus-phrase {
  font-size: clamp(1.1rem, 4.5vw, 1.8rem);
  font-weight: 600; color: #555; text-align: center;
}
.wf-form__options {
  flex: 1; display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px; align-content: center;
}
.wf-option {
  padding: 16px 12px; border-radius: 16px; border: 2px solid #e0e0e0;
  background: #fafafa; font-size: clamp(0.9rem, 3.5vw, 1.2rem);
  font-weight: 600; color: #333; cursor: pointer;
  transition: border-color 0.15s, background 0.15s, transform 0.1s;
  min-height: 64px; line-height: 1.3;
}
.wf-option:not(:disabled):active { transform: scale(0.97); }
.wf-option--correct { border-color: #4caf50; background: #e8f5e9; color: #2e7d32; }
.wf-option--wrong   { border-color: #ef5350; background: #ffebee; animation: wf-shake 0.4s; }
.wf-option:disabled { cursor: default; }

/* ── yes_no ─────────────────────────────────────────── */
.wf-yn {
  display: flex; flex-direction: column;
  height: 100%; padding: 16px; gap: 16px;
  box-sizing: border-box;
}
.wf-yn__stimulus {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 16px;
}
.wf-yn__img {
  width: min(180px, 40vw); height: min(180px, 40vw);
  object-fit: contain; border-radius: 16px; background: #f5f5f5;
}
.wf-yn__img--loading {
  background: #e0e0e0; animation: wf-pulse 1.2s ease-in-out infinite;
}
.wf-yn__phrase {
  font-size: clamp(1.1rem, 4.5vw, 1.8rem);
  font-weight: 700; color: #1565c0; text-align: center;
}
.wf-yn__feedback {
  height: 36px; text-align: center;
  font-size: 1.8rem; font-weight: bold;
  transition: color 0.2s;
}
.wf-yn__feedback--correct { color: #4caf50; }
.wf-yn__feedback--wrong   { color: #ef5350; }
.wf-yn__buttons {
  display: flex; gap: 16px; padding-bottom: 8px;
}
.wf-yn__btn {
  flex: 1; padding: 20px; border-radius: 20px; border: none;
  font-size: clamp(1.2rem, 5vw, 1.8rem); font-weight: 800;
  cursor: pointer; transition: opacity 0.15s, transform 0.1s;
  min-height: 72px;
}
.wf-yn__btn:not(:disabled):active { transform: scale(0.96); }
.wf-yn__btn:disabled { opacity: 0.4; cursor: default; }
.wf-yn__btn--yes { background: #4caf50; color: #fff; }
.wf-yn__btn--no  { background: #ef5350; color: #fff; }

/* ── question_ask ───────────────────────────────────── */
.wf-qa {
  display: flex; flex-direction: column;
  height: 100%; padding: 16px; gap: 12px;
  box-sizing: border-box;
}
.wf-qa__instruction {
  font-size: clamp(0.9rem, 3.5vw, 1.2rem);
  color: #888; text-align: center;
}
.wf-qa__stimulus {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px;
}
.wf-qa__img {
  width: min(180px, 40vw); height: min(180px, 40vw);
  object-fit: contain; border-radius: 16px; background: #f5f5f5;
}
.wf-qa__img--loading {
  background: #e0e0e0; animation: wf-pulse 1.2s ease-in-out infinite;
}
.wf-qa__noun-phrase {
  font-size: clamp(1rem, 4vw, 1.5rem);
  font-weight: 600; color: #555; text-align: center;
}
.wf-qa__answer-hint {
  display: flex; align-items: center; justify-content: center;
  gap: 12px; padding: 12px 20px;
  background: #e3f2fd; border-radius: 16px;
}
.wf-qa__arrow { font-size: 1.5rem; color: #4caf50; }
.wf-qa__adj-phrase {
  font-size: clamp(1.1rem, 4.5vw, 1.8rem);
  font-weight: 700; color: #1565c0;
}
.wf-qa__buttons {
  display: flex; gap: 12px; padding-bottom: 8px;
}
.wf-qa__btn {
  flex: 1; padding: 16px; border-radius: 16px; border: none;
  font-size: clamp(1rem, 4vw, 1.3rem); font-weight: 700;
  cursor: pointer; transition: opacity 0.15s;
  min-height: 60px;
}
.wf-qa__btn--retry   { background: #fff3e0; color: #e65100; }
.wf-qa__btn--correct { background: #4caf50; color: #fff; }

/* ── animations ─────────────────────────────────────── */
@keyframes wf-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}
@keyframes wf-shake {
  0%, 100% { transform: translateX(0); }
  25%       { transform: translateX(-6px); }
  75%       { transform: translateX(6px); }
}
```

- [ ] **Step 3: Register in registry.js**

In `src/topics/registry.js`, add after the last import line:

```js
import WordFormationRenderer from "./renderers/word_formation/index.jsx";
```

And in `RENDERER_REGISTRY`:

```js
word_formation: WordFormationRenderer,
```

- [ ] **Step 4: Register in engineRegistry.js**

In `src/topics/renderers/engineRegistry.js`, add import:

```js
import { generateTasks as wordFormationEngine } from "./word_formation/engine";
```

And in `ENGINE_REGISTRY`:

```js
word_formation: wordFormationEngine,
```

- [ ] **Step 5: Verify build compiles**

```
npm run build
```
Expected: no errors. If CSS variables or import errors appear — fix before committing.

- [ ] **Step 6: Commit**

```
git add src/topics/renderers/word_formation/ src/topics/registry.js src/topics/renderers/engineRegistry.js
git commit -m "feat(word-formation): renderer registered, all 4 modes implemented"
```

---

### Task 6: Deck Data + Placeholder Images + Build Script

**Files:**
- Create: `scripts/build-word-formation-deck.mjs`
- Create: `public/decks/placeholder_images/wf_*.svg` (10 placeholder SVGs via the script)
- Modify: `public/decks/catalog.json` — add entry (done by build script)

- [ ] **Step 1: Create build script**

```js
// scripts/build-word-formation-deck.mjs
import JSZip from "jszip";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const TOPIC_ID = "word_formation_soup";
const VERSION  = "1.0.0";
const ZIP_PATH = `public/decks/${TOPIC_ID}_v${VERSION}.zip`;

// Placeholder SVG — colored rectangle with label text
function makePlaceholderSvg(label, bgColor) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" rx="40" fill="${bgColor}"/>
  <text x="200" y="220" font-family="Arial, sans-serif" font-size="52" font-weight="bold"
        fill="white" text-anchor="middle" dominant-baseline="middle">${label}</text>
</svg>`;
}

const CONCEPTS = [
  { id: "ryba",    noun: "рыба",    nounPhrase: "суп из рыбы",    adjPhrase: "рыбный суп",    difficulty: "easy",   color: "#2196F3" },
  { id: "myaso",   noun: "мясо",    nounPhrase: "суп из мяса",    adjPhrase: "мясной суп",    difficulty: "easy",   color: "#F44336" },
  { id: "grib",    noun: "гриб",    nounPhrase: "суп из грибов",  adjPhrase: "грибной суп",   difficulty: "easy",   color: "#795548" },
  { id: "kapusta", noun: "капуста", nounPhrase: "суп из капусты", adjPhrase: "капустный суп", difficulty: "easy",   color: "#4CAF50" },
  { id: "kuritsa", noun: "курица",  nounPhrase: "суп из курицы",  adjPhrase: "куриный суп",   difficulty: "medium", color: "#FF9800" },
  { id: "goroh",   noun: "горох",   nounPhrase: "суп из гороха",  adjPhrase: "гороховый суп", difficulty: "medium", color: "#8BC34A" },
  { id: "luk",     noun: "лук",     nounPhrase: "суп из лука",    adjPhrase: "луковый суп",   difficulty: "medium", color: "#9C27B0" },
  { id: "ovoschi", noun: "овощи",   nounPhrase: "суп из овощей",  adjPhrase: "овощной суп",   difficulty: "medium", color: "#009688" },
  { id: "fasolj",  noun: "фасоль",  nounPhrase: "суп из фасоли",  adjPhrase: "фасолевый суп", difficulty: "hard",   color: "#E91E63" },
  { id: "tomat",   noun: "томат",   nounPhrase: "суп из томата",  adjPhrase: "томатный суп",  difficulty: "hard",   color: "#FF5722" },
];

const topic = {
  meta: {
    id: TOPIC_ID,
    renderer: "word_formation",
    version: VERSION,
    title: "Словообразование: суп",
    language: "ru",
    conceptCount: CONCEPTS.length,
  },
  modes: [
    {
      id: "pair_intro",
      type: "pair_intro",
      evaluation: "none",
      ui: { title: "Знакомимся", instruction: "Смотрим на пары" },
      methodology: {
        text: "Логопед показывает связь двух форм: «суп из рыбы» → «рыбный суп». Ребёнок слышит обе формы, видит анимированную стрелку. Оценка не нужна.",
        tips: ["Называйте обе формы вслух вместе с ребёнком", "Повторите пару если ребёнок отвлёкся"],
        duration: "3–5 минут"
      },
    },
    {
      id: "form_it",
      type: "form_it",
      evaluation: "auto",
      ui: { title: "Как называется суп?", instruction: "Выбери правильное название" },
      methodology: {
        text: "Ребёнок видит ингредиент (или фразу «суп из рыбы») и выбирает правильное прилагательное из нескольких вариантов. Ядро темы — тренировка правила словообразования.",
        tips: ["Начинайте с 2 вариантов, постепенно переходите к 4", "Параметр «стимул» меняет направление задания"],
        duration: "5–8 минут"
      },
      params: {
        stimulus: {
          type: "enum",
          values: ["phrase", "image", "mixed"],
          default: "mixed",
          label: { ru: "Стимул" },
          hint: { ru: "Фраза — «суп из рыбы»; Картинка — ингредиент; Смешанный — чередование" },
        },
        optionCount: {
          type: "enum",
          values: [2, 4],
          default: 4,
          label: { ru: "Вариантов ответа" },
        },
      },
    },
    {
      id: "yes_no",
      type: "yes_no",
      evaluation: "auto",
      ui: { title: "Правильно?", instruction: "Нажми ДА или НЕТ" },
      methodology: {
        text: "Ребёнок видит картинку ингредиента и текстовую фразу — иногда правильную, иногда нет. Нажимает ДА или НЕТ. Тренирует подтверждение связи.",
        tips: ["Правильный вариант показывается чаще (~60%), чтобы снизить склонность к отказу", "Используйте после «Как называется суп?»"],
        duration: "3–5 минут"
      },
      params: {
        repsPerConcept: {
          type: "number",
          default: 1,
          min: 1,
          max: 3,
          label: { ru: "Повторений на понятие" },
        },
      },
    },
    {
      id: "question_ask",
      type: "question_ask",
      evaluation: "none",
      ui: { title: "Отвечаем", instruction: "Логопед задаёт вопрос" },
      methodology: {
        text: "Логопед показывает картинку, спрашивает «Как называется суп?». Ребёнок отвечает устно. Логопед нажимает ✓ или ↺. Экспрессивный режим — максимальная сложность.",
        tips: ["Принимайте приближённые ответы", "Подсказывайте первый слог если молчит более 5 секунд"],
        duration: "5–7 минут"
      },
    },
  ],
  cards: CONCEPTS.map(c => ({
    id: c.id,
    noun: c.noun,
    nounPhrase: c.nounPhrase,
    adjPhrase: c.adjPhrase,
    image: `media/${c.id}.svg`,
    audioNounPhrase: `audio/${c.id}_noun.mp3`,
    audioAdjPhrase: `audio/${c.id}_adj.mp3`,
    difficulty: c.difficulty,
  })),
};

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(topic, null, 2));

// Add placeholder SVG images
for (const c of CONCEPTS) {
  zip.file(`media/${c.id}.svg`, makePlaceholderSvg(c.noun, c.color));
}

// Audio files: skip for now — components handle missing audio gracefully
// Real audio can be added later via TTS script

const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync(ZIP_PATH, buffer);
console.log(`✓ ${ZIP_PATH}`);

// Update catalog
const catalogPath = "public/decks/catalog.json";
const catalog = existsSync(catalogPath)
  ? JSON.parse(readFileSync(catalogPath, "utf-8"))
  : { decks: [] };
const idx = catalog.decks.findIndex(d => d.id === TOPIC_ID);
const entry = {
  id: TOPIC_ID,
  version: VERSION,
  url: `./decks/${TOPIC_ID}_v${VERSION}.zip`,
  title: "Словообразование: суп",
  renderer: "word_formation",
};
if (idx >= 0) catalog.decks[idx] = entry;
else catalog.decks.push(entry);
writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
console.log("✓ catalog.json updated");
```

- [ ] **Step 2: Run build script**

```
node scripts/build-word-formation-deck.mjs
```
Expected output:
```
✓ public/decks/word_formation_soup_v1.0.0.zip
✓ catalog.json updated
```

- [ ] **Step 3: Build main app**

```
npm run build
```
Expected: success, no errors.

- [ ] **Step 4: Start dev server and verify deck appears in catalog**

```
npm run dev
```

Open http://localhost:5173, go to topic catalog. The deck «Словообразование: суп» should appear. Open it, try each mode:
- **Знакомимся**: colored rectangles shown left/right with arrow animation
- **Как называется суп?**: 4 text buttons appear, correct one turns green
- **Правильно?**: ДА/НЕТ buttons respond correctly
- **Отвечаем**: ✓ / ↺ buttons visible, logopedist can evaluate

- [ ] **Step 5: Commit**

```
git add scripts/build-word-formation-deck.mjs public/decks/word_formation_soup_v1.0.0.zip public/decks/catalog.json
git commit -m "feat(word-formation): deck with placeholder images, all 4 modes working"
```

---

## What's NOT in this plan (next steps after visual review)

1. **Real images** — replace SVG placeholders with actual ingredient photos/illustrations via Cardgen Studio or manual upload
2. **Audio files** — TTS-generated `{id}_noun.mp3` and `{id}_adj.mp3` for all 10 concepts (use `scripts/generate-audio.mjs` pattern)
3. **Mode icons** — generate icons for each mode via `modeIconPrompts`
4. **Methodology text** — review with Katya, adjust tips
5. **Distractor difficulty** — smart suffix-based distractor selection for hard level (future enhancement)
