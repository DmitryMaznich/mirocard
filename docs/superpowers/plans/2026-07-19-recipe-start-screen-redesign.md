# Редизайн экрана «Начать готовить» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести в реальный код (`ParamsScreen.jsx`/`styles.css`) визуал экрана
«Начать готовить» из согласованного мокапа: ряд фигурок-человечков вместо голого
степпера порций, две секции («Ингредиенты»/«Время готовки») с иконкой только в
заголовке, однострочные строки степперов с компактной записью значения.

**Architecture:** Расширяем формат `# adjustable:` до 4 колонок (`key | group | label
| unit`), чтобы парсер отдавал группу и единицу измерения, а не только подпись. Новая
экспортируемая `formatCompact()` рядом с `formatWithUnit()` в `parseRecipeTxt.js`
для компактной записи значения на экране настроек. Весь новый CSS — под отдельным
префиксом `rp-*`, не трогает общие `.param-row`/`.stepper-btn`, которые используют
другие экраны настроек.

**Tech Stack:** React, Vite, Vitest.

## Global Constraints

- Редизайн применяется **только** к уже размеченным `{ключ:...}` полям — сейчас 5:
  `oil`, `butter`, `sauteTime`, `fryTime`, `simmerTime`. Не добавлять новые ключи
  другим ингредиентам chicken.txt в этой задаче.
- Новый CSS — только под именами с префиксом `rp-` (`recipe params`). Не менять
  `.param-row`, `.param-label`, `.param-stepper`, `.stepper-btn`, `.stepper-value`,
  `.param-section*` — их используют другие экраны настроек (сравнение, столбик и т.д.).
- Палитра — только существующие хардкод-хексы из `styles.css`: `#1c7a6e` (тёмный
  чай), `#4a9b8f` (чай светлее), `#d9a441` (горчичный), `#b9822a` (горчичный тёмный,
  новый — производный тон для текста/иконок на кремовом фоне, тот же оттенок что и
  `#d9a441`), `#1a2e2b`/`#3a5c58`/`#7a9e9a` (чернила), `#c8d4d2` (линия), `#d8c9a3`
  (нить пунктира), `#ece4d3` (граница строки).
- Референс-документ: `docs/superpowers/specs/2026-07-19-recipe-start-screen-redesign.md`.
- Мокап (источник точных значений): `https://claude.ai/code/artifact/50668204-ee83-4d09-aa70-006d3af76bd7`.

---

### Task 1: `formatCompact` — компактная запись значения

**Files:**
- Modify: `src/topics/renderers/reading/parseRecipeTxt.js`
- Test: `src/topics/renderers/reading/parseRecipeTxt.test.js`

**Interfaces:**
- Consumes: ничего нового.
- Produces: `formatCompact(val, unit) → string` — используется в Task 4
  (`ParamsScreen.jsx`).

- [ ] **Step 1: Написать падающие тесты**

Добавить в `src/topics/renderers/reading/parseRecipeTxt.test.js`, после блока
`describe('formatWithUnit (exported for the ingredient-stepper UI)', ...)`:

```js
describe('formatCompact (compact settings-screen readout)', () => {
  it('formats a whole number with the given unit', () => {
    expect(formatCompact(3, 'мин')).toBe('3 мин');
  });

  it('formats a half quantity with a fraction glyph, not a spelled-out word', () => {
    expect(formatCompact(4.5, 'ст.л.')).toBe('4½ ст.л.');
  });

  it('formats a half quantity below 1 as a bare fraction glyph', () => {
    expect(formatCompact(0.5, 'ч.л.')).toBe('½ ч.л.');
  });

  it('snaps a near-half float to the nearest half before formatting', () => {
    expect(formatCompact(2.4999999999, 'мин')).toBe('2½ мин');
  });
});
```

Обновить импорт в начале файла:

```js
// find:
import { stepPortionsMultiplier, applyPortions, formatPortionsPhrase, computeStepSegments, parseTimerMinutesFromText, applyFireEmoji, applyOptionSelections, filterStepsByOptions, extractAdjustableTemplates, computeAdjustableDefault, formatWithUnit } from './parseRecipeTxt.js';
```

