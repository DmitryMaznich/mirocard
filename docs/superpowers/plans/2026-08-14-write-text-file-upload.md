# write_text .txt File Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher upload a `.txt` file on propis's `write_text` mode settings screen (`ParamsScreen.jsx`) to seed the session's starting text, instead of typing it by hand — with a 200-character limit enforced at upload time, and the loaded text remaining fully editable with the on-screen keyboard once the session starts.

**Architecture:** A new generic declarative param type, `"text_upload"`, added to `ParamsScreen.jsx`'s existing schema-driven params system (same mechanism `"sentence_list"` already uses — no bespoke per-topic branch). The chosen text travels: `ParamsScreen` (`params.customText`, persisted via the existing `persistStudentTopicLink`) → `useSessionEngine.js`'s already-existing generic `generateTasks(mode, cards, sessionSize, sessionParams)` call → `propis/engine.js` (currently ignores `sessionParams` entirely — this plan fixes that specifically for `write_text`) → `task.initialText` → `WriteTextView`'s initial `text` state.

**Tech Stack:** React (function components, hooks), plain `<input type="file">` + `File.text()` (no FileReader boilerplate, no new dependency — matches how `TopicImport.jsx` already reads an uploaded file, just with `.text()` instead of `.arrayBuffer()`).

## Global Constraints

- 200-character limit (after trimming/normalizing line endings) — a file over the limit is rejected with an error message stating the limit and the file's actual length; any previously-loaded text is left untouched.
- No character-set filtering — any text passes through; `WriteTextView`'s existing fallback-glyph rendering already handles uncaptured characters.
- Uploaded text stays fully editable afterward via `WriteTextView`'s own on-screen keyboard — this plan only changes the session's *starting* text.
- Every propis test must stay green after each task: `npx vitest run src/topics/renderers/propis`.
- Per `docs/propis.md`'s versioning rule: a deck version's zip is never overwritten. `tools/propis/topic.json`'s `meta.version` must be bumped before rebuilding.
- See `docs/superpowers/specs/2026-08-14-write-text-file-upload-design.md` for the full rationale behind these choices.

---

### Task 1: Thread `sessionParams.customText` from the engine into `WriteTextView`'s starting text

**Files:**
- Modify: `src/topics/renderers/propis/engine.js` (full file, 24 lines)
- Modify: `src/topics/renderers/propis/engine.test.js` (full file, 44 lines)
- Modify: `src/topics/renderers/propis/WriteTextView.jsx:66`

**Interfaces:**
- Produces: `generateTasks(mode, cards, sessionSize, sessionParams)` — same exported name, two new (optional, unused-except-by-write_text) trailing parameters. For `mode.type === "write_text"`, the returned task gains an `initialText` field: `sessionParams?.customText ?? ""`. Every other mode branch (`practice`/`show`/`write_words`/unknown) is untouched — they still return exactly the same shape as before.
- Consumes: nothing new — `WriteTextView`'s existing `task` prop just gains an optional `initialText` string field it reads once at mount.

- [ ] **Step 1: Write the failing tests**

Replace the existing `write_text` describe block in `src/topics/renderers/propis/engine.test.js` (the whole file becomes):

