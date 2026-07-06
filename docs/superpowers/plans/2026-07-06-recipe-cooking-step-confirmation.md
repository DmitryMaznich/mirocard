# Recipe Cooking Step-Confirmation UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the recipe-cooking screen's "Назад/Дальше" stepper with a single type-aware confirmation button, remove the free-jump step drawer, add an anti-tap-cascade lock, a segmented phase progress bar, step-transition animation, and a "Готовим на N" portions phrase on the title card.

**Architecture:** All changes are localized to `src/topics/renderers/reading/index.jsx` (the `InstructionTask` component), a couple of new pure helper functions in `src/topics/renderers/reading/parseRecipeTxt.js`, and additive/replacing CSS in `src/styles.css`. No changes to the recipe `.txt` format, `parseRecipeTxt()`'s parsing logic, `engine.js`, or any other renderer.

**Tech Stack:** React (function components + hooks), plain CSS (no animation library — this codebase has none), Vitest for pure-function unit tests. There is no React component-testing harness in this repo (no `@testing-library/react`), so JSX/behavioral changes are verified manually in the running app; only the two new pure helper functions get automated tests.

## Global Constraints

- Do not change the recipe `.txt` format or `parseRecipeTxt()`'s step-parsing logic (types `heading`/`action`/`checklist`/`warning`/`image`/`bullets` stay as-is).
- Do not touch `adultConfirmAdvance` outside `src/topics/renderers/reading/index.jsx` — the setting and its use in `SessionScreen.jsx`/`useSessionEngine.js` for other task types must keep working unchanged.
- No new npm dependencies (no animation library, no test-library addition) — everything is plain CSS + existing React/Vitest tooling.
- Every step-confirmation button label rule from the spec table must hold: `action`/`checklist` → "Готово ✓", `checklist` also gated on `allChecked`, `heading` (not first step) → "Начнём →", `warning` → "Понял(а)", `image`/`bullets` → "Дальше →", last step → distinct "Готово, рецепт закончен! 🎉" leading to a separate completion card.
- Reference spec: `docs/superpowers/specs/2026-07-06-recipe-cooking-step-confirmation-design.md`.

---

## Task 1: `formatPortionsPhrase` helper (collective numerals)

**Files:**
- Modify: `src/topics/renderers/reading/parseRecipeTxt.js` (append after `resolveStepOwners`, currently ends at line 253)
- Test: `src/topics/renderers/reading/parseRecipeTxt.test.js` (append new `describe` block)

**Interfaces:**
- Produces: `formatPortionsPhrase(count: number): string` — exported from `parseRecipeTxt.js`. Later consumed by Task 7 in `index.jsx`.

- [ ] **Step 1: Write the failing tests**

Append to `src/topics/renderers/reading/parseRecipeTxt.test.js`:

```js
import { formatPortionsPhrase } from './parseRecipeTxt.js';

describe('formatPortionsPhrase', () => {
  it('uses collective numerals for 1-8 portions', () => {
    expect(formatPortionsPhrase(1)).toBe('Готовим на одного');
    expect(formatPortionsPhrase(2)).toBe('Готовим на двоих');
    expect(formatPortionsPhrase(3)).toBe('Готовим на троих');
    expect(formatPortionsPhrase(4)).toBe('Готовим на четверых');
    expect(formatPortionsPhrase(5)).toBe('Готовим на пятерых');
    expect(formatPortionsPhrase(6)).toBe('Готовим на шестерых');
    expect(formatPortionsPhrase(7)).toBe('Готовим на семерых');
    expect(formatPortionsPhrase(8)).toBe('Готовим на восьмерых');
  });

  it('falls back to "на N человек" above 8', () => {
    expect(formatPortionsPhrase(9)).toBe('Готовим на 9 человек');
    expect(formatPortionsPhrase(12)).toBe('Готовим на 12 человек');
  });

  it('treats a falsy/zero count as 1', () => {
    expect(formatPortionsPhrase(0)).toBe('Готовим на одного');
    expect(formatPortionsPhrase(undefined)).toBe('Готовим на одного');
  });

  it('rounds a fractional count', () => {
    expect(formatPortionsPhrase(2.4)).toBe('Готовим на двоих');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/topics/renderers/reading/parseRecipeTxt.test.js`
Expected: FAIL — `formatPortionsPhrase is not defined` / import error.

- [ ] **Step 3: Implement the helper**

Append to `src/topics/renderers/reading/parseRecipeTxt.js` (after the closing `}` of `resolveStepOwners`, line 253):

