# Renderer-in-ZIP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move topic renderers out of the main app bundle into their respective topic ZIP files, so adding new topic types never grows the main bundle.

**Architecture:** Each topic ZIP ships a `renderer.js` — a self-contained IIFE bundle (React externalized, other deps bundled). The app exposes React globally via `window.__Mirocard`, executes `renderer.js` via indirect eval, and caches the resulting component in memory. `SessionScreen` loads the renderer lazily from IndexedDB instead of from the static registry.

**Tech Stack:** Vite library build (IIFE format), Rollup externals/globals, JSZip, IndexedDB (`topics` store), React 18, @dnd-kit/core (bundled inside renderer).

---

## Background

### Why IIFE + indirect eval

Dynamic `import()` from a blob URL fails because bare specifiers like `import 'react'` in the renderer ES module can't be resolved from a blob URL context. IIFE format with Rollup globals sidesteps this: all external deps become references to `window.__Mirocard.X` at build time. Indirect eval `(0, eval)(code)` executes in global scope, making `var __MirocardRenderer = …` accessible as `window.__MirocardRenderer`.

### Why dnd-kit is bundled into the renderer (not exposed globally)

dnd-kit uses React hooks internally. It must share the same React instance as the renderer component. Since React is externalized (→ `window.__Mirocard.React`), dnd-kit's own `import 'react'` is also externalized in the renderer build — so dnd-kit and the component both call through the same React instance. dnd-kit does NOT need to be on `window.__Mirocard`.

### Scope

This plan migrates **sentence_puzzle only**. Other renderers (flashcards, comparison, etc.) stay in `registry.js` as fallback until their topics are rebuilt. `SessionScreen` prefers the dynamic loader; falls back to registry when `renderer.js` is absent from IndexedDB.

---

## File Map

| File | Change |
|------|--------|
| `src/main.jsx` | Add `window.__Mirocard = { React, jsxRuntime }` before `createRoot` |
| `vite.config.renderer.mjs` | New — Vite IIFE library build config, parameterized by `RENDERER` env var |
| `src/topics/rendererLoader.js` | New — load + eval `renderer.js` from IndexedDB, in-memory cache |
| `src/features/session/SessionScreen.jsx` | Use `rendererLoader` instead of `RENDERER_REGISTRY` |
| `src/topics/registry.js` | Remove `sentence_puzzle` import |
| `tools/sentence_puzzle/build.mjs` | Build renderer.js via Vite, include in ZIP |
| `package.json` | Add `build:renderer` script |

---

## Task 1: Expose React globals in main.jsx

**Files:**
- Modify: `src/main.jsx`

- [ ] **Step 1: Add globals before createRoot**

Open `src/main.jsx`. After the imports and before `createRoot(...)`, insert:

```js
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
// Expose shared host globals for dynamically-loaded renderer IIFEs.
// Renderers externalize 'react' and 'react/jsx-runtime' at build time,
// referencing these globals so they share the app's React instance.
window.__Mirocard = { React, jsxRuntime };
```

Full updated `src/main.jsx`:

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import "./styles.css";
import App from "./App";

// Expose shared host globals for dynamically-loaded renderer IIFEs.
window.__Mirocard = { React, jsxRuntime };

if ("serviceWorker" in navigator) {
  let refreshing = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
    .then((registration) => {
      registration.waiting?.postMessage({ type: "SKIP_WAITING" });
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            worker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
      registration.update().catch(() => {});
    })
    .catch(() => {});
}

const SPLASH_MIN_MS = 1800;
const splashStart = performance.now();

function dismissSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  const elapsed = performance.now() - splashStart;
  const wait = Math.max(0, SPLASH_MIN_MS - elapsed);
  setTimeout(() => {
    splash.classList.add("splash--exit");
    setTimeout(() => splash.remove(), 580);
  }, wait);
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

dismissSplash();
```

- [ ] **Step 2: Build and verify no errors**

```bash
npm run build
```

Expected: `✓ built in …ms`, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main.jsx
git commit -m "feat(renderer): expose window.__Mirocard host globals for dynamic renderers"
```

---

## Task 2: Vite renderer build config