```js
import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine.js";

const LETTER_CARD = { id: "а", type: "letter", label: "а", strokes: [{ d: "M 0 0 C 1 1 2 2 3 3" }] };
const CONNECTOR_CARD = { id: "conn_4_2", type: "connector", fromLine: 4, toLine: 2, strokes: [{ d: "M 0 0 C 1 1 2 2 3 3" }] };
const CARD_NO_STROKES = { id: "я", type: "letter", label: "я", strokes: [] };

describe("generateTasks — practice/show (existing behavior)", () => {
  it("practice mode returns only letter-type cards with strokes as items", () => {
    const tasks = generateTasks({ type: "practice" }, [LETTER_CARD, CONNECTOR_CARD, CARD_NO_STROKES]);
    expect(tasks).toEqual([{ type: "practice", items: [LETTER_CARD] }]);
  });

  it("show mode returns only letter-type cards with strokes as items", () => {
    const tasks = generateTasks({ type: "show" }, [LETTER_CARD, CONNECTOR_CARD]);
    expect(tasks).toEqual([{ type: "show", items: [LETTER_CARD] }]);
  });
});

describe("generateTasks — write_words", () => {
  it("splits cards into letters and connectors by type", () => {
    const tasks = generateTasks({ type: "write_words" }, [LETTER_CARD, CONNECTOR_CARD, CARD_NO_STROKES]);
    expect(tasks).toEqual([{ type: "write_words", letters: [LETTER_CARD], connectors: [CONNECTOR_CARD] }]);
  });

  it("returns empty arrays when there are no cards of either type", () => {
    const tasks = generateTasks({ type: "write_words" }, []);
    expect(tasks).toEqual([{ type: "write_words", letters: [], connectors: [] }]);
  });
});

describe("generateTasks — write_text", () => {
  it("splits cards into letters and connectors by type, same as write_words, with an empty initialText when no sessionParams are passed at all", () => {
    const tasks = generateTasks({ type: "write_text" }, [LETTER_CARD, CONNECTOR_CARD, CARD_NO_STROKES]);
    expect(tasks).toEqual([{ type: "write_text", letters: [LETTER_CARD], connectors: [CONNECTOR_CARD], initialText: "" }]);
  });

  it("defaults initialText to empty when sessionParams is passed but has no customText", () => {
    const tasks = generateTasks({ type: "write_text" }, [LETTER_CARD], 1, {});
    expect(tasks[0].initialText).toBe("");
  });

  it("uses sessionParams.customText as initialText when present", () => {
    const tasks = generateTasks({ type: "write_text" }, [LETTER_CARD], 1, { customText: "мама мыла раму" });
    expect(tasks[0].initialText).toBe("мама мыла раму");
  });
});

describe("generateTasks — unknown mode", () => {
  it("returns an empty array", () => {
    expect(generateTasks({ type: "nope" }, [LETTER_CARD])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify the new/changed ones fail**

Run: `npx vitest run src/topics/renderers/propis/engine.test.js`
Expected: the `write_text` describe block's 3 tests fail (first one on the missing `initialText: ""` field via `toEqual`; the other two because `tasks[0].initialText` is `undefined`, not `""`/the passed string). The `practice`/`show`/`write_words`/unknown-mode tests still pass unchanged.

- [ ] **Step 3: Update `engine.js`**

Replace the whole file:

```js
export function generateTasks(mode, cards, sessionSize, sessionParams) {
  const allCards = Array.isArray(cards) ? cards : (cards?.cards ?? []);
  const withStrokes = allCards.filter((c) => Array.isArray(c.strokes) && c.strokes.length > 0);
  const letters = withStrokes.filter((c) => c.type === "letter");
  const connectors = withStrokes.filter((c) => c.type === "connector");

  if (mode.type === "practice") {
    return [{ type: "practice", items: letters }];
  }

  if (mode.type === "show") {
    return [{ type: "show", items: letters }];
  }

  if (mode.type === "write_words") {
    return [{ type: "write_words", letters, connectors }];
  }

  if (mode.type === "write_text") {
    return [{ type: "write_text", letters, connectors, initialText: sessionParams?.customText ?? "" }];
  }

  return [];
}
```

(Only the function signature and the `write_text` branch changed — `practice`/`show`/`write_words`/the final `return []` are byte-for-byte the same as before.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/topics/renderers/propis/engine.test.js`
Expected: all tests pass (8 total: 2 practice/show + 2 write_words + 3 write_text + 1 unknown-mode).

- [ ] **Step 5: Seed `WriteTextView`'s starting text from `task.initialText`**

In `src/topics/renderers/propis/WriteTextView.jsx`, change line 66 from:

```js
  const [text, setText] = useState("");
```

to:

```js
  const [text, setText] = useState(task?.initialText ?? "");
```

- [ ] **Step 6: Run the full propis suite**

Run: `npx vitest run src/topics/renderers/propis`
Expected: all pass, same total count as before plus the 2 new engine tests (474 + 2 = 476... actual current baseline count may differ slightly by the time this runs; just confirm 100% pass, no failures).

- [ ] **Step 7: Live-verify `WriteTextView` opens with the seeded text**

Use the project's established throwaway dev-harness workflow (`docs/propis.md`'s "Verifying visual changes locally" section — create `dev-propis.html` + `src/dev-propis-preview.jsx` at the repo root, delete both before committing):

