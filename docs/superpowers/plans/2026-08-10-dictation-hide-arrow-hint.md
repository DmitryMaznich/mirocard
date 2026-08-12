# "Стрелка в подсказке" Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings toggle to the `graphic_dictation` mode of the `symmetry_draw` topic ("Рисуем по клеткам") that hides the arrow-icon hint during a live dictation session, leaving only the text instruction ("2 клетки вправо"), so the child has to read rather than glance at a symbol.

**Architecture:** A new `boolean` mode param (`showArrow`, default `true`) flows through the app's existing settings pipeline — `ParamsScreen.jsx`'s `params` state → `persistStudentTopicLink` → `useSessionEngine.js`'s `sessionParams` → the `<Renderer sessionParams={...} />` prop already passed to every custom topic renderer. `tools/symmetry_draw/renderer.js`'s `DictationTask` already receives `sessionParams` as a prop (via `h(DictationTask, props)`'s spread) but doesn't read it yet; this plan wires that one read.

**Tech Stack:** Plain JS (`h()`-based, no JSX) for `tools/symmetry_draw/renderer.js` (a separately-built IIFE, not part of the Vite build); React/JSX for `src/features/session/ParamsScreen.jsx`.

## Global Constraints

- Scope is the live session only (`DictationTask`). The printed worksheet's compact command list is explicitly unaffected — do not touch `symmetryDrawPrintHtml.js`.
- Default value is `true` (arrow shown, current behavior unchanged for existing users) — this is an opt-in toggle.
- Toggle label: "Стрелка в подсказке". Hint: "Выключите, чтобы ребёнок читал команду текстом, а не смотрел на значок."
- Toggle appears only when `mode.type === "graphic_dictation"` — `mirror_draw` and `repeat_draw` show no new control.
- `tools/symmetry_draw/topic.json` lives inside a separately-built, versioned ZIP deck (`tools/symmetry_draw/build.mjs` → `public/decks/symmetry_draw_v<version>.zip`). Per this project's established rule, never overwrite an existing versioned ZIP URL — every release adds a new `v<version>.zip` file and repoints `public/decks/catalog.json` at it; old version files stay in place untouched.
- Neither `tools/symmetry_draw/renderer.js` nor `ParamsScreen.jsx` has an existing unit/component test harness in this codebase (confirmed: no `ParamsScreen*.test.*`, and `tools/symmetry_draw`'s only test file, `verify_trace.test.mjs`, covers card-tracing geometry, not the `DictationTask` UI). Verification for both is a live browser check, matching this project's established pattern for these files — not fabricated unit tests.

---

### Task 1: Add `showArrow` param to `topic.json`

**Files:**
- Modify: `tools/symmetry_draw/topic.json` (the `graphic_dictation` mode entry, currently lines 39–47)

**Interfaces:**
- Produces: a `params.showArrow` boolean definition (`type: "boolean"`, `default: true`) on the `graphic_dictation` mode object, which `ParamsScreen.jsx`'s existing `getInitialParams()` (unconditional, already reads `mode?.params`) will pick up automatically — no code change needed for that part.

- [ ] **Step 1: Edit the `graphic_dictation` mode entry**

Find this block in `tools/symmetry_draw/topic.json`:

```json
    {
      "id": "graphic_dictation",
      "type": "graphic_dictation",
      "evaluation": "auto",
      "ui": {
        "title": "Графический диктант",
        "instruction": "Слушай команду и веди линию от активной точки",
        "icon": "media/dictation_avatar.svg"
      }
    }
```

Replace it with (adds a `params` object; everything else unchanged):

```json
    {
      "id": "graphic_dictation",
      "type": "graphic_dictation",
      "evaluation": "auto",
      "ui": {
        "title": "Графический диктант",
        "instruction": "Слушай команду и веди линию от активной точки",
        "icon": "media/dictation_avatar.svg"
      },
      "params": {
        "showArrow": {
          "type": "boolean",
          "default": true,
          "label": { "ru": "Стрелка в подсказке" },
          "hint": { "ru": "Выключите, чтобы ребёнок читал команду текстом, а не смотрел на значок" }
        }
      }
    }
```

- [ ] **Step 2: Validate the JSON**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('tools/symmetry_draw/topic.json', 'utf8')); console.log('valid')"
```

Expected: prints `valid` (no `SyntaxError`).

- [ ] **Step 3: Commit**

```bash
git add tools/symmetry_draw/topic.json
git commit -m "feat(symmetry_draw): add showArrow param to graphic_dictation mode"
```

---

### Task 2: Read `showArrow` in `DictationTask`

**Files:**
- Modify: `tools/symmetry_draw/renderer.js` (the `DictationTask` function signature at line 140, and the arrow-wrap render at line 262)

**Interfaces:**
- Consumes: `sessionParams` — already passed to `DictationTask` today via `window.__MirocardRenderer = function SymmetryDrawRenderer(props) { return props.task?.type === "graphic_dictation" ? h(DictationTask, props) : h(GridTask, props); }` (line 445–447), which spreads ALL props (including `sessionParams`) onto `DictationTask`. No change needed to `SymmetryDrawRenderer` — this task only changes what `DictationTask` itself reads.
- Produces: arrow-icon visibility gated on `sessionParams?.showArrow` (default `true` when absent/undefined, matching Task 1's topic.json default).

- [ ] **Step 1: Destructure `sessionParams` in the function signature**

Find:

```js
  function DictationTask({ task, onCorrect }) {
```

Replace with:

```js
  function DictationTask({ task, onCorrect, sessionParams }) {
```

- [ ] **Step 2: Compute `showArrow` alongside the other per-render derived values**

Find this block (right after `const shape = task.card;`):

```js
    const shape = task.card;
    const command = shape.commands[stepIndex];
```

Replace with:

```js
    const shape = task.card;
    const showArrow = sessionParams?.showArrow ?? true;
    const command = shape.commands[stepIndex];
```

- [ ] **Step 3: Gate the arrow-wrap render on `showArrow`**

Find (inside the returned `h("section", ...)` tree, the `dictation__command` div's first child):

```js
        command ? h("div", { className: "dictation__arrow-wrap" }, h(InstructionGraphic, { command })) : null,
```

Replace with:

```js
        command && showArrow ? h("div", { className: "dictation__arrow-wrap" }, h(InstructionGraphic, { command })) : null,
```

The `dictation__command-copy` div right after it (containing `dictation__text`, `commandText(command)`) is untouched — it always renders regardless of `showArrow`, which is the whole point: the text instruction remains the only hint when the arrow is off.

- [ ] **Step 4: Commit**

```bash
git add tools/symmetry_draw/renderer.js
git commit -m "feat(symmetry_draw): hide dictation arrow hint when sessionParams.showArrow is false"
```

---

### Task 3: Toggle control in `ParamsScreen.jsx`

**Files:**
- Modify: `src/features/session/ParamsScreen.jsx` (the `isSymmetryDrawPrint` ternary arm, currently lines 1046–1048)

**Interfaces:**
- Consumes: `params`/`setParams` (already in scope in `ParamsScreen`, the same state object `getInitialParams()` initializes from `mode?.params` — see Task 1), `mode` (already in scope), `BooleanParam` (already defined in this same file at line 406, props `{ label, hint, value, onChange, disabled, info, onShowInfo }`).
- Produces: nothing new consumed elsewhere — this is the toggle's only UI.

- [ ] **Step 1: Wrap the `SymmetryDrawPrintParams` arm to add the conditional toggle**

Find:

```jsx
  ) : isSymmetryDrawPrint ? (
    <SymmetryDrawPrintParams topicRecord={topicRecord} mode={mode} />
  ) : (
```

Replace with:

```jsx
  ) : isSymmetryDrawPrint ? (
    <>
      {mode?.type === "graphic_dictation" && (
        <BooleanParam
          label="Стрелка в подсказке"
          hint="Выключите, чтобы ребёнок читал команду текстом, а не смотрел на значок"
          value={params.showArrow ?? true}
          onChange={(v) => setParams((p) => ({ ...p, showArrow: v }))}
        />
      )}
      <SymmetryDrawPrintParams topicRecord={topicRecord} mode={mode} />
    </>
  ) : (
```

- [ ] **Step 2: Live browser check — toggle appears only for graphic_dictation**

Using the dev server (see `.claude/launch.json` / `npm run dev`), navigate to the `symmetry_draw` topic:
- Open the `graphic_dictation` mode's params screen — confirm the "Стрелка в подсказке" toggle appears above the "🖨 Печать / PDF" button, defaulting to on (`param-toggle--on` class present on the switch button).
- Open `mirror_draw`'s and `repeat_draw`'s params screens — confirm neither shows the toggle (only the print button, unchanged from before this plan).

- [ ] **Step 3: Commit**

```bash
git add src/features/session/ParamsScreen.jsx
git commit -m "feat(session): add graphic_dictation arrow-hint toggle to ParamsScreen"
```

---

### Task 4: Release — bump version, rebuild ZIP, update catalog

**Files:**
- Modify: `tools/symmetry_draw/topic.json` (`meta.version`)
- Create: `tools/symmetry_draw/symmetry_draw.zip` (rebuilt in place — this file is the build script's working output, already tracked in git per the existing pattern seen in commit `74c5302d`)
- Create: `public/decks/symmetry_draw_v1.6.0.zip` (new versioned copy — never overwrite an existing version's file)
- Modify: `public/decks/catalog.json` (the `symmetry_draw` entry's `version`, `url`, `zipUrl`)

**Interfaces:**
- Consumes: `tools/symmetry_draw/build.mjs` (existing script, unmodified — bundles `topic.json` + `renderer.js` + `renderer.css` + the 3 avatar SVGs into `tools/symmetry_draw/symmetry_draw.zip`).

- [ ] **Step 1: Bump the version in `topic.json`**

Find (in `meta`):

```json
    "version": "1.5.0",
```

Replace with:

```json
    "version": "1.6.0",
```

- [ ] **Step 2: Rebuild the ZIP**

Run:

```bash
node tools/symmetry_draw/build.mjs
```

Expected output: `Built <path>/tools/symmetry_draw/symmetry_draw.zip`.

- [ ] **Step 3: Copy the rebuilt ZIP to its versioned public path**

```bash
cp tools/symmetry_draw/symmetry_draw.zip public/decks/symmetry_draw_v1.6.0.zip
```

Do not delete or overwrite `public/decks/symmetry_draw_v1.5.0.zip` (or any earlier version) — it stays in place.

- [ ] **Step 4: Update `catalog.json`**

Find (in the `symmetry_draw` entry):

```json
      "id": "symmetry_draw",
      "version": "1.5.0",
      "url": "./decks/symmetry_draw_v1.5.0.zip",
      "zipUrl": "symmetry_draw_v1.5.0.zip",
```

Replace with:

```json
      "id": "symmetry_draw",
      "version": "1.6.0",
      "url": "./decks/symmetry_draw_v1.6.0.zip",
      "zipUrl": "symmetry_draw_v1.6.0.zip",
```

- [ ] **Step 5: Verify the new ZIP's `topic.json` has both this plan's changes**

```bash
node -e "
const JSZip = require('jszip');
const fs = require('fs');
JSZip.loadAsync(fs.readFileSync('public/decks/symmetry_draw_v1.6.0.zip')).then(async (zip) => {
  const topic = JSON.parse(await zip.file('topic.json').async('string'));
  console.log('version:', topic.meta.version);
  console.log('showArrow param:', JSON.stringify(topic.modes.find(m => m.id === 'graphic_dictation').params));
});
"
```

Expected: `version: 1.6.0` and the `showArrow` param definition from Task 1 printed.

- [ ] **Step 6: Commit**

```bash
git add tools/symmetry_draw/topic.json tools/symmetry_draw/symmetry_draw.zip public/decks/symmetry_draw_v1.6.0.zip public/decks/catalog.json
git commit -m "content(symmetry_draw): rebuild deck v1.6.0 with showArrow dictation param"
```

---

### Task 5: End-to-end verification

**Files:** none modified — verification only.

- [ ] **Step 1: Live browser check — toggle actually hides/shows the arrow in a real session**

Using the dev server with the rebuilt deck installed (reinstall the topic from `public/decks/symmetry_draw_v1.6.0.zip` if the dev environment had an older version cached):

1. Navigate to the `graphic_dictation` mode's params screen. Turn the "Стрелка в подсказке" toggle off.
2. Start a session ("Начать занятие"). Confirm: no arrow icon is shown next to the command; the text instruction (e.g. "2 клетки вправо") is still shown and readable; the grid/drawing interaction (tap-drag between the active point and target) still works normally; the "↻" voice button still speaks the correct instruction text.
3. Return to params, turn the toggle back on. Start a new session. Confirm the arrow icon is back.

- [ ] **Step 2: Confirm the setting persists**

With the toggle off, leave the params screen (back to home) and reopen `graphic_dictation`'s params screen for the same student. Confirm the toggle is still off (persisted via `persistStudentTopicLink`, the same mechanism every other mode param already uses — no new persistence code was written, this just confirms the existing plumbing carries `showArrow` correctly).

- [ ] **Step 3: Report results to the user**

Summarize pass/fail for each check above. If everything passes, the feature is complete.
