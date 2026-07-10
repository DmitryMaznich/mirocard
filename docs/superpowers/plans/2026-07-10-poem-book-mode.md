# Poem-Book Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `read_poem_book` mode to the `reading_dad_poems` topic that presents 8
new character-trait poems as a page-flippable "book" (Back/Next + counter), reusing the
existing single-poem visual layout for each page.

**Architecture:** One new task type (`read_poem_book`) generates a single session task that
carries all 8 poem "pages"; a new React component manages `pageIndex` locally and renders
each page with the exact same building blocks (`ReadingTextBlock`, `ReadingIllustration`,
`useFitReadingText`, `ReadingCloseButton`) the existing single-poem view already uses. The
book is reached directly from the text list, bypassing the mode-picker screen, the same way
`safe_code`/`instruction`/`shopping_list` texts already do.

**Tech Stack:** React 19, Vite, Vitest (jsdom), JSZip + sharp (build-time content generation).

## Global Constraints

- Reuse existing CSS classes only (`reading-line-nav`, `reading-secondary-btn`,
  `reading-primary-btn`, `reading-line-count`, `reading-poem-wrap`, `reading-title`,
  `reading-content`) — no new stylesheet rules.
- No swipe gesture, no comprehension questions, no author field for the 8 new poems (per
  approved spec `docs/superpowers/specs/2026-07-10-poem-book-mode-design.md`).
- Page order fixed: Ваня → Лена → Даня → Катя → Андрей → Саша → Юля → Никита.
- Book cover / first page image: `neposlushni.webp` (converted from `Teaching poems/neposlushni.png`).
- Topic version bump `1.0.20` → `1.0.21`; old zip/catalog URL must not be overwritten
  (new file `reading_dad_poems_v1.0.21.zip`, old `..._v1.0.20.zip` stays on disk).
- Close button (`ReadingCloseButton`) must remain visible/functional on every page.

---

### Task 1: `generateTasks` support for `read_poem_book`

**Files:**
- Modify: `src/topics/renderers/reading/engine.js:20-137`
- Test: `src/topics/renderers/reading/engine.test.js`

**Interfaces:**
- Consumes: nothing new — `generateTasks(mode, topicRecord, textId, sessionParams, textOverride)` already exists (`engine.js:111`).
- Produces: for a text with `kind: "poem_book"`, `generateTasks({ type: "read_poem_book" }, topicRecord, textId)` returns `[{ type: "read_poem_book", textId, text }]` where `text.pages` is the array of page objects. Task 3 (React component) and Task 2 (mode registration) rely on this exact shape: `task.type === "read_poem_book"`, `task.text.pages[i]` with `{ id, kind: "poem", title, image, lines }`.

- [ ] **Step 1: Write the failing test**

Add to the end of `src/topics/renderers/reading/engine.test.js` (after the existing `safe_code mode` describe block):

```js
describe("read_poem_book mode", () => {
  const BOOK_TOPIC = {
    meta: { id: "reading_test", renderer: "reading" },
    texts: [
      {
        id: "character_traits_book",
        kind: "poem_book",
        title: { ru: "Педагогические стихи" },
        pages: [
          {
            id: "vanya",
            kind: "poem",
            title: { ru: "Ваня-непослушный" },
            image: "media/vanya.webp",
            lines: [{ id: "l1", text: "Ваня очень непослушный-" }],
          },
          {
            id: "lena",
            kind: "poem",
            title: { ru: "Лена-трудолюбивая" },
            image: "media/lena.webp",
            lines: [{ id: "l1", text: "Лена очень любит труд" }],
          },
        ],
      },
    ],
  };

  it("generates one read_poem_book task carrying all pages", () => {
    const tasks = generateTasks({ type: "read_poem_book" }, BOOK_TOPIC, "character_traits_book");
    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe("read_poem_book");
    expect(tasks[0].textId).toBe("character_traits_book");
    expect(tasks[0].text.pages).toHaveLength(2);
    expect(tasks[0].text.pages[0].id).toBe("vanya");
  });

  it("returns empty if no poem_book kind text exists", () => {
    const tasks = generateTasks({ type: "read_poem_book" }, TOPIC, "dad_best");
    expect(tasks).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/topics/renderers/reading/engine.test.js`