```js

const COLLECTIVE_PORTIONS_RU = {
  1: "одного",
  2: "двоих",
  3: "троих",
  4: "четверых",
  5: "пятерых",
  6: "шестерых",
  7: "семерых",
  8: "восьмерых",
};

/**
 * "Готовим на двоих" style phrase for the recipe title card, using Russian
 * collective numerals for 1-8 (the observed max_portions range) and a plain
 * "на N человек" fallback above that.
 */
export function formatPortionsPhrase(count) {
  const n = Math.round(count) || 1;
  const word = COLLECTIVE_PORTIONS_RU[n];
  return word ? `Готовим на ${word}` : `Готовим на ${n} человек`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/topics/renderers/reading/parseRecipeTxt.test.js`
Expected: PASS (all tests in the file, including the pre-existing `stepPortionsMultiplier`/`applyPortions` ones).

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/reading/parseRecipeTxt.js src/topics/renderers/reading/parseRecipeTxt.test.js
git commit -m "feat(recipes): add formatPortionsPhrase collective-numeral helper"
```

---

## Task 2: `computeStepSegments` helper (phase segmentation)

**Files:**
- Modify: `src/topics/renderers/reading/parseRecipeTxt.js` (append after Task 1's `formatPortionsPhrase`)
- Test: `src/topics/renderers/reading/parseRecipeTxt.test.js` (append new `describe` block)

**Interfaces:**
- Consumes: nothing new — operates on the same `steps` array shape `parseRecipeTxt()` already produces (`{id, type, text, ...}`).
- Produces: `computeStepSegments(steps: Array<{type: string, text: string}>): Array<{title: string|null, startIndex: number, count: number}>` — exported from `parseRecipeTxt.js`. Later consumed by Task 6 in `index.jsx` for the segmented progress bar.

- [ ] **Step 1: Write the failing tests**

Append to `src/topics/renderers/reading/parseRecipeTxt.test.js`:

```js
import { computeStepSegments } from './parseRecipeTxt.js';

