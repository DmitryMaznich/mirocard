# Column Arithmetic Params Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the settings screen for the «Столбик» (`column_arithmetic`) mode into a reference visual pattern (sectioned rows, toggle switches for booleans, mandatory per-parameter (i) explanations) that other topics can adopt later without touching `ParamsScreen.jsx` again.

**Architecture:** `ParamsScreen.jsx` already renders any mode's settings generically from `mode.params` (schema in `topicLoader.js`). We extend that schema with `section`/`info` fields already partially supported (section grouping exists, unused until now), add a small `ParamLabel` sub-component + info modal for the new `(i)` button, restyle the shared `BooleanParam` checkbox into a toggle switch, and rebuild the (also shared, non-schema) reward-section block at the bottom of the screen to match. A schema-level `hideConceptPicker` flag lets a mode opt out of the (for this mode, non-functional) concept picker, and `rewardDefaults.strictStars` lets a mode override the app-wide default for one reward setting.

**Tech Stack:** React (function components, hooks), existing `Modal` component (`src/shared/components/Modal.jsx`), plain CSS in `src/styles.css`, Vitest for existing unit tests.

## Global Constraints

- Only the `column_arithmetic` mode's own `mode.params` gets the new `section`/`info` fields in this plan. Other topics are not migrated — their `mode.params` entries simply have no `info`/`section`, so the (i) button and section grouping silently don't render for them (already-safe defaults in the shared component).
- The `BooleanParam` checkbox→toggle visual change and the reward-section (Видео-награда/Серия/Строгий подсчёт) restyle are shared code — they will visually affect every mode that uses them, not just «Столбик». This is intentional (see design spec) — do not add a mode-gate around this restyle.
- Do not touch `src/topics/renderers/column_addition/engine.js`, `index.jsx`, `src/features/session/sessionEngine.js` — none of them need to change for this plan.
- `link.strictStars ?? true` in `src/core/linkUtils.js` stays as-is (no `mode` available there) — do not add mode-awareness to it.
- Reference design doc: `docs/superpowers/specs/2026-07-17-column-arithmetic-params-screen-design.md` — re-read it if a step here seems ambiguous, it has the full rationale.
- Windows dev environment — use the Bash tool (Git Bash) for all commands in this plan, not PowerShell, so the exact commands below work as written.
- This repo occasionally accumulates stray deploy-artifact directories at the repo root (e.g. `.worktrees/...`, `__codex_deploy_reward_fix_.../`) left behind by other concurrent sessions. `vitest run <path>` filters match by path *suffix*, so a bare `src/...` filter can also pick up a stale copy of the same file inside one of these stray directories and fail on an unrelated broken import. If a `vitest run` step reports a failure whose file path does **not** start with `src/` relative to the repo root, that failure is stray-artifact noise — ignore it and judge success by the `src/...` results only. Do not delete these directories; they may be another session's in-progress work.

---

### Task 1: Schema — extend `column_arithmetic` mode definition

**Files:**
- Modify: `src/topics/topicLoader.js:1030-1073` (the `column_addition: [ { id: "column_arithmetic", ... } ]` entry)
- Test: `src/topics/topicLoader.test.js`

**Interfaces:**
- Produces: `DEFAULT_MODES.column_addition[0]` (the `column_arithmetic` mode object) now has two new top-level fields — `hideConceptPicker: true` and `rewardDefaults: { strictStars: false }` — and every entry in its `params` object has a `section: "<string>"` and `info: { ru: { text: "<string>", tip: "<string>" } }` field. `showHelper`/`showCompare` change `type` from `"enum"` to `"boolean"` (their `default` values, `false`/`true`, are unchanged — already real booleans, not strings, so no runtime value migration is needed).
- Consumed by: Task 3/4/5 (`ParamsScreen.jsx` reads `def.section`, `def.info`, `mode.hideConceptPicker`, `mode.rewardDefaults.strictStars`) and Task 6 (`useSessionEngine.js` reads `mode.rewardDefaults.strictStars`).

- [ ] **Step 1: Write the failing migration test**

Add this test to `src/topics/topicLoader.test.js`, right after the existing test `"refreshes a mode's param widget type to the current default, even if an older shape was persisted"` (ends around line 438, look for the closing `});` after the `numericBlocks` assertions):

