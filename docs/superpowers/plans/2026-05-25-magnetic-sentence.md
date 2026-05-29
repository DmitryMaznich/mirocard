# Magnetic Sentence Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new modes to Magnetic Alphabet — `magnetic_sentence` (text visible) and `magnetic_sentence_audio` (audio + from memory) — with a three-phase flow: assemble → success → copy-to-notebook.

**Architecture:** Engine embeds sentences (with audio paths) into the task object; the renderer handles all three phases internally and calls `onAdvance` only when all sentences are done. `useSessionEngine.js` gets a magnetic_alphabet special case to pass `topicRecord` to the engine. Session params UI gets a new `SentenceListParam` component for the `sentence_list` param type.

**Tech Stack:** React (hooks, pointerEvents), CSS animations, existing `playTopicFile(topicId, path)` for audio

---

### Task 1: Add sentences and new modes to topic.json

**Files:**
- Modify: `tools/magnetic_alphabet/topic.json`

- [ ] **Step 1: Add `sentences` array and two new modes**

Replace the content of `tools/magnetic_alphabet/topic.json` — keep all existing content, insert `sentences` array at the top level and two new mode objects in `modes`:

```json
{
  "meta": {
    "id": "magnetic_alphabet",
    "version": "1.7.0",
    "renderer": "magnetic_alphabet",
    "title": "Магнитная азбука",
    "avatar": "media/avatar.svg"
  },
  "sentences": [
    { "id": "s01", "text": "Мама мыла раму." },
    { "id": "s02", "text": "У Тани кот." },
    { "id": "s03", "text": "Дети идут в школу." },
    { "id": "s04", "text": "Папа читает книгу." },
    { "id": "s05", "text": "Собака сидит у дома." },
    { "id": "s06", "text": "На столе стоит ваза." },
    { "id": "s07", "text": "Кот пьёт молоко." },
    { "id": "s08", "text": "Бабушка вяжет носки." },
    { "id": "s09", "text": "Дети любят играть." },
    { "id": "s10", "text": "Солнце светит ярко." }
  ],
  "modes": [
    {
      "id": "magnetic_free",
      "type": "magnetic_free",
      "evaluation": "none",
      "ui": {
        "title": "Свободная азбука",
        "instruction": "Составляй слова и предложения из букв"
      },
      "params": {
        "layout": {
          "type": "enum",
          "label": { "ru": "Раскладка" },
          "values": ["abv", "qwerty"],
          "labels": { "ru": { "abv": "АБВ", "qwerty": "ЙЦУКЕН" } },
          "default": "abv"
        }
      }
    },
    {
      "id": "magnetic_words",
      "type": "magnetic_words",
      "evaluation": "none",
      "ui": {
        "title": "Сборка по заданию",
        "instruction": "Взрослый задаёт текст, ученик собирает его на доске"
      },
      "params": {
        "layout": {
          "type": "enum",
          "label": { "ru": "Раскладка" },
          "values": ["abv", "qwerty"],
          "labels": { "ru": { "abv": "АБВ", "qwerty": "ЙЦУКЕН" } },
          "default": "abv"
        }
      }
    },
    {
      "id": "magnetic_sentence",
      "type": "magnetic_sentence",
      "evaluation": "none",
      "ui": {
        "title": "Предложение (текст)",
        "instruction": "Прочитай предложение и составь его из букв, затем перепиши в тетрадь"
      },
      "params": {
        "layout": {
          "type": "enum",
          "label": { "ru": "Раскладка" },
          "values": ["abv", "qwerty"],
          "labels": { "ru": { "abv": "АБВ", "qwerty": "ЙЦУКЕН" } },
          "default": "abv"
        },
        "sentences": {
          "type": "sentence_list",
          "label": { "ru": "Предложения" },
          "source": "topic.sentences"
        }
      }
    },
    {
      "id": "magnetic_sentence_audio",
      "type": "magnetic_sentence_audio",
      "evaluation": "none",
      "ui": {
        "title": "Предложение (по памяти)",
        "instruction": "Послушай предложение и составь его из букв по памяти, затем перепиши в тетрадь"
      },
      "params": {
        "layout": {
          "type": "enum",
          "label": { "ru": "Раскладка" },
          "values": ["abv", "qwerty"],
          "labels": { "ru": { "abv": "АБВ", "qwerty": "ЙЦУКЕН" } },
          "default": "abv"
        },
        "sentences": {
          "type": "sentence_list",
          "label": { "ru": "Предложения" },
          "source": "topic.sentences"
        }
      }
    }
  ],
  "cards": [
    { "id": "А", "type": "letter", "label": "А", "category": "vowel" },
    { "id": "Б", "type": "letter", "label": "Б", "category": "consonant" },
    { "id": "В", "type": "letter", "label": "В", "category": "consonant" },
    { "id": "Г", "type": "letter", "label": "Г", "category": "consonant" },
    { "id": "Д", "type": "letter", "label": "Д", "category": "consonant" },
    { "id": "Е", "type": "letter", "label": "Е", "category": "vowel" },
    { "id": "Ё", "type": "letter", "label": "Ё", "category": "vowel" },
    { "id": "Ж", "type": "letter", "label": "Ж", "category": "consonant" },
    { "id": "З", "type": "letter", "label": "З", "category": "consonant" },
    { "id": "И", "type": "letter", "label": "И", "category": "vowel" },
    { "id": "Й", "type": "letter", "label": "Й", "category": "consonant" },
    { "id": "К", "type": "letter", "label": "К", "category": "consonant" },
    { "id": "Л", "type": "letter", "label": "Л", "category": "consonant" },
    { "id": "М", "type": "letter", "label": "М", "category": "consonant" },
    { "id": "Н", "type": "letter", "label": "Н", "category": "consonant" },
    { "id": "О", "type": "letter", "label": "О", "category": "vowel" },
    { "id": "П", "type": "letter", "label": "П", "category": "consonant" },
    { "id": "Р", "type": "letter", "label": "Р", "category": "consonant" },
    { "id": "С", "type": "letter", "label": "С", "category": "consonant" },
    { "id": "Т", "type": "letter", "label": "Т", "category": "consonant" },
    { "id": "У", "type": "letter", "label": "У", "category": "vowel" },
    { "id": "Ф", "type": "letter", "label": "Ф", "category": "consonant" },
    { "id": "Х", "type": "letter", "label": "Х", "category": "consonant" },
    { "id": "Ц", "type": "letter", "label": "Ц", "category": "consonant" },
    { "id": "Ч", "type": "letter", "label": "Ч", "category": "consonant" },
    { "id": "Ш", "type": "letter", "label": "Ш", "category": "consonant" },
    { "id": "Щ", "type": "letter", "label": "Щ", "category": "consonant" },
    { "id": "Ъ", "type": "letter", "label": "Ъ", "category": "sign" },
    { "id": "Ы", "type": "letter", "label": "Ы", "category": "vowel" },
    { "id": "Ь", "type": "letter", "label": "Ь", "category": "sign" },
    { "id": "Э", "type": "letter", "label": "Э", "category": "vowel" },
    { "id": "Ю", "type": "letter", "label": "Ю", "category": "vowel" },
    { "id": "Я", "type": "letter", "label": "Я", "category": "vowel" }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add tools/magnetic_alphabet/topic.json
git commit -m "feat(magnetic_alphabet): add sentence modes and built-in sentence list to topic.json"
```