```js
// replace with:
import { stepPortionsMultiplier, applyPortions, formatPortionsPhrase, computeStepSegments, parseTimerMinutesFromText, applyFireEmoji, applyOptionSelections, filterStepsByOptions, extractAdjustableTemplates, computeAdjustableDefault, formatWithUnit, formatCompact } from './parseRecipeTxt.js';
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/topics/renderers/reading/parseRecipeTxt.test.js`
Expected: FAIL — `formatCompact is not a function`.

- [ ] **Step 3: Реализовать**

В `src/topics/renderers/reading/parseRecipeTxt.js` добавить сразу после функции
`formatWithUnit` (перед `stepPortionsMultiplier`):

```js
/**
 * Settings-screen readout: compact numeral + abbreviated unit ("4½ ст.л.").
 * Deliberately NOT the grammatically-declined phrase formatWithUnit produces
 * ("4 с половиной столовой ложки") — that phrasing is for a child to read
 * aloud during cooking; this is a config control for the adult setting up
 * the session, where a compact value scans faster across many rows.
 */
export function formatCompact(val, unit) {
  const snapped = Math.round(val * 2) / 2;
  const whole = Math.floor(snapped);
  const isHalf = snapped - whole === 0.5;
  const num = isHalf ? (whole > 0 ? `${whole}½` : '½') : `${whole}`;
  return `${num} ${unit}`;
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/topics/renderers/reading/parseRecipeTxt.test.js`
Expected: PASS — все тесты, включая существующие.

- [ ] **Step 5: Коммит**

```bash
git add src/topics/renderers/reading/parseRecipeTxt.js src/topics/renderers/reading/parseRecipeTxt.test.js
git commit -m "feat(recipes): add formatCompact for the settings-screen value readout"
```

---

### Task 2: `# adjustable:` — 4 колонки (group + unit)

**Files:**
- Modify: `src/topics/builtinRecipesTopic.js`
- Test: `src/topics/builtinRecipesTopic.test.js`

**Interfaces:**
- Consumes: ничего нового.
- Produces: `parseAdjustable(txt) → { [key]: { group, label, unit } }` — раньше
  возвращала `{ [key]: label }` (строку). Используется в Task 4 (`ParamsScreen.jsx`)
  как `activeText.adjustable[key].group` / `.label` / `.unit`.

- [ ] **Step 1: Переписать тесты под новый формат (не добавить — заменить)**

В `src/topics/builtinRecipesTopic.test.js` заменить блок `describe('parseAdjustable', ...)`:

```js
// find:
describe('parseAdjustable', () => {
  it('parses key | label lines under # adjustable:', () => {
    const content = '# adjustable:\n#   oil | Растительное масло\n#   butter | Сливочное масло\nТест\n';
    expect(parseAdjustable(content)).toEqual({ oil: 'Растительное масло', butter: 'Сливочное масло' });
  });

  it('returns an empty object when there is no # adjustable: block', () => {
    expect(parseAdjustable('Тест рецепт без метаданных\n')).toEqual({});
  });

  it('stops the block at the next # key', () => {
    const content = '# adjustable:\n#   oil | Масло\n# ingredients:\n#   яйца | 3 | шт\nТест\n';
    expect(parseAdjustable(content)).toEqual({ oil: 'Масло' });
  });
});
```

```js
// replace with:
describe('parseAdjustable', () => {
  it('parses key | group | label | unit lines under # adjustable:', () => {
    const content = '# adjustable:\n#   oil | ingredient | Растительное масло | ст.л.\n#   sauteTime | time | Лук и морковь | мин\nТест\n';
    expect(parseAdjustable(content)).toEqual({
      oil: { group: 'ingredient', label: 'Растительное масло', unit: 'ст.л.' },
      sauteTime: { group: 'time', label: 'Лук и морковь', unit: 'мин' },
    });
  });

  it('returns an empty object when there is no # adjustable: block', () => {
    expect(parseAdjustable('Тест рецепт без метаданных\n')).toEqual({});
  });

  it('stops the block at the next # key', () => {
    const content = '# adjustable:\n#   oil | ingredient | Масло | ст.л.\n# ingredients:\n#   яйца | 3 | шт\nТест\n';
    expect(parseAdjustable(content)).toEqual({ oil: { group: 'ingredient', label: 'Масло', unit: 'ст.л.' } });
  });

  it('skips a line missing any of the four fields', () => {
    const content = '# adjustable:\n#   oil | ingredient | Масло\nТест\n';
    expect(parseAdjustable(content)).toEqual({});
  });
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/topics/builtinRecipesTopic.test.js`
Expected: FAIL — старая реализация возвращает строку вместо объекта
`{group, label, unit}`.

