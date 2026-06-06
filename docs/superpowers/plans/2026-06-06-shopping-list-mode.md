# Shopping List Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `shopping_list` mode to the existing recipes deck (`reading_dad_texts`) — accordion of 14 grocery categories, tap items to check, big Print button sends to browser print dialog.

**Architecture:** New mode type `shopping_list` in the reading renderer. Content lives in `content/shopping/shopping.txt` using the existing recipe `.txt` format. Engine finds the shopping text by kind rather than textId, so it works regardless of which recipe is selected in params. Print uses `window.print()` + `@media print` CSS visibility trick.

**Tech Stack:** React (hooks), existing `parseRecipeTxt` + `getRawRecipeTxt` from groupStore, `window.print()`, CSS `@media print`, JSZip (deck rebuild script), `npm run deploy:prod`

---

### Task 1: Create shopping list content file

**Files:**
- Create: `content/shopping/shopping.txt`

- [ ] **Step 1: Create the directory and write the content file**

Create `content/shopping/shopping.txt` with this exact content:

```
Список покупок

1. Овощи:
- картошка
- морковь
- лук
- огурцы
- помидоры
- капуста
- свёкла
- кабачок
- чеснок
- перец болгарский

2. Фрукты:
- яблоки
- бананы
- апельсины
- груши
- виноград
- мандарины
- лимон

3. Зелень:
- укроп
- петрушка
- зелёный лук
- базилик
- кинза
- шпинат

4. Бакалея:
- рис
- гречка
- макароны
- сахар
- соль
- мука
- масло растительное
- овсяные хлопья
- горчица

5. Мясо:
- курица
- говядина
- свинина
- фарш
- сосиски
- колбаса

6. Рыба:
- сёмга
- треска
- тунец
- минтай
- форель

7. Напитки:
- вода
- сок
- чай
- кофе
- газировка
- морс

8. Молочные продукты:
- молоко
- кефир
- йогурт
- сметана
- творог
- масло сливочное
- сыр
- ряженка

9. Бытовая химия:
- стиральный порошок
- средство для мытья посуды
- шампунь
- мыло
- зубная паста
- туалетная бумага

10. Сладости:
- шоколад
- конфеты
- печенье
- вафли
- мармелад
- пирожное

11. Хлебобулочные изделия:
- хлеб
- батон
- булочки
- лаваш
- багет

12. Консервы:
- тушёнка
- кукуруза консервированная
- горошек
- помидоры в банке
- рыбные консервы
- оливки

13. Заморозка:
- пельмени
- вареники
- блинчики
- замороженные овощи
- мороженое

14. Товары для животных:
- корм для кошки
- корм для собаки
- наполнитель для лотка
- лакомство для питомца
```

- [ ] **Step 2: Verify `parseRecipeTxt` parses it correctly**

Run this in Node (or add a quick `console.log` test):
```js
import { parseRecipeTxt } from "./src/topics/renderers/reading/parseRecipeTxt.js";
import { readFileSync } from "fs";
const raw = readFileSync("content/shopping/shopping.txt", "utf-8");
const steps = parseRecipeTxt(raw);
console.log(steps.length); // expect 15 (1 heading + 14 checklists)
console.log(steps[1].type); // "checklist"
console.log(steps[1].items.length); // 10 (Овощи)
```

Expected: 1 heading step ("Список покупок") + 14 checklist steps.

- [ ] **Step 3: Commit**

```
git add content/shopping/shopping.txt
git commit -m "content: add shopping list txt (14 categories)"
```

---

### Task 2: Add `shopping_list` case to reading engine + test

**Files:**
- Modify: `src/topics/renderers/reading/engine.js`
- Modify: `src/topics/renderers/reading/engine.test.js`

- [ ] **Step 1: Write the failing test first**

Add to `src/topics/renderers/reading/engine.test.js`:

```js
describe("shopping_list mode", () => {
  const SHOPPING_TOPIC = {
    meta: { id: "reading_test", renderer: "reading" },
    texts: [
      {
        id: "shopping_list",
        kind: "shopping_list",
        title: { ru: "Список покупок" },
        file: "shopping/shopping.txt",
      },
    ],
  };

  it("generates one shopping_list task ignoring textId", () => {
    const tasks = generateTasks({ type: "shopping_list" }, SHOPPING_TOPIC, "any_text_id");
    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe("shopping_list");
    expect(tasks[0].text.kind).toBe("shopping_list");
  });

  it("returns empty if no shopping_list kind text exists", () => {
    const tasks = generateTasks({ type: "shopping_list" }, TOPIC, "dad_best");
    expect(tasks).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```
npx vitest run src/topics/renderers/reading/engine.test.js
```

Expected: FAIL — `shopping_list` case missing.

- [ ] **Step 3: Implement the case in `engine.js`**

In `src/topics/renderers/reading/engine.js`, add a helper and the new case:

```js
function buildShoppingListTask(text) {
  return {
    type: "shopping_list",
    textId: text.id,
    text,
  };
}

export function generateTasks(mode, topicRecord, textId, _sessionParams = null, textOverride = null) {
  const text = getReadingText(topicRecord, textId, textOverride);
  if (!text) return [];

  switch (mode.type) {
    case "read_text":
      return [buildReadTextTask(text)];
    case "understand_text":
      return buildUnderstandTasks(text);
    case "assemble_text":
      return text.kind === "poem" ? buildAssembleTasks(text) : [];
    case "follow_instruction":
      return text.kind === "instruction" ? [buildFollowInstructionTask(text)] : [];
    case "shopping_list": {
      const shoppingText = (topicRecord.texts ?? []).find((t) => t.kind === "shopping_list");
      return shoppingText ? [buildShoppingListTask(shoppingText)] : [];
    }
    default:
      return [];
  }
}
```

Note: the `shopping_list` case ignores `textId` — it always finds the text by `kind === "shopping_list"` from the topic record.

- [ ] **Step 4: Run test — verify it passes**

```
npx vitest run src/topics/renderers/reading/engine.test.js
```

Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```
git add src/topics/renderers/reading/engine.js src/topics/renderers/reading/engine.test.js
git commit -m "feat(reading): add shopping_list engine case + test"
```

---

### Task 3: Add `ShoppingListTask` component to reading renderer

**Files:**
- Modify: `src/topics/renderers/reading/index.jsx` (add component + register in TASK_RENDERERS)

- [ ] **Step 1: Add the component**

In `src/topics/renderers/reading/index.jsx`, add the following component function **before** the `TASK_RENDERERS` object (around line 664):

```jsx
function ShoppingListTask({ task, topicId, onAdvance }) {
  const [steps, setSteps] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [checked, setChecked] = useState({});

  useEffect(() => {
    async function load() {
      await pullRecipeKvFromServer().catch(() => {});
      const filePath = task.text?.file;
      if (filePath) {
        const raw = await getRawRecipeTxt(topicId, filePath).catch(() => null);
        if (raw) {
          setSteps(parseRecipeTxt(raw).filter((s) => s.type === "checklist" || s.type === "action"));
        }
      } else {
        setSteps((task.text?.steps ?? []).filter((s) => s.type === "checklist" || s.type === "action"));
      }
    }
    load();
  }, [topicId, task.text?.file]);

  const toggleCategory = useCallback((idx) => {
    setExpanded((e) => ({ ...e, [idx]: !e[idx] }));
  }, []);

  const toggleItem = useCallback((stepIdx, itemIdx) => {
    const key = `${stepIdx}_${itemIdx}`;
    setChecked((c) => ({ ...c, [key]: !c[key] }));
  }, []);

  const checkedCountFor = (stepIdx, items) =>
    (items ?? []).filter((_, i) => checked[`${stepIdx}_${i}`]).length;

  const totalChecked = steps.reduce((sum, step, si) => sum + checkedCountFor(si, step.items), 0);

  return (
    <div className="session-body reading-body shopping-body">
      <div className="shopping-list">
        {steps.map((step, si) => {
          const items = step.items ?? [];
          const doneCount = checkedCountFor(si, items);
          const allDone = doneCount === items.length && items.length > 0;
          const isOpen = !!expanded[si];
          return (
            <div key={step.id ?? si} className={`shopping-category${allDone ? " shopping-category--done" : ""}`}>
              <button
                className="shopping-category-header"
                onClick={() => toggleCategory(si)}
              >
                <span className="shopping-category-toggle">{isOpen ? "▼" : "▶"}</span>
                <span className="shopping-category-name">{step.text.replace(/:$/, "")}</span>
                <span className={`shopping-category-count${allDone ? " shopping-category-count--done" : ""}`}>
                  {doneCount}/{items.length}
                </span>
              </button>
              {isOpen && (
                <ul className="shopping-items">
                  {items.map((item, ii) => {
                    const done = !!checked[`${si}_${ii}`];
                    return (
                      <li
                        key={ii}
                        role="checkbox"
                        aria-checked={done}
                        className={`shopping-item${done ? " shopping-item--done" : ""}`}
                        onClick={() => toggleItem(si, ii)}
                      >
                        <span className="shopping-checkbox">{done ? "✓" : ""}</span>
                        <span className="shopping-item-label">{item}</span>
                        {!done && <span className="shopping-tap-hint">нажми</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Shown only during window.print() — invisible in normal flow */}
      <div className="shopping-print-area">
        <h1 className="shopping-print-title">Список покупок</h1>
        {totalChecked === 0
          ? steps.map((step, si) => (
              <div key={si} className="shopping-print-category">
                <div className="shopping-print-category-name">{step.text.replace(/:$/, "")}</div>
                <ul className="shopping-print-items">
                  {(step.items ?? []).map((item, i) => (
                    <li key={i} className="shopping-print-item">☐ {item}</li>
                  ))}
                </ul>
              </div>
            ))
          : steps.map((step, si) => {
              const checkedItems = (step.items ?? []).filter((_, i) => checked[`${si}_${i}`]);
              if (checkedItems.length === 0) return null;
              return (
                <div key={si} className="shopping-print-category">
                  <div className="shopping-print-category-name">{step.text.replace(/:$/, "")}</div>
                  <ul className="shopping-print-items">
                    {checkedItems.map((item, i) => (
                      <li key={i} className="shopping-print-item">☐ {item}</li>
                    ))}
                  </ul>
                </div>
              );
            })
        }
      </div>

      <div className="shopping-actions">
        <button className="shopping-print-btn" onClick={() => window.print()}>
          🖨 Печатать
        </button>
        <button className="reading-primary-btn" onClick={onAdvance}>
          Готово
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register in TASK_RENDERERS**

Find the `TASK_RENDERERS` object (around line 665 in original file, now shifted down) and add the entry:

```js
const TASK_RENDERERS = {
  read_text:           ReadTextTask,
  understand_text:     UnderstandTextTask,
  assemble_line:       AssembleLineTask,
  follow_instruction:  InstructionTask,
  shopping_list:       ShoppingListTask,   // ← add this line
};
```

- [ ] **Step 3: Verify the build compiles**

```
npx vite build --mode development 2>&1 | tail -20
```

Expected: no TypeScript/JSX errors.

- [ ] **Step 4: Commit**

```
git add src/topics/renderers/reading/index.jsx
git commit -m "feat(reading): add ShoppingListTask accordion component"
```

---

### Task 4: Add shopping list CSS

**Files:**
- Modify: `src/styles.css` (append at end of file)

- [ ] **Step 1: Append styles to `src/styles.css`**

Add at the very end of `src/styles.css`:

```css
/* ═══════════════════════════════════════════════
   Shopping List Mode
   ═══════════════════════════════════════════════ */

.shopping-body {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.shopping-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 16px;
}

.shopping-category {
  border: 2px solid #b2d8d8;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}

.shopping-category--done {
  border-color: #4caf90;
}

.shopping-category-header {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font-size: 1.1rem;
  font-weight: 600;
  color: #263131;
}

.shopping-category--done .shopping-category-header {
  background: #f0faf5;
}

.shopping-category-toggle {
  font-size: 0.85rem;
  color: #4caf90;
  min-width: 16px;
}

.shopping-category-name {
  flex: 1;
}

.shopping-category-count {
  font-size: 0.82rem;
  font-weight: 700;
  color: #888;
  background: #f0f0f0;
  border-radius: 12px;
  padding: 2px 10px;
}

.shopping-category-count--done {
  background: #c8f0de;
  color: #2a8a62;
}

.shopping-items {
  list-style: none;
  margin: 0;
  padding: 0 0 8px;
  border-top: 1px solid #e0f0f0;
}

.shopping-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  cursor: pointer;
  font-size: 1rem;
  color: #263131;
  transition: background 0.12s;
}

.shopping-item:active {
  background: #d8eeea;
}

.shopping-item--done {
  background: #e2f4ef;
}

.shopping-checkbox {
  width: 28px;
  height: 28px;
  border: 2px solid #b2d8d8;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  color: #fff;
  font-weight: 700;
  flex-shrink: 0;
}

.shopping-item--done .shopping-checkbox {
  background: #4caf90;
  border-color: #4caf90;
}

.shopping-item-label {
  flex: 1;
}

.shopping-tap-hint {
  font-size: 0.68rem;
  font-weight: 700;
  color: #b0c8c8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.shopping-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
  border-top: 1px solid #e0f0f0;
  background: #fff;
}

.shopping-print-btn {
  width: 100%;
  padding: 16px;
  font-size: 1.2rem;
  font-weight: 700;
  background: #2196f3;
  color: #fff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  letter-spacing: 0.02em;
}

.shopping-print-btn:active {
  background: #1976d2;
  transform: scale(0.98);
}

/* Print area: hidden in normal view */
.shopping-print-area {
  display: none;
}

/* ─── Print ─────────────────────────────────── */
@media print {
  body * {
    visibility: hidden;
  }

  .shopping-print-area,
  .shopping-print-area * {
    visibility: visible;
  }

  .shopping-print-area {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    padding: 20mm 15mm;
    box-sizing: border-box;
  }

  .shopping-print-title {
    font-size: 20pt;
    font-weight: bold;
    margin: 0 0 14pt;
    text-align: center;
    border-bottom: 2pt solid #000;
    padding-bottom: 6pt;
  }

  .shopping-print-category {
    margin-bottom: 10pt;
    page-break-inside: avoid;
  }

  .shopping-print-category-name {
    font-size: 13pt;
    font-weight: bold;
    margin-bottom: 4pt;
  }

  .shopping-print-items {
    list-style: none;
    margin: 0;
    padding: 0;
    columns: 2;
    column-gap: 20pt;
  }

  .shopping-print-item {
    font-size: 11pt;
    padding: 3pt 0;
    break-inside: avoid;
  }
}
```

- [ ] **Step 2: Commit**

```
git add src/styles.css
git commit -m "feat(styles): add shopping list accordion + print CSS"
```

---

### Task 5: Update deck build script to include shopping content

**Files:**
- Modify: `scripts/update-recipes-deck.mjs`

- [ ] **Step 1: Update version constants and add shopping list**

Replace the top of `scripts/update-recipes-deck.mjs` — change OLD_ZIP, NEW_ZIP, and NEW_VERSION:

```js
const OLD_ZIP = "public/decks/reading_dad_texts_v1.65.0.zip";
const NEW_ZIP = "public/decks/reading_dad_texts_v1.66.0.zip";
const NEW_VERSION = "1.66.0";
```

After the recipe loop (after `console.log(\`${id}.txt: ${steps} шагов — "${title.ru}"\`);`) but before building `newTopic`, add the shopping list:

```js
// Add shopping list text file to ZIP
const SHOPPING_TXT = "content/shopping/shopping.txt";
const shoppingContent = readFileSync(SHOPPING_TXT, "utf-8");
newZip.file("shopping/shopping.txt", shoppingContent);
console.log("shopping.txt: добавлен список покупок (14 категорий)");

// Shopping list text entry
const shoppingTextEntry = {
  id: "shopping_list",
  kind: "shopping_list",
  title: { ru: "Список покупок", en: "Shopping list" },
  file: "shopping/shopping.txt",
};

// Shopping list mode entry
const shoppingMode = {
  id: "shopping_list",
  type: "shopping_list",
  evaluation: "none",
  ui: {
    title: { ru: "Список в магазин", en: "Shopping list" },
    instruction: { ru: "Отметь, что нужно купить, и распечатай список" },
    icon: "media/icons/reading_read.svg",
  },
};
```

Then update the `newTopic` object to include shopping entries:

```js
const newTopic = {
  ...oldTopic,
  meta: {
    ...oldTopic.meta,
    version: NEW_VERSION,
  },
  texts: [...textsManifest, shoppingTextEntry],
  modes: [...(oldTopic.modes ?? []), shoppingMode],
};
```

- [ ] **Step 2: Commit**

```
git add scripts/update-recipes-deck.mjs
git commit -m "chore(script): add shopping list to recipes deck v1.66.0"
```

---

### Task 6: Rebuild the deck ZIP

**Files:**
- Creates: `public/decks/reading_dad_texts_v1.66.0.zip`
- Modifies: `public/decks/catalog.json`

- [ ] **Step 1: Run the script**

```
node scripts/update-recipes-deck.mjs
```

Expected output (last few lines):
```
shopping.txt: добавлен список покупок (14 категорий)

Создан: public/decks/reading_dad_texts_v1.66.0.zip (15 рецептов)
Обновлён catalog.json
```

- [ ] **Step 2: Verify the ZIP contains the shopping file**

```js
// Quick node check
import JSZip from "jszip";
import { readFileSync } from "fs";
const zip = await JSZip.loadAsync(readFileSync("public/decks/reading_dad_texts_v1.66.0.zip"));
console.log(Object.keys(zip.files).filter(f => f.includes("shopping")));
// Expected: ["shopping/shopping.txt"]
const topic = JSON.parse(await zip.file("topic.json").async("string"));
console.log(topic.texts.find(t => t.kind === "shopping_list")?.id);
// Expected: "shopping_list"
console.log(topic.modes.find(m => m.id === "shopping_list")?.id);
// Expected: "shopping_list"
```

Or run: `node -e "import('jszip').then(({default:JSZip})=>JSZip.loadAsync(require('fs').readFileSync('public/decks/reading_dad_texts_v1.66.0.zip')).then(z=>console.log(Object.keys(z.files).filter(f=>f.includes('shopping')))))"` 

- [ ] **Step 3: Commit the new ZIP and catalog**

```
git add public/decks/reading_dad_texts_v1.66.0.zip public/decks/catalog.json
git commit -m "chore: release reading_dad_texts v1.66.0 with shopping list mode"
```

---

### Task 7: Build frontend and deploy

- [ ] **Step 1: Run full build + deploy**

```
npm run deploy:prod
```

Expected: build completes, files uploaded to 192.168.1.163, both URLs verified green.

- [ ] **Step 2: Manual test in browser**

1. Open https://mirocard.kaplieva.help/
2. Open «Инструкции — рецепты» deck
3. If already installed — reinstall it (Settings → re-import) so the new version loads
4. Go to params → select mode «Список в магазин»
5. Start session
6. Verify: 14 categories visible, all collapsed
7. Tap «Овощи» → expands showing 10 items
8. Tap 3 items → they show ✓, count shows «3/10»
9. Tap «🖨 Печатать» → browser print dialog opens
10. In print preview: only checked items grouped by category, rest hidden
11. Tap «Готово» → session ends normally

- [ ] **Step 3: Test print with nothing checked**

Repeat step 9 with 0 items checked → print preview shows ALL categories with full item lists (full blank checklist template).