---

### Task 2: Update engine.js to handle new mode types

**Files:**
- Modify: `src/topics/renderers/magnetic_alphabet/engine.js`

- [ ] **Step 1: Rewrite engine to accept topicRecord and handle new modes**

Replace the entire content of `src/topics/renderers/magnetic_alphabet/engine.js`:

```js
export function generateTasks(mode, topicRecord, sessionParams) {
  const cards = Array.isArray(topicRecord) ? topicRecord : (topicRecord?.cards ?? []);
  const letters = cards
    .filter((c) => c.type === "letter")
    .map((c) => ({ letter: c.id, category: c.category ?? "consonant" }));

  if (mode.type === "magnetic_sentence" || mode.type === "magnetic_sentence_audio") {
    const selectedTexts = Array.isArray(sessionParams?.sentences) ? sessionParams.sentences : [];
    const topicSentences = Array.isArray(topicRecord?.sentences) ? topicRecord.sentences : [];
    const audioMap = Object.fromEntries(topicSentences.map((s) => [s.text, s.audio ?? null]));
    const sentences = selectedTexts.map((text) => ({ text, audio: audioMap[text] ?? null }));
    return [{ type: mode.type, letters, sentences }];
  }

  return [{ type: mode.type ?? "magnetic_free", letters }];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/topics/renderers/magnetic_alphabet/engine.js
git commit -m "feat(magnetic_alphabet): engine handles magnetic_sentence and magnetic_sentence_audio modes"
```