- [ ] **Step 3: Реализовать**

В `src/topics/builtinRecipesTopic.js` заменить `parseAdjustable`:

```js
// find:
// "# adjustable:" declares which {key:...} template placeholders in the step
// text get an editable stepper on the cook-start screen, and what to label
// each one — each indented line is "key | label". A key only gets a stepper
// if it's ALSO declared here AND appears in a {key:...} template somewhere
// in the steps (see extractAdjustableTemplates in parseRecipeTxt.js) — this
// block supplies the label, the step text supplies the number.
export function parseAdjustable(txt) {
  const adjustable = {};
  let inAdjustable = false;
  for (const rawLine of txt.split('\n')) {
    if (!rawLine.startsWith('#')) { inAdjustable = false; continue; }
    const afterHash = rawLine.slice(1);
    if (inAdjustable) {
      if (afterHash.startsWith('  ') || afterHash.startsWith('\t\t')) {
        const parts = afterHash.trim().split('|').map((p) => p.trim());
        const [key, label] = parts;
        if (key && label) adjustable[key] = label;
        continue;
      }
      inAdjustable = false;
    }
    if (afterHash.trim() === 'adjustable:') inAdjustable = true;
  }
  return adjustable;
}
```

```js
// replace with:
// "# adjustable:" declares which {key:...} template placeholders in the step
// text get an editable stepper on the cook-start screen: which section it
// belongs to, what to label it, and what compact unit abbreviation to show
// next to the number. Each indented line is "key | group | label | unit" —
// group is "ingredient" or "time" (used to sort the key into one of the two
// ledger sections on the start-cooking screen). A key only gets a stepper if
// it's ALSO declared here AND appears in a {key:...} template somewhere in
// the steps (see extractAdjustableTemplates in parseRecipeTxt.js) — this
// block supplies the group/label/unit, the step text supplies the number.
export function parseAdjustable(txt) {
  const adjustable = {};
  let inAdjustable = false;
  for (const rawLine of txt.split('\n')) {
    if (!rawLine.startsWith('#')) { inAdjustable = false; continue; }
    const afterHash = rawLine.slice(1);
    if (inAdjustable) {
      if (afterHash.startsWith('  ') || afterHash.startsWith('\t\t')) {
        const parts = afterHash.trim().split('|').map((p) => p.trim());
        const [key, group, label, unit] = parts;
        if (key && group && label && unit) adjustable[key] = { group, label, unit };
        continue;
      }
      inAdjustable = false;
    }
    if (afterHash.trim() === 'adjustable:') inAdjustable = true;
  }
  return adjustable;
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/topics/builtinRecipesTopic.test.js`
Expected: PASS — все тесты, включая `buildRecipesTopicRecord` (не завязан на форму
`adjustable`, только проверяет `soup.adjustable` в `toBeUndefined()`).

- [ ] **Step 5: Коммит**

```bash
git add src/topics/builtinRecipesTopic.js src/topics/builtinRecipesTopic.test.js
git commit -m "feat(recipes): extend # adjustable: to 4 columns (group + unit)"
```

---

### Task 3: `chicken.txt` — обновить `# adjustable:` на новый формат

**Files:**
- Modify: `content/recipes/chicken.txt`

**Interfaces:**
- Consumes: формат из Task 2.
- Produces: единственный реальный потребитель нового формата на сегодня.

- [ ] **Step 1: Заменить блок**

```
// find:
# adjustable:
#   oil | Растительное масло
#   butter | Сливочное масло
#   sauteTime | Лук и морковь на сковороде
#   fryTime | Курица на сковороде
#   simmerTime | Тушение в сливках
```

```
// replace with:
# adjustable:
#   oil | ingredient | Растительное масло | ст.л.
#   butter | ingredient | Сливочное масло | ст.л.
#   sauteTime | time | Лук и морковь на сковороде | мин
#   fryTime | time | Курица на сковороде | мин
#   simmerTime | time | Тушение в сливках | мин
```

- [ ] **Step 2: Прогнать полный тестовый набор**