```js
  it("refreshes column_arithmetic's params to the new reference shape, even if an older shape was persisted", async () => {
    // Simulates a device that installed column_arithmetic back when showHelper/showCompare
    // were enum widgets and the mode had no section/info/hideConceptPicker/rewardDefaults —
    // on the next load, the mode must pick up the new reference-screen shape.
    const db = await freshDb();
    const staleRecord = {
      id: "column_addition",
      meta: { id: "column_addition", renderer: "column_addition", version: "1.3.0", title: { ru: "Сложение и вычитание в столбик" } },
      modes: [
        {
          id: "column_arithmetic",
          type: "column_arithmetic",
          evaluation: "auto",
          ui: { title: "Столбик", instruction: "Перетащи цифры в нужные клетки", icon: "media/icons/column_addition_mode.svg" },
          params: {
            operation: { type: "enum", values: ["add", "subtract", "mixed"], labels: { ru: { add: "Только +", subtract: "Только −", mixed: "Микс" } }, default: "add", label: { ru: "Операция" } },
            carryMode: { type: "enum", values: ["none", "carry", "mixed"], labels: { ru: { none: "Без переноса / займа", carry: "С переносом / займом", mixed: "Микс" } }, default: "none", label: { ru: "Перенос / заём" } },
            digits: { type: "enum", values: [2, 3], labels: { ru: { "2": "2-значные", "3": "3-значные" } }, default: 2, label: { ru: "Разрядность" } },
            showHelper: { type: "enum", values: [false, true], labels: { ru: { "false": "Скрыт", "true": "Показывать" } }, default: false, label: { ru: "Помощник (палка)" } },
            showCompare: { type: "enum", values: [true, false], labels: { ru: { "true": "Показывать", "false": "Скрыт" } }, default: true, label: { ru: "Сравнение" } },
          },
        },
      ],
      cards: [
        { id: "col_add", conceptId: "col_add", renderer: "column_addition", params: { operation: "add" } },
        { id: "col_sub", conceptId: "col_sub", renderer: "column_addition", params: { operation: "subtract" } },
      ],
      installedAt: new Date().toISOString(),
    };

    await kv.set(db, "topic:column_addition", staleRecord);
    await kv.set(db, "installedTopicIds", ["column_addition"]);

    const record = await getTopicRecord(db, "column_addition");
    const mode = record.modes.find((m) => m.id === "column_arithmetic");

    expect(mode.hideConceptPicker).toBe(true);
    expect(mode.rewardDefaults).toEqual({ strictStars: false });
    expect(mode.params.showHelper.type).toBe("boolean");
    expect(mode.params.showCompare.type).toBe("boolean");
    expect(mode.params.operation.section).toBe("Что решаем");
    expect(mode.params.showHelper.section).toBe("Отображение в занятии");
    expect(mode.params.operation.info.ru.text).toEqual(expect.any(String));
    expect(mode.params.operation.info.ru.tip).toEqual(expect.any(String));
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "c:\Users\dmazn\Projects\Mirocard2" && npx vitest run --exclude "**/.worktrees/**" --exclude "**/dist/**" --exclude "**/node_modules/**" src/topics/topicLoader.test.js`
Expected: FAIL — `expect(mode.hideConceptPicker).toBe(true)` receives `undefined`.

- [ ] **Step 3: Update the schema**

In `src/topics/topicLoader.js`, replace the existing `column_addition: [ { id: "column_arithmetic", ... }, ...` entry (lines 1030-1073) with:

```js
  column_addition: [
    {
      id: "column_arithmetic",
      type: "column_arithmetic",
      evaluation: "auto",
      ui: { title: "Столбик", instruction: "Перетащи цифры в нужные клетки", icon: "media/icons/column_addition_mode.svg" },
      hideConceptPicker: true,
      rewardDefaults: { strictStars: false },
      params: {
        operation: {
          type: "enum",
          values: ["add", "subtract", "mixed"],
          labels: { ru: { add: "Только +", subtract: "Только −", mixed: "Микс" } },
          default: "add",
          label: { ru: "Операция" },
          section: "Что решаем",
          info: {
            ru: {
              text: "Какие примеры видит ребёнок — только сложение, только вычитание или оба вида вперемешку.",
              tip: "Если ребёнок только начал осваивать столбик — выберите одну операцию, чтобы не путать алгоритмы. «Микс» включайте, когда оба действия отработаны отдельно.",
            },
          },
        },
        carryMode: {
          type: "enum",
          values: ["none", "carry", "mixed"],
          labels: { ru: { none: "Без переноса / займа", carry: "С переносом / займом", mixed: "Микс" } },
          default: "none",
          label: { ru: "Перенос / заём" },
          section: "Что решаем",
          info: {
            ru: {
              text: "Определяет, встречаются ли в примерах перенос через разряд при сложении или заём при вычитании — самая сложная часть счёта в столбик.",
              tip: "Начните с «Без переноса/займа», пока ребёнок уверенно считает без него, и включайте «Микс» только когда база отработана.",
            },
          },
        },
        digits: {
          type: "enum",
          values: [2, 3],
          labels: { ru: { "2": "2-значные", "3": "3-значные" } },
          default: 2,
          label: { ru: "Разрядность" },
          section: "Что решаем",
          info: {
            ru: {
              text: "Сколько цифр в числах примера — двузначные (например, 34+18) или трёхзначные (например, 246+137).",
              tip: "Переходите на 3-значные, только когда 2-значные примеры с переносом/займом решаются уверенно.",
            },
          },
        },
        showHelper: {
          type: "boolean",
          default: false,
          label: { ru: "Помощник (палка)" },
          section: "Отображение в занятии",
          info: {
            ru: {
              text: "Показывает на экране счётную палку с бусинами, которой ребёнок может помочь себе при подсчёте разряда.",
              tip: "Включайте как временную опору для тех, кто ещё не считает в уме — убирайте по мере того, как палка перестаёт быть нужна.",
            },
          },
        },
        showCompare: {
          type: "boolean",
          default: true,
          label: { ru: "Сравнение" },
          section: "Отображение в занятии",
          info: {
            ru: {
              text: "При заёме показывает полоску сравнения разрядов — наглядно, почему не хватает единиц и нужно занять десяток.",
              tip: "Держите включённым, пока ребёнок только осваивает заём — это основная подсказка, объясняющая механику.",
            },
          },
        },
      },
    },
```