---

### Task 3: Add magnetic_alphabet special case to useSessionEngine.js

**Files:**
- Modify: `src/features/session/useSessionEngine.js`

Context: currently `magnetic_alphabet` falls into the generic `else` branch which passes only `cards` to the engine. The new engine needs `topicRecord` to access `topicRecord.sentences`. Add a special case BEFORE the `else` block.

- [ ] **Step 1: Add magnetic_alphabet branch in useState initializer**

In `src/features/session/useSessionEngine.js`, inside the `useState(() => { ... })` initializer, find the `else if (renderer === "sentence_puzzle")` block and add a new branch after it (before the `else`):

```js
    } else if (renderer === "magnetic_alphabet") {
      const generateTasks = ENGINE_REGISTRY["magnetic_alphabet"];
      tasks = generateTasks ? generateTasks(mode, topicRecord, sessionParams) : [];
    } else {
```

- [ ] **Step 2: Add the same branch in the `useEffect` restart block**

In the same file, find the `useEffect` that rebuilds tasks (around line 100–115). It has the same pattern. Add the same `magnetic_alphabet` branch there too. Find:

```js
      const generateTasks = ENGINE_REGISTRY["sentence_puzzle"];
      const spSelected = link.selectedConceptIds?.length ? link.selectedConceptIds : null;
      tasks = generateTasks ? generateTasks(mode, topicRecord, sessionParams, activeStudent, spSelected) : [];
    } else {
```

Replace with:

```js
      const generateTasks = ENGINE_REGISTRY["sentence_puzzle"];
      const spSelected = link.selectedConceptIds?.length ? link.selectedConceptIds : null;
      tasks = generateTasks ? generateTasks(mode, topicRecord, sessionParams, activeStudent, spSelected) : [];
    } else if (renderer === "magnetic_alphabet") {
      const generateTasks = ENGINE_REGISTRY["magnetic_alphabet"];
      tasks = generateTasks ? generateTasks(mode, topicRecord, sessionParams) : [];
    } else {
```

- [ ] **Step 3: Commit**

```bash
git add src/features/session/useSessionEngine.js
git commit -m "feat(magnetic_alphabet): pass topicRecord to engine for sentence modes"
```

---

### Task 4: Add SentenceListParam to ParamsScreen.jsx

**Files:**
- Modify: `src/features/session/ParamsScreen.jsx`

- [ ] **Step 1: Add the SentenceListParam component**

After the `BooleanParam` function definition (around line 62) in `src/features/session/ParamsScreen.jsx`, insert:

```jsx
function SentenceListParam({ label, predefined, value, onChange }) {
  const selected = Array.isArray(value) ? value : [];
  const [customText, setCustomText] = useState(() =>
    selected.filter((s) => !predefined.some((p) => p.text === s)).join("\n")
  );

  function togglePredefined(text) {
    if (selected.includes(text)) {
      onChange(selected.filter((s) => s !== text));
    } else {
      onChange([...selected, text]);
    }
  }

  function handleCustomChange(e) {
    setCustomText(e.target.value);
    const customLines = e.target.value
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const predefinedSelected = selected.filter((s) => predefined.some((p) => p.text === s));
    onChange([...predefinedSelected, ...customLines]);
  }

  return (
    <div className="param-row param-row--block param-sentence-list">
      <div className="param-label">{label}</div>
      <div className="param-sentence-list__body">
        {predefined.length > 0 && (
          <div className="param-sentence-list__predefined">
            {predefined.map((s) => (
              <label key={s.id} className="param-sentence-list__item">
                <input
                  type="checkbox"
                  className="param-checkbox"
                  checked={selected.includes(s.text)}
                  onChange={() => togglePredefined(s.text)}
                />
                <span>{s.text}</span>
              </label>
            ))}
          </div>
        )}
        <div className="param-sentence-list__custom">
          <div className="param-hint">Свои предложения (по одному на строку):</div>
          <textarea
            className="param-sentence-textarea"
            rows={3}
            value={customText}
            onChange={handleCustomChange}
            placeholder="Например: Ваня читает книгу."
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Handle sentence_list in the params renderer loop**

In `ParamsScreen.jsx`, inside the non-reading, non-comparison params section, find the `Object.entries(mode.params ?? {}).map(...)` block (around line 413). After the `if (def.type === "boolean")` branch and before `return null;`, add:

```jsx
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
```

- [ ] **Step 3: Handle sentence_list in getInitialParams**

In `getInitialParams()` (around line 316), the line:

```js
out[key] = saved[key] ?? def.default ?? (def.type === "number" ? def.min : def.values?.[0]);
```

Add a guard before it:

```js
      if (def.type === "sentence_list") {
        out[key] = saved[key] ?? [];
        continue;
      }
      out[key] = saved[key] ?? def.default ?? (def.type === "number" ? def.min : def.values?.[0]);