Run: `npx vitest run`
Expected: без новых сбоев относительно бейзлайна (см. «Тесты» ниже — известный
несвязанный бейзлайн этого репозитория; сверить, что список падающих файлов не
вырос).

- [ ] **Step 3: Коммит**

```bash
git add content/recipes/chicken.txt
git commit -m "feat(recipes): update chicken.txt # adjustable: to group/unit format"
```

---

### Task 4: `ParamsScreen.jsx` — редизайн `RecipeStartParams`

**Files:**
- Modify: `src/features/session/ParamsScreen.jsx`

**Interfaces:**
- Consumes: `formatCompact` (Task 1), `activeText.adjustable[key].{group,label,unit}`
  (Task 2), `formatPortionsPhrase` (уже существует в `parseRecipeTxt.js`, не менялась).
- Produces: ничего нового наружу — внутренняя разметка `RecipeStartParams`.

Юнит-тестов для `ParamsScreen.jsx` в проекте нет (как и раньше) — визуальная
проверка в Task 6.

- [ ] **Step 1: Обновить импорт**

```js
// find:
import { extractAdjustableTemplates, computeAdjustableDefault, formatWithUnit, stepPortionsMultiplier } from "@/topics/renderers/reading/parseRecipeTxt.js";
```

```js
// replace with:
import { extractAdjustableTemplates, computeAdjustableDefault, formatCompact, stepPortionsMultiplier, formatPortionsPhrase } from "@/topics/renderers/reading/parseRecipeTxt.js";
```

- [ ] **Step 2: Заменить JSX-разметку `RecipeStartParams`**

```jsx
// find:
  return (
    <div className="params-layout">
      <div className="params-info-col">
        {student && (
          <div className="params-info-student">
            <div className="params-info-student__avatar">
              {student.photoDataUrl
                ? <img src={student.photoDataUrl} alt={student.name} />
                : getInitials(student.name)
              }
            </div>
            <div className="params-info-student__name">{student.name}</div>
          </div>
        )}
        <div className="params-info-start">
          <Button fullWidth onClick={startSession}>Начать готовить</Button>
        </div>
      </div>

      <div className="params-settings-col">
        <div className="params-body">
          <div className="param-row">
            <div className="param-label">Порций</div>
            {fixedPortions
              ? <span className="all-texts-portions-fixed">готовим {fixedPortions}</span>
              : <div className="all-texts-portions">
                  <button className="all-texts-portions-btn" onClick={() => changePortions(Math.max(1, portions - 1))} disabled={portions <= 1}>−</button>
                  <span className="all-texts-portions-value">{portions}</span>
                  <button className="all-texts-portions-btn" onClick={() => changePortions(Math.min(maxPortions, portions + 1))} disabled={portions >= maxPortions}>+</button>
                </div>
            }
          </div>
          {adjustableTemplates.length > 0 && (
            <div className="param-section">
              <div className="param-section__header">Количества</div>
              {adjustableTemplates.map((t) => {
                const defaultValue = computeAdjustableDefault(t, factor);
                const value = ingredientOverrides[t.key] ?? defaultValue;
                const increment = t.kind === "additive" ? t.step : 1;
                const min = Math.max(0, t.base - increment);
                return (
                  <div className="param-row" key={t.key}>
                    <div className="param-label">{adjustableLabels[t.key]}</div>
                    <div className="param-stepper">
                      <button
                        className="stepper-btn"
                        disabled={value <= min}
                        onClick={() => setIngredientOverrides((prev) => ({ ...prev, [t.key]: Math.max(min, value - increment) }))}
                      >−</button>
                      <span className="stepper-value">{formatWithUnit(value, t.one, t.few, t.many)}</span>
                      <button
                        className="stepper-btn"
                        onClick={() => setIngredientOverrides((prev) => ({ ...prev, [t.key]: value + increment }))}
                      >+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="param-row">
            <div className="param-label">Цифры на плите</div>
            <button
              type="button"
              className="link-btn"
              onClick={() => setStoveModalOpen(true)}
            >
              Настроить
            </button>
          </div>
          {optionGroups.map(([groupId, choices]) => (
            <OptionsPicker
              key={groupId}
              label="Топпинг (можно несколько или ничего)"
              choices={choices}
              selected={options[groupId] ?? []}
              onChange={(next) => setOptions((prev) => ({ ...prev, [groupId]: next }))}
            />
          ))}
        </div>
        <div className="params-start-phone">
          <Button fullWidth onClick={startSession}>Начать готовить</Button>
        </div>
      </div>

      {stoveModalOpen && <StoveHeatModal onClose={() => setStoveModalOpen(false)} />}
    </div>
  );
}
```