**Files:**
- Create: `vite.config.renderer.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create vite.config.renderer.mjs**

Create `vite.config.renderer.mjs` at project root:

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RENDERER = process.env.RENDERER;
if (!RENDERER) throw new Error("RENDERER env var is required (e.g. RENDERER=sentence_puzzle)");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  build: {
    lib: {
      entry:   path.resolve(__dirname, `src/topics/renderers/${RENDERER}/index.jsx`),
      name:    "__MirocardRenderer",
      formats: ["iife"],
      fileName: () => "renderer",
    },
    outDir:     path.resolve(__dirname, `tools/${RENDERER}/dist`),
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      external: ["react", "react/jsx-runtime"],
      output: {
        globals: {
          "react":             "__Mirocard.React",
          "react/jsx-runtime": "__Mirocard.jsxRuntime",
        },
      },
    },
  },
});
```

- [ ] **Step 2: Add npm script to package.json**

In `package.json`, inside `"scripts"`, add:

```json
"build:renderer": "vite build --config vite.config.renderer.mjs"
```

- [ ] **Step 3: Test the build for sentence_puzzle**

```bash
RENDERER=sentence_puzzle npm run build:renderer
```

On Windows (PowerShell):
```powershell
$env:RENDERER="sentence_puzzle"; npm run build:renderer
```

Expected output:
```
vite … building client environment for production…
✓ N modules transformed.
tools/sentence_puzzle/dist/renderer.iife.js   XX kB
✓ built in …ms
```

Verify `tools/sentence_puzzle/dist/renderer.iife.js` exists and contains `__MirocardRenderer`.

> **Note:** Vite appends `.iife.js` despite `fileName: () => "renderer"`. The actual output filename will be `renderer.iife.js`. This is accounted for in Task 5.

- [ ] **Step 4: Commit**

```bash
git add vite.config.renderer.mjs package.json
git commit -m "feat(renderer): add Vite IIFE library build config for per-topic renderers"
```

---

## Task 3: rendererLoader.js

**Files:**
- Create: `src/topics/rendererLoader.js`

The loader reads `renderer.js` (or `renderer.iife.js`) from IndexedDB `topics` store, executes it via indirect eval, and returns the React component. In-memory cache avoids re-parsing.

- [ ] **Step 1: Create src/topics/rendererLoader.js**

```js
import { getDb } from "@/core/db";
import { topics } from "@/core/db";

// In-memory cache: topicId → React component
const _cache = new Map();

async function readRendererBlob(db, topicId) {
  // Try both possible filenames (Vite appends .iife.js to the output)
  return (
    (await topics.getFile(db, topicId, "renderer.iife.js")) ??
    (await topics.getFile(db, topicId, "renderer.js"))
  );
}

export async function loadRenderer(topicId) {
  if (_cache.has(topicId)) return _cache.get(topicId);

  const db = await getDb();
  const blob = await readRendererBlob(db, topicId);
  if (!blob) return null;

  const code = await blob.text();

  // Indirect eval: executes in global scope so `var __MirocardRenderer = …`
  // becomes window.__MirocardRenderer. window.__Mirocard must be set first
  // (done in main.jsx before createRoot).
  // eslint-disable-next-line no-eval
  (0, eval)(code);

  const Component = window.__MirocardRenderer?.default ?? window.__MirocardRenderer ?? null;
  // Clean up global to avoid leaking between loads
  delete window.__MirocardRenderer;

  if (Component) _cache.set(topicId, Component);
  return Component;
}

export function clearRendererCache(topicId) {
  if (topicId) _cache.delete(topicId);
  else _cache.clear();
}
```

- [ ] **Step 2: Build to verify no errors**

```bash
npm run build
```

Expected: `✓ built in …ms`.

- [ ] **Step 3: Commit**

```bash
git add src/topics/rendererLoader.js
git commit -m "feat(renderer): add rendererLoader — loads and evals renderer.js from IndexedDB"
```

---

## Task 4: Update SessionScreen to use dynamic renderer

**Files:**
- Modify: `src/features/session/SessionScreen.jsx`

`SessionScreen` currently does `const Renderer = RENDERER_REGISTRY[topicRecord.meta.renderer]`. We replace this with a `useState` + `useEffect` that calls `loadRenderer(topicId)`. Fall back to `RENDERER_REGISTRY` if the dynamic loader returns null (topic was installed before renderer-in-ZIP era).

- [ ] **Step 1: Read current SessionScreen**

Read `src/features/session/SessionScreen.jsx` lines 1–20 to confirm current imports.

Current imports (from earlier read):
```js
import { useEffect } from "react";
import { useAppStore } from "@/core/store";
import { RENDERER_REGISTRY } from "@/topics/registry";
import { useSessionEngine } from "./useSessionEngine";
import { useAudio } from "@/shared/hooks/useAudio";
import ProgressBar from "@/shared/components/ProgressBar";
```