```

- [ ] **Step 4: Disable Start button when sentence list is empty**

In `ParamsScreen.jsx`, add a computed variable after the `paramsContent` assignment (around line 457):

```js
  const hasSentenceListParam = Object.values(mode?.params ?? {}).some((d) => d.type === "sentence_list");
  const sentenceListEmpty = hasSentenceListParam && (params.sentences ?? []).length === 0;
```

Then update both Start buttons to pass `disabled`:

Find:
```jsx
<Button fullWidth onClick={startSession}>Начать занятие</Button>
```
Replace both occurrences with:
```jsx
<Button fullWidth onClick={startSession} disabled={sentenceListEmpty}>Начать занятие</Button>
```

- [ ] **Step 5: Commit**

```bash
git add src/features/session/ParamsScreen.jsx
git commit -m "feat(params): add SentenceListParam component for sentence_list mode params"
```

---

### Task 5: Create MagneticSentenceView.jsx

**Files:**
- Create: `src/topics/renderers/magnetic_alphabet/MagneticSentenceView.jsx`

- [ ] **Step 1: Create the file**

Create `src/topics/renderers/magnetic_alphabet/MagneticSentenceView.jsx` with this content:

```jsx
import { useState, useRef, Fragment } from "react";

const DIGIT_ROW = ["0","1","2","3","4","5","6","7","8","9"];
const ABV_ROWS = [
  ["А","Б","В","Г","Д","Е","Ё","Ж","З","И","Й"],
  ["К","Л","М","Н","О","П","Р","С","Т","У","Ф"],
  ["Х","Ц","Ч","Ш","Щ","Ъ","Ы","Ь","Э","Ю","Я"],
];
const QWERTY_ROWS = [
  ["Й","Ц","У","К","Е","Н","Г","Ш","Щ","З","Х"],
  ["Ф","Ы","В","А","П","Р","О","Л","Д","Ж","Э"],
  ["Я","Ч","С","М","И","Т","Ь","Б","Ю","Ъ","Ё"],
];
const BOTTOM_LEFT  = ["!","?"];
const BOTTOM_RIGHT = [".","," ];

const VOWELS = new Set(["А","Е","Ё","И","О","У","Ы","Э","Ю","Я"]);
const SIGNS  = new Set(["Ъ","Ь"]);

let _seq = 0;
function newId() { return `ms_${++_seq}`; }

function emptyLines(n = 12) { return Array.from({ length: n }, () => []); }

function ensureTrailing(lines) {
  const safe   = Array.isArray(lines) ? lines : [];
  const rev    = [...safe].reverse();
  const ne     = rev.findIndex((l) => l.length > 0);
  const tail   = ne === -1 ? safe.length : ne;
  const toAdd  = Math.max(0, 4 - tail);
  return toAdd > 0 ? [...safe, ...emptyLines(toAdd)] : safe;
}