```jsx
// replace with:
  function renderLedgerRow(t) {
    const info = adjustableLabels[t.key];
    const defaultValue = computeAdjustableDefault(t, factor);
    const value = ingredientOverrides[t.key] ?? defaultValue;
    const increment = t.kind === "additive" ? t.step : 1;
    const min = Math.max(0, t.base - increment);
    const isOverridden = ingredientOverrides[t.key] != null;
    return (
      <li className="rp-row" key={t.key}>
        <span className="rp-row-main">
          <span className="rp-row-label">{info.label}</span>
          {isOverridden && (
            <span className="rp-row-note">
              <button
                type="button"
                className="rp-reset-link"
                onClick={() => setIngredientOverrides((prev) => {
                  const next = { ...prev };
                  delete next[t.key];
                  return next;
                })}
              >
                правка · вернуть
              </button>
            </span>
          )}
        </span>
        <span className="rp-row-control">
          <button
            type="button"
            className="rp-spoon-btn"
            disabled={value <= min}
            onClick={() => setIngredientOverrides((prev) => ({ ...prev, [t.key]: Math.max(min, value - increment) }))}
          >−</button>
          <span className="rp-row-value" key={value}>{formatCompact(value, info.unit)}</span>
          <button
            type="button"
            className="rp-spoon-btn"
            onClick={() => setIngredientOverrides((prev) => ({ ...prev, [t.key]: value + increment }))}
          >+</button>
        </span>
      </li>
    );
  }

  const ingredientTemplates = adjustableTemplates.filter((t) => adjustableLabels[t.key]?.group === "ingredient");
  const timeTemplates = adjustableTemplates.filter((t) => adjustableLabels[t.key]?.group === "time");

  return (
    <div className="params-layout">
      <div className="params-info-col">
        {student && (
          <div className="params-info-student">
            <div className="params-info-student__avatar">
              {student.photoDataUrl
                ? <img src={student.photoDataUrl} alt={student.name} />
                : getInitials(student.name)
              }
            </div>
            <div className="params-info-student__name">{student.name}</div>
          </div>
        )}
        <div className="params-info-start">
          <Button fullWidth onClick={startSession}>Начать готовить</Button>
        </div>
      </div>

      <div className="params-settings-col">
        <div className="params-body">
          {fixedPortions ? (
            <div className="param-row">
              <div className="param-label">Порций</div>
              <span className="all-texts-portions-fixed">готовим {fixedPortions}</span>
            </div>
          ) : (
            <section className="rp-people-hero">
              <div className="rp-people-row">
                {Array.from({ length: maxPortions }, (_, i) => i + 1).map((n) => (
                  <span key={n} className={`rp-person ${n <= portions ? "rp-person--filled" : "rp-person--ghost"}`}>
                    <svg viewBox="0 0 26 32">
                      <path
                        className="rp-fig-body"
                        strokeWidth="1.7"
                        strokeLinejoin="round"
                        d="M9.5,11 Q6,11.5 5,13 Q2,15 2.6,17.2 Q3.4,19.4 6.2,17.6 Q8,16.4 9,15
                           L9,19 Q7.5,20 7,22 L6.4,29 Q6.2,31.4 8.6,31.2 Q10.6,31 10.8,29
                           L11.6,21.5 Q12,20.2 13,20 Q14,20.2 14.4,21.5 L15.2,29
                           Q15.4,31 17.4,31.2 Q19.8,31.4 19.6,29 L19,22 Q18.5,20 17,19
                           L17,15 Q18,16.4 19.8,17.6 Q22.6,19.4 23.4,17.2 Q24,15 21,13
                           Q20,11.5 16.5,11 Q15,10.2 13,10.2 Q11,10.2 9.5,11 Z"
                      />
                      <circle className="rp-fig-head" cx="13" cy="6.6" r="4.6" strokeWidth="1.7" />
                      <g className="rp-fig-eyes" fill="#fffaf0">
                        <circle cx="11.1" cy="6.4" r="0.85" />
                        <circle cx="14.9" cy="6.4" r="0.85" />
                      </g>
                    </svg>
                  </span>
                ))}
              </div>
              <p className="rp-people-phrase">{formatPortionsPhrase(portions)}</p>
              <div className="rp-people-control">
                <button className="rp-dial-btn" onClick={() => changePortions(Math.max(1, portions - 1))} disabled={portions <= 1} aria-label="Меньше порций">−</button>
                <span className="rp-people-count" key={portions}>{portions}</span>
                <button className="rp-dial-btn" onClick={() => changePortions(Math.min(maxPortions, portions + 1))} disabled={portions >= maxPortions} aria-label="Больше порций">+</button>
              </div>
            </section>
          )}
          {ingredientTemplates.length > 0 && (
            <>
              <div className="rp-stitch">
                <svg className="rp-stitch-icon" viewBox="0 0 22 22" aria-hidden="true">
                  <path d="M4 9.5h14a7 6.3 0 0 1-14 0Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4.6 8c0-1 .6-1.6 1.2-1.6M17.4 8c0-1-.6-1.6-1.2-1.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <span>Ингредиенты</span>
              </div>
              <ul className="rp-ledger">{ingredientTemplates.map(renderLedgerRow)}</ul>
            </>
          )}
          {timeTemplates.length > 0 && (
            <>
              <div className="rp-stitch">
                <svg className="rp-stitch-icon" viewBox="0 0 22 22" aria-hidden="true">
                  <circle cx="11" cy="12" r="7.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M11 7.6V12l3.2 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8.4 2.6h5.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <span>Время готовки</span>
              </div>
              <ul className="rp-ledger">{timeTemplates.map(renderLedgerRow)}</ul>
            </>
          )}
          <div className="param-row">
            <div className="param-label">Цифры на плите</div>
            <button
              type="button"
              className="link-btn"
              onClick={() => setStoveModalOpen(true)}
            >
              Настроить
            </button>
          </div>
          {optionGroups.map(([groupId, choices]) => (
            <OptionsPicker
              key={groupId}
              label="Топпинг (можно несколько или ничего)"
              choices={choices}
              selected={options[groupId] ?? []}
              onChange={(next) => setOptions((prev) => ({ ...prev, [groupId]: next }))}
            />
          ))}
        </div>
        <div className="params-start-phone">
          <Button fullWidth onClick={startSession}>Начать готовить</Button>
        </div>
      </div>

      {stoveModalOpen && <StoveHeatModal onClose={() => setStoveModalOpen(false)} />}
    </div>
  );
}
```