- [ ] **Step 2: Update SessionScreen.jsx**

Replace the file content with:

```jsx
import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { RENDERER_REGISTRY } from "@/topics/registry";
import { loadRenderer } from "@/topics/rendererLoader";
import { useSessionEngine } from "./useSessionEngine";
import { useAudio } from "@/shared/hooks/useAudio";
import ProgressBar from "@/shared/components/ProgressBar";

export default function SessionScreen() {
  const setScreen       = useAppStore((s) => s.setScreen);
  const students        = useAppStore((s) => s.students);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const activeStudent   = students.find((s) => s.id === activeStudentId) ?? null;

  const {
    sessionState, currentTask, mode, topicRecord, sessionParams,
    completedRecord, onCorrect, onIncorrect, onMistake, onAdvance, onQualityAnswer,
  } = useSessionEngine();

  const { soundEnabled, toggleSound, playFeedback, playTopicFile } = useAudio();

  // Dynamic renderer: prefer renderer.js from IndexedDB, fall back to registry.
  const [Renderer, setRenderer] = useState(() =>
    topicRecord ? (RENDERER_REGISTRY[topicRecord.meta.renderer] ?? null) : null
  );

  useEffect(() => {
    if (!topicRecord) return;
    const topicId = topicRecord.meta.id;
    loadRenderer(topicId).then((DynamicRenderer) => {
      if (DynamicRenderer) {
        setRenderer(() => DynamicRenderer);
      } else {
        // Fallback to built-in registry for topics without renderer.js
        setRenderer(() => RENDERER_REGISTRY[topicRecord.meta.renderer] ?? null);
      }
    });
  }, [topicRecord?.meta.id]);

  useEffect(() => {
    if (!completedRecord) return;
    const skipSummary = topicRecord?.meta.renderer === "reading" && mode?.type === "read_text";
    setScreen(skipSummary ? "modes" : "summary");
  }, [completedRecord, mode?.type, setScreen, topicRecord?.meta.renderer]);

  function handleCorrect(conceptId, cardId) {
    playFeedback("correct");
    onCorrect(conceptId, cardId);
  }

  function handleIncorrect(conceptId, cardId) {
    playFeedback("incorrect");
    onIncorrect(conceptId, cardId);
  }

  function handleMistake(conceptId, cardId) {
    playFeedback("incorrect");
    onMistake(conceptId, cardId);
  }

  if (!sessionState || !topicRecord || !mode) {
    return (
      <div className="session-screen">
        <div className="screen-center">Нет данных для сессии</div>
      </div>
    );
  }

  const { status, taskIndex, tasks, correctCount, incorrectCount } = sessionState;
  const total = tasks.length;

  const isCorrectFeedback   = status === "answer_correct";
  const isIncorrectFeedback = status === "answer_incorrect";

  const feedbackClass =
    isCorrectFeedback   ? "session-feedback session-feedback--correct"
  : isIncorrectFeedback ? "session-feedback session-feedback--incorrect"
  : "";

  return (
    <div className="session-screen">
      <div className="session-topbar">
        <ProgressBar value={taskIndex} max={total} className="session-progress" />
        <div className="session-counter">
          {taskIndex + 1} / {total}
          {mode.evaluation === "auto" && (
            <span className="session-score">  ✓{correctCount}  ✗{incorrectCount}</span>
          )}
        </div>
        <button
          className={`session-audio-icon-button${soundEnabled ? " session-audio-icon-button--active" : ""}`}
          onClick={toggleSound}
          aria-label={soundEnabled ? "Выключить звук" : "Включить звук"}
        >
          <span className="session-audio-speaker-icon">
            {soundEnabled ? "🔊" : "🔇"}
          </span>
        </button>
        <button className="session-finish-btn" onClick={() => setScreen("home")}>✕</button>
      </div>

      {feedbackClass && (
        <div
          className={`${feedbackClass}${isCorrectFeedback ? " session-feedback--tappable" : ""}`}
          onClick={isCorrectFeedback ? onAdvance : undefined}
        >
          {isCorrectFeedback ? "Правильно!" : "Попробуем ещё раз…"}
          {isCorrectFeedback && (
            <div className="session-feedback__tap-hint">Нажмите, чтобы продолжить</div>
          )}
        </div>
      )}

      {Renderer && currentTask ? (
        <div
          className={`session-renderer-wrap${isCorrectFeedback ? " session-renderer-wrap--tappable" : ""}`}
          onClick={isCorrectFeedback ? onAdvance : undefined}
        >
          <Renderer
            key={`${taskIndex}_${sessionState.taskRetry ?? 0}`}
            task={currentTask}
            mode={mode}
            sessionStatus={status}
            topicId={topicRecord.meta.id}
            sessionParams={sessionParams}
            student={activeStudent}
            soundEnabled={soundEnabled}
            playTopicFile={playTopicFile}
            onCorrect={handleCorrect}
            onIncorrect={handleIncorrect}
            onMistake={handleMistake}
            onAdvance={onAdvance}
            onQualityAnswer={onQualityAnswer}
          />
        </div>
      ) : !Renderer ? (
        <div className="screen-center">Загрузка рендерера…</div>
      ) : (
        <div className="screen-center">Неизвестный рендерер: {topicRecord.meta.renderer}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build to verify no errors**

```bash
npm run build
```

Expected: `✓ built in …ms`.

- [ ] **Step 4: Commit**

```bash
git add src/features/session/SessionScreen.jsx
git commit -m "feat(renderer): SessionScreen loads renderer dynamically from IndexedDB with registry fallback"
```

---

## Task 5: Build sentence_puzzle renderer and package into ZIP

**Files:**
- Modify: `tools/sentence_puzzle/build.mjs`

After `RENDERER=sentence_puzzle npm run build:renderer`, the file `tools/sentence_puzzle/dist/renderer.iife.js` exists. We update `build.mjs` to include it in the ZIP.

> **Note on filename:** When Vite builds IIFE format with `fileName: () => "renderer"`, the actual output is `renderer.iife.js`. If Vite changes this in future, adjust the filename below.

- [ ] **Step 1: Update tools/sentence_puzzle/build.mjs**

```js
import JSZip from "jszip";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, "..", "..");