describe('computeStepSegments', () => {
  it('groups a typical recipe into segments by heading', () => {
    const steps = [
      { type: 'heading', text: 'Омлет' },
      { type: 'heading', text: 'Подготовка' },
      { type: 'checklist', text: 'Собери ингредиенты' },
      { type: 'heading', text: 'Готовим' },
      { type: 'action', text: 'Разбей яйца' },
      { type: 'action', text: 'Взбей вилкой' },
    ];
    expect(computeStepSegments(steps)).toEqual([
      { title: 'Омлет', startIndex: 0, count: 1 },
      { title: 'Подготовка', startIndex: 1, count: 2 },
      { title: 'Готовим', startIndex: 3, count: 3 },
    ]);
  });

  it('puts steps before the first heading into an untitled segment', () => {
    const steps = [
      { type: 'action', text: 'Разогрей сковороду' },
      { type: 'heading', text: 'Готовим' },
      { type: 'action', text: 'Налей масло' },
    ];
    expect(computeStepSegments(steps)).toEqual([
      { title: null, startIndex: 0, count: 1 },
      { title: 'Готовим', startIndex: 1, count: 2 },
    ]);
  });

  it('treats a recipe with no headings as one untitled segment', () => {
    const steps = [
      { type: 'action', text: 'Раз' },
      { type: 'action', text: 'Два' },
    ];
    expect(computeStepSegments(steps)).toEqual([
      { title: null, startIndex: 0, count: 2 },
    ]);
  });

  it('handles back-to-back headings as separate single-step segments', () => {
    const steps = [
      { type: 'heading', text: 'А' },
      { type: 'heading', text: 'Б' },
      { type: 'action', text: 'Шаг' },
    ];
    expect(computeStepSegments(steps)).toEqual([
      { title: 'А', startIndex: 0, count: 1 },
      { title: 'Б', startIndex: 1, count: 2 },
    ]);
  });

  it('returns an empty array for no steps', () => {
    expect(computeStepSegments([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/topics/renderers/reading/parseRecipeTxt.test.js`
Expected: FAIL — `computeStepSegments is not defined` / import error.

- [ ] **Step 3: Implement the helper**

Append to `src/topics/renderers/reading/parseRecipeTxt.js` (after `formatPortionsPhrase` from Task 1):

```js

/**
 * Group a recipe's parsed steps into phase segments for the progress bar.
 * A new segment starts at every `heading` step; steps before the first
 * heading (if any) form a leading untitled segment. Consecutive headings
 * each start their own segment.
 */
export function computeStepSegments(steps) {
  const segments = [];
  let current = null;
  steps.forEach((step, i) => {
    if (step.type === "heading" || !current) {
      if (current) segments.push(current);
      current = { title: step.type === "heading" ? step.text : null, startIndex: i, count: 0 };
    }
    current.count += 1;
  });
  if (current) segments.push(current);
  return segments;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/topics/renderers/reading/parseRecipeTxt.test.js`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/reading/parseRecipeTxt.js src/topics/renderers/reading/parseRecipeTxt.test.js
git commit -m "feat(recipes): add computeStepSegments phase-grouping helper"
```

---

## Task 3: Unify the step-confirmation button, remove `adultConfirmAdvance` gating

**Files:**
- Modify: `src/topics/renderers/reading/index.jsx` (`InstructionTask`, currently lines 392-718)
- Modify: `src/styles.css` (nav button rules, currently lines 720-770 and 1317-1321)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: a `ctaLabel` string local to `InstructionTask`, and CSS classes `.instruction-back-btn` / `.instruction-cta-btn` that Task 5 (lock) extends.

**Context:** Currently (line 396) the component reads `adultConfirmAdvance` from settings and, when true, makes both nav buttons non-interactive (`onClick={undefined}`) and keyboard-only via the `instruction-nav--kbd` CSS class. This task removes that gating entirely (scoped to this screen only) and replaces the "Назад"/"Дальше" button pair with one type-aware CTA button plus a small icon-only back button.

- [ ] **Step 1: Remove the `adultConfirmAdvance` store read**

In `src/topics/renderers/reading/index.jsx`, delete this line (currently line 396):

```js
  const adultConfirmAdvance     = useAppStore((s) => s.settings?.adultConfirmAdvance ?? true);
```

- [ ] **Step 2: Add the `ctaLabel` computation**

Find this block (currently lines 450-453):

```js
  const isLast = stepIndex === steps.length - 1;
  const allChecked =
    step?.type !== "checklist" ||
    (step.items ?? []).every((_, i) => !!checked[`${stepIndex}_${i}`]);
```

Replace it with:

```js
  const isLast = stepIndex === steps.length - 1;
  const allChecked =
    step?.type !== "checklist" ||
    (step.items ?? []).every((_, i) => !!checked[`${stepIndex}_${i}`]);

  const ctaLabel = isLast
    ? "Готово, рецепт закончен! 🎉"
    : step?.type === "heading"
    ? "Начнём →"
    : step?.type === "warning"
    ? "Понял(а)"
    : step?.type === "image" || step?.type === "bullets"
    ? "Дальше →"
    : "Готово ✓";
```

- [ ] **Step 3: Replace the nav button pair**

Find this block (currently lines 674-683):

```jsx
          <div className={`instruction-nav${adultConfirmAdvance ? " instruction-nav--kbd" : ""}`}>
            <button className="reading-secondary-btn" onClick={adultConfirmAdvance ? undefined : goBack}>
              <span className="kb-key kb-key--back">←</span>
              Назад
            </button>
            <button className="reading-primary-btn" disabled={!allChecked} onClick={adultConfirmAdvance ? undefined : handleNext}>
              {isLast ? "Готово" : "Дальше"}
              <span className="kb-key kb-key--fwd">→</span>
            </button>
          </div>
```

Replace it with:

```jsx
          <div className="instruction-nav">
            <button
              type="button"
              className="instruction-back-btn"
              onClick={goBack}
              aria-label="Назад"
            >
              <BackArrowIcon size={20} />
            </button>
            <button
              type="button"
              className="reading-primary-btn instruction-cta-btn"
              disabled={!allChecked}
              onClick={handleNext}
            >
              {ctaLabel}
            </button>
          </div>
```

- [ ] **Step 4: Update the nav CSS**

In `src/styles.css`, find this block (currently lines 720-770):

```css
/* ── Nav ── */
.instruction-nav {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding-bottom: max(4px, var(--app-safe-bottom, 0px));
}

.instruction-nav .reading-secondary-btn,
.instruction-nav .reading-primary-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* Keyboard key badges inside nav buttons */
.kb-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  font-size: 15px;
  font-weight: 900;
  flex-shrink: 0;
  line-height: 1;
}

.kb-key--back {
  background: #c4cbca;
  color: #3a4a47;
  box-shadow: 0 3px 0 #8fa0a0;
}

.kb-key--fwd {
  background: rgba(255,255,255,0.22);
  color: white;
  box-shadow: 0 3px 0 rgba(0,0,0,0.18);
}

/* Keyboard-only mode: screen taps disabled, keys are the cue */
.instruction-nav--kbd .reading-secondary-btn,
.instruction-nav--kbd .reading-primary-btn {
  pointer-events: none;
  cursor: default;
}
```

Replace it with:

```css
/* ── Nav ── */
.instruction-nav {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding-bottom: max(4px, var(--app-safe-bottom, 0px));
}

.instruction-nav .reading-primary-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.instruction-back-btn {
  flex-shrink: 0;
  width: 52px;
  min-height: 52px;
  border-radius: 16px;
  border: none;
  background: #eef0ef;
  color: #566461;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.instruction-back-btn:active {
  background: #dfe4e2;
}

.instruction-cta-btn:disabled {
  opacity: 0.5;
  box-shadow: none;
}
```

- [ ] **Step 5: Update the mobile nav override**

In `src/styles.css`, find this block (currently lines 1317-1321):

```css
  .instruction-nav .reading-secondary-btn,
  .instruction-nav .reading-primary-btn {
    padding: 14px 10px;
    font-size: 1rem;
  }
```

Replace it with:

```css
  .instruction-nav .reading-primary-btn {
    padding: 14px 10px;
    font-size: 1rem;
  }

  .instruction-back-btn {
    width: 46px;
    min-height: 46px;
  }
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`

In the browser: open the Planner → "Готовить" on any recipe with prep checklist steps and a warning step (e.g. `content/recipes/omelet.txt` or `content/recipes/salad.txt`). Step through and confirm:
- The button reads "Начнём →" on the title/heading steps, "Готово ✓" on action and checklist steps, "Понял(а)" on the "Проверка!" warning step, and "Готово, рецепт закончен! 🎉" on the last step.
- On a checklist step, the button is disabled (greyed, unclickable) until every item is tapped/checked.
- The small back button (icon only, no text) is always clickable and moves to the previous step.
- Open the app's Settings, toggle "adultConfirmAdvance" (whatever its UI label is) on and off — the recipe screen's buttons keep working by tap either way (the setting no longer affects this screen).

- [ ] **Step 7: Commit**

```bash
git add src/topics/renderers/reading/index.jsx src/styles.css
git commit -m "feat(recipes): unify step CTA button, drop adultConfirmAdvance gate in cooking screen"
```

---

## Task 4: Remove the "все шаги" jump drawer

**Files:**
- Modify: `src/topics/renderers/reading/index.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing new — pure removal.

- [ ] **Step 1: Remove `listOpen`/`listRef` state**

Delete these lines (currently lines 408-409):

```js
  const [listOpen,   setListOpen]   = useState(false);
  const listRef = useRef(null);
```

- [ ] **Step 2: Remove the drawer-scroll `useEffect`**

Delete this block (currently lines 455-459):

```js
  useEffect(() => {
    if (!listOpen || !listRef.current) return;
    const el = listRef.current.querySelector(".instruction-list-item--active");
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [listOpen]);
```

- [ ] **Step 3: Remove the `setListOpen(false)` call in `handleNext`**

Find (currently lines 472-476):

```js
  const handleNext = useCallback(() => {
    setListOpen(false);
    if (isLast) onAdvance();
    else setStepIndex((n) => n + 1);
  }, [isLast, onAdvance]);
```

Replace with:

```js
  const handleNext = useCallback(() => {
    if (isLast) onAdvance();
    else setStepIndex((n) => n + 1);
  }, [isLast, onAdvance]);
```

- [ ] **Step 4: Remove the drawer toggle button and drawer JSX**

Delete this block (currently lines 643-672, sitting between the step card `</div>` and the nav `<div>`):

```jsx
          <button
            className={`instruction-drawer-toggle${listOpen ? " instruction-drawer-toggle--open" : ""}`}
            onClick={() => setListOpen((v) => !v)}
          >
            <span className="instruction-drawer-pill" />
            <span className="instruction-drawer-label">все шаги {listOpen ? "▲" : "▼"}</span>
          </button>

          {listOpen && (
            <div className="instruction-drawer" ref={listRef}>
              {steps.map((s, i) => {
                const isDone = i < stepIndex;
                const isActive = i === stepIndex;
                return (
                  <div
                    key={s.id}
                    className={[
                      "instruction-list-item",
                      isDone ? "instruction-list-item--done" : "",
                      isActive ? "instruction-list-item--active" : "",
                    ].filter(Boolean).join(" ")}
                  >
                    <span className="instruction-list-icon">{isDone ? "✓" : isActive ? "▶" : ""}</span>
                    {s.type !== "heading" && <span className="instruction-list-num">{i + 1}.</span>}
                    <span className="instruction-list-text">{applyFireEmoji(applyPortions(s.text, portions))}</span>
                  </div>
                );
              })}
            </div>
          )}
```

- [ ] **Step 5: Remove drawer/list CSS**

In `src/styles.css`, delete this block (currently lines 623-718, from the `/* ── Drawer toggle ── */` comment through `.instruction-list-text { flex: 1; }`):

```css
/* ── Drawer toggle ── */
.instruction-drawer-toggle {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px 0 2px;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}

.instruction-drawer-pill {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: #c2d8d4;
  transition: background 0.15s;
}

.instruction-drawer-toggle:active .instruction-drawer-pill,
.instruction-drawer-toggle--open .instruction-drawer-pill {
  background: #4caf90;
}

.instruction-drawer-label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #7fb8ac;
  transition: color 0.15s;
}

.instruction-drawer-toggle--open .instruction-drawer-label { color: #3a9a7a; }

/* ── Steps drawer ── */
.instruction-drawer {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  max-height: 38vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-radius: 14px;
  background: #f4f9f8;
  border: 1.5px solid #d0e8e2;
  padding: 8px 10px;
  flex-shrink: 0;
}

.instruction-list-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 5px 6px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  color: #4a6361;
  line-height: 1.3;
}

.instruction-list-item--active {
  background: rgba(76, 175, 144, 0.12);
  color: #1c3634;
}

.instruction-list-item--done {
  color: #9ab8b3;
}

.instruction-list-icon {
  width: 16px;
  flex-shrink: 0;
  font-size: 0.7rem;
  color: #4caf90;
  text-align: center;
}

.instruction-list-item--active .instruction-list-icon { color: #3a9a7a; }

.instruction-list-num {
  flex-shrink: 0;
  color: #9ab8b3;
  font-size: 0.8rem;
}

.instruction-list-item--active .instruction-list-num { color: #5a8a80; }

.instruction-list-text { flex: 1; }

```

- [ ] **Step 6: Remove the drawer's mobile override**

In `src/styles.css`, delete this block (currently lines 1323-1325):

```css
  .instruction-drawer {
    max-height: 220px;
  }
```

- [ ] **Step 7: Manual verification**

Run: `npm run dev`

Open a recipe in the Planner → "Готовить" flow. Confirm there is no "все шаги ▼" pill/button anywhere on the screen, and the layout between the step card and the nav buttons has no leftover gap or broken spacing.

- [ ] **Step 8: Commit**

```bash
git add src/topics/renderers/reading/index.jsx src/styles.css
git commit -m "feat(recipes): remove free-jump step drawer from cooking screen"
```

---

## Task 5: Anti tap-cascade lock

**Files:**
- Modify: `src/topics/renderers/reading/index.jsx`

**Interfaces:**
- Consumes: the `handleNext`/CTA button from Task 3.
- Produces: nothing new consumed by later tasks (Task 7 further edits `handleNext`, see note below).

**Context:** After a step change, briefly disable the forward button/keys so a stray second tap from the same gesture that confirmed the previous step can't cascade into confirming the new one too.

- [ ] **Step 1: Add the `locked` state and its reset effect**

Find the `toggleItem` callback (currently lines 467-470):

```js
  const toggleItem = useCallback((i) => {
    const key = `${stepIndex}_${i}`;
    setChecked((c) => ({ ...c, [key]: !c[key] }));
  }, [stepIndex]);
```

Add this new state and effect directly above it:

```js
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    setLocked(true);
    const t = setTimeout(() => setLocked(false), 450);
    return () => clearTimeout(t);
  }, [stepIndex]);

```

- [ ] **Step 2: Make `handleNext` respect the lock**

Find (from Task 4's edit):

```js
  const handleNext = useCallback(() => {
    if (isLast) onAdvance();
    else setStepIndex((n) => n + 1);
  }, [isLast, onAdvance]);
```

Replace with:

```js
  const handleNext = useCallback(() => {
    if (locked) return;
    if (isLast) onAdvance();
    else setStepIndex((n) => n + 1);
  }, [locked, isLast, onAdvance]);
```

- [ ] **Step 3: Disable the CTA button while locked**

Find (from Task 3's edit):

```jsx
            <button
              type="button"
              className="reading-primary-btn instruction-cta-btn"
              disabled={!allChecked}
              onClick={handleNext}
            >
              {ctaLabel}
            </button>
```

Replace `disabled={!allChecked}` with `disabled={!allChecked || locked}`:

```jsx
            <button
              type="button"
              className="reading-primary-btn instruction-cta-btn"
              disabled={!allChecked || locked}
              onClick={handleNext}
            >
              {ctaLabel}
            </button>
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`

Open a recipe and rapidly double/triple-tap (or double-click) the CTA button as fast as possible right after a step change. Confirm it advances at most one step per ~450ms window — it should not be possible to blow through two or more steps with one rapid-fire tap burst. Confirm normal single-tap pacing (slower than 450ms between taps) still advances every time with no perceptible extra delay.

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/reading/index.jsx
git commit -m "feat(recipes): add anti tap-cascade lock after each step change"
```

---

## Task 6: Segmented phase progress bar

**Files:**
- Modify: `src/topics/renderers/reading/index.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `computeStepSegments` from Task 2 (`src/topics/renderers/reading/parseRecipeTxt.js`).
- Produces: a local `InstructionProgressBar` component in `index.jsx`, not consumed elsewhere.

- [ ] **Step 1: Import `computeStepSegments`**

Find the import (currently line 7):

```js
import { parseRecipeTxt, resolveStepOwners, applyPortions, applyFireEmoji, stepPortionsMultiplier } from "./parseRecipeTxt";
```

Replace with:

```js
import { parseRecipeTxt, resolveStepOwners, applyPortions, applyFireEmoji, stepPortionsMultiplier, computeStepSegments } from "./parseRecipeTxt";
```

(Task 7 extends this same import line with `formatPortionsPhrase` — not added here, to keep this task lint-clean with no unused import.)

- [ ] **Step 2: Add the `InstructionProgressBar` component**

Add this new component directly above `function InstructionTask(...)` (currently line 392):

```jsx
function InstructionProgressBar({ segments, stepIndex }) {
  const active = segments.find((s) => stepIndex >= s.startIndex && stepIndex < s.startIndex + s.count);
  return (
    <div className="instruction-progressbar-wrap">
      <div className="instruction-progressbar">
        {segments.map((seg, i) => {
          const endIndex = seg.startIndex + seg.count - 1;
          let fillPct = 0;
          if (stepIndex > endIndex) fillPct = 100;
          else if (stepIndex >= seg.startIndex) fillPct = ((stepIndex - seg.startIndex + 1) / seg.count) * 100;
          return (
            <div key={i} className="instruction-progressbar-segment" style={{ flexGrow: seg.count }}>
              <div className="instruction-progressbar-segment-fill" style={{ width: `${fillPct}%` }} />
            </div>
          );
        })}
      </div>
      {active?.title && <div className="instruction-phase-label">{active.title}</div>}
    </div>
  );
}

```

- [ ] **Step 3: Compute segments in `InstructionTask` and render the bar**

Find the `segments`-free area right after `steps`/`stepIndex` are derived — locate this line (currently line 441):

```js
  const step = steps[stepIndex];
```

Add directly above it:

```js
  const segments = useMemo(() => computeStepSegments(steps), [steps]);
```

Then find the header block (currently lines 577-582):

```jsx
          <div className="instruction-header">
            <span className="instruction-progress">{stepIndex + 1} / {steps.length}</span>
            <button type="button" className="instruction-close-btn" onClick={exitInstruction}>
              Закрыть рецепт
            </button>
          </div>
```

Replace it with:

```jsx
          <div className="instruction-header">
            <InstructionProgressBar segments={segments} stepIndex={stepIndex} />
            <div className="instruction-header-row">
              <button type="button" className="instruction-close-btn" onClick={exitInstruction}>
                Закрыть рецепт
              </button>
            </div>
          </div>
```

- [ ] **Step 4: Update header/progress CSS**

In `src/styles.css`, find this block (currently lines 431-450):

```css
.instruction-header {
  width: 100%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.instruction-header-spacer {
  width: 2.2rem;
  flex-shrink: 0;
}

.instruction-progress {
  flex: 1;
  text-align: center;
  font-size: 1rem;
  font-weight: 700;
  color: #6b7a7a;
}
```

Replace it with:

```css
.instruction-header {
  width: 100%;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.instruction-header-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.instruction-progressbar-wrap {
  width: 100%;
}

.instruction-progressbar {
  width: 100%;
  display: flex;
  gap: 4px;
}

.instruction-progressbar-segment {
  height: 8px;
  border-radius: 4px;
  background: #e4ece9;
  overflow: hidden;
  position: relative;
}

.instruction-progressbar-segment-fill {
  position: absolute;
  inset: 0 auto 0 0;
  height: 100%;
  background: #4caf90;
  border-radius: 4px;
  transition: width 0.25s ease;
}

.instruction-phase-label {
  margin-top: 4px;
  font-size: 0.85rem;
  font-weight: 700;
  color: #6b7a7a;
  text-align: center;
}
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`

Open a recipe that has at least two `heading` steps (a title heading plus at least one mid-recipe phase heading, e.g. `content/recipes/pasta.txt`). Confirm:
- The bar shows one visual segment per phase, sized roughly by how many steps are in each phase.
- The segment for a phase you've already completed is fully filled; the current phase's segment fills proportionally as you advance through it; later phases are empty.
- The phase name under the bar updates as you move between phases.

- [ ] **Step 6: Commit**

```bash
git add src/topics/renderers/reading/index.jsx src/styles.css
git commit -m "feat(recipes): add segmented phase progress bar to cooking screen"
```

---

## Task 7: Step-transition animation, phase-complete badge, portions phrase, completion card

**Files:**
- Modify: `src/topics/renderers/reading/index.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `formatPortionsPhrase` from Task 1 (already imported in Task 6, Step 1).
- Produces: nothing consumed elsewhere — this is the final task.

- [ ] **Step 1: Import `formatPortionsPhrase`**

Find the import (currently, after Task 6's edit):

```js
import { parseRecipeTxt, resolveStepOwners, applyPortions, applyFireEmoji, stepPortionsMultiplier, computeStepSegments } from "./parseRecipeTxt";
```

Replace with:

```js
import { parseRecipeTxt, resolveStepOwners, applyPortions, applyFireEmoji, stepPortionsMultiplier, computeStepSegments, formatPortionsPhrase } from "./parseRecipeTxt";
```

- [ ] **Step 2: Add `portionsCount` state and populate it**

Find the state declarations (currently lines 403-408, after Task 4's removal of `listOpen`/`listRef` two lines shorter):

```js
  const [portions,   setPortions]   = useState(1);
  const [steps,      setSteps]      = useState(task.text?.steps ?? []);
  const [group,      setGroup]      = useState([]);
  const [stepIndex,  setStepIndex]  = useState(0);
  const [checked,    setChecked]    = useState({});
```

Add `portionsCount` next to `portions`:

```js
  const [portions,   setPortions]   = useState(1);
  const [portionsCount, setPortionsCount] = useState(1);
  const [steps,      setSteps]      = useState(task.text?.steps ?? []);
  const [group,      setGroup]      = useState([]);
  const [stepIndex,  setStepIndex]  = useState(0);
  const [checked,    setChecked]    = useState({});
```

Find where the multiplier is set in the load effect (currently lines 433-436):

```js
      const basePortions = task.text?.portions ?? 1;
      const chosenPortions = sessionPortionsOverride ?? settings.portions ?? basePortions;
      setPortions(stepPortionsMultiplier(basePortions, task.text?.fixedPortions, chosenPortions));
      if (sessionPortionsOverride != null) setSessionPortionsOverride(null);
```

Replace with:

```js
      const basePortions = task.text?.portions ?? 1;
      const chosenPortions = sessionPortionsOverride ?? settings.portions ?? basePortions;
      setPortions(stepPortionsMultiplier(basePortions, task.text?.fixedPortions, chosenPortions));
      setPortionsCount(chosenPortions);
      if (sessionPortionsOverride != null) setSessionPortionsOverride(null);
```

- [ ] **Step 3: Add `finished` state and the completion-card handler**

Find (from Task 5's edit):

```js
  const handleNext = useCallback(() => {
    if (locked) return;
    if (isLast) onAdvance();
    else setStepIndex((n) => n + 1);
  }, [locked, isLast, onAdvance]);
```

Replace with:

```js
  const [finished, setFinished] = useState(false);

  const handleNext = useCallback(() => {
    if (locked) return;
    if (isLast) setFinished(true);
    else setStepIndex((n) => n + 1);
  }, [locked, isLast]);

  const handleFinish = useCallback(() => {
    onAdvance();
  }, [onAdvance]);
```

- [ ] **Step 4: Route Enter/ArrowRight/Escape through the completion card when finished**

Find the keyboard effect (currently lines 500-512):

```js
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      switch (e.key) {
        case "ArrowRight": case "Enter": e.preventDefault(); handleNext(); break;
        case " ":          e.preventDefault(); handleSpace(); break;
        case "ArrowLeft":  case "Backspace": e.preventDefault(); goBack(); break;
        case "Escape": e.preventDefault(); exitInstruction(); break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleNext, handleSpace, goBack, exitInstruction]);
```

Replace with:

```js
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (finished) {
        if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); handleFinish(); }
        if (e.key === "Escape") { e.preventDefault(); exitInstruction(); }
        return;
      }
      switch (e.key) {
        case "ArrowRight": case "Enter": e.preventDefault(); handleNext(); break;
        case " ":          e.preventDefault(); handleSpace(); break;
        case "ArrowLeft":  case "Backspace": e.preventDefault(); goBack(); break;
        case "Escape": e.preventDefault(); exitInstruction(); break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleNext, handleSpace, goBack, exitInstruction, finished, handleFinish]);
```

- [ ] **Step 5: Render the completion card**

Find (currently, after Task 4's removal, around what was line 514):

```js
  if (!step) return null;
```

Add directly above it:

```jsx
  if (finished) {
    return (
      <div className="session-body reading-body instruction-body">
        <div className="instruction-step instruction-step--heading">
          <div className="instruction-step-text">🎉 Рецепт готов!</div>
        </div>
        <div className="instruction-nav">
          <button type="button" className="reading-primary-btn instruction-cta-btn" onClick={handleFinish}>
            Готово
          </button>
        </div>
      </div>
    );
  }

```

- [ ] **Step 6: Add the phase-complete badge and portions phrase to the heading branch, and key the step card for the transition animation**

Find this block (currently lines 584-606):

```jsx
          <div className={`instruction-step${step.type === "heading" ? " instruction-step--heading" : ""}${step.type === "image" ? " instruction-step--image" : ""}${step.type === "warning" ? " instruction-step--warning" : ""}`}>
            {step.type === "image" ? (
              imageUrl
                ? <img src={imageUrl} alt="" className="instruction-step-img" />
                : <div className="instruction-step-img-placeholder" />
            ) : step.type === "warning" ? (
              <div className="instruction-step-text instruction-step-text--warning">
                <span className="instruction-warning-icon">🔔</span>
                {step.text}
              </div>
            ) : (
            <div className="instruction-step-text">{(() => {
              const text = applyFireEmoji(applyPortions(step.text, portions));
              const parts = text.split(/(?<=[.!]) (?=[А-ЯЁа-яёA-Za-z(])/g);
              if (parts.length === 1) return text;
              return parts.map((s, i) => (
                <Fragment key={i}>
                  {i > 0 && <br />}
                  {s}
                </Fragment>
              ));
            })()}</div>
            )}
```

Replace it with:

```jsx
          <div
            key={stepIndex}
            className={`instruction-step${step.type === "heading" ? " instruction-step--heading" : ""}${step.type === "image" ? " instruction-step--image" : ""}${step.type === "warning" ? " instruction-step--warning" : ""}`}
          >
            {step.type === "image" ? (
              imageUrl
                ? <img src={imageUrl} alt="" className="instruction-step-img" />
                : <div className="instruction-step-img-placeholder" />
            ) : step.type === "warning" ? (
              <div className="instruction-step-text instruction-step-text--warning">
                <span className="instruction-warning-icon">🔔</span>
                {step.text}
              </div>
            ) : (
            <>
            {step.type === "heading" && stepIndex > 0 && (
              <div className="instruction-phase-complete-badge">Этап пройден! 👍</div>
            )}
            <div className="instruction-step-text">{(() => {
              const text = applyFireEmoji(applyPortions(step.text, portions));
              const parts = text.split(/(?<=[.!]) (?=[А-ЯЁа-яёA-Za-z(])/g);
              if (parts.length === 1) return text;
              return parts.map((s, i) => (
                <Fragment key={i}>
                  {i > 0 && <br />}
                  {s}
                </Fragment>
              ));
            })()}</div>
            {step.type === "heading" && stepIndex === 0 && (
              <div className="instruction-title-portions">{formatPortionsPhrase(portionsCount)}</div>
            )}
            </>
            )}
```

- [ ] **Step 7: Add transition/badge/portions CSS**

In `src/styles.css`, find the `.instruction-step` rule (currently lines 466-478):

```css
.instruction-step {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 20px;
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  padding: 16px 0;
}
```

Replace it with:

```css
.instruction-step {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 20px;
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  padding: 16px 0;
  animation: instruction-step-slide-in 280ms ease;
}

@keyframes instruction-step-slide-in {
  from { opacity: 0; transform: translateX(24px); }
  to   { opacity: 1; transform: translateX(0); }
}

.instruction-phase-complete-badge {
  font-size: 1rem;
  font-weight: 700;
  color: #3a9a7a;
  text-align: center;
}

.instruction-title-portions {
  font-size: 1.1rem;
  font-weight: 700;
  color: #4a6361;
  text-align: center;
}
```

- [ ] **Step 8: Manual verification**

Run: `npm run dev`

Open a recipe (e.g. `content/recipes/salad.txt`) via Planner → "Готовить", picking a non-default portion count in the params screen (e.g. 2 or 4 people). Confirm:
- The very first card (dish title + photo) shows "Готовим на двоих"/"Готовим на четверых" etc. matching what you picked.
- Each step transition plays a brief slide-in (not an instant cut).
- The first heading step of the *second* phase (not the title) shows "Этап пройден! 👍" above its own heading text; the title card itself does not show this badge.
- Tapping "Готово, рецепт закончен! 🎉" on the last step shows a distinct "🎉 Рецепт готов!" card with its own "Готово" button; tapping that returns to the Planner (same place the "Закрыть рецепт" button goes).
- Repeat the full run from Task 3–7's verification steps once more end-to-end to confirm nothing regressed (button labels per step type, checklist gating, back button, anti-cascade lock, progress bar, drawer absence).

- [ ] **Step 9: Commit**

```bash
git add src/topics/renderers/reading/index.jsx src/styles.css
git commit -m "feat(recipes): add step transition animation, phase-complete badge, portions phrase, completion card"
```

---

## Self-Review Notes

- **Spec coverage:** unified CTA button + type-based labels (Task 3), removed drawer (Task 4), anti tap-cascade lock (Task 5), segmented phase progress bar (Task 6), slide transition + phase-complete badge + final completion card (Task 7), "Готовим на …" phrase (Task 7), `adultConfirmAdvance` removed scoped to this screen only (Task 3). All spec sections are covered.
- **No format changes:** no task touches `parseRecipeTxt()`'s parsing logic, `.txt` files, or `engine.js`.
- **Type consistency:** `formatPortionsPhrase` (Task 1) and `computeStepSegments` (Task 2) signatures are used identically at their Task 6/7 call sites. `ctaLabel`, `locked`, `finished`, `handleFinish`, `portionsCount` are each introduced once and referenced with the same names in every later task that touches them.
