# «Код от сейфа» (safe_code mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `safe_code` mode to the "Инструкция" reading theme (`reading_dad_texts`): the child reads one instruction at a time pointing to a physical hiding spot, enters the digit found there on a keypad, and after all digits are confirmed the safe opens and a reward video plays.

**Architecture:** New `text.kind: "safe_code"` holds only a fixed pool of hiding-spot phrases (used as picklist options, not real content). A dedicated settings screen (`SafeCodeParamsContent`) lets the adult pick, per session, which spots hold which digit (2–5 of them), saved to a small KV entry. The session renders a new `SafeCodeTask` component that walks through the configured spots one at a time, checking each entered digit against the saved ground truth immediately, then shows a celebratory "safe opened" screen that locally triggers the existing `RewardVideoModal`.

**Tech Stack:** React (Vite), Zustand store (`useAppStore`), IndexedDB-backed KV (`@/core/db`, `@/core/groupStore`), Vitest for unit tests, JSZip for deck packaging.

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-07-08-safe-code-design.md` — every requirement below traces back to it.
- Canonical project root is `C:\Users\dmazn\Projects\Mirocard2`. Never edit files under `runtime/`, `dist/`, `.superpowers/deploy-copy-*`, `codex-deploy-*`, `__codex_deploy_*`, or any restored-backup folder — several stray copies of this repo exist at the repo root; only edit files under the real `src/`, `scripts/`, `content/`, `public/`, `docs/`.
- When running `npx vitest run <path>`, vitest's positional argument is a substring filter, not an exact path — it will also match same-named files inside the stray copies above. Only trust results whose reported path starts with `src/` (no leading stray-folder segment).
- `src/topics/topicLoader.test.js:184` (`imports a reading topic with texts and no cards`) is a **pre-existing broken test**, unrelated to this feature — it still expects the mode list from before `follow_instruction` was added to `DEFAULT_MODES.reading`. Task 3 below fixes this in the same edit that touches that array, since leaving it stale would make the diff confusing; do not otherwise "fix" unrelated failing tests.
- Recipe deck content is rebuilt via `scripts/update-recipes-deck.mjs`, which **completely rebuilds `topic.json`'s `texts` array from `content/recipes/*.txt`** — any text not sourced that way (like our safe_code locations pool) will be silently dropped on the next recipe deploy unless the script itself is taught to also include it. Task 4 handles this.
- No new image/SVG assets — the design is explicitly text-only except for the safe/keypad UI chrome.
- Follow the existing code style: no comments except where a non-obvious constraint needs explaining, no unrelated refactors.

---

## File Structure

New files:
- `content/safe_code/locations.json` — the fixed pool of hiding-spot phrases, source of truth for the deck rebuild script.
- `src/features/reading/SafeCodeParamsContent.jsx` — settings screen (spot + digit picker, "generate random", start button).

Modified files:
- `src/core/groupStore.js` — add `getSafeCodeConfig`/`saveSafeCodeConfig`, `getSafeCodeCustomLocations`/`saveSafeCodeCustomLocations`, `getSafeCodeLog`/`appendSafeCodeLog`.
- `src/topics/renderers/reading/engine.js` — add `buildSafeCodeTask` + `case "safe_code"` in `generateTasks`.
- `src/topics/renderers/reading/engine.test.js` — cover the new case.
- `src/topics/topicLoader.js` — add `safe_code` to `DEFAULT_MODES.reading` and `DEFAULT_MODE_METHODOLOGY.reading`.
- `src/topics/topicLoader.test.js` — fix the stale mode-list assertion, add a safe_code-specific assertion.
- `scripts/update-recipes-deck.mjs` — read `content/safe_code/locations.json`, inject it into `textsManifest`, rebuild the zip, bump version, update `catalog.json`.
- `src/features/reading/TextPickerScreen.jsx` — short-circuit navigation for `kind === "safe_code"`, add its `KIND_LABELS` entry.
- `src/features/home/ModePickerScreen.jsx` — `filterReadingModes` rule for `kind === "safe_code"`.
- `src/features/session/ParamsScreen.jsx` — `isReadingSafeCode` branch rendering `SafeCodeParamsContent`.
- `src/features/session/SessionScreen.jsx` — add `"safe_code"` to the `isInstruction` check and the adult-confirm bypass list.
- `src/topics/renderers/reading/index.jsx` — new `SafeCodeTask` component, registered in `TASK_RENDERERS`.
- `src/styles.css` — new `.safe-code-*` classes for the params screen rows and the session UI (header tracker / instruction / numpad).

---

### Task 1: `groupStore.js` — safe_code KV storage

**Files:**
- Modify: `src/core/groupStore.js` (append near the other feature-specific KV sections, after the "Planner cycle" section, i.e. after line 323)

**Interfaces:**
- Produces: `getSafeCodeConfig(topicId): Promise<{codeLength:number, locations:{phrase:string, digit:number}[]} | null>`, `saveSafeCodeConfig(topicId, config)`, `getSafeCodeCustomLocations(topicId): Promise<{label:string, phrase:string}[]>`, `saveSafeCodeCustomLocations(topicId, locations)`, `getSafeCodeLog(topicId): Promise<object[]>`, `appendSafeCodeLog(topicId, entry)`.

- [ ] **Step 1: Add the KV helpers**

Append to `src/core/groupStore.js` (after the `RECIPE_KV_PREFIXES`/`pullRecipeKvFromServer` block, i.e. at the end of the file):

```js
// ─── Safe code (safe_code mode) session config ───────────────────────────────

const safeCodeConfigKey = (topicId) => `safe_code_config_${topicId}`;

export async function getSafeCodeConfig(topicId) {
  const db = await getDb();
  return (await kv.get(db, safeCodeConfigKey(topicId))) ?? null;
}

export async function saveSafeCodeConfig(topicId, config) {
  const db = await getDb();
  const key = safeCodeConfigKey(topicId);
  await kv.set(db, key, config);
  pushOp("kv.upsert", { key, value: config }).catch(() => {});
}

// ─── Safe code custom (user-typed) hiding spots ──────────────────────────────

const safeCodeCustomLocationsKey = (topicId) => `safe_code_custom_locations_${topicId}`;

export async function getSafeCodeCustomLocations(topicId) {
  const db = await getDb();
  return (await kv.get(db, safeCodeCustomLocationsKey(topicId))) ?? [];
}

export async function saveSafeCodeCustomLocations(topicId, locations) {
  const db = await getDb();
  const key = safeCodeCustomLocationsKey(topicId);
  await kv.set(db, key, locations);
  pushOp("kv.upsert", { key, value: locations }).catch(() => {});
}

// ─── Safe code attempt log (analytics only, not synced) ──────────────────────

const safeCodeLogKey = (topicId) => `safe_code_log_${topicId}`;

export async function getSafeCodeLog(topicId) {
  const db = await getDb();
  return (await kv.get(db, safeCodeLogKey(topicId))) ?? [];
}

export async function appendSafeCodeLog(topicId, entry) {
  const db = await getDb();
  const key = safeCodeLogKey(topicId);
  const existing = (await kv.get(db, key)) ?? [];
  const updated = [...existing, entry].slice(-200);
  await kv.set(db, key, updated);
}
```

- [ ] **Step 2: Sanity-check with a scratch script**

Run:
```bash
node -e "
import('./src/core/groupStore.js').then(async (m) => {
  await m.saveSafeCodeConfig('t1', { codeLength: 2, locations: [{ phrase: 'под подушкой', digit: 3 }] });
  console.log(await m.getSafeCodeConfig('t1'));
});
"
```
This will fail because `getDb()` needs a browser IndexedDB shim outside Vitest — that's expected and fine; this file has no dedicated test suite in this codebase (same as `getShoppingHistory`/`saveShoppingHistory` etc., which are also untested thin KV wrappers). Skip automated testing for this task; correctness is verified end-to-end in Task 7's manual pass. Instead, just confirm the file still parses:

```bash
node --check src/core/groupStore.js
```
Expected: no output (exit code 0).

- [ ] **Step 3: Commit**

```bash
git add src/core/groupStore.js
git commit -m "feat(safe_code): add KV storage for session config, custom locations, and attempt log"
```

---

### Task 2: `engine.js` — `safe_code` task generation

**Files:**
- Modify: `src/topics/renderers/reading/engine.js`
- Modify: `src/topics/renderers/reading/engine.test.js`

**Interfaces:**
- Consumes: nothing new — same `generateTasks(mode, topicRecord, textId, sessionParams, textOverride)` signature already exported.
- Produces: `generateTasks({ type: "safe_code" }, topicRecord, textId)` returns `[{ type: "safe_code", textId, text }]` when the resolved text has `kind === "safe_code"`, else `[]`.

- [ ] **Step 1: Write the failing test**

Add to `src/topics/renderers/reading/engine.test.js` (after the `daily_sentences mode` describe block, i.e. at the end of the file):

```js
describe("safe_code mode", () => {
  const SAFE_CODE_TOPIC = {
    meta: { id: "reading_test", renderer: "reading" },
    texts: [
      {
        id: "safe_code_locations",
        kind: "safe_code",
        title: { ru: "Код от сейфа" },
        spots: [
          { id: "pillow", label: "Подушка", phrase: "под подушкой" },
          { id: "box", label: "Коробка", phrase: "в коробке" },
        ],
      },
    ],
  };

  it("generates one safe_code task ignoring textId", () => {
    const tasks = generateTasks({ type: "safe_code" }, SAFE_CODE_TOPIC, "any_text_id");
    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe("safe_code");
    expect(tasks[0].text.kind).toBe("safe_code");
    expect(tasks[0].text.spots).toHaveLength(2);
  });

  it("returns empty if no safe_code kind text exists", () => {
    const tasks = generateTasks({ type: "safe_code" }, TOPIC, "dad_best");
    expect(tasks).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run ./src/topics/renderers/reading/engine.test.js`
Expected: FAIL — `generateTasks({ type: "safe_code" }, ...)` returns `[]` (hits the `default:` branch) instead of the expected task.

- [ ] **Step 3: Implement**

In `src/topics/renderers/reading/engine.js`, add a builder next to `buildShoppingListTask` (after line 67):

```js
function buildSafeCodeTask(text) {
  return {
    type: "safe_code",
    textId: text.id,
    text,
  };
}
```

Add a case to the `switch (mode.type)` inside `generateTasks` (after the `case "shopping_list":` block, i.e. after line 119):

```js
    case "safe_code":
      return text.kind === "safe_code" ? [buildSafeCodeTask(text)] : [];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run ./src/topics/renderers/reading/engine.test.js`
Expected: PASS (all tests in the file, including the two new ones).

- [ ] **Step 5: Commit**

```bash
git add src/topics/renderers/reading/engine.js src/topics/renderers/reading/engine.test.js
git commit -m "feat(safe_code): generate a single safe_code task from a safe_code-kind text"
```

---

### Task 3: `topicLoader.js` — register the `safe_code` mode default

**Files:**
- Modify: `src/topics/topicLoader.js`
- Modify: `src/topics/topicLoader.test.js`

**Interfaces:**
- Produces: `DEFAULT_MODES.reading` now includes a `safe_code` mode object (`id: "safe_code"`, `type: "safe_code"`, `evaluation: "none"`); `DEFAULT_MODE_METHODOLOGY.reading.safe_code` documents it. Any reading-renderer topic whose zip doesn't already list `safe_code` in its own `modes` array gets it merged in automatically via the existing `mergeDefaultModes`/`ensureModeIcons` pipeline (no icon file needed — the reading renderer's default icon fallback applies).

- [ ] **Step 1: Fix the pre-existing stale assertion first**

In `src/topics/topicLoader.test.js`, the test `"imports a reading topic with texts and no cards"` (around line 184) currently asserts a 3-mode list that predates `follow_instruction` being added to `DEFAULT_MODES.reading`. Update it to match current reality, in the same edit that will add `safe_code`:

Change:
```js
    expect(record.modes.map((m) => m.id)).toEqual(["read_text", "understand_text", "assemble_text"]);
```
to:
```js
    expect(record.modes.map((m) => m.id)).toEqual(["read_text", "understand_text", "assemble_text", "follow_instruction", "safe_code"]);
```
(this second edit only makes sense once Step 2 below lands — write it now, it will fail until then, which is expected in Step 3).

- [ ] **Step 2: Add the mode default**

In `src/topics/topicLoader.js`, inside `DEFAULT_MODES.reading` (the array starting at line 709), add a new entry after the `follow_instruction` object (after line 765, before the closing `],` of the `reading` array):

```js
    {
      id: "safe_code",
      type: "safe_code",
      evaluation: "none",
      ui: {
        title: "Код от сейфа",
        instruction: "Ищите цифры по дому и вводите их на клавиатуре",
      },
    },
```

- [ ] **Step 3: Add the methodology entry**

In `src/topics/topicLoader.js`, inside `DEFAULT_MODE_METHODOLOGY.reading` (the object starting at line 394), add a `safe_code` key after `assemble_text` (after line 411, before the closing `},` of the `reading` object):

```js
    safe_code: {
      summary: "Поиск спрятанных по дому цифр по текстовой инструкции.",
      text: "Перед занятием взрослый прячет карточки с цифрами по дому и указывает в настройках, где какая цифра лежит. Ребёнок читает инструкцию, идёт искать цифру и вводит её на клавиатуре.",
      settings: ["Количество цифр в коде: от 2 до 5.", "Список мест хранения редактируется — можно выбрать из готовых или вписать своё."],
      goal: "Ребёнок связывает прочитанную инструкцию с конкретным действием в реальном пространстве и удерживает цель до её выполнения.",
    },
```

- [ ] **Step 4: Run the topicLoader test file**

Run: `npx vitest run ./src/topics/topicLoader.test.js`
Expected: PASS for `"imports a reading topic with texts and no cards"` and all other tests in the file (ignore any results reported under stray backup-folder paths per the Global Constraints note).

- [ ] **Step 5: Commit**

```bash
git add src/topics/topicLoader.js src/topics/topicLoader.test.js
git commit -m "feat(safe_code): register safe_code as a default reading mode"
```

---

### Task 4: Deck content — safe_code locations pool

**Files:**
- Create: `content/safe_code/locations.json`
- Modify: `scripts/update-recipes-deck.mjs`
- Create (generated): `public/decks/reading_dad_texts_v1.136.0.zip`
- Modify: `public/decks/catalog.json`

**Interfaces:**
- Produces: the deployed `reading_dad_texts` deck's `topic.json` gains one text: `{ id: "safe_code_locations", kind: "safe_code", title: {ru:"Код от сейфа"}, spots: [...] }`, and every future run of `update-recipes-deck.mjs` keeps re-including it (sourced from `content/safe_code/locations.json`, not hand-edited into the zip).

- [ ] **Step 1: Write the locations pool content file**

Create `content/safe_code/locations.json`:

```json
{
  "title": { "ru": "Код от сейфа", "en": "Safe Code" },
  "spots": [
    { "id": "pillow",   "label": "Подушка",             "phrase": "под подушкой" },
    { "id": "box",      "label": "Коробка",              "phrase": "в коробке" },
    { "id": "table",    "label": "Стол",                 "phrase": "на столе" },
    { "id": "wardrobe", "label": "Шкаф",                  "phrase": "в шкафу" },
    { "id": "shelf",    "label": "Полка",                 "phrase": "на полке" },
    { "id": "book",     "label": "Книга",                 "phrase": "за книгой" },
    { "id": "carpet",   "label": "Ковёр",                  "phrase": "под ковром" },
    { "id": "sofa",     "label": "Диван",                 "phrase": "под диваном" }
  ]
}
```

- [ ] **Step 2: Teach `update-recipes-deck.mjs` to include it**

In `scripts/update-recipes-deck.mjs`, bump the three version constants at the top (lines 4-6):

```js
const OLD_ZIP = "public/decks/reading_dad_texts_v1.135.0.zip";
const NEW_ZIP = "public/decks/reading_dad_texts_v1.136.0.zip";
const NEW_VERSION = "1.136.0";
```

Add an import for reading the JSON file (top of file, alongside the existing `node:fs` import on line 2):

```js
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
```
(already imports `readFileSync` — no change needed here, just confirming it's available.)

After the `textsManifest` loop (after line 141, before the `// Build new topic.json` comment on line 143), add:

```js
// Safe code (safe_code mode) — fixed pool of hiding-spot phrases, not derived
// from content/recipes/*.txt, so it must be re-added explicitly on every
// rebuild or it would silently disappear from the deck.
const safeCodeLocations = JSON.parse(readFileSync("content/safe_code/locations.json", "utf-8"));
textsManifest.push({
  id: "safe_code_locations",
  kind: "safe_code",
  title: safeCodeLocations.title,
  spots: safeCodeLocations.spots,
});
```

- [ ] **Step 3: Rebuild the zip**

Run:
```bash
node scripts/update-recipes-deck.mjs
```
Expected output ends with: `Создан: public/decks/reading_dad_texts_v1.136.0.zip (12 рецептов)` followed by `Обновлён catalog.json`.

- [ ] **Step 4: Verify the new text landed in the zip**

Run:
```bash
node -e "
import('jszip').then(async ({ default: JSZip }) => {
  const { readFileSync } = await import('node:fs');
  const zip = await JSZip.loadAsync(readFileSync('public/decks/reading_dad_texts_v1.136.0.zip'));
  const topic = JSON.parse(await zip.file('topic.json').async('string'));
  const safeCodeText = topic.texts.find((t) => t.kind === 'safe_code');
  console.log('found:', !!safeCodeText, 'spots:', safeCodeText?.spots?.length);
});
"
```
Expected: `found: true spots: 8`

- [ ] **Step 5: Commit**

```bash
git add content/safe_code/locations.json scripts/update-recipes-deck.mjs public/decks/reading_dad_texts_v1.136.0.zip public/decks/catalog.json
git commit -m "feat(safe_code): add hiding-spot locations pool to reading_dad_texts deck; bump v1.136.0"
```

Do not run `npm run deploy:prod` yet — deployment happens once, after all tasks below are complete and manually verified (Task 8).

---

### Task 5: `SafeCodeParamsContent.jsx` — settings screen

**Files:**
- Create: `src/features/reading/SafeCodeParamsContent.jsx`
- Modify: `src/styles.css` (append new classes)

**Interfaces:**
- Consumes: `getSafeCodeCustomLocations`, `saveSafeCodeCustomLocations`, `saveSafeCodeConfig` from `@/core/groupStore` (Task 1); `useTimer().markSessionStart`; `useAppStore((s) => s.setScreen)`.
- Produces: default export `SafeCodeParamsContent({ topicId, spots, topicTitle, textTitle, student })` — a React component matching the calling convention of `InstructionParamsContent` (same prop shape family), to be wired into `ParamsScreen.jsx` in Task 6.

- [ ] **Step 1: Create the component**

Create `src/features/reading/SafeCodeParamsContent.jsx`:

```jsx
import { useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { useTimer } from "@/features/timer/TimerContext";
import Button from "@/shared/components/Button";
import { getInitials } from "@/shared/utils/format";
import { getSafeCodeCustomLocations, saveSafeCodeCustomLocations, saveSafeCodeConfig } from "@/core/groupStore";

const CUSTOM_VALUE = "__custom__";
const MIN_CODE_LENGTH = 2;
const MAX_CODE_LENGTH = 5;

function emptyRow() {
  return { locationId: "", customText: "", phrase: "", digit: "" };
}

function randomDigits(count) {
  const pool = Array.from({ length: 10 }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export default function SafeCodeParamsContent({ topicId, spots, topicTitle, textTitle, student }) {
  const setScreen = useAppStore((s) => s.setScreen);
  const { markSessionStart } = useTimer();

  const [customLocations, setCustomLocations] = useState([]);
  const [codeLength, setCodeLength] = useState(3);
  const [rows, setRows] = useState(() => Array.from({ length: 3 }, emptyRow));

  useEffect(() => {
    getSafeCodeCustomLocations(topicId).then(setCustomLocations).catch(() => {});
  }, [topicId]);

  const allOptions = [...spots, ...customLocations];

  function changeCodeLength(next) {
    const clamped = Math.max(MIN_CODE_LENGTH, Math.min(MAX_CODE_LENGTH, next));
    setCodeLength(clamped);
    setRows((prev) => {
      const copy = prev.slice(0, clamped);
      while (copy.length < clamped) copy.push(emptyRow());
      return copy;
    });
  }

  function updateRow(index, patch) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function selectLocation(index, value) {
    if (value === CUSTOM_VALUE) {
      updateRow(index, { locationId: CUSTOM_VALUE, phrase: "" });
      return;
    }
    const option = allOptions.find((o) => (o.id ?? o.phrase) === value);
    updateRow(index, { locationId: value, phrase: option?.phrase ?? "", customText: "" });
  }

  function setCustomText(index, text) {
    updateRow(index, { customText: text, phrase: text });
  }

  function setDigit(index, value) {
    const digits = value.replace(/[^0-9]/g, "").slice(0, 1);
    updateRow(index, { digit: digits });
  }

  function generateRandom() {
    const filled = rows.filter((row) => row.phrase.trim());
    const digits = randomDigits(filled.length);
    let d = 0;
    setRows((prev) => prev.map((row) => {
      if (!row.phrase.trim()) return row;
      const digit = String(digits[d]);
      d += 1;
      return { ...row, digit };
    }));
  }

  const isReady = rows.length === codeLength && rows.every((row) => row.phrase.trim() && row.digit !== "");

  async function startSession() {
    const newCustom = rows
      .filter((row) => row.locationId === CUSTOM_VALUE && row.customText.trim())
      .map((row) => ({ label: row.customText.trim(), phrase: row.customText.trim() }));
    if (newCustom.length) {
      const merged = [...customLocations];
      for (const loc of newCustom) {
        if (!merged.some((m) => m.phrase === loc.phrase)) merged.push(loc);
      }
      setCustomLocations(merged);
      await saveSafeCodeCustomLocations(topicId, merged).catch(() => {});
    }
    await saveSafeCodeConfig(topicId, {
      codeLength,
      locations: rows.map((row) => ({ phrase: row.phrase, digit: Number(row.digit) })),
    }).catch(() => {});
    markSessionStart();
    setScreen("session");
  }

  return (
    <div className="params-layout">
      <div className="params-info-col">
        {topicTitle && <div className="params-info-topic">{topicTitle}</div>}
        {textTitle && <div className="params-info-mode">{textTitle}</div>}
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
          <Button fullWidth onClick={startSession} disabled={!isReady}>Начать занятие</Button>
        </div>
      </div>

      <div className="params-settings-col">
        <div className="params-body">
          <div className="param-row">
            <div className="param-label">Цифр в коде</div>
            <div className="param-stepper">
              <button className="stepper-btn" disabled={codeLength <= MIN_CODE_LENGTH} onClick={() => changeCodeLength(codeLength - 1)}>−</button>
              <span className="stepper-value">{codeLength}</span>
              <button className="stepper-btn" disabled={codeLength >= MAX_CODE_LENGTH} onClick={() => changeCodeLength(codeLength + 1)}>+</button>
            </div>
          </div>

          <div className="param-row param-row--block">
            <div className="param-label">Где спрятаны цифры</div>
            <div className="safe-code-rows">
              {rows.map((row, i) => (
                <div key={i} className="safe-code-row">
                  <span className="safe-code-row-index">{i + 1}.</span>
                  <select
                    className="safe-code-location-select"
                    value={row.locationId}
                    onChange={(e) => selectLocation(i, e.target.value)}
                  >
                    <option value="" disabled>Выбери место</option>
                    {allOptions.map((opt) => (
                      <option key={opt.id ?? opt.phrase} value={opt.id ?? opt.phrase}>{opt.label}</option>
                    ))}
                    <option value={CUSTOM_VALUE}>Своё место…</option>
                  </select>
                  {row.locationId === CUSTOM_VALUE && (
                    <input
                      className="safe-code-custom-input"
                      value={row.customText}
                      onChange={(e) => setCustomText(i, e.target.value)}
                      placeholder="например: в кармане куртки"
                    />
                  )}
                  <input
                    className="safe-code-digit-input"
                    inputMode="numeric"
                    value={row.digit}
                    onChange={(e) => setDigit(i, e.target.value)}
                    placeholder="?"
                  />
                </div>
              ))}
            </div>
            <button className="link-btn safe-code-generate-btn" onClick={generateRandom}>
              🎲 Сгенерировать случайные
            </button>
          </div>
        </div>

        <div className="params-start-phone">
          <Button fullWidth onClick={startSession} disabled={!isReady}>Начать занятие</Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add CSS for the new rows**

Append to `src/styles.css` (end of file):

```css
.safe-code-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.safe-code-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.safe-code-row-index {
  font-weight: 800;
  color: #566461;
  min-width: 18px;
}

.safe-code-location-select,
.safe-code-custom-input {
  flex: 1;
  min-width: 140px;
  min-height: 44px;
  border-radius: 12px;
  border: 1px solid #dde4e2;
  padding: 8px 12px;
  font-size: 0.95rem;
  font-family: inherit;
}

.safe-code-digit-input {
  width: 48px;
  min-height: 44px;
  border-radius: 12px;
  border: 1px solid #dde4e2;
  text-align: center;
  font-size: 1.1rem;
  font-weight: 800;
  font-family: inherit;
}

.safe-code-generate-btn {
  margin-top: 8px;
}
```

- [ ] **Step 3: Verify it compiles**

Run:
```bash
npx eslint src/features/reading/SafeCodeParamsContent.jsx
```
Expected: no errors (warnings about unused vars would indicate a typo — there should be none).

- [ ] **Step 4: Commit**

```bash
git add src/features/reading/SafeCodeParamsContent.jsx src/styles.css
git commit -m "feat(safe_code): add settings screen for picking hiding spots and digits"
```

---

### Task 6: Routing wiring — TextPickerScreen, ModePickerScreen, ParamsScreen, SessionScreen

**Files:**
- Modify: `src/features/reading/TextPickerScreen.jsx`
- Modify: `src/features/home/ModePickerScreen.jsx`
- Modify: `src/features/session/ParamsScreen.jsx`
- Modify: `src/features/session/SessionScreen.jsx`

**Interfaces:**
- Consumes: `SafeCodeParamsContent` from Task 5.
- Produces: clicking a `kind: "safe_code"` text in the reading topic's text list routes straight to the new settings screen and, on completion, the session finishes like `follow_instruction` does (returns to `sessionReturnScreen`, no adult-confirm gate, no Summary screen).

- [ ] **Step 1: `TextPickerScreen.jsx` — short-circuit + label**

In `src/features/reading/TextPickerScreen.jsx`, change line 9:
```js
const KIND_LABELS = { poem: "стих", instruction: "инструкция", shopping_list: "список" };
```
to:
```js
const KIND_LABELS = { poem: "стих", instruction: "инструкция", shopping_list: "список", safe_code: "сейф" };
```

Change the `pickText` function (lines 72-83):
```js
  function pickText(text) {
    setActiveText(text);
    if (text.kind === "instruction") {
      setActiveModeId("follow_instruction");
      setScreen("home");
    } else if (text.kind === "shopping_list") {
      setActiveModeId("shopping_list");
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
    } else {
      setScreen("modes");
    }
  }
```

- [ ] **Step 2: `ModePickerScreen.jsx` — defensive filter rule**

In `src/features/home/ModePickerScreen.jsx`, change `filterReadingModes` (lines 36-45):
```js
function filterReadingModes(modes = [], text) {
  if (!text) return [];
  if (text.kind === "instruction") {
    return modes.filter((mode) => mode.id === "follow_instruction");
  }
  if (text.kind === "sentence_pool") {
    return modes.filter((mode) => mode.type === "daily_sentences");
  }
  return modes.filter((mode) => !(mode.id === "assemble_text" && text.kind !== "poem" && text.kind !== "story") && mode.id !== "follow_instruction");
}
```
to:
```js
function filterReadingModes(modes = [], text) {
  if (!text) return [];
  if (text.kind === "instruction") {
    return modes.filter((mode) => mode.id === "follow_instruction");
  }
  if (text.kind === "safe_code") {
    return modes.filter((mode) => mode.id === "safe_code");
  }
  if (text.kind === "sentence_pool") {
    return modes.filter((mode) => mode.type === "daily_sentences");
  }
  return modes.filter((mode) => !(mode.id === "assemble_text" && text.kind !== "poem" && text.kind !== "story") && mode.id !== "follow_instruction" && mode.id !== "safe_code");
}
```

- [ ] **Step 3: `ParamsScreen.jsx` — render `SafeCodeParamsContent`**

In `src/features/session/ParamsScreen.jsx`, add the import (after line 19):
```js
import SafeCodeParamsContent from "@/features/reading/SafeCodeParamsContent";
```

Change line 512:
```js
  const isReadingInstruction  = isReading && (activeText?.kind === "instruction" || activeText?.kind === "shopping_list");
```
Leave as-is, and add a sibling constant right after it:
```js
  const isReadingSafeCode     = isReading && activeText?.kind === "safe_code";
```

Add a new early-return block right after the existing `if (isReadingInstruction) { ... }` block (after its closing `}` around line 557), before `function getInitialParams() {`:
```jsx
  if (isReadingSafeCode) {
    return (
      <div className="screen">
        <div className="screen-header">
          <button
            className="back-btn"
            onClick={() => {
              setScreen(sessionReturnScreen ?? "texts");
              setSessionReturnScreen(null);
            }}
          ><BackArrowIcon /></button>
          <h1 className="screen-title">{getTopicTitle(activeText.title)}</h1>
        </div>
        <SafeCodeParamsContent
          topicId={activeTopicId}
          spots={activeText.spots ?? []}
          topicTitle={getTopicTitle(topicRecord.meta.title)}
          textTitle={getTopicTitle(activeText.title)}
          student={student}
        />
      </div>
    );
  }
```

- [ ] **Step 4: `SessionScreen.jsx` — bypass gate + return screen**

In `src/features/session/SessionScreen.jsx`, change line 92:
```js
    const isInstruction = mode?.type === "follow_instruction" || mode?.type === "shopping_list";
```
to:
```js
    const isInstruction = mode?.type === "follow_instruction" || mode?.type === "shopping_list" || mode?.type === "safe_code";
```

Change line 155 (the long `requestAdvance` condition):
```js
    if (!adultConfirmAdvance || advanceGate === ADVANCE_GATE_READY || mode?.type === "follow_instruction" || mode?.type === "daily_sentences" || mode?.type === "listen_write_letters" || mode?.type === "magnetic_sentence" || mode?.type === "magnetic_sentence_audio" || mode?.type === "sort_letters" || mode?.type === "story_sequence" || mode?.type === "letter_demo" || mode?.type === "letter_follow" || mode?.type === "letter_trace") {
```
to:
```js
    if (!adultConfirmAdvance || advanceGate === ADVANCE_GATE_READY || mode?.type === "follow_instruction" || mode?.type === "daily_sentences" || mode?.type === "listen_write_letters" || mode?.type === "magnetic_sentence" || mode?.type === "magnetic_sentence_audio" || mode?.type === "sort_letters" || mode?.type === "story_sequence" || mode?.type === "letter_demo" || mode?.type === "letter_follow" || mode?.type === "letter_trace" || mode?.type === "safe_code") {
```

- [ ] **Step 5: Verify the four files compile**

Run:
```bash
npx eslint src/features/reading/TextPickerScreen.jsx src/features/home/ModePickerScreen.jsx src/features/session/ParamsScreen.jsx src/features/session/SessionScreen.jsx
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/reading/TextPickerScreen.jsx src/features/home/ModePickerScreen.jsx src/features/session/ParamsScreen.jsx src/features/session/SessionScreen.jsx
git commit -m "feat(safe_code): wire routing from text picker through params to session"
```

---

### Task 7: `SafeCodeTask` — the session UI

**Files:**
- Modify: `src/topics/renderers/reading/index.jsx`
- Modify: `src/styles.css` (append new classes)

**Interfaces:**
- Consumes: `getSafeCodeConfig`, `appendSafeCodeLog` from `@/core/groupStore` (Task 1); `RewardVideoModal` from `@/shared/components/RewardVideoModal`; the `{ type: "safe_code", textId, text }` task shape from Task 2; the same renderer prop contract every other task component in this file receives (`task, topicId, onAdvance, onClose`).
- Produces: `TASK_RENDERERS.safe_code = SafeCodeTask`, so `ReadingRenderer` dispatches to it when `task.type === "safe_code"`.

- [ ] **Step 1: Add the import**

In `src/topics/renderers/reading/index.jsx`, add after line 12 (`import { BackArrowIcon } from "@/shared/components/ArrowIcons";`):
```js
import RewardVideoModal from "@/shared/components/RewardVideoModal";
import { getSafeCodeConfig, appendSafeCodeLog } from "@/core/groupStore";
```

- [ ] **Step 2: Add the `SafeCodeTask` component**

Insert before the `const TASK_RENDERERS = {` line (currently line 1267), a new component:

```jsx
const ORDINALS_ACCUSATIVE = ["первую", "вторую", "третью", "четвёртую", "пятую"];

function SafeCodeTask({ task, topicId, onAdvance, onClose }) {
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const students = useAppStore((s) => s.students);
  const student = students.find((s) => s.id === activeStudentId) ?? null;

  const [config, setConfig] = useState(null);
  const [foundCount, setFoundCount] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [wrongPulse, setWrongPulse] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [opened, setOpened] = useState(false);
  const startedAtRef = useRef(Date.now());
  const loggedRef = useRef(false);

  useEffect(() => {
    getSafeCodeConfig(topicId).then(setConfig).catch(() => setConfig({ codeLength: 0, locations: [] }));
  }, [topicId]);

  if (!config) return <div className="session-body reading-body">Загрузка…</div>;

  const locations = config.locations ?? [];
  const total = locations.length;

  function handleDigit(digit) {
    if (opened || foundCount >= total) return;
    const expected = locations[foundCount]?.digit;
    if (digit === expected) {
      setFeedback({ ok: true, text: "Верно! Идём дальше." });
      const next = foundCount + 1;
      setFoundCount(next);
      if (next >= total) {
        setTimeout(() => {
          setOpened(true);
          if (!loggedRef.current) {
            loggedRef.current = true;
            appendSafeCodeLog(topicId, {
              codeLength: config.codeLength,
              locationCount: total,
              wrongAttempts,
              elapsedMs: Date.now() - startedAtRef.current,
              opened: true,
            }).catch(() => {});
          }
        }, 500);
      }
      setTimeout(() => setFeedback(null), 900);
    } else {
      setWrongAttempts((n) => n + 1);
      setWrongPulse(true);
      setFeedback({ ok: false, text: "Не подходит — попробуй ещё раз." });
      setTimeout(() => { setWrongPulse(false); setFeedback(null); }, 500);
    }
  }

  if (opened) {
    return (
      <div className="session-body reading-body safe-code-body">
        <div className="safe-code-instruction-zone safe-code-instruction-zone--opened">
          <div className="safe-code-icon">🔓🎉</div>
          <div className="safe-code-instruction-text">Сейф открыт!</div>
        </div>
        <RewardVideoModal
          rewardVideos={student?.rewardVideos ?? []}
          studentId={student?.id}
          onDismiss={onAdvance}
        />
      </div>
    );
  }

  const current = locations[foundCount];

  return (
    <div className="session-body reading-body safe-code-body">
      <ReadingCloseButton onClose={onClose} />
      <div className="safe-code-header">
        <div className="safe-code-progress">
          {locations.map((_, i) => (
            <div key={i} className="safe-code-progress-seg">
              <div className="safe-code-progress-seg-fill" style={{ width: i < foundCount ? "100%" : "0%" }} />
            </div>
          ))}
        </div>
        <div className="safe-code-tracker">
          {locations.map((loc, i) => (
            <div
              key={i}
              className={[
                "safe-code-slot",
                i === foundCount ? "safe-code-slot--active" : "",
                i === foundCount && wrongPulse ? "safe-code-slot--wrong" : "",
                i < foundCount ? "safe-code-slot--done" : "",
              ].filter(Boolean).join(" ")}
            >
              {i < foundCount ? loc.digit : ""}
            </div>
          ))}
        </div>
      </div>

      <div className="safe-code-instruction-zone">
        <div className="safe-code-step-label">Цифра {foundCount + 1} из {total}</div>
        <div className="safe-code-instruction-text">
          Иди и найди {current?.phrase} {ORDINALS_ACCUSATIVE[foundCount] ?? "следующую"} цифру кода.
        </div>
        <div className={`safe-code-feedback${feedback ? " safe-code-feedback--show" : ""}${feedback?.ok ? " safe-code-feedback--ok" : ""}`}>
          {feedback?.text ?? ""}
        </div>
      </div>

      <div className="safe-code-numpad">
        {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((d) => (
          <button key={d} className="safe-code-numpad-btn" onClick={() => handleDigit(d)}>{d}</button>
        ))}
        <div />
        <button className="safe-code-numpad-btn" onClick={() => handleDigit(0)}>0</button>
        <div />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Register the renderer**

Change `TASK_RENDERERS` (currently lines 1267-1273):
```js
const TASK_RENDERERS = {
  read_text:           ReadTextTask,
  understand_text:     UnderstandTextTask,
  assemble_line:       AssembleLineTask,
  follow_instruction:  InstructionTask,
  shopping_list:       ShoppingListTask,
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
};
```

- [ ] **Step 4: Add CSS**

Append to `src/styles.css` (end of file, after the Task 5 additions):

```css
.safe-code-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.safe-code-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.safe-code-progress {
  display: flex;
  gap: 4px;
}

.safe-code-progress-seg {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: #e4ece9;
  overflow: hidden;
}

.safe-code-progress-seg-fill {
  height: 100%;
  background: #4caf90;
  transition: width 0.3s ease;
}

.safe-code-tracker {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.safe-code-slot {
  width: 40px;
  height: 48px;
  border-radius: 10px;
  background: #fbf3e3;
  border: 2px solid #b8873f;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  font-weight: 800;
  color: #8a6329;
  font-variant-numeric: tabular-nums;
}

.safe-code-slot--active {
  border-color: #4a9b8f;
  box-shadow: 0 0 0 3px rgba(74, 155, 143, 0.22);
}

.safe-code-slot--wrong {
  border-color: #c85a4d;
}

.safe-code-slot--done {
  background: #b8873f;
  color: #fff8ec;
}

.safe-code-instruction-zone {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  text-align: center;
}

.safe-code-step-label {
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #6b7a7a;
}

.safe-code-instruction-text {
  font-size: 1.55rem;
  font-weight: 800;
  line-height: 1.28;
  color: #1c3634;
}

.safe-code-feedback {
  min-height: 22px;
  font-size: 0.92rem;
  font-weight: 700;
  color: #8f3b31;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.safe-code-feedback--show {
  opacity: 1;
}

.safe-code-feedback--ok {
  color: #2f6f66;
}

.safe-code-icon {
  font-size: 2.6rem;
}

.safe-code-numpad {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding-bottom: max(4px, var(--app-safe-bottom, 0px));
}

.safe-code-numpad-btn {
  min-height: 56px;
  border: none;
  border-radius: 14px;
  background: #eef0ef;
  color: #1c3634;
  font-size: 1.3rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.safe-code-numpad-btn:active {
  background: #4a9b8f;
  color: white;
}
```

- [ ] **Step 5: Verify it compiles**

Run:
```bash
npx eslint src/topics/renderers/reading/index.jsx
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/topics/renderers/reading/index.jsx src/styles.css
git commit -m "feat(safe_code): add SafeCodeTask session UI with per-digit entry and reward trigger"
```

---

### Task 8: End-to-end manual verification

This task has no automated test — it exercises the full flow in a running browser, per the repo's own convention (`verify`/`run` skills) that UI changes must be driven by hand before being called done.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (leave running; note the printed local URL, e.g. `http://localhost:8080`).

- [ ] **Step 2: Import the freshly built deck (if not already installed) and open it**

In the running app: go to the topic catalog, install/update "Чтение. Готовим еду" so it picks up `reading_dad_texts_v1.136.0.zip`, then open its text list and tap "Код от сейфа".

- [ ] **Step 3: Configure a session**

Set code length to 3, pick 3 different locations from the dropdown (including at least one "Своё место…" custom entry), fill in 3 digits (or use "🎲 Сгенерировать случайные"), tap "Начать занятие".

- [ ] **Step 4: Walk through the flow**

For each of the 3 steps: confirm the instruction sentence reads naturally (e.g. "Иди и найди под подушкой первую цифру кода."), tap a wrong digit once (confirm the slot flashes red and the instruction stays), then tap the correct configured digit (confirm the slot fills, the tracker advances, and the next instruction appears).

- [ ] **Step 5: Confirm the finish**

After the third correct digit, confirm the "Сейф открыт!" screen appears with the reward modal already up on top of it ("Молодец! Пять правильных подряд!" — this copy is inherited verbatim from the shared `RewardVideoModal` component and reused as-is, same as `column_addition` already does; it is not specific to a 5-in-a-row streak here). Tap "🎬 Смотреть мультик" (if the test student has no `rewardVideos` configured, confirm it dismisses gracefully instead of crashing), and confirm the app returns to the text list (not the Summary screen) afterward.

- [ ] **Step 6: Re-open and confirm a fresh custom location persisted**

Go back into settings for the same mode; confirm the custom location typed in Step 3 now appears as a dropdown option (not just as free text).

- [ ] **Step 7: Deploy**

Only after Steps 1-6 all pass: follow `DEPLOYMENT.md` (`git status --short` clean check, then `npm run deploy:prod`, then `npm run deploy:verify`).

---

## Self-Review Notes

- **Spec coverage:** placement/mode registration → Tasks 3, 6; content model → Task 4; settings screen (stepper, location+digit rows, random button) → Task 5; session flow (header tracker / instruction / numpad, per-digit check, celebratory finish) → Task 7; reward reuse → Task 7 Step 2; logging → Task 1 (`appendSafeCodeLog`) + Task 7 Step 2 call site. All six spec sections have a corresponding task.
- **Placeholder scan:** no TBD/TODO left; every step has runnable code or an exact command.
- **Type consistency:** `getSafeCodeConfig`/`saveSafeCodeConfig` (Task 1) return/accept `{codeLength, locations: {phrase, digit}[]}` — matches what `SafeCodeParamsContent` (Task 5) saves and what `SafeCodeTask` (Task 7) reads (`config.locations[i].digit`, `config.codeLength`). Task type string `"safe_code"` is consistent across `DEFAULT_MODES.reading` (Task 3), `generateTasks`'s switch (Task 2), `TASK_RENDERERS` (Task 7), and all the routing checks (Task 6).
- **Known pre-existing issue documented, not silently left:** the stale `topicLoader.test.js` assertion is called out explicitly in Global Constraints and fixed as part of Task 3 rather than left to surprise the implementer.