`src/dev-propis-preview.jsx`:
```jsx
import { createRoot } from "react-dom/client";
import WriteTextView from "./topics/renderers/propis/WriteTextView.jsx";
import "./topics/renderers/propis/propis.css";
import topic from "../tools/propis/topic.json";

const letters = topic.cards.filter((c) => c.type === "letter");
const connectors = topic.cards.filter((c) => c.type === "connector");

createRoot(document.getElementById("root")).render(
  <WriteTextView
    task={{ type: "write_text", letters, connectors, initialText: "привет мир" }}
    onClose={() => console.log("close")}
  />
);
```

Start it via the Browser pane's `preview_start` tool with `{ "name": "dev-propis-preview" }` (reuses the `.claude/launch.json` entry already set up in earlier propis sessions, port 8099), navigate to `http://localhost:8099/dev-propis.html`. Confirm via `javascript_tool` (screenshots/`computer` may be unavailable if the Browser pane isn't visible on the user's side — this has happened repeatedly in this project) that the grid already shows "привет мир" laid out on load, with no keypress needed, and that typing an additional letter via `.propis-key` still appends normally (confirms it's real editable state, not a static prop). Delete the throwaway files afterward.

- [ ] **Step 8: Commit**

```bash
git add src/topics/renderers/propis/engine.js src/topics/renderers/propis/engine.test.js src/topics/renderers/propis/WriteTextView.jsx
git commit -m "$(cat <<'EOF'
feat(propis): write_text reads its starting text from sessionParams

propis/engine.js's generateTasks silently ignored the sessionSize/
sessionParams arguments useSessionEngine.js's generic branch already
passes to every topic — now write_text specifically reads
sessionParams.customText into task.initialText, which WriteTextView
uses to seed its (still fully editable) text state instead of always
starting empty. No other mode's task shape changes.

Prep step for file upload on ParamsScreen (next commit) — this alone
doesn't add any UI yet, just the plumbing a caller could already use.
EOF
)"
```

---

### Task 2: Upload UI on `ParamsScreen` — new `"text_upload"` param type

**Files:**
- Modify: `tools/propis/topic.json` (write_text mode entry, `tools/propis/topic.json:61-77` and `tools/propis/topic.json:4` for `meta.version`)
- Modify: `src/features/session/ParamsScreen.jsx` (imports at top; new `TextUploadParam` component after `SentenceListParam`; `getInitialParams()`; `renderParam()`)
- Modify: `src/styles.css` (new CSS block after `.param-sentence-textarea:focus`, `src/styles.css:19369`)

**Interfaces:**
- Consumes: `generateTasks` from Task 1 (already reads `sessionParams.customText`) — this task is what actually gets a real value into `sessionParams.customText` for a live session.
- Produces: nothing new consumed elsewhere — this is the top of the chain (the settings UI itself).

- [ ] **Step 1: Bump the deck version and add the params schema**

In `tools/propis/topic.json`, change line 4:

```json
    "version": "1.23.0",
```
to:
```json
    "version": "1.23.1",
```