(The rest of the `column_addition` array — `column_copy` and any modes after it — stays untouched below this entry.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "c:\Users\dmazn\Projects\Mirocard2" && npx vitest run --exclude "**/.worktrees/**" --exclude "**/dist/**" --exclude "**/node_modules/**" src/topics/topicLoader.test.js`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Commit**

```bash
cd "c:\Users\dmazn\Projects\Mirocard2"
git add src/topics/topicLoader.js src/topics/topicLoader.test.js
git commit -m "$(cat <<'EOF'
feat(column_arithmetic): add section/info/hideConceptPicker/rewardDefaults to mode schema

Groups the mode's 5 params into two labeled sections, gives each a
mandatory (i) explanation, opts the mode out of the non-functional
concept picker, and lets it override the app-wide strictStars default.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: CSS — info button, toggle switch, info-modal styling

**Files:**
- Modify: `src/styles.css` (insert after the `.link-btn:disabled` rule at line 14174, i.e. right before the `/* ─── Home screen ─── */` comment at line 14176)

**Interfaces:**
- Produces: CSS classes `.param-label-wrap`, `.param-info-btn`, `.param-toggle`, `.param-toggle--on`, `.param-hint--under-row`, `.info-modal-text`, `.info-modal-tip` — consumed by Task 3/4/5's JSX.

- [ ] **Step 1: Insert the new CSS block**

In `src/styles.css`, right before the line `/* ─── Home screen ────────────────────────────────────────────────────────── */` (line 14176), insert:

```css
.param-label-wrap { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
.param-info-btn {
  width: 18px; height: 18px;
  border-radius: 50%;
  border: none;
  background: #e4ecea;
  color: #4a7f78;
  font-size: 0.7rem;
  font-weight: 800;
  font-style: italic;
  font-family: Georgia, "Times New Roman", serif;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
}
.param-info-btn:hover { background: #d3e4e1; }

.param-toggle {
  width: 44px; height: 26px;
  border-radius: 13px;
  border: none;
  background: #d5dbd9;
  position: relative;
  flex-shrink: 0;
  cursor: pointer;
  transition: background 0.15s;
  padding: 0;
}
.param-toggle::after {
  content: "";
  position: absolute;
  top: 3px; left: 3px;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.25);
  transition: left 0.15s;
}
.param-toggle--on { background: #1c7a6e; }
.param-toggle--on::after { left: 21px; }
.param-toggle:disabled { cursor: not-allowed; }

.param-hint--under-row { padding: 0 4px 4px; margin-top: -4px; }

.info-modal-text { font-size: 0.92rem; line-height: 1.5; color: #33433f; margin: 0 0 12px; }
.info-modal-tip {
  font-size: 0.88rem;
  line-height: 1.5;
  background: #eef6f4;
  border-radius: 10px;
  padding: 10px 12px;
  color: #1a2e2b;
}
.info-modal-tip b { color: #1c7a6e; }
```

- [ ] **Step 2: Sanity-check the CSS parses**

Run: `cd "c:\Users\dmazn\Projects\Mirocard2" && npm run build`
Expected: build succeeds (no CSS syntax errors reported by Vite).

- [ ] **Step 3: Commit**

```bash
cd "c:\Users\dmazn\Projects\Mirocard2"
git add src/styles.css
git commit -m "$(cat <<'EOF'
style(params): add CSS for param info button, toggle switch, info-modal tip

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `ParamsScreen.jsx` — `ParamLabel`, info modal, toggle-style `BooleanParam`

**Files:**
- Modify: `src/features/session/ParamsScreen.jsx`

**Interfaces:**
- Produces: `ParamLabel({ label, info, onShowInfo })` component (renders label text + optional `(i)` button); `NumberStepper`, `EnumParam`, `BooleanParam` now accept `info` (shape `{ text, tip }` or `undefined`) and `onShowInfo` (callback receiving `{ title, text, tip }`) props; `BooleanParam` renders a `.param-toggle` button instead of a checkbox.
- Consumes: `Modal` from `@/shared/components/Modal` (already imported in this file).

- [ ] **Step 1: Add the `ParamLabel` component**

In `src/features/session/ParamsScreen.jsx`, right before the `function NumberStepper(...)` definition (currently at line 125), insert:

```jsx
function ParamLabel({ label, info, onShowInfo }) {
  return (
    <div className="param-label-wrap">
      <span className="param-label">{label}</span>
      {info && (
        <button
          type="button"
          className="param-info-btn"
          aria-label={`Что означает: ${label}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onShowInfo({ title: label, text: info.text, tip: info.tip });
          }}
        >
          i
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire `info`/`onShowInfo` into `NumberStepper` and `EnumParam`**

Replace the body of `NumberStepper` (currently):

```jsx
function NumberStepper({ label, value, min, max, onChange }) {
  return (
    <div className="param-row">
      <div className="param-label">{label}</div>
```

with:

```jsx
function NumberStepper({ label, value, min, max, onChange, info, onShowInfo }) {
  return (
    <div className="param-row">
      <ParamLabel label={label} info={info} onShowInfo={onShowInfo} />
```

(Leave the rest of the function body — the `.param-stepper` block — unchanged.)

Replace the body of `EnumParam` (currently):

```jsx
function EnumParam({ label, options, labels, value, onChange, disabledValues }) {
  return (
    <div className="param-row">
      <div className="param-label">{label}</div>
```

with:

```jsx
function EnumParam({ label, options, labels, value, onChange, disabledValues, info, onShowInfo }) {
  return (
    <div className="param-row">
      <ParamLabel label={label} info={info} onShowInfo={onShowInfo} />
```

(Leave the rest of the function body — the `.param-enum-group` map — unchanged.)

- [ ] **Step 3: Convert `BooleanParam` to a toggle switch**

Replace the entire `BooleanParam` function (currently):

```jsx
function BooleanParam({ label, hint, value, onChange, disabled }) {
  return (
    <label className={`param-row param-row--checkbox${disabled ? " param-row--disabled" : ""}`}>
      <input
        type="checkbox"
        className="param-checkbox"
        checked={Boolean(value)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="param-label">{label}</span>
      {hint ? <span className="param-hint">{hint}</span> : null}
    </label>
  );
}
```

with:

```jsx
function BooleanParam({ label, hint, value, onChange, disabled, info, onShowInfo }) {
  return (
    <>
      <div className={`param-row${disabled ? " param-row--disabled" : ""}`}>
        <ParamLabel label={label} info={info} onShowInfo={onShowInfo} />
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(value)}
          aria-label={label}
          className={`param-toggle ${value ? "param-toggle--on" : ""}`}
          disabled={disabled}
          onClick={() => onChange(!value)}
        />
      </div>
      {hint ? <div className="param-hint param-hint--under-row">{hint}</div> : null}
    </>
  );
}
```

- [ ] **Step 4: Add info-modal state and render it**

In the `ParamsScreen` component body, find:

```jsx
  const [showModeInfo,   setShowModeInfo]    = useState(false);
  const [showPinGate,    setShowPinGate]     = useState(false);
```

and add a third line right after:

```jsx
  const [showModeInfo,   setShowModeInfo]    = useState(false);
  const [showPinGate,    setShowPinGate]     = useState(false);
  const [activeInfo,     setActiveInfo]      = useState(null);
```

Then, near the bottom of the component, find the existing `{showModeInfo && (...)}` modal block:

```jsx
      {showModeInfo && (
        <Modal title={modeTitle} onClose={() => setShowModeInfo(false)}>
          <ModeMethodology mode={mode} />
        </Modal>
      )}
```

and add a new modal block right after it:

```jsx
      {showModeInfo && (
        <Modal title={modeTitle} onClose={() => setShowModeInfo(false)}>
          <ModeMethodology mode={mode} />
        </Modal>
      )}

      {activeInfo && (
        <Modal title={activeInfo.title} onClose={() => setActiveInfo(null)}>
          <p className="info-modal-text">{activeInfo.text}</p>
          {activeInfo.tip && (
            <div className="info-modal-tip"><b>Совет:</b> {activeInfo.tip}</div>
          )}
        </Modal>
      )}
```

- [ ] **Step 5: Pass `info`/`onShowInfo` through `renderParam`**

Inside the `renderParam(key, def)` function (defined inside the big IIFE around line 848), update the three call sites that currently omit `info`:

Replace:

```jsx
          if (def.type === "number") {
            return (
              <NumberStepper
                key={key}
                label={def.label?.ru ?? key}
                value={params[key] ?? def.default}
                min={def.min}
                max={def.max}
                onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
              />
            );
          }
          if (def.type === "enum") {
            return (
              <EnumParam
                key={key}
                label={def.label?.ru ?? key}
                options={def.values}
                labels={def.labels?.ru}
                value={params[key] ?? def.default}
                onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
                disabledValues={def.disabledValues}
              />
            );
          }
```

with:

```jsx
          if (def.type === "number") {
            return (
              <NumberStepper
                key={key}
                label={def.label?.ru ?? key}
                value={params[key] ?? def.default}
                min={def.min}
                max={def.max}
                onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
                info={def.info?.ru}
                onShowInfo={setActiveInfo}
              />
            );
          }
          if (def.type === "enum") {
            return (
              <EnumParam
                key={key}
                label={def.label?.ru ?? key}
                options={def.values}
                labels={def.labels?.ru}
                value={params[key] ?? def.default}
                onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
                disabledValues={def.disabledValues}
                info={def.info?.ru}
                onShowInfo={setActiveInfo}
              />
            );
          }
```

And further down in the same function, replace:

```jsx
          if (def.type === "boolean") {
            return (
              <BooleanParam
                key={key}
                label={def.label?.ru ?? key}
                hint={def.hint?.ru ?? ""}
                value={params[key] ?? def.default ?? false}
                disabled={def.dependsOn ? !params[def.dependsOn] : false}
                onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
              />
            );
          }
```

with:

```jsx
          if (def.type === "boolean") {
            return (
              <BooleanParam
                key={key}
                label={def.label?.ru ?? key}
                hint={def.hint?.ru ?? ""}
                value={params[key] ?? def.default ?? false}
                disabled={def.dependsOn ? !params[def.dependsOn] : false}
                onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
                info={def.info?.ru}
                onShowInfo={setActiveInfo}
              />
            );
          }
```

(This is the `renderParam` used for non-reading, non-comparison modes — the one at the bottom of the file, not the near-identical `EnumParam`/`BooleanParam` calls inside the `isReading` branch higher up. Leave the `isReading` branch untouched — reading topics are out of scope for this plan.)

- [ ] **Step 6: Run existing tests to confirm nothing broke**

Run: `cd "c:\Users\dmazn\Projects\Mirocard2" && npx vitest run --exclude "**/.worktrees/**" --exclude "**/dist/**" --exclude "**/node_modules/**" src/features/session`
Expected: PASS (no existing test imports/exercises `ParamsScreen.jsx` directly, so this run should be unaffected — it's a guard against an accidental import-time syntax error).

Run: `cd "c:\Users\dmazn\Projects\Mirocard2" && npm run build`
Expected: build succeeds (catches JSX syntax errors the test run above wouldn't).

- [ ] **Step 7: Commit**

```bash
cd "c:\Users\dmazn\Projects\Mirocard2"
git add src/features/session/ParamsScreen.jsx
git commit -m "$(cat <<'EOF'
feat(params-screen): add (i) info modal, restyle BooleanParam as a toggle switch

BooleanParam is shared across modes, so every existing boolean setting
(not just column_arithmetic's) now renders as a toggle instead of a
checkbox. Same true/false semantics, no data migration needed.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `ParamsScreen.jsx` — hide concept picker, mode-aware `strictStars` default

**Files:**
- Modify: `src/features/session/ParamsScreen.jsx`

**Interfaces:**
- Consumes: `mode.hideConceptPicker` (boolean, from Task 1's schema) and `mode.rewardDefaults?.strictStars` (boolean, from Task 1's schema) — both already present on `mode`, which is computed earlier in the component (`const mode = topicRecord?.modes.find(...)` around line 566).

- [ ] **Step 1: Hide the «Понятия» block when `mode.hideConceptPicker` is set**

Find:

```jsx
      {!isPhraseMatch && !modeHasCategoryParam && (
        <div className="param-row param-row--block">
          <div className="param-label">Понятия</div>
```

Replace the opening condition line only:

```jsx
      {!isPhraseMatch && !modeHasCategoryParam && !mode?.hideConceptPicker && (
        <div className="param-row param-row--block">
          <div className="param-label">Понятия</div>
```

- [ ] **Step 2: Make the `strictStars` initial state mode-aware**

Find:

```jsx
  const [strictStars,   setStrictStars]   = useState(link.strictStars ?? true);
```

Replace with:

```jsx
  const [strictStars,   setStrictStars]   = useState(link.strictStars ?? mode?.rewardDefaults?.strictStars ?? true);
```

- [ ] **Step 3: Run tests and build**

Run: `cd "c:\Users\dmazn\Projects\Mirocard2" && npx vitest run --exclude "**/.worktrees/**" --exclude "**/dist/**" --exclude "**/node_modules/**" src/topics src/features/session`
Expected: PASS.

Run: `cd "c:\Users\dmazn\Projects\Mirocard2" && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
cd "c:\Users\dmazn\Projects\Mirocard2"
git add src/features/session/ParamsScreen.jsx
git commit -m "$(cat <<'EOF'
feat(params-screen): honor mode.hideConceptPicker and mode.rewardDefaults.strictStars

column_arithmetic's concept picker was decorative (useSessionEngine
already silently ignores it — see 2026-07-17 design spec), and its
per-cell mistake granularity makes strictStars=true unusually harsh,
so the mode now opts out of the picker and defaults strictStars=false.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `ParamsScreen.jsx` — rebuild the «Награда за занятие» section

**Files:**
- Modify: `src/features/session/ParamsScreen.jsx`

**Interfaces:**
- Consumes: `ParamLabel` (Task 3), `.param-toggle`/`.param-row--disabled` CSS (Task 2 / pre-existing).
- Produces: no new exported interface — this is leaf JSX inside the `ParamsScreen` component's return statement.

- [ ] **Step 1: Replace the three separate reward blocks with one grouped, reordered section**

Find this exact block (three separate `{hasVideos && ...}` blocks — «Сложность серии», «Подсчёт звёзд», «Видео-награда», in that order):

```jsx
          {hasVideos && mode.evaluation !== "none" && !isAlphabetPairs && (
            <div className="param-row param-row--block">
              <div className="param-label">Сложность серии</div>
              <div className="param-enum-section">
                <div className="param-enum-group">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      className={`enum-btn enum-btn--compact ${answersPerStar === n ? "enum-btn--active" : ""}`}
                      onClick={() => setAnswersPerStar(n)}
                    >
                      ×{n}
                    </button>
                  ))}
                </div>
                <div className="param-hint">
                  Бонус каждые {5 * answersPerStar} правильных ответов подряд
                </div>
              </div>
            </div>
          )}

          {hasVideos && mode.evaluation !== "none" && !isAlphabetPairs && (
            <div className="param-row param-row--block">
              <div className="param-label">Подсчёт звёзд</div>
              <div className="param-enum-section">
                <div className="param-enum-group">
                  <button
                    className={`enum-btn enum-btn--compact ${!strictStars ? "enum-btn--active" : ""}`}
                    onClick={() => setStrictStars(false)}
                  >
                    Мягко
                  </button>
                  <button
                    className={`enum-btn enum-btn--compact ${strictStars ? "enum-btn--active" : ""}`}
                    onClick={() => setStrictStars(true)}
                  >
                    Строго
                  </button>
                </div>
                <div className="param-hint">
                  {strictStars
                    ? "Любая ошибка сбрасывает серию"
                    : "Ошибки не сбрасывают серию"}
                </div>
              </div>
            </div>
          )}

          {hasVideos && !isAlphabetPairs && (
            <div className="param-row param-row--block">
              <div className="param-label">Видео-награда</div>
              <div className="param-enum-section">
                <div className="param-enum-group">
                  <button
                    className={`enum-btn enum-btn--compact ${!videoReward ? "enum-btn--active" : ""}`}
                    onClick={() => setVideoReward(false)}
                  >
                    Нет
                  </button>
                  <button
                    className={`enum-btn enum-btn--compact ${videoReward ? "enum-btn--active" : ""}`}
                    onClick={() => setVideoReward(true)}
                  >
                    Да
                  </button>
                </div>
                <div className="param-hint">
                  {!videoReward
                    ? "Видео-награда отключена"
                    : mode.evaluation !== "none"
                      ? "Видео показывается за серию правильных ответов"
                      : "Награда доступна на экране завершения"}
                </div>
              </div>
            </div>
          )}
```

Replace it with:

```jsx
          {hasVideos && !isAlphabetPairs && (
            <div className="param-section">
              <div className="param-section__header">Награда за занятие</div>

              <div className="param-row">
                <ParamLabel
                  label="Видео-награда"
                  info={{
                    text: "Включает показ бонусного видео ученику за успешную серию правильных ответов в этом занятии.",
                    tip: "Выключите, если видео отвлекает ребёнка от задания сильнее, чем мотивирует.",
                  }}
                  onShowInfo={setActiveInfo}
                />
                <button
                  type="button"
                  role="switch"
                  aria-checked={videoReward}
                  aria-label="Видео-награда"
                  className={`param-toggle ${videoReward ? "param-toggle--on" : ""}`}
                  onClick={() => setVideoReward((v) => !v)}
                />
              </div>

              {mode.evaluation !== "none" && (
                <>
                  <div className={`param-row${!videoReward ? " param-row--disabled" : ""}`}>
                    <ParamLabel
                      label="Серия для видеонаграды"
                      info={{
                        text: "Сколько правильных ответов подряд без ошибок нужно набрать, чтобы получить бонусное видео — отображается как 5 звёзд по пути.",
                        tip: "Начните с 5, чтобы награда приходила быстро и не терялась мотивация; увеличивайте до 10-15 по мере уверенности ребёнка.",
                      }}
                      onShowInfo={setActiveInfo}
                    />
                    <div className="param-enum-group">
                      {[1, 2, 3].map((n) => (
                        <button
                          key={n}
                          className={`enum-btn ${answersPerStar === n ? "enum-btn--active" : ""}`}
                          disabled={!videoReward}
                          onClick={() => setAnswersPerStar(n)}
                        >
                          {5 * n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={`param-row${!videoReward ? " param-row--disabled" : ""}`}>
                    <ParamLabel
                      label="Строгий подсчёт"
                      info={{
                        text: "В «Строго» любая ошибка — даже одна неверная цифра в отдельной клетке примера — сразу обнуляет серию для звёзд. В «Мягко» ошибки в клетках не сбрасывают серию, она растёт по мере решённых примеров.",
                        tip: "Для «Столбика» рекомендуем «Мягко» — ошибка в одной цифре трёхзначного числа при «Строго» может обнулить всю серию за один случайный тап.",
                      }}
                      onShowInfo={setActiveInfo}
                    />
                    <button
                      type="button"
                      role="switch"
                      aria-checked={strictStars}
                      aria-label="Строгий подсчёт"
                      className={`param-toggle ${strictStars ? "param-toggle--on" : ""}`}
                      disabled={!videoReward}
                      onClick={() => setStrictStars((v) => !v)}
                    />
                  </div>
                </>
              )}
            </div>
          )}
```

- [ ] **Step 2: Run tests and build**

Run: `cd "c:\Users\dmazn\Projects\Mirocard2" && npx vitest run --exclude "**/.worktrees/**" --exclude "**/dist/**" --exclude "**/node_modules/**" src/topics src/features/session`
Expected: PASS.

Run: `cd "c:\Users\dmazn\Projects\Mirocard2" && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd "c:\Users\dmazn\Projects\Mirocard2"
git add src/features/session/ParamsScreen.jsx
git commit -m "$(cat <<'EOF'
feat(params-screen): reorder and restyle the reward section

Видео-награда now leads (it's the master switch — StarBar.jsx returns
null entirely when it's off, so the other two settings have zero
visible effect while it's disabled). "Сложность серии" (×1/×2/×3)
renamed to "Серия для видеонаграды" showing the real totals (5/10/15).
"Подсчёт звёзд" renamed to "Строгий подсчёт" and is now a toggle.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `useSessionEngine.js` — mode-aware `strictStars` default

**Files:**
- Modify: `src/features/session/useSessionEngine.js:117` and `src/features/session/useSessionEngine.js:173`

**Interfaces:**
- Consumes: `mode.rewardDefaults?.strictStars` (from Task 1's schema) — `mode` is already an in-scope variable at both call sites (function parameter at line 31 for `buildGeneratedSessionState`, hook-local variable at line 151 for the `useSessionEngine()` body).

- [ ] **Step 1: Update `buildGeneratedSessionState`'s call to `createSessionState`**

Find (around line 107-118):

```js
  const baseState = createSessionState(
    tasks,
    mode,
    activeStudentId,
    activeTopicId,
    topicRecord.meta.version,
    selectedConceptIds,
    renderer === "reading" ? activeTextId : null,
    isDeckMode,
    link.answersPerStar ?? 1,
    link.strictStars ?? true,
  );
```

Replace the last argument line:

```js
  const baseState = createSessionState(
    tasks,
    mode,
    activeStudentId,
    activeTopicId,
    topicRecord.meta.version,
    selectedConceptIds,
    renderer === "reading" ? activeTextId : null,
    isDeckMode,
    link.answersPerStar ?? 1,
    link.strictStars ?? mode?.rewardDefaults?.strictStars ?? true,
  );
```

- [ ] **Step 2: Update `sessionParams`**

Find (around line 173):

```js
  const sessionParams = { ...(link.params ?? {}), strictStars: link.strictStars ?? true };
```

Replace with:

```js
  const sessionParams = { ...(link.params ?? {}), strictStars: link.strictStars ?? mode?.rewardDefaults?.strictStars ?? true };
```

- [ ] **Step 3: Run tests**

Run: `cd "c:\Users\dmazn\Projects\Mirocard2" && npx vitest run --exclude "**/.worktrees/**" --exclude "**/dist/**" --exclude "**/node_modules/**" src/features/session/sessionEngine.test.js src/features/session/useStarProgress.test.js src/features/session/rewardProgress.test.js`
Expected: PASS (133 tests, matching the baseline already confirmed during design — see spec doc).

- [ ] **Step 4: Commit**

```bash
cd "c:\Users\dmazn\Projects\Mirocard2"
git add src/features/session/useSessionEngine.js
git commit -m "$(cat <<'EOF'
feat(session): let mode.rewardDefaults override the strictStars fallback

column_arithmetic sets rewardDefaults.strictStars=false (Task 4); every
other mode has no rewardDefaults, so this is a no-op for them and the
app-wide default stays true.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full relevant test suite**

Run: `cd "c:\Users\dmazn\Projects\Mirocard2" && npx vitest run --exclude "**/.worktrees/**" --exclude "**/dist/**" --exclude "**/node_modules/**" src/topics src/features/session`
Expected: PASS. (Two known-unrelated pre-existing failures may appear in `src/topics/renderers/column_addition/engine.test.js`'s `FingerSystem`/`getRemoveMode` tests — these predate this plan and are not caused by it; if any *other* test fails, stop and investigate before continuing.)

- [ ] **Step 2: Start the dev server**

Run: `cd "c:\Users\dmazn\Projects\Mirocard2" && npm run dev`

- [ ] **Step 3: Drive the settings screen with Playwright (headed mode — see project convention, not `--headless`)**

Navigate to the app, pick any student, open topic «Сложение и вычитание в столбик», mode «Столбик», and confirm on the settings screen:
- No «Понятия» row is shown above the parameter sections.
- Two sections render: «Что решаем» (Операция / Перенос-заём / Разрядность) and «Отображение в занятии» (Помощник (палка) / Сравнение) — the latter two render as toggles, not buttons.
- Every parameter row has a small `(i)` button; clicking one opens a modal with an explanation paragraph and a highlighted «Совет:» tip, and closes on the `×` button or overlay click.
- If the active student has reward videos assigned: a third section «Награда за занятие» renders with, in order, «Видео-награда» (toggle), «Серия для видеонаграды» (buttons showing `5`/`10`/`15`), «Строгий подсчёт» (toggle) — and «Строгий подсчёт» is off by default for a student/topic pair that has never had this setting saved before.
- Toggling «Видео-награда» off visually disables (dimmed, unclickable) the two rows below it; toggling it back on re-enables them.

- [ ] **Step 4: Report results to the user**

Summarize what was checked and any deviations found, before considering the plan complete.