- [ ] **Step 3: Прогнать полный тестовый набор**

Run: `npx vitest run`
Expected: без новых сбоев относительно бейзлайна.

- [ ] **Step 4: Коммит**

```bash
git add src/features/session/ParamsScreen.jsx
git commit -m "feat(recipes): redesign RecipeStartParams — people-pictogram portions, split ledger"
```

---

### Task 5: `styles.css` — новые `rp-*` стили

**Files:**
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: классы из Task 4 (`rp-people-hero`, `rp-people-row`, `rp-person`,
  `rp-person--filled`, `rp-person--ghost`, `rp-fig-body`, `rp-fig-head`,
  `rp-fig-eyes`, `rp-people-phrase`, `rp-people-control`, `rp-people-count`,
  `rp-dial-btn`, `rp-stitch`, `rp-stitch-icon`, `rp-ledger`, `rp-row`,
  `rp-row-main`, `rp-row-label`, `rp-row-note`, `rp-reset-link`, `rp-row-control`,
  `rp-spoon-btn`, `rp-row-value`).
- Produces: ничего наружу — терминальная задача цепочки.

- [ ] **Step 1: Добавить основной блок стилей**

В `src/styles.css` найти существующее правило `.stepper-value` (единственное
вхождение вне медиа-запроса):

```css
// find:
.stepper-value { font-size: 1.25rem; font-weight: 800; min-width: 30px; text-align: center; color: #1a2e2b; }
```

Оставить эту строку как есть и сразу после неё вставить новый блок:

```css
// insert after:
.stepper-value { font-size: 1.25rem; font-weight: 800; min-width: 30px; text-align: center; color: #1a2e2b; }

/* ── RecipeStartParams redesign: people-pictogram portions + split ledger ── */
.rp-people-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 4px 4px;
}
.rp-people-row {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 6px;
  flex-wrap: wrap;
  padding: 0 8px;
}
.rp-person {
  width: 27px; height: 32px;
  flex-shrink: 0;
  transition: transform .32s cubic-bezier(.34,1.56,.64,1), opacity .28s ease;
  transform: scale(1) rotate(var(--rp-tilt, 0deg));
}
.rp-person:nth-child(odd) { --rp-tilt: -3deg; }
.rp-person:nth-child(even) { --rp-tilt: 2.5deg; }
.rp-person svg { width: 100%; height: 100%; overflow: visible; }
.rp-fig-body, .rp-fig-head { transition: fill .28s ease, stroke .28s ease; }
.rp-fig-eyes { transition: opacity .2s ease; opacity: 0; }
.rp-person--filled .rp-fig-body, .rp-person--filled .rp-fig-head { fill: #d9a441; stroke: #b9822a; }
.rp-person--filled .rp-fig-eyes { opacity: 1; }
.rp-person--ghost .rp-fig-body, .rp-person--ghost .rp-fig-head { fill: none; stroke: #c8d4d2; stroke-dasharray: 2.2 2.4; }
.rp-person--ghost { transform: scale(0.86) rotate(var(--rp-tilt, 0deg)); opacity: 0.75; }

.rp-people-phrase {
  margin-top: 10px;
  text-align: center;
  font-size: 0.86rem;
  font-weight: 700;
  color: #1c7a6e;
  letter-spacing: 0.01em;
}

.rp-people-control {
  margin-top: 10px;
  display: flex; align-items: center; justify-content: center; gap: 16px;
}
.rp-people-count {
  font-size: 1.6rem;
  font-weight: 800;
  min-width: 30px;
  text-align: center;
  color: #1a2e2b;
  font-variant-numeric: tabular-nums;
  animation: rp-num-pulse .38s ease;
}
.rp-dial-btn {
  width: 38px; height: 38px; border-radius: 50%;
  border: 1.5px solid #c8d4d2;
  background: #fff;
  color: #1a2e2b;
  font-size: 1.2rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.07), 0 3px 8px rgba(0,0,0,0.03);
  transition: transform .12s ease, background .12s ease, border-color .12s ease;
  flex-shrink: 0;
}
.rp-dial-btn:hover:not(:disabled) { border-color: #d9a441; background: rgba(217,164,65,0.16); }
.rp-dial-btn:active:not(:disabled) { transform: scale(0.88); }
.rp-dial-btn:disabled { opacity: 0.32; cursor: default; }

.rp-stitch {
  display: flex; align-items: center; gap: 8px;
  margin: 20px 2px 6px;
}
.rp-stitch::before, .rp-stitch::after {
  content: "";
  flex: 1;
  height: 0;
  border-top: 1.6px dashed #d8c9a3;
}
.rp-stitch-icon { width: 15px; height: 15px; color: #b9822a; flex-shrink: 0; }
.rp-stitch span {
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.11em;
  color: #7a9e9a;
  white-space: nowrap;
}

.rp-ledger { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.rp-row {
  display: flex; align-items: center; gap: 12px;
  padding: 9px 2px;
  border-bottom: 1px solid #ece4d3;
}
.rp-row:last-child { border-bottom: none; }
.rp-row-main { flex: 1; min-width: 0; }
.rp-row-label { font-size: 0.87rem; font-weight: 700; color: #1a2e2b; line-height: 1.3; }
.rp-row-note { margin-top: 1px; animation: rp-rise .22s ease; }
.rp-reset-link {
  all: unset;
  cursor: pointer;
  font-style: italic;
  font-size: 0.72rem;
  color: #b9822a;
  border-bottom: 1px dotted #b9822a;
  line-height: 1.3;
  white-space: nowrap;
}
.rp-row-control { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.rp-spoon-btn {
  width: 27px; height: 27px; border-radius: 50%;
  border: 1.5px solid #c8d4d2;
  background: #fff;
  color: #3a5c58;
  font-size: 0.95rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform .1s ease, background .1s ease, border-color .1s ease;
}
.rp-spoon-btn:hover:not(:disabled) { background: rgba(74,155,143,0.12); border-color: #4a9b8f; color: #1c7a6e; }
.rp-spoon-btn:active:not(:disabled) { transform: scale(0.86); }
.rp-spoon-btn:disabled { opacity: 0.3; cursor: default; }
.rp-row-value {
  min-width: 56px;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 800;
  color: #1a2e2b;
  font-variant-numeric: tabular-nums;
  animation: rp-flash .5s ease;
}

@keyframes rp-num-pulse { 0% { transform: scale(1); } 40% { transform: scale(1.14); } 100% { transform: scale(1); } }
@keyframes rp-rise { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: translateY(0); } }
@keyframes rp-flash { 0% { color: #b9822a; } 100% { color: #1a2e2b; } }

@media (prefers-reduced-motion: reduce) {
  .rp-person, .rp-people-count, .rp-row-note, .rp-row-value { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
```