Then, in the `write_text` mode object (currently lines 60-77), add a `"params"` key after `"methodology"` (before the mode object's own closing `}`):

```json
    {
      "id": "write_text",
      "type": "write_text",
      "evaluation": "none",
      "ui": {
        "title": "Пишем текст",
        "instruction": "Набирай слова на клавиатуре — они сами лягут на строку прописи"
      },
      "methodology": {
        "text": "Ребёнок набирает произвольный текст на цветной алфавитной клавиатуре (гласные, согласные и твёрдый/мягкий знак — разного цвета, как в «Магнитной азбуке»). Слова появляются сразу, без анимации, построчно на тетрадной сетке — если слово не помещается по ширине строки, оно само переносится на следующую. Отдельная клавиша ⏎ позволяет перейти на новую строку вручную, не дожидаясь автопереноса.",
        "tips": [
          "Регистр переключается тем же тумблером, что и в «Написании слов».",
          "«←» стирает последний введённый символ (в том числе перенос строки), «Очистить» — сбрасывает весь текст.",
          "Буквы без записанного образца в тексте пропускаются, а не ломают остальную строку."
        ],
        "duration": "5–10 минут"
      },
      "params": {
        "customText": {
          "type": "text_upload",
          "label": { "ru": "Свой текст (.txt)" },
          "maxLength": 200
        }
      }
    }
```

(Everything except the new trailing `"params"` key is unchanged from the current file — this is purely additive.)

- [ ] **Step 2: Rebuild the deck and update the catalog**

Run: `node scripts/build-propis-deck.mjs`
Expected: creates `public/decks/propis_v1.23.1.zip` and updates `public/decks/catalog.json`'s `propis` entry (`version` + `url`) to match — confirm both by re-reading `public/decks/catalog.json`'s propis entry.

- [ ] **Step 3: Run the full propis suite**

Run: `npx vitest run src/topics/renderers/propis`
Expected: still all green — this step touched no `.js` logic, only data files.

- [ ] **Step 4: Add `useRef` to `ParamsScreen.jsx`'s React import**

Change line 1 from:
```js
import { useState, useEffect, useMemo } from "react";
```
to:
```js
import { useState, useEffect, useMemo, useRef } from "react";
```

- [ ] **Step 5: Add the `TextUploadParam` component**

In `src/features/session/ParamsScreen.jsx`, insert this new function immediately after `SentenceListParam`'s closing `}` (currently ending at line 511, right before `function SentencePoolSelector`):

```jsx
function TextUploadParam({ label, maxLength, value, onChange }) {
  const fileRef = useRef(null);
  const [error, setError] = useState(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const normalized = raw.replace(/\r\n?/g, "\n").trim();
      if (normalized.length > maxLength) {
        setError(`Слишком длинный текст: ${normalized.length} символов, максимум ${maxLength}.`);
        return;
      }
      setError(null);
      onChange(normalized);
    } catch {
      setError("Не удалось прочитать файл. Убедитесь, что это текстовый .txt файл.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="param-row param-row--block param-text-upload">
      <div className="param-label">{label}</div>
      <div className="param-text-upload__body">
        {value ? (
          <>
            <div className="param-text-upload__preview">{value}</div>
            <div className="param-text-upload__actions">
              <button type="button" className="param-text-upload__link" onClick={() => fileRef.current?.click()}>
                Заменить файл
              </button>
              <button type="button" className="param-text-upload__link" onClick={() => onChange("")}>
                Очистить
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="param-text-upload__trigger" onClick={() => fileRef.current?.click()}>
            📄 Загрузить .txt
          </button>
        )}
        {error && <div className="param-text-upload__error">{error}</div>}
        <input
          ref={fileRef}
          type="file"
          accept=".txt,text/plain"
          onChange={handleFile}
          style={{ display: "none" }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Wire `text_upload` into `getInitialParams()`**

In `src/features/session/ParamsScreen.jsx`, the generic loop inside `getInitialParams()` (around line 884-895) currently reads:

```js
    const modeParams = mode?.params ?? {};
    const out = {};
    for (const [key, def] of Object.entries(modeParams)) {
      if (def.type === "concept_selector") continue;
      if (def.type === "sentence_list") {
        out[key] = saved[key] ?? [];
        continue;
      }
      if (def.type === "enum_multi") {
        out[key] = saved[key] ?? def.default ?? [];
        continue;
      }
      out[key] = saved[key] ?? def.default ?? (def.type === "number" ? def.min : def.values?.[0]);
    }
    return out;
```

Add a `text_upload` branch alongside `sentence_list`/`enum_multi`:

```js
    const modeParams = mode?.params ?? {};
    const out = {};
    for (const [key, def] of Object.entries(modeParams)) {
      if (def.type === "concept_selector") continue;
      if (def.type === "sentence_list") {
        out[key] = saved[key] ?? [];
        continue;
      }
      if (def.type === "text_upload") {
        out[key] = saved[key] ?? "";
        continue;
      }
      if (def.type === "enum_multi") {
        out[key] = saved[key] ?? def.default ?? [];
        continue;
      }
      out[key] = saved[key] ?? def.default ?? (def.type === "number" ? def.min : def.values?.[0]);
    }
    return out;
```

- [ ] **Step 7: Wire `text_upload` into `renderParam()`**

In the same file, `renderParam()`'s chain of `if (def.type === ...)` branches (around line 1112-1213) currently ends its declarative-type checks with the `sentence_list` branch (around line 1201-1212) followed by `return null;`. Add a new branch for `text_upload` right after the `sentence_list` branch:

```js
          if (def.type === "sentence_list") {
            const predefined = topicRecord?.sentences ?? [];
            return (
              <SentenceListParam
                key={key}
                label={def.label?.ru ?? key}
                predefined={predefined}
                value={params[key] ?? []}
                onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
              />
            );
          }
          if (def.type === "text_upload") {
            return (
              <TextUploadParam
                key={key}
                label={def.label?.ru ?? key}
                maxLength={def.maxLength}
                value={params[key] ?? ""}
                onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
              />
            );
          }
          return null;
```

- [ ] **Step 8: Add the CSS**

In `src/styles.css`, immediately after the `.param-sentence-textarea:focus { border-color: #4a9b8f; }` rule (currently line 19369, right before the `/* reward modal (pre-video choice) */` comment), add:

```css
/* ── TextUploadParam ── */
.param-text-upload .param-text-upload__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.param-text-upload__trigger {
  align-self: flex-start;
  border: 2px dashed #d6cbbf;
  border-radius: 8px;
  background: #fff;
  color: #263131;
  font-size: 14px;
  font-weight: 600;
  padding: 8px 14px;
  cursor: pointer;
}
.param-text-upload__trigger:hover { border-color: #4a9b8f; }

.param-text-upload__preview {
  border: 2px solid #d6cbbf;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
  color: #263131;
  white-space: pre-wrap;
  max-height: 120px;
  overflow-y: auto;
}

.param-text-upload__actions { display: flex; gap: 12px; }

.param-text-upload__link {
  border: none;
  background: none;
  color: #4a9b8f;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
}

.param-text-upload__error {
  color: #ef4444;
  background: #fef2f2;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 13px;
}
```

- [ ] **Step 9: Live-verify the full upload flow**

`ParamsScreen` pulls from the app's real zustand store (selected student, topic records, etc.) — faking that standalone would be more work than it saves, so verify this using the project's normal full-app dev server rather than the propis-specific throwaway harness. `.claude/launch.json` has a `"dev"` entry (port 8080) for exactly this. Before starting it, call the Browser pane's `preview_list` tool — this repo routinely has other concurrent Claude Code sessions running (confirmed repeatedly in this project's history), and if a `"dev"` server is already running (from this session or another), reuse its `tabId`/`serverId` rather than starting a duplicate on the same port. Only if no `"dev"` server is running at all, start one with `preview_start` `{ "name": "dev" }`.

1. Navigate the app to the propis topic, select the "Пишем текст" mode, reach `ParamsScreen`.
2. Confirm the new "📄 Загрузить .txt" control renders.
3. Prepare two throwaway test files in the scratchpad directory: `short.txt` containing e.g. `мама мыла раму` (well under 200 chars) and `long.txt` containing a repeated string over 200 characters.
4. Upload `long.txt` first: confirm the error message appears stating the limit (200) and the actual character count, and that no preview/value was set.
5. Upload `short.txt`: confirm the error clears, a read-only preview of the text appears, with "Заменить файл"/"Очистить" links.
6. Click "Очистить": confirm the preview disappears and the upload trigger button reappears.
7. Re-upload `short.txt`, then start the session: confirm `WriteTextView` opens with "мама мыла раму" already laid out on the grid, and that typing an additional character via the on-screen keyboard still appends normally.
8. Check `read_console_messages` for any errors during this sequence.

Note in the final report if any step can't be verified because the Browser pane isn't visible on the user's side (as has happened repeatedly in this project) — fall back to `javascript_tool`/DOM-state inspection (reading React fiber state, as done in earlier propis sessions) rather than screenshots in that case.

- [ ] **Step 10: Commit**

```bash
git add tools/propis/topic.json public/decks/catalog.json "public/decks/propis_v1.23.1.zip" src/features/session/ParamsScreen.jsx src/styles.css
git commit -m "$(cat <<'EOF'
feat(propis): upload a .txt file to seed write_text's starting text

New generic ParamsScreen param type, "text_upload" — reuses the
existing declarative params system (same shape as sentence_list)
rather than a bespoke per-topic branch, so it's available to any
future topic that wants it too. Enforces a 200-character limit at
upload time (rejects with an error stating the limit and the file's
actual length, leaving any previously-loaded text untouched) — this
is a handwriting-practice mode, not a reading mode, so a session's
worth of text is a few short sentences, not a document. No
character-set filtering: WriteTextView's existing fallback-glyph
rendering already handles any uncaptured character.

propis deck bumped to v1.23.1 (params-only addition, no card/stroke
data changed).

See docs/superpowers/specs/2026-08-14-write-text-file-upload-design.md
EOF
)"
```

---

## Post-plan note (not a task)

Deployment is intentionally not part of this plan — ask the user before running `npm run deploy:prod`, same as every other change to this app (see `CLAUDE.md`).