function normalize(text) {
  return String(text || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

function getTextFromLines(lines) {
  return lines
    .map((line) => line.map((t) => (t.type === "space" ? " " : t.letter ?? "")).join(""))
    .join("\n")
    .replace(/\n+$/, "")
    .trim();
}

function getCategory(letter, letterMap) {
  const s = String(letter || "");
  if (!s || !/^[А-ЯЁ]$/u.test(s)) return "neutral";
  if (letterMap[s]) return letterMap[s];
  if (VOWELS.has(s)) return "vowel";
  if (SIGNS.has(s))  return "sign";
  return "consonant";
}

export default function MagneticSentenceView({
  task, mode, topicId,
  sessionParams, soundEnabled,
  playTopicFile, playFeedback,
  onAdvance,
}) {
  const audioMode = mode?.type === "magnetic_sentence_audio";
  const layout    = sessionParams?.layout ?? "abv";
  const kbRows    = layout === "qwerty" ? QWERTY_ROWS : ABV_ROWS;
  const sentences = task?.sentences ?? [];
  const letterMap = Object.fromEntries((task?.letters ?? []).map((l) => [l.letter, l.category]));

  const canvasRef  = useRef(null);
  const pendingRef = useRef(null);

  const [sentenceIdx, setSentenceIdx] = useState(0);
  const [phase,       setPhase]       = useState("assemble"); // "assemble" | "success" | "copy"
  const [lines,       setLines]       = useState(() => ensureTrailing(emptyLines()));
  const [drag,        setDrag]        = useState(null);
  const [dropTarget,  setDropTarget]  = useState(null);
  const [checkResult, setCheckResult] = useState(null); // null | "correct" | "incorrect"

  const current      = sentences[sentenceIdx] ?? null;
  const assembledText = getTextFromLines(lines);
  const canCheck     = assembledText.trim().length > 0 && phase === "assemble" && !checkResult;

  function updateLines(fn) {
    setLines((cur) => ensureTrailing(fn(cur)));
  }

  function computeDrop(x, y, src = lines) {
    const lineEls = canvasRef.current?.querySelectorAll(".mag-line");
    if (!lineEls?.length) return null;
    let best = 0, bestD = Infinity;
    lineEls.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(y - (r.top + r.height / 2));
      if (d < bestD) { bestD = d; best = i; }
    });
    const tokens = lineEls[best].querySelectorAll(".mag-token:not(.mag-floating)");
    let ins = (src[best] ?? []).length;
    for (let i = 0; i < tokens.length; i++) {
      const r = tokens[i].getBoundingClientRect();
      if (x < r.left + r.width / 2) { ins = i; break; }
    }
    return { lineIdx: best, insertIdx: ins };
  }

  function beginFromKeyboard(e, letter, category) {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
    const cat = category ?? getCategory(letter, letterMap);
    setDrag({ pointerId: e.pointerId, source: "keyboard", letter, category: cat, x: e.clientX, y: e.clientY });
    setDropTarget(computeDrop(e.clientX, e.clientY));
  }

  function beginFromCanvas(e, lineIdx, tokenIdx, token) {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
    pendingRef.current = { pointerId: e.pointerId, lineIdx, tokenIdx, token, startX: e.clientX, startY: e.clientY };
  }

  function startCanvasDrag(pending, cx, cy) {
    let snap = lines;
    updateLines((cur) => {
      const next = cur.map((line, i) =>
        i === pending.lineIdx ? line.filter((_, j) => j !== pending.tokenIdx) : line
      );
      snap = ensureTrailing(next);
      return next;
    });
    setDrag({
      pointerId: pending.pointerId,
      source:   "canvas",
      letter:   pending.token.letter,
      category: pending.token.category,
      type:     pending.token.type,
      x: cx, y: cy,
    });
    setDropTarget(computeDrop(cx, cy, snap));
  }

  function handleMove(e) {
    const p = pendingRef.current;
    if (!drag && p && e.pointerId === p.pointerId) {
      if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) >= 10) {
        pendingRef.current = null;
        startCanvasDrag(p, e.clientX, e.clientY);
      }
      return;
    }
    if (!drag || e.pointerId !== drag.pointerId) return;
    setDrag((d) => ({ ...d, x: e.clientX, y: e.clientY }));
    setDropTarget(computeDrop(e.clientX, e.clientY));
  }

  function handleUp(e) {
    const p = pendingRef.current;
    if (!drag && p && e.pointerId === p.pointerId) {
      pendingRef.current = null;
      updateLines((cur) =>
        cur.map((line, i) =>
          i === p.lineIdx ? line.filter((_, j) => j !== p.tokenIdx) : line
        )
      );
      return;
    }
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (dropTarget) {
      const token = {
        id:       newId(),
        type:     drag.type ?? (drag.category === "space" ? "space" : "letter"),
        letter:   drag.letter,
        category: drag.category,
      };
      updateLines((cur) =>
        cur.map((line, i) => {
          if (i !== dropTarget.lineIdx) return line;
          const next = [...line];
          next.splice(dropTarget.insertIdx, 0, token);
          return next;
        })
      );
    }
    setDrag(null);
    setDropTarget(null);
    pendingRef.current = null;
  }

  function handleCheck() {
    if (!canCheck) return;
    const correct = normalize(assembledText) === normalize(current?.text ?? "");
    if (correct) {
      setCheckResult("correct");
      if (soundEnabled) playFeedback?.("correct");
      setTimeout(() => {
        setCheckResult(null);
        setPhase("success");
        setTimeout(() => setPhase("copy"), 1500);
      }, 400);
    } else {
      setCheckResult("incorrect");
      if (soundEnabled) playFeedback?.("incorrect");
      setTimeout(() => setCheckResult(null), 1500);
    }
  }

  function handleDone() {
    const nextIdx = sentenceIdx + 1;
    if (nextIdx >= sentences.length) {
      onAdvance?.();
    } else {
      setSentenceIdx(nextIdx);
      setPhase("assemble");
      setLines(ensureTrailing(emptyLines()));
    }
  }

  async function handleListen() {
    if (current?.audio) {
      await playTopicFile?.(topicId, current.audio);
    }
  }

  if (phase === "copy") {
    return (
      <div className="mag-screen mag-copy-screen">
        <div className="mag-copy-animation">
          <span className="mag-copy-pen">✏️</span>
          <span className="mag-copy-notebook">📓</span>
        </div>
        <div className="mag-copy-text">{assembledText}</div>
        <button className="mag-copy-done-btn" onClick={handleDone}>Готово</button>
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className="mag-screen mag-success-screen">
        <div className="mag-success-icon">✓</div>
      </div>
    );
  }

  return (
    <div
      className="mag-screen"
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      {audioMode ? (
        <div className="mag-sentence-bar mag-sentence-bar--audio">
          <button className="mag-listen-btn" onClick={handleListen}>
            🔊 Слушать
          </button>
          {!current?.audio && current?.text && (
            <span className="mag-sentence-text">{current.text}</span>
          )}
        </div>
      ) : (
        <div className="mag-sentence-bar">
          <span className="mag-sentence-text">{current?.text ?? ""}</span>
        </div>
      )}

      <div className="mag-canvas" ref={canvasRef}>
        {lines.map((line, li) => (
          <div key={li} className={`mag-line${dropTarget?.lineIdx === li ? " drag-target" : ""}`}>
            {line.map((tok, ti) => (
              <Fragment key={tok.id}>
                {dropTarget?.lineIdx === li && dropTarget.insertIdx === ti && <div className="mag-insert-cursor" />}
                <div
                  className={`mag-token ${tok.category}`}
                  onPointerDown={(e) => beginFromCanvas(e, li, ti, tok)}
                >
                  {tok.type === "space" ? null : tok.letter}
                </div>
              </Fragment>
            ))}
            {dropTarget?.lineIdx === li && dropTarget.insertIdx === line.length && <div className="mag-insert-cursor" />}
          </div>
        ))}
      </div>

      <div className="mag-keyboard">
        <div className="mag-kb-row digits">
          {DIGIT_ROW.map((d) => (
            <button key={d} type="button" className="mag-key neutral" onPointerDown={(e) => beginFromKeyboard(e, d)}>
              {d}
            </button>
          ))}
        </div>
        {kbRows.map((row, ri) => (
          <div key={ri} className="mag-kb-row letters">
            {row.map((letter) => (
              <button
                key={letter}
                type="button"
                className={`mag-key ${getCategory(letter, letterMap)}`}
                onPointerDown={(e) => beginFromKeyboard(e, letter)}
              >
                {letter}
              </button>
            ))}
          </div>
        ))}
        <div className="mag-kb-row bottom">
          {BOTTOM_LEFT.map((s) => (
            <button key={s} type="button" className="mag-key neutral" onPointerDown={(e) => beginFromKeyboard(e, s)}>{s}</button>
          ))}
          <button type="button" className="mag-key-space" onPointerDown={(e) => beginFromKeyboard(e, null, "space")}>
            пробел
          </button>
          {BOTTOM_RIGHT.map((s) => (
            <button key={s} type="button" className="mag-key neutral" onPointerDown={(e) => beginFromKeyboard(e, s)}>{s}</button>
          ))}
        </div>
      </div>

      <div className="mag-sentence-check-bar">
        <button
          className={`mag-check-btn${checkResult ? ` mag-check-btn--${checkResult}` : ""}`}
          onClick={handleCheck}
          disabled={!canCheck}
        >
          {checkResult === "correct" ? "✓" : checkResult === "incorrect" ? "✗" : "Проверить"}
        </button>
        <span className="mag-sentence-counter">
          {sentenceIdx + 1} / {sentences.length}
        </span>
      </div>

      {drag && (
        <div
          className={`mag-token ${drag.category} mag-floating`}
          style={{ left: drag.x, top: drag.y }}
        >
          {drag.category === "space" ? "·" : drag.letter}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/topics/renderers/magnetic_alphabet/MagneticSentenceView.jsx
git commit -m "feat(magnetic_alphabet): add MagneticSentenceView component with assemble/success/copy phases"
```

---

### Task 6: Route new modes in index.jsx

**Files:**
- Modify: `src/topics/renderers/magnetic_alphabet/index.jsx`

- [ ] **Step 1: Import and route new modes**

At the top of `src/topics/renderers/magnetic_alphabet/index.jsx`, add the import after the existing imports:

```js
import MagneticSentenceView from "./MagneticSentenceView";
```

At the start of the `MagneticAlphabetRenderer` function body (before the existing hooks), add:

```js
  if (mode?.type === "magnetic_sentence" || mode?.type === "magnetic_sentence_audio") {
    return (
      <MagneticSentenceView
        task={task}
        mode={mode}
        topicId={props?.topicId}
        sessionParams={sessionParams}
        soundEnabled={soundEnabled}
        playTopicFile={props?.playTopicFile}
        playFeedback={playFeedback}
        onAdvance={props?.onAdvance}
      />
    );
  }
```

Note: The function signature must expose `topicId`, `playTopicFile`, `onAdvance`. Check the current signature:

```js
export default function MagneticAlphabetRenderer({ task, mode, sessionParams, soundEnabled, playFeedback }) {
```

Update the signature to:

```js
export default function MagneticAlphabetRenderer({ task, mode, sessionParams, soundEnabled, playFeedback, topicId, playTopicFile, onAdvance }) {
```

And update the JSX in the routing block:

```js
  if (mode?.type === "magnetic_sentence" || mode?.type === "magnetic_sentence_audio") {
    return (
      <MagneticSentenceView
        task={task}
        mode={mode}
        topicId={topicId}
        sessionParams={sessionParams}
        soundEnabled={soundEnabled}
        playTopicFile={playTopicFile}
        playFeedback={playFeedback}
        onAdvance={onAdvance}
      />
    );
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/topics/renderers/magnetic_alphabet/index.jsx
git commit -m "feat(magnetic_alphabet): route magnetic_sentence modes to MagneticSentenceView"
```

---

### Task 7: Add CSS for new components

**Files:**
- Modify: `src/topics/renderers/magnetic_alphabet/magnetic_alphabet.css`
- Modify: `src/styles.css`

- [ ] **Step 1: Add styles for new phases and sentence bar to magnetic_alphabet.css**

Append to the end of `src/topics/renderers/magnetic_alphabet/magnetic_alphabet.css`:

```css
/* ── Sentence bar (assemble phase) ── */
.mag-sentence-bar {
  flex-shrink: 0;
  padding: 10px 16px 8px;
  background: #f0f7ff;
  border-bottom: 2px solid #b8d4f0;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.mag-sentence-text {
  font-size: clamp(16px, 2.5vw, 22px);
  font-weight: 700;
  color: #1a3a5c;
  letter-spacing: 0.01em;
}

.mag-sentence-bar--audio {
  background: #f5f0ff;
  border-bottom-color: #c4b0e8;
}

.mag-listen-btn {
  height: 40px;
  padding: 0 18px;
  border-radius: 10px;
  border: 2px solid #7c5cbf;
  background: #fff;
  color: #5a3ea0;
  font-size: clamp(14px, 2vw, 18px);
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}
.mag-listen-btn:hover { background: #f0eaff; }
.mag-listen-btn:active { background: #e4d8ff; }

/* ── Check bar (assemble phase) ── */
.mag-sentence-check-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 8px 12px 6px;
  background: #fdfcf9;
  border-top: 1.5px solid #e8e2d9;
}

.mag-sentence-counter {
  font-size: 14px;
  color: #8a7f76;
  font-weight: 600;
}

/* ── Success screen ── */
.mag-success-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e8f8e8;
  animation: mag-success-flash 1.5s ease-out forwards;
}

@keyframes mag-success-flash {
  0%   { background: #e8f8e8; }
  50%  { background: #b8f0b8; }
  100% { background: #e8f8e8; }
}

.mag-success-icon {
  font-size: clamp(64px, 12vw, 96px);
  color: #2e8b2e;
  font-weight: 900;
  animation: mag-success-pop 0.4s ease-out;
}

@keyframes mag-success-pop {
  0%   { transform: scale(0.5); opacity: 0; }
  70%  { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}

/* ── Copy screen ── */
.mag-copy-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  padding: 32px 24px;
  background: #fffdf5;
}

.mag-copy-animation {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: clamp(36px, 7vw, 56px);
}

.mag-copy-pen {
  display: inline-block;
  animation: pen-write 1.8s ease-in-out infinite alternate;
  transform-origin: bottom right;
}

@keyframes pen-write {
  0%   { transform: translateX(0) rotate(-10deg); }
  100% { transform: translateX(48px) rotate(-10deg); }
}

.mag-copy-notebook {
  display: inline-block;
}

.mag-copy-text {
  font-size: clamp(20px, 3.5vw, 30px);
  font-weight: 700;
  color: #1a3a5c;
  text-align: center;
  border-bottom: 3px dashed #b0c4d8;
  padding-bottom: 8px;
  letter-spacing: 0.02em;
}

.mag-copy-done-btn {
  height: 52px;
  padding: 0 40px;
  border-radius: 14px;
  border: none;
  background: #4a9b8f;
  color: #fff;
  font-size: clamp(16px, 2.4vw, 22px);
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}
.mag-copy-done-btn:hover  { background: #3d8278; }
.mag-copy-done-btn:active { transform: scale(0.97); }
```

- [ ] **Step 2: Add SentenceListParam styles to src/styles.css**

Append to the end of `src/styles.css`:

```css
/* ── SentenceListParam ── */
.param-sentence-list .param-sentence-list__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.param-sentence-list__predefined {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.param-sentence-list__item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 14px;
  color: #263131;
  cursor: pointer;
  line-height: 1.4;
}

.param-sentence-list__custom {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.param-sentence-textarea {
  width: 100%;
  border: 2px solid #d6cbbf;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
  color: #263131;
  resize: vertical;
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
}
.param-sentence-textarea:focus { border-color: #4a9b8f; }
```

- [ ] **Step 3: Commit**

```bash
git add src/topics/renderers/magnetic_alphabet/magnetic_alphabet.css src/styles.css
git commit -m "feat(magnetic_alphabet): add CSS for sentence modes — sentence bar, success, copy screens"
```

---

### Task 8: Rebuild deck ZIP and verify

**Files:**
- Modify: `tools/magnetic_alphabet/magnetic_alphabet.zip`
- Modify: `public/decks/catalog.json`

- [ ] **Step 1: Rebuild the ZIP using build.mjs**

```bash
node tools/magnetic_alphabet/build.mjs
```

Expected output: `✓ Built: ...tools/magnetic_alphabet/magnetic_alphabet.zip`

- [ ] **Step 2: Copy ZIP to public/decks with versioned name**

```bash
cp tools/magnetic_alphabet/magnetic_alphabet.zip public/decks/magnetic_alphabet_v1.7.0.zip
```

- [ ] **Step 3: Update catalog.json**

In `public/decks/catalog.json`, find the `magnetic_alphabet` entry and update `version` and `url` fields:

```json
{
  "id": "magnetic_alphabet",
  "version": "1.7.0",
  "title": { "ru": "Магнитная азбука", "en": "Magnetic Alphabet" },
  "description": {
    "ru": "33 буквы русского алфавита на магнитной доске. Составляй слова и предложения из букв. Гласные — красные, согласные — синие.",
    "en": "33 Russian letters on a magnetic board. Build words and sentences by dragging letters. Vowels in red, consonants in blue."
  },
  "url": "./decks/magnetic_alphabet_v1.7.0.zip"
}

- [ ] **Step 4: Start dev server and manually verify the full flow**

```bash
npm run dev
```

Open the app in a browser. Verification checklist:

1. Open Magnetic Alphabet topic → see two new modes: "Предложение (текст)" and "Предложение (по памяти)"
2. Open params for "Предложение (текст)" → see checkboxes for 10 built-in sentences and a textarea
3. Select 2–3 sentences, click "Начать занятие"
4. **Text mode:** sentence appears at top bar → assemble it using letters → press "Проверить" → green flash → pen animation + assembled text → "Готово" → next sentence
5. After last sentence: session ends (summary screen)
6. Test wrong assembly: press "Проверить" → red flash, canvas stays
7. Test "Предложение (по памяти)" mode: only Listen button visible, no text → button plays audio (or shows text if no audio file)
8. Verify Start button is disabled when no sentences are selected

- [ ] **Step 5: Commit final**

```bash
git add public/decks/ tools/magnetic_alphabet/magnetic_alphabet.zip
git commit -m "feat(magnetic_alphabet): rebuild deck v1.7.0 with sentence modes"
```