// Build the renderer IIFE
console.log("Building renderer…");
execFileSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "build:renderer"],
  {
    cwd: root,
    env: { ...process.env, RENDERER: "sentence_puzzle" },
    stdio: "inherit",
  }
);

// Verify output exists
const rendererPath = join(__dir, "dist", "renderer.iife.js");
if (!existsSync(rendererPath)) {
  throw new Error(`renderer.iife.js not found at ${rendererPath}`);
}

const topicJson   = readFileSync(join(__dir, "topic.json"), "utf-8");
const avatarSvg   = readFileSync(join(__dir, "media", "avatar.svg"));
const rendererJs  = readFileSync(rendererPath);

const zip = new JSZip();
zip.file("topic.json",          topicJson);
zip.file("media/avatar.svg",    avatarSvg);
zip.file("renderer.iife.js",    rendererJs);

const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
const outPath = join(__dir, "sentence_puzzle.zip");
writeFileSync(outPath, buffer);
console.log("✓ Built:", outPath);
```

- [ ] **Step 2: Run the build**

```bash
node tools/sentence_puzzle/build.mjs
```

Expected:
```
Building renderer…
✓ N modules transformed.
tools/sentence_puzzle/dist/renderer.iife.js  XX kB
✓ built in …ms
✓ Built: …/tools/sentence_puzzle/sentence_puzzle.zip
```

- [ ] **Step 3: Verify ZIP contents**

```bash
node -e "
const JSZip = require('jszip');
const fs = require('fs');
const buf = fs.readFileSync('tools/sentence_puzzle/sentence_puzzle.zip');
JSZip.loadAsync(buf).then(z => console.log(Object.keys(z.files)));
"
```

Expected output includes `renderer.iife.js`:
```
[ 'topic.json', 'media/avatar.svg', 'renderer.iife.js' ]
```

- [ ] **Step 4: Copy ZIP to public/decks and update catalog version**

```bash
cp tools/sentence_puzzle/sentence_puzzle.zip public/decks/sentence_puzzle_v1.1.0.zip
```

Update `public/decks/catalog.json` — change the sentence_puzzle entry:
```json
{
  "id": "sentence_puzzle",
  "version": "1.1.0",
  "title": { "ru": "Пазл предложений", "en": "Sentence Puzzle" },
  "url": "./decks/sentence_puzzle_v1.1.0.zip"
}
```

- [ ] **Step 5: Commit**

```bash
git add tools/sentence_puzzle/build.mjs tools/sentence_puzzle/dist/ public/decks/sentence_puzzle_v1.1.0.zip public/decks/catalog.json
git commit -m "feat(sentence_puzzle): bundle renderer.js into topic ZIP v1.1.0"
```

---

## Task 6: Remove sentence_puzzle from registry and verify bundle shrinks

**Files:**
- Modify: `src/topics/registry.js`

- [ ] **Step 1: Remove sentence_puzzle from registry.js**

```js
import FlashcardsRenderer          from "./renderers/flashcards/index.jsx";
import ComparisonRenderer          from "./renderers/comparison/index.jsx";
import MathHousesRenderer          from "./renderers/math_houses/index.jsx";
import AdditionSubtractionRenderer from "./renderers/addition_subtraction/index.jsx";
import ReadingRenderer             from "./renderers/reading/index.jsx";