- [ ] **Step 2: Добавить увеличение тап-таргетов на планшете**

Найти существующий блок (внутри `@media (min-width: 768px) { ... }`):

```css
// find:
  .param-row { padding: 14px 16px; }
  .stepper-btn { width: 48px; height: 48px; }
  .stepper-value { font-size: 1.3rem; }
```

```css
// replace with:
  .param-row { padding: 14px 16px; }
  .stepper-btn { width: 48px; height: 48px; }
  .stepper-value { font-size: 1.3rem; }
  .rp-dial-btn { width: 44px; height: 44px; }
  .rp-spoon-btn { width: 32px; height: 32px; }
  .rp-row { padding: 12px 2px; }
```

- [ ] **Step 3: Прогнать полный тестовый набор**

Run: `npx vitest run`
Expected: без новых сбоев относительно бейзлайна (CSS-only правки не должны ничего
сломать в юнит-тестах, но прогон — стандартная страховка перед коммитом).

- [ ] **Step 4: Коммит**

```bash
git add src/styles.css
git commit -m "feat(recipes): style RecipeStartParams redesign (rp-* classes)"
```

---

### Task 6: Ручная проверка в браузере

**Files:** нет (проверочная задача).

- [ ] **Step 1: Запустить дев-сервер**

Run: `npm run dev` (в фоне)

- [ ] **Step 2: Открыть экран «Начать готовить» для «Курица в сливочном соусе»
(Playwright, headed-режим)**

Путь: локальный режим → Меню → Ужин → «Курица в сливочном соусе» → «Готовить по
шагам» (тот же путь, что использовался при живой проверке предыдущей задачи —
включить `account.featureFlags = ['planner']` через `window.__store` при
необходимости, если фича-флаг не выдан локальному аккаунту).

Проверить визуально на 1 и на 8 порциях:
- Ряд из 8 фигурок-человечков; на N порциях первые N — сплошные горчичные с
  «глазами», остальные — контурные пунктирные, слегка повёрнутые вразнобой.
- Под рядом — фраза `formatPortionsPhrase` («Готовим на одного» / «...восьмерых»).
- Секция «Ингредиенты» (иконка миски) с двумя строками (масло раст./слив.),
  секция «Время готовки» (иконка часов) с тремя строками — каждая строка
  однострочная, подпись и степпер не переносятся друг под друга даже на 8 порциях.
- Ручной override одной строки → рядом с подписью на той же строке появляется
  «правка · вернуть» курсивом; клик по ней возвращает расчётное значение.
- Смена числа порций сбрасывает все override (как и раньше — не менялось).
- Значения совпадают с форматом `formatCompact`: например масло на 8 порциях —
  «4½ ст.л.», не «4 с половиной столовой ложки».

- [ ] **Step 3: Проверить, что «Начать готовить» по-прежнему переносит выставленные
override в текст шага во время готовки**

Нажать «Начать готовить», дойти до шага с маслом (шаг 8) — убедиться, что показанное
там количество совпадает с тем, что было выставлено на экране настроек (полным
словом — «4 с половиной столовой ложки», не «4½ ст.л.» — экран готовки не менялся).

- [ ] **Step 4: Проверить, что другой экран настроек не пострадал**

Открыть экран настроек любого нерецептового режима (например, «Сравнение чисел») —
убедиться, что вид `.param-row`/`.stepper-btn` не изменился (общие классы не
затронуты).

- [ ] **Step 5: Закрыть браузер, остановить дев-сервер**