Expected: FAIL — both new assertions on `tasks` fail because `generateTasks` has no
`"read_poem_book"` case yet, so the `default` branch returns `[]`.

- [ ] **Step 3: Implement the minimal code**

In `src/topics/renderers/reading/engine.js`, add a new builder function right after
`buildSafeCodeTask` (currently ends at line 75, right before `function seededShuffle`):

```js
function buildPoemBookTask(text) {
  return {
    type: "read_poem_book",
    textId: text.id,
    text,
  };
}
```

Then add a case to the `switch (mode.type)` block inside `generateTasks` (currently at
`engine.js:115-136`), right after the `case "safe_code":` block:

```js
    case "read_poem_book":
      return text.kind === "poem_book" ? [buildPoemBookTask(text)] : [];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/topics/renderers/reading/engine.test.js`
Expected: PASS (all tests in the file, including the two new ones).

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/reading/engine.js src/topics/renderers/reading/engine.test.js
git commit -m "feat(reading): add read_poem_book task generation"
```

---

### Task 2: Register the `read_poem_book` mode

**Files:**
- Modify: `src/topics/topicLoader.js:394-418` (mode description registry)
- Modify: `src/topics/topicLoader.js:762-781` (`DEFAULT_MODES.reading`)
- Modify: `src/topics/topicLoader.test.js:184` (existing assertion on default reading modes)

**Interfaces:**
- Consumes: nothing new.
- Produces: `DEFAULT_MODES.reading` now includes an object with `id: "read_poem_book"`,
  `type: "read_poem_book"`, `evaluation: "none"`. Every reading-renderer topic record's
  `modes` array (built by `normalizeReading`/`mergeDefaultModes*`) will include this entry.
  Task 4 (`TextPickerScreen.jsx`) relies on the mode id string `"read_poem_book"` matching
  exactly what it passes to `setActiveModeId(...)`.

- [ ] **Step 1: Run the existing test to see current (passing) state**

Run: `npx vitest run src/topics/topicLoader.test.js`
Expected: PASS (baseline, before any change).

- [ ] **Step 2: Add the mode definition**

In `src/topics/topicLoader.js`, inside `DEFAULT_MODES.reading` array, insert a new object
right after the `safe_code` entry (which currently ends at line 780-781, just before the
array's closing `],` at line 782):

```js
    {
      id: "read_poem_book",
      type: "read_poem_book",
      evaluation: "none",
      ui: {
        title: "Педагогические стихи",
        instruction: "Листайте книгу вместе с ребёнком",
        icon: "media/icons/reading_read.svg",
      },
    },
```

- [ ] **Step 3: Add the info-popup description (optional UI text registry)**

In the same file, inside the `reading: { ... }` block of `DEFAULT_MODE_METHODOLOGY`
(starts at `topicLoader.js:358`; the `reading` sub-object currently has `read_text`,
`understand_text`, `assemble_text`, `safe_code` keys, ending around line 417-418), add a
new key right after `safe_code`:

```js
    read_poem_book: {
      summary: "Книга из 8 стихов о характере — читаем вместе, перелистывая страницы.",
      text: "Специалист листает книгу вместе с ребёнком: каждая страница — отдельный стих с иллюстрацией, доступны кнопки «Назад» и «Дальше».",
      goal: "Ребёнок слушает и обсуждает разные модели поведения через короткие стихи.",
    },
```

- [ ] **Step 4: Run the topicLoader test to see the now-expected failure**

Run: `npx vitest run src/topics/topicLoader.test.js`
Expected: FAIL on the test `"imports a reading topic with texts and no cards"` — the
assertion `expect(record.modes.map((m) => m.id)).toEqual([...5 ids...])` now receives 6 ids
because `DEFAULT_MODES.reading` gained a new default mode.

- [ ] **Step 5: Update the test's expectation**

In `src/topics/topicLoader.test.js`, change line 184 from:

```js
    expect(record.modes.map((m) => m.id)).toEqual(["read_text", "understand_text", "assemble_text", "follow_instruction", "safe_code"]);