export const RENDERER_REGISTRY = {
  flashcards:            FlashcardsRenderer,
  comparison:            ComparisonRenderer,
  math_houses:           MathHousesRenderer,
  addition_subtraction:  AdditionSubtractionRenderer,
  reading:               ReadingRenderer,
};
```

- [ ] **Step 2: Build and check bundle size**

```bash
npm run build
```

Expected: bundle is noticeably smaller (sentence_puzzle + @dnd-kit removed, ~50–70 kB reduction raw, ~15–20 kB gzip). The output line will show something like:

```
dist/index.html  69X kB │ gzip: 18X kB
```

Previous was `744 kB │ gzip: 196 kB`. If size did not shrink, check that no other file still imports from `sentence_puzzle/`.

- [ ] **Step 3: Verify no remaining imports of sentence_puzzle renderer**

```bash
grep -r "sentence_puzzle" src/ --include="*.js" --include="*.jsx" | grep -v "renderers/sentence_puzzle" | grep -v "rendererLoader"
```

Expected: no output (no files outside the renderer folder import it).

- [ ] **Step 4: Commit**

```bash
git add src/topics/registry.js
git commit -m "feat(renderer): remove sentence_puzzle from static registry — now loaded from ZIP"
```

---

## Task 7: End-to-end test + deploy

- [ ] **Step 1: Build final app**

```bash
npm run build
```

- [ ] **Step 2: Manual test checklist (dev server)**

```bash
npm run dev
```

Open `http://localhost:5173` in browser.

1. Log in with test account
2. Go to Topics → install sentence_puzzle (v1.1.0 from catalog)
3. Go to session → open sentence_puzzle
4. Verify: puzzle pieces render correctly, drag-and-drop works, question screen appears
5. Open flashcards topic → verify it still works (registry fallback)
6. Open a math/comparison topic → verify it still works (registry fallback)
7. Open DevTools → Network → confirm no extra JS files fetched (single HTML)

- [ ] **Step 3: Deploy**

```bash
npm run deploy:prod
```

Expected final line: `deploy target is consistent.`

- [ ] **Step 4: Upload backend files if changed (none in this plan)**

No backend changes in this plan.

- [ ] **Step 5: Final commit if needed**

If `npm run deploy:prod` bumps package.json:

```bash
git status
# should be clean after deploy script auto-commits version bump
```

---

## Self-Review

**Spec coverage:**
- ✅ Renderer-in-ZIP: `renderer.iife.js` is built by `build.mjs` and included in ZIP
- ✅ App bundle doesn't grow: sentence_puzzle + dnd-kit removed from registry/bundle
- ✅ Dynamic loading: `rendererLoader.js` reads from IndexedDB, evals, caches
- ✅ Backward compat: registry fallback for topics without `renderer.iife.js`
- ✅ Shared React: `window.__Mirocard` set in `main.jsx` before `createRoot`
- ✅ dnd-kit hooks: externalized `react` at build time → dnd-kit bundled in renderer but uses app's React instance

**Placeholder scan:** None found.

**Type consistency:**
- `loadRenderer(topicId)` → returns `React.ComponentType | null` — used correctly in SessionScreen
- `clearRendererCache(topicId?)` — not called in this plan but exported for future use (e.g., on topic uninstall)
- Blob file key `"renderer.iife.js"` — matches what Vite outputs and what `build.mjs` stores in ZIP

**One gap identified and fixed:** The original plan tried `renderer.js` as filename, but Vite IIFE format appends `.iife.js`. Both `rendererLoader.js` (tries `renderer.iife.js` first, then `renderer.js`) and `build.mjs` (explicitly reads `renderer.iife.js`) account for this.