```

to:

```js
    expect(record.modes.map((m) => m.id)).toEqual(["read_text", "understand_text", "assemble_text", "follow_instruction", "safe_code", "read_poem_book"]);
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/topics/topicLoader.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/topics/topicLoader.js src/topics/topicLoader.test.js
git commit -m "feat(reading): register read_poem_book as a default reading mode"
```

---

### Task 3: `ReadPoemBookTask` React component

**Files:**
- Modify: `src/topics/renderers/reading/index.jsx:178-296` (add component after `ReadTextTask`)
- Modify: `src/topics/renderers/reading/index.jsx:1289-1296` (`TASK_RENDERERS` registration)

**Interfaces:**
- Consumes: `task` shaped as produced by Task 1 (`{ type: "read_poem_book", textId, text }`,
  `text.pages` array of `{ id, kind: "poem", title, image, lines }`); `topicId` (string);
  `onAdvance` (function, called with no args to end the session); `onClose` (function or
  undefined, called with no args to close mid-session). Also reuses existing helpers already
  defined in this file: `ReadingTextBlock({ lines })`, `ReadingIllustration({ topicId, text, illustrationRef })`,
  `useFitReadingText(active, deps)` (returns `{ bodyRef, wrapRef, contentRef, illustrationRef }`),
  `ReadingCloseButton({ onClose })`, `getTopicTitle(title)` (imported at top of file).
- Produces: registers itself under the key `"read_poem_book"` in `TASK_RENDERERS`, so
  `ReadingRenderer` (the file's default export, `index.jsx:1298`) dispatches to it whenever
  `task.type === "read_poem_book"`.

There is no automated render test for this component — no other file in
`src/topics/renderers/*/index.jsx` has JSX component tests in this codebase (no
`@testing-library/react` dependency), so verification here is manual, deferred to Task 6.

- [ ] **Step 1: Add the component**

In `src/topics/renderers/reading/index.jsx`, insert this function immediately after the
closing brace of `ReadTextTask` (currently ends at line 243, right before
`function UnderstandTextTask(...)`):

```jsx
function ReadPoemBookTask({ task, topicId, onAdvance, onClose }) {
  const pages = task.text?.pages ?? [];
  const [pageIndex, setPageIndex] = useState(0);
  const page = pages[pageIndex] ?? pages[0];
  const fit = useFitReadingText(true, [page?.id]);

  if (!page) return null;

  return (
    <div className="session-body reading-body" ref={fit.bodyRef}>
      <ReadingCloseButton onClose={onClose} />
      <div className="reading-poem-wrap" ref={fit.wrapRef}>
        <div className="reading-title">{getTopicTitle(page.title)}</div>
        <div className="reading-content" ref={fit.contentRef}>
          <ReadingTextBlock lines={page.lines} />
        </div>
      </div>
      <ReadingIllustration topicId={topicId} text={page} illustrationRef={fit.illustrationRef} />
      <div className="reading-line-nav">
        <button
          className="reading-secondary-btn"
          disabled={pageIndex <= 0}
          onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
        >
          Назад
        </button>
        <span className="reading-line-count">{pageIndex + 1} / {pages.length}</span>
        {pageIndex + 1 < pages.length ? (
          <button
            className="reading-primary-btn"
            onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
          >
            Дальше
          </button>
        ) : (
          <button className="reading-primary-btn" onClick={onAdvance}>Готово</button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register it in `TASK_RENDERERS`**

In the same file, change:

```js
const TASK_RENDERERS = {
  read_text:           ReadTextTask,
  understand_text:     UnderstandTextTask,
  assemble_line:       AssembleLineTask,
  follow_instruction:  InstructionTask,
  shopping_list:       ShoppingListTask,
  safe_code:           SafeCodeTask,
};
```

to:

```js
const TASK_RENDERERS = {
  read_text:           ReadTextTask,
  understand_text:     UnderstandTextTask,
  assemble_line:       AssembleLineTask,
  follow_instruction:  InstructionTask,
  shopping_list:       ShoppingListTask,
  safe_code:           SafeCodeTask,
  read_poem_book:      ReadPoemBookTask,
};
```

- [ ] **Step 3: Run the full reading engine/component test file to confirm nothing broke**

Run: `npx vitest run src/topics/renderers/reading/`
Expected: PASS (this only touches `index.jsx`, which has no dedicated test file, but
`engine.test.js` and `parseRecipeTxt.test.js` in the same directory must still pass since
`index.jsx` imports from `engine.js`).

- [ ] **Step 4: Commit**

```bash
git add src/topics/renderers/reading/index.jsx
git commit -m "feat(reading): add ReadPoemBookTask component for page-flip navigation"
```

---

### Task 4: Wire the book into the text picker

**Files:**
- Modify: `src/features/reading/TextPickerScreen.jsx:9` (`KIND_LABELS`)
- Modify: `src/features/reading/TextPickerScreen.jsx:72-86` (`pickText`)
- Modify: `src/features/reading/TextPickerScreen.jsx:131-135` (metadata line)

**Interfaces:**
- Consumes: a text object with `kind === "poem_book"` (produced by Task 5's content) and
  the mode id `"read_poem_book"` registered by Task 2.
- Produces: tapping a `poem_book` text in the list calls `setActiveModeId("read_poem_book")`
  and `setScreen("home")`, matching the existing `instruction`/`shopping_list`/`safe_code`
  pattern exactly (same two calls, same order).

- [ ] **Step 1: Add the kind label**

Change:

```js
const KIND_LABELS = { poem: "стих", instruction: "инструкция", shopping_list: "список", safe_code: "сейф", sentence_pool: "задания" };
```

to:

```js
const KIND_LABELS = { poem: "стих", instruction: "инструкция", shopping_list: "список", safe_code: "сейф", sentence_pool: "задания", poem_book: "книга" };
```

- [ ] **Step 2: Add the dispatch branch in `pickText`**

Change:

```js
  function pickText(text) {
    setActiveText(text);
    if (text.kind === "instruction") {
      setActiveModeId("follow_instruction");
      setScreen("home");
    } else if (text.kind === "shopping_list") {
      setActiveModeId("shopping_list");
      setScreen("home");
    } else if (text.kind === "safe_code") {
      setActiveModeId("safe_code");
      setScreen("home");
    } else {
      setScreen("modes");
    }
  }
```

to:

```js
  function pickText(text) {
    setActiveText(text);
    if (text.kind === "instruction") {
      setActiveModeId("follow_instruction");
      setScreen("home");
    } else if (text.kind === "shopping_list") {
      setActiveModeId("shopping_list");
      setScreen("home");
    } else if (text.kind === "safe_code") {
      setActiveModeId("safe_code");
      setScreen("home");
    } else if (text.kind === "poem_book") {
      setActiveModeId("read_poem_book");
      setScreen("home");
    } else {
      setScreen("modes");
    }
  }
```

- [ ] **Step 3: Fix the metadata line for `poem_book`**

Change:

```jsx
                  {text.kind !== "instruction" && (
                    <div className="topic-item__meta">
                      {`${text.lines?.length ?? 0} строк · уровень ${text.level ?? 1}`}
                    </div>
                  )}
```

to:

```jsx
                  {text.kind === "poem_book" ? (
                    <div className="topic-item__meta">{`${text.pages?.length ?? 0} стихов`}</div>
                  ) : text.kind !== "instruction" && (
                    <div className="topic-item__meta">
                      {`${text.lines?.length ?? 0} строк · уровень ${text.level ?? 1}`}
                    </div>
                  )}
```

- [ ] **Step 4: Lint the file**

Run: `npx eslint src/features/reading/TextPickerScreen.jsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/reading/TextPickerScreen.jsx
git commit -m "feat(reading): route poem_book texts straight into read_poem_book mode"
```

---

### Task 5: Generate the 8-poem content and rebuild the deck zip

**Files:**
- Modify: `scripts/generate-reading-demo.mjs`
- Read (source assets, not committed): `Teaching poems/neposlushni.png`, `Teaching poems/Trudoljubiv.png`, `Teaching poems/Grjaznulja.png`, `Teaching poems/Zhadina.png`, `Teaching poems/Trus.png`, `Teaching poems/Smelij.png`, `Teaching poems/kaprizulja.png`, `Teaching poems/Lenivij.png`
- Produces (generated, committed): `public/decks/reading_dad_poems_v1.0.21.zip`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure content/build step); the resulting zip's
  `topic.json` must contain a `texts[]` entry with `kind: "poem_book"` and 8 `pages`, each
  page shaped exactly as Task 1's test / Task 3's component expect
  (`{ id, kind: "poem", title: { ru }, image: "media/<id>.webp", lines: [{ id, text }, ...] }`).
- Produces: the zip file consumed by Task 6 (`catalog.json`) and by manual verification
  (Task 7).

- [ ] **Step 1: Add the image conversion helper and source loading**

In `scripts/generate-reading-demo.mjs`, right after the existing `buildSisterPhoto` function
and its invocation (currently lines 15-22), add:

```js
async function buildPoemPageImage(pngPath) {
  return sharp(pngPath)
    .resize(900, 900, { fit: "inside" })
    .webp({ quality: 85 })
    .toBuffer();
}

const poemBookSourceDir = fileURLToPath(new URL("../Teaching poems/", import.meta.url));
const poemBookPages = [
  { id: "vanya",  file: "neposlushni.png",  title: "Ваня-непослушный" },
  { id: "lena",   file: "Trudoljubiv.png",  title: "Лена-трудолюбивая" },
  { id: "danya",  file: "Grjaznulja.png",   title: "Даня-грязнуля" },
  { id: "katya",  file: "Zhadina.png",      title: "Катя-жадина" },
  { id: "andrey", file: "Trus.png",         title: "Андрей-трус" },
  { id: "sasha",  file: "Smelij.png",       title: "Саша-смелый" },
  { id: "yulya",  file: "kaprizulja.png",   title: "Юля-капризуля" },
  { id: "nikita", file: "Lenivij.png",      title: "Никита-ленивый" },
];
const poemBookImages = Object.fromEntries(
  await Promise.all(
    poemBookPages.map(async ({ id, file }) => [id, await buildPoemPageImage(`${poemBookSourceDir}${file}`)])
  )
);
```

- [ ] **Step 2: Bump the version**

Change:

```js
    id: "reading_dad_poems",
    version: "1.0.20",
```

to:

```js
    id: "reading_dad_poems",
    version: "1.0.21",
```

- [ ] **Step 3: Register the new mode in the manifest**

Change:

```js
  modes: [
    { id: "read_text", requirePin: false },
    { id: "understand_text", requirePin: false },
    { id: "assemble_text", requirePin: false },
    { id: "follow_instruction", requirePin: false },
  ],
```

to:

```js
  modes: [
    { id: "read_text", requirePin: false },
    { id: "understand_text", requirePin: false },
    { id: "assemble_text", requirePin: false },
    { id: "follow_instruction", requirePin: false },
    { id: "read_poem_book", requirePin: false },
  ],
```

- [ ] **Step 4: Add the `poem_book` text entry**

In the `texts: [...]` array, insert this object right after the `sister_love` entry (which
currently ends at line 453, right before the array's closing `],` at line 454):

```js
    {
      id: "character_traits_book",
      kind: "poem_book",
      title: { ru: "Педагогические стихи" },
      image: "media/vanya.webp",
      level: 1,
      pages: [
        {
          id: "vanya",
          kind: "poem",
          title: { ru: "Ваня-непослушный" },
          image: "media/vanya.webp",
          lines: [
            { id: "l1", text: "Ваня очень непослушный-" },
            { id: "l2", text: "Папу с мамой он не слушал!" },
            { id: "l3", text: "Не получит он за это," },
            { id: "l4", text: "Ни качелей, ни планшета!" },
          ],
        },
        {
          id: "lena",
          kind: "poem",
          title: { ru: "Лена-трудолюбивая" },
          image: "media/lena.webp",
          lines: [
            { id: "l1", text: "Лена очень любит труд" },
            { id: "l2", text: "Помогает там и тут!" },
            { id: "l3", text: "Убирает и стирает," },
            { id: "l4", text: "Пыль все время вытирает!" },
            { id: "l5", text: "Все в восторге! Что за диво!" },
            { id: "l6", text: "Как она трудолюбива!" },
          ],
        },
        {
          id: "danya",
          kind: "poem",
          title: { ru: "Даня-грязнуля" },
          image: "media/danya.webp",
          lines: [
            { id: "l1", text: "Даня мыться не любил!" },
            { id: "l2", text: "Тело очень редко мыл!" },
            { id: "l3", text: "Мама с папой лишь вздохнули!" },
            { id: "l4", text: "Даню все зовут грязнулей!" },
            { id: "l5", text: "С ним никто дружить не хочет," },
            { id: "l6", text: "Так как он вонючий очень!" },
          ],
        },
        {
          id: "katya",
          kind: "poem",
          title: { ru: "Катя-жадина" },
          image: "media/katya.webp",
          lines: [
            { id: "l1", text: "Кате сложно поделиться" },
            { id: "l2", text: "И игрушками, и пиццей!" },
            { id: "l3", text: "И сидит в углу одна-" },
            { id: "l4", text: "Так как жадная она!" },
          ],
        },
        {
          id: "andrey",
          kind: "poem",
          title: { ru: "Андрей-трус" },
          image: "media/andrey.webp",
          lines: [
            { id: "l1", text: "Наш Андрей всего боится" },
            { id: "l2", text: "Грома, пауков и птицу," },
            { id: "l3", text: "И комарика укус…" },
            { id: "l4", text: "Наш Андрюша просто трус." },
          ],
        },
        {
          id: "sasha",
          kind: "poem",
          title: { ru: "Саша-смелый" },
          image: "media/sasha.webp",
          lines: [
            { id: "l1", text: "Ну а Саша смелый очень-" },
            { id: "l2", text: "Не боится даже ночью!" },
            { id: "l3", text: "Защищает слабых он!" },
            { id: "l4", text: "Саша просто чемпион!!!" },
          ],
        },
        {
          id: "yulya",
          kind: "poem",
          title: { ru: "Юля-капризуля" },
          image: "media/yulya.webp",
          lines: [
            { id: "l1", text: "Наша Юля-капризуля!" },
            { id: "l2", text: "Ноет, плачет и ревёт…" },
            { id: "l3", text: "И поэтому никто ей" },
            { id: "l4", text: "Ничего и не даёт!" },
          ],
        },
        {
          id: "nikita",
          kind: "poem",
          title: { ru: "Никита-ленивый" },
          image: "media/nikita.webp",
          lines: [
            { id: "l1", text: "Никита сутки напролёт" },
            { id: "l2", text: "С кровати мягкой не встаёт." },
            { id: "l3", text: "Маме он не помогает," },
            { id: "l4", text: "Умных книжек не читает," },
            { id: "l5", text: "Чтоб вы знали, между прочим," },
            { id: "l6", text: "Быть ленивым плохо очень!" },
          ],
        },
      ],
    },
```

- [ ] **Step 5: Add the 8 images and rename the output file**

Change:

```js
const zip = new JSZip();
zip.file("topic.json", JSON.stringify(manifest, null, 2));
zip.file("media/dad_best.webp", dadBestImage);
zip.file("media/mom_love.webp", momLoveImage);
zip.file("media/family.svg", familySvg);
zip.file("media/sister_alina.webp", alinaPhoto);
zip.file("media/sister_polina.webp", polinaPhoto);
const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync("public/decks/reading_dad_poems_v1.0.20.zip", buffer);
```

to:

```js
const zip = new JSZip();
zip.file("topic.json", JSON.stringify(manifest, null, 2));
zip.file("media/dad_best.webp", dadBestImage);
zip.file("media/mom_love.webp", momLoveImage);
zip.file("media/family.svg", familySvg);
zip.file("media/sister_alina.webp", alinaPhoto);
zip.file("media/sister_polina.webp", polinaPhoto);
for (const { id } of poemBookPages) {
  zip.file(`media/${id}.webp`, poemBookImages[id]);
}
const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync("public/decks/reading_dad_poems_v1.0.21.zip", buffer);
```

- [ ] **Step 6: Run the generator**

Run: `node scripts/generate-reading-demo.mjs`
Expected: exits with no errors; `public/decks/reading_dad_poems_v1.0.21.zip` exists.

- [ ] **Step 7: Verify the zip contents**

Run:

```bash
node -e "
import('jszip').then(async ({ default: JSZip }) => {
  const fs = await import('node:fs');
  const buf = fs.readFileSync('public/decks/reading_dad_poems_v1.0.21.zip');
  const zip = await JSZip.loadAsync(buf);
  const topic = JSON.parse(await zip.files['topic.json'].async('string'));
  const book = topic.texts.find((t) => t.kind === 'poem_book');
  console.log('pages:', book.pages.length);
  console.log('modes:', topic.modes.map((m) => m.id));
  console.log('media files:', Object.keys(zip.files).filter((f) => f.startsWith('media/vanya') || f.startsWith('media/nikita')));
});
"
```

Expected output: `pages: 8`, `modes:` array includes `read_poem_book`, `media files:` lists
`media/vanya.webp` and `media/nikita.webp`.

- [ ] **Step 8: Commit**

```bash
git add scripts/generate-reading-demo.mjs public/decks/reading_dad_poems_v1.0.21.zip
git commit -m "feat(reading): generate 8-poem character-traits book content (v1.0.21)"
```

---

### Task 6: Update the catalog entry

**Files:**
- Modify: `public/decks/catalog.json:3-17`

**Interfaces:**
- Consumes: the file produced by Task 5 (`reading_dad_poems_v1.0.21.zip`).
- Produces: the app's topic library will offer version `1.0.21` for `reading_dad_poems`;
  the old `1.0.20` zip file stays on disk untouched (no URL is overwritten).

- [ ] **Step 1: Update the catalog entry**

Change:

```json
    {
      "id": "reading_dad_poems",
      "version": "1.0.20",
      "title": {
        "ru": "Чтение: Стихи",
        "en": "Reading: Poems"
      },
      "description": {
        "ru": "Четыре стихотворения: совместное чтение, иллюстрация, вопросы по смыслу и сборка стихотворения из слов.",
        "en": "Four poems: shared reading, illustration, comprehension questions, and poem assembly."
      },
      "url": "./decks/reading_dad_poems_v1.0.20.zip",
      "status": "release",
      "access": "free"
    },
```

to:

```json
    {
      "id": "reading_dad_poems",
      "version": "1.0.21",
      "title": {
        "ru": "Чтение: Стихи",
        "en": "Reading: Poems"
      },
      "description": {
        "ru": "Четыре стихотворения и книга из восьми стихов о характере: совместное чтение, иллюстрация, вопросы по смыслу и сборка стихотворения из слов.",
        "en": "Four poems plus an eight-poem character-traits book: shared reading, illustration, comprehension questions, and poem assembly."
      },
      "url": "./decks/reading_dad_poems_v1.0.21.zip",
      "status": "release",
      "access": "free"
    },
```

- [ ] **Step 2: Validate the JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/decks/catalog.json','utf8')); console.log('valid')"`
Expected: prints `valid`.

- [ ] **Step 3: Commit**

```bash
git add public/decks/catalog.json
git commit -m "chore(reading): point catalog at reading_dad_poems v1.0.21"
```

---

### Task 7: End-to-end verification

**Files:** none (verification only).

**Interfaces:** none — this task exercises the full stack built by Tasks 1-6.

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, no regressions in any test file.

- [ ] **Step 2: Run the linter**

Run: `npx eslint .`
Expected: no errors.

- [ ] **Step 3: Run a production build**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 4: Manual browser verification**

Start the dev server (`npm run dev`), open the app, navigate to the "Чтение: Стихи" topic
for a student. If the topic record was already imported at an older version in local/dev
storage, trigger the app's topic update flow (or remove and re-add the topic) so the new
`1.0.21` content loads. Then:

1. Confirm a new list item "Педагогические стихи" appears in the text list, with the
   "Ваня-непослушный" illustration as its cover and "8 стихов" as its meta line.
2. Tap it — confirm it goes straight into the reading session (no mode-picker screen).
3. Confirm page 1 shows title "Ваня-непослушный", the 4-line poem, and the matching
   illustration.
4. Tap "Дальше" through all 8 pages — confirm the counter goes `1 / 8` → `8 / 8`, each
   page's title/text/illustration matches the content from Task 5 in order (Ваня → Лена →
   Даня → Катя → Андрей → Саша → Юля → Никита), and "Назад" is disabled only on page 1.
5. On the last page, confirm the button reads "Готово" and tapping it ends the session.
6. Re-enter the book, go to page 4 or later, and confirm the close button (✕) is visible
   and closes the session mid-book.
7. Resize the browser to a small/mobile viewport and confirm long pages (e.g. "Лена-
   трудолюбивая", 6 lines) still fit on screen without clipping (auto-fit shrinking should
   kick in, same as the existing single-poem view).

- [ ] **Step 5: Report results**

If any check in Step 4 fails, fix the relevant task's code before proceeding — do not mark
this task complete with a failing manual check.
