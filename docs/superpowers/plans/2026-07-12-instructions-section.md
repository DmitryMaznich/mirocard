# Раздел «Инструкции» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third home-screen tab, «Инструкции» — a grid of step-by-step visual instructions for kids (starting with «Уборка на кухне»), a step-through runner, and a parent/therapist-facing constructor to create custom instructions, gated by PIN and a `featureFlags` flag exactly like the Planner tab.

**Architecture:** A standalone feature (`src/features/instructions/`), not routed through the existing recipe/session task-engine. Built-in instructions are bundled at build time from `content/instructions/*.json` (same `import.meta.glob` technique as `builtinRecipesTopic.js`). User-created instructions are a single JSON blob stored under one `account_kv` key (`user_instructions`), synced with the existing `pushOp('kv.upsert', ...)` / `syncQueue` mechanism — no backend changes required.

**Tech Stack:** React 19, Zustand store, IndexedDB (`src/core/db.js`), Vite `import.meta.glob`, Vitest + `fake-indexeddb`.

## Global Constraints

- FeatureFlag name is exactly `"instructions"` (mirrors `"planner"`), read from `account.featureFlags`.
- MVP step shape is plain text only — no headings/checklist/warning/image step types, no per-phase progress grouping.
- No drag-and-drop step reordering — use up/down arrow buttons.
- Creating, editing, and deleting a user instruction all require the existing PIN gate (`PinGateModal`, `settings.adultPinHash`) — same as other parent-only actions.
- Backend schema/routes are unchanged — everything rides on the existing `account_kv` table, `kv.upsert` sync op, and `GET /account/kv?prefix=` route.
- Design reference: `docs/superpowers/specs/2026-07-12-instructions-design.md`.
- New screen-level fixed header/footer elements must reserve `var(--app-safe-top/bottom)` per the mandatory iOS safe-area rule in `CLAUDE.md`.

---

## File Structure

| File | Responsibility |
|---|---|
| `content/instructions/kitchen_cleaning.json` | First built-in instruction's content |
| `src/topics/builtinInstructions.js` | Loads `content/instructions/*.json` at build time into `BUILTIN_INSTRUCTIONS` |
| `src/features/instructions/instructionValidation.js` | Pure validation of a draft instruction (title/steps) |
| `src/features/instructions/instructionsApi.js` | CRUD for user instructions + kv sync, merges with built-ins |
| `src/features/instructions/InstructionRunnerScreen.jsx` | Full-screen step-through UI + "Готово" |
| `src/features/instructions/InstructionConstructorScreen.jsx` | Full-screen create/edit/delete form |
| `src/features/instructions/InstructionsTab.jsx` | Grid picker embedded in Home's tab content, PIN gate for create/edit |
| `src/features/instructions/instructions.css` | All new visual styles for the three components above |
| `src/core/store.js` | + `activeInstructionId`, `instructionConstructorId` fields/setters |
| `src/features/home/HomeScreen.jsx` | + `InstructionsTabIcon`, third tab wiring, `hasInstructionsAccess` |
| `src/App.jsx` | + `instruction_runner` / `instruction_constructor` screen registration |
| `public/admin.html` | + `instructions` entry in `KNOWN_FLAGS` |

---

### Task 1: Store fields for the active/edited instruction

**Files:**
- Modify: `src/core/store.js` (add near the `homeActiveTab` block, around line 126)
- Test: `src/core/store.test.js`

**Interfaces:**
- Produces: `activeInstructionId: string|null`, `setActiveInstructionId(id)`, `instructionConstructorId: string|null`, `setInstructionConstructorId(id)` — consumed by `InstructionsTab`, `InstructionRunnerScreen`, `InstructionConstructorScreen` in later tasks.

- [ ] **Step 1: Write the failing test**

Add to `src/core/store.test.js`, inside the existing `describe("actions", ...)` block (after the `setActiveStudentId` test):

```js
  it("setActiveInstructionId updates selection", () => {
    getStore().setActiveInstructionId("kitchen_cleaning");
    expect(getStore().activeInstructionId).toBe("kitchen_cleaning");
  });

  it("setInstructionConstructorId updates selection", () => {
    getStore().setInstructionConstructorId("abc-123");
    expect(getStore().instructionConstructorId).toBe("abc-123");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/store.test.js`
Expected: FAIL — `setActiveInstructionId is not a function`

- [ ] **Step 3: Add the fields to the store**

In `src/core/store.js`, right after this existing block (around line 125-126):

```js
  homeActiveTab: "session",
  setHomeActiveTab: (homeActiveTab) => set({ homeActiveTab }),
```

insert:

```js

  // ─── Instructions ───────────────────────────────────────────────────────────
  activeInstructionId: null,
  setActiveInstructionId: (id) => set({ activeInstructionId: id }),
  instructionConstructorId: null,
  setInstructionConstructorId: (id) => set({ instructionConstructorId: id }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/store.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/store.js src/core/store.test.js
git commit -m "feat(instructions): add activeInstructionId/instructionConstructorId store fields"
```

---

### Task 2: Built-in instruction content + loader

**Files:**
- Create: `content/instructions/kitchen_cleaning.json`
- Create: `src/topics/builtinInstructions.js`
- Test: `src/topics/builtinInstructions.test.js`

**Interfaces:**
- Produces: `BUILTIN_INSTRUCTIONS: Array<{id, title, emoji, steps: string[], builtin: true, updatedAt: 0}>` — consumed by `instructionsApi.js` (Task 4).

- [ ] **Step 1: Create the content file**

Create `content/instructions/kitchen_cleaning.json`:

```json
{
  "title": "Уборка на кухне",
  "emoji": "🧽",
  "steps": [
    "Убери грязную посуду со стола в раковину",
    "Стряхни крошки со стола в мусорное ведро",
    "Протри стол влажной тряпкой",
    "Убери стулья на место",
    "Вынеси мусорное ведро, если оно полное",
    "Вымой руки с мылом — уборка закончена!"
  ]
}
```

- [ ] **Step 2: Write the failing test**

Create `src/topics/builtinInstructions.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { BUILTIN_INSTRUCTIONS } from './builtinInstructions.js';

describe('BUILTIN_INSTRUCTIONS', () => {
  it('includes the kitchen cleaning instruction', () => {
    const kitchen = BUILTIN_INSTRUCTIONS.find((i) => i.id === 'kitchen_cleaning');
    expect(kitchen).toBeDefined();
    expect(kitchen.title).toBe('Уборка на кухне');
    expect(kitchen.emoji).toBe('🧽');
    expect(kitchen.steps.length).toBe(6);
  });

  it('marks every built-in instruction as builtin with at least one step', () => {
    expect(BUILTIN_INSTRUCTIONS.length).toBeGreaterThan(0);
    for (const instruction of BUILTIN_INSTRUCTIONS) {
      expect(instruction.builtin).toBe(true);
      expect(instruction.steps.length).toBeGreaterThan(0);
      expect(typeof instruction.id).toBe('string');
      expect(instruction.id.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/topics/builtinInstructions.test.js`
Expected: FAIL — cannot find module `./builtinInstructions.js`

- [ ] **Step 4: Write the loader**

Create `src/topics/builtinInstructions.js`:

```js
// Synthesizes the built-in instruction library directly from
// content/instructions/*.json, bundled at build time — same approach
// as builtinRecipesTopic.js (no ZIP, no catalog entry, no install step).
// See docs/superpowers/specs/2026-07-12-instructions-design.md.

const instructionModules = import.meta.glob('../../content/instructions/*.json', {
  eager: true,
});

export const BUILTIN_INSTRUCTIONS = Object.entries(instructionModules)
  .map(([path, mod]) => {
    const id = path.split('/').pop().replace(/\.json$/, '');
    const data = mod.default;
    return {
      id,
      title: data.title,
      emoji: data.emoji,
      steps: data.steps,
      builtin: true,
      updatedAt: 0,
    };
  })
  .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/topics/builtinInstructions.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add content/instructions/kitchen_cleaning.json src/topics/builtinInstructions.js src/topics/builtinInstructions.test.js
git commit -m "feat(instructions): add built-in kitchen cleaning instruction and loader"
```

---

### Task 3: Instruction draft validation

**Files:**
- Create: `src/features/instructions/instructionValidation.js`
- Test: `src/features/instructions/instructionValidation.test.js`

**Interfaces:**
- Produces: `validateInstructionDraft({title, steps}) -> {valid: boolean, errors: {title?: string, steps?: string}}` — consumed by `InstructionConstructorScreen` (Task 6).

- [ ] **Step 1: Write the failing test**

Create `src/features/instructions/instructionValidation.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { validateInstructionDraft } from './instructionValidation.js';

describe('validateInstructionDraft', () => {
  it('is valid with a title and at least one non-empty step', () => {
    const result = validateInstructionDraft({ title: 'Собираем портфель', steps: ['Найди дневник'] });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('rejects an empty or whitespace-only title', () => {
    expect(validateInstructionDraft({ title: '', steps: ['Шаг'] }).valid).toBe(false);
    expect(validateInstructionDraft({ title: '   ', steps: ['Шаг'] }).errors.title).toBeTruthy();
  });

  it('rejects when every step is empty or whitespace-only', () => {
    const result = validateInstructionDraft({ title: 'Название', steps: ['', '   '] });
    expect(result.valid).toBe(false);
    expect(result.errors.steps).toBeTruthy();
  });

  it('rejects an empty steps array', () => {
    const result = validateInstructionDraft({ title: 'Название', steps: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.steps).toBeTruthy();
  });

  it('is valid when at least one step has real text even if others are blank', () => {
    const result = validateInstructionDraft({ title: 'Название', steps: ['', 'Реальный шаг', '  '] });
    expect(result.valid).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/instructions/instructionValidation.test.js`
Expected: FAIL — cannot find module `./instructionValidation.js`

- [ ] **Step 3: Write the implementation**

Create `src/features/instructions/instructionValidation.js`:

```js
export function validateInstructionDraft(draft) {
  const errors = {};

  if (!draft.title || !draft.title.trim()) {
    errors.title = 'Введите название';
  }

  const nonEmptySteps = (draft.steps ?? []).map((s) => s.trim()).filter(Boolean);
  if (nonEmptySteps.length === 0) {
    errors.steps = 'Добавьте хотя бы один шаг';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/instructions/instructionValidation.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/instructions/instructionValidation.js src/features/instructions/instructionValidation.test.js
git commit -m "feat(instructions): add instruction draft validation"
```

---

### Task 4: User instructions CRUD + kv sync

**Files:**
- Create: `src/features/instructions/instructionsApi.js`
- Test: `src/features/instructions/instructionsApi.test.js`

**Interfaces:**
- Consumes: `BUILTIN_INSTRUCTIONS` from `@/topics/builtinInstructions` (Task 2); `getDb, kv` from `@/core/db`; `pushOp` from `@/core/syncApi`; `api` from `@/core/api`.
- Produces: `getUserInstructions()`, `getAllInstructions()`, `addInstruction({title, emoji, steps}) -> instruction`, `updateInstruction(id, {title, emoji, steps}) -> instruction|null`, `deleteInstruction(id)`, `pullUserInstructionsFromServer()` — consumed by `InstructionsTab`, `InstructionRunnerScreen`, `InstructionConstructorScreen` (Tasks 5-7).

- [ ] **Step 1: Write the failing test**

Create `src/features/instructions/instructionsApi.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, kv } from '@/core/db';
import {
  getUserInstructions, addInstruction, updateInstruction, deleteInstruction, getAllInstructions,
} from './instructionsApi.js';

beforeEach(async () => {
  const db = await getDb();
  await kv.set(db, 'user_instructions', []);
});

describe('getUserInstructions', () => {
  it('returns an empty array when nothing is saved', async () => {
    expect(await getUserInstructions()).toEqual([]);
  });
});

describe('addInstruction', () => {
  it('creates an instruction with a generated id and builtin:false', async () => {
    const created = await addInstruction({ title: 'Собираем портфель', emoji: '🎒', steps: ['Найди дневник'] });
    expect(created.id).toBeTruthy();
    expect(created.builtin).toBe(false);
    expect(created.title).toBe('Собираем портфель');

    const all = await getUserInstructions();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(created.id);
  });
});

describe('updateInstruction', () => {
  it('updates title, emoji, and steps by id', async () => {
    const created = await addInstruction({ title: 'Старое имя', emoji: '📦', steps: ['Шаг 1'] });
    const updated = await updateInstruction(created.id, { title: 'Новое имя', emoji: '🧦', steps: ['Шаг 1', 'Шаг 2'] });
    expect(updated.title).toBe('Новое имя');
    expect(updated.emoji).toBe('🧦');
    expect(updated.steps).toEqual(['Шаг 1', 'Шаг 2']);
  });

  it('leaves other instructions untouched', async () => {
    const a = await addInstruction({ title: 'A', emoji: '🅰️', steps: ['1'] });
    const b = await addInstruction({ title: 'B', emoji: '🅱️', steps: ['1'] });
    await updateInstruction(a.id, { title: 'A2', emoji: '🅰️', steps: ['1'] });
    const all = await getUserInstructions();
    expect(all.find((i) => i.id === b.id).title).toBe('B');
  });
});

describe('deleteInstruction', () => {
  it('removes the instruction by id', async () => {
    const created = await addInstruction({ title: 'Удалить меня', emoji: '🗑️', steps: ['1'] });
    await deleteInstruction(created.id);
    expect(await getUserInstructions()).toEqual([]);
  });
});

describe('getAllInstructions', () => {
  it('merges built-in and user instructions', async () => {
    await addInstruction({ title: 'Своя', emoji: '⭐', steps: ['1'] });
    const all = await getAllInstructions();
    expect(all.some((i) => i.id === 'kitchen_cleaning')).toBe(true);
    expect(all.some((i) => i.title === 'Своя')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/instructions/instructionsApi.test.js`
Expected: FAIL — cannot find module `./instructionsApi.js`

- [ ] **Step 3: Write the implementation**

Create `src/features/instructions/instructionsApi.js`:

```js
import { getDb, kv } from "@/core/db";
import { pushOp } from "@/core/syncApi";
import { api } from "@/core/api";
import { BUILTIN_INSTRUCTIONS } from "@/topics/builtinInstructions";

const USER_INSTRUCTIONS_KEY = "user_instructions";

export async function getUserInstructions() {
  const db = await getDb();
  return (await kv.get(db, USER_INSTRUCTIONS_KEY)) ?? [];
}

async function saveUserInstructions(instructions) {
  const db = await getDb();
  await kv.set(db, USER_INSTRUCTIONS_KEY, instructions);
  pushOp("kv.upsert", { key: USER_INSTRUCTIONS_KEY, value: instructions }).catch(() => {});
}

export async function getAllInstructions() {
  const userInstructions = await getUserInstructions();
  return [...BUILTIN_INSTRUCTIONS, ...userInstructions];
}

export async function addInstruction({ title, emoji, steps }) {
  const instructions = await getUserInstructions();
  const instruction = {
    id: crypto.randomUUID(),
    title,
    emoji,
    steps,
    builtin: false,
    updatedAt: Date.now(),
  };
  await saveUserInstructions([...instructions, instruction]);
  return instruction;
}

export async function updateInstruction(id, { title, emoji, steps }) {
  const instructions = await getUserInstructions();
  const next = instructions.map((instr) =>
    instr.id === id ? { ...instr, title, emoji, steps, updatedAt: Date.now() } : instr
  );
  await saveUserInstructions(next);
  return next.find((instr) => instr.id === id) ?? null;
}

export async function deleteInstruction(id) {
  const instructions = await getUserInstructions();
  await saveUserInstructions(instructions.filter((instr) => instr.id !== id));
}

/** Pull the latest user_instructions blob from the server into local IndexedDB — same shape as groupStore.js's pullRecipeKvFromServer(). */
export async function pullUserInstructionsFromServer() {
  try {
    const { kv: items } = await api.get(`/account/kv?prefix=${encodeURIComponent(USER_INSTRUCTIONS_KEY)}`);
    if (!Array.isArray(items) || !items.length) return;
    const db = await getDb();
    for (const { key, value } of items) {
      await kv.set(db, key, value);
    }
  } catch {
    // Offline или не авторизован — пропускаем тихо
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/instructions/instructionsApi.test.js`
Expected: PASS (5 describe blocks, all green)

- [ ] **Step 5: Commit**

```bash
git add src/features/instructions/instructionsApi.js src/features/instructions/instructionsApi.test.js
git commit -m "feat(instructions): add user instruction CRUD with account_kv sync"
```

---

### Task 5: InstructionRunnerScreen (step-through UI)

**Files:**
- Create: `src/features/instructions/InstructionRunnerScreen.jsx`

**Interfaces:**
- Consumes: `useAppStore` fields `activeInstructionId`, `setScreen` (`@/core/store`); `getAllInstructions` (`@/features/instructions/instructionsApi`, Task 4).
- Produces: default export `InstructionRunnerScreen` React component (no props — reads `activeInstructionId` from the store) — consumed by `src/App.jsx` (Task 7).

No dedicated unit test for this task: the codebase does not unit-test React screen components (only 2 of 49 test files are `.test.jsx`, both hooks). This component is verified in Task 9's manual browser pass.

- [ ] **Step 1: Write the component**

Create `src/features/instructions/InstructionRunnerScreen.jsx`:

```jsx
import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/core/store";
import { getAllInstructions } from "./instructionsApi";
import "./instructions.css";

export default function InstructionRunnerScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const activeInstructionId = useAppStore((s) => s.activeInstructionId);
  const [instruction, setInstruction] = useState(undefined); // undefined = loading, null = not found
  const [stepIndex, setStepIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAllInstructions().then((all) => {
      if (cancelled) return;
      setInstruction(all.find((i) => i.id === activeInstructionId) ?? null);
    });
    return () => { cancelled = true; };
  }, [activeInstructionId]);

  const exit = useCallback(() => {
    setScreen("home");
  }, [setScreen]);

  const steps = instruction?.steps ?? [];
  const isLast = stepIndex === steps.length - 1;

  const handleNext = useCallback(() => {
    if (isLast) { setFinished(true); return; }
    setStepIndex((n) => n + 1);
  }, [isLast]);

  const handleBack = useCallback(() => {
    if (stepIndex > 0) setStepIndex((n) => n - 1);
    else exit();
  }, [stepIndex, exit]);

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (finished) {
        if (e.key === "Escape" || e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); exit(); }
        return;
      }
      switch (e.key) {
        case "ArrowRight": case "Enter": case " ": e.preventDefault(); handleNext(); break;
        case "ArrowLeft": case "Backspace": e.preventDefault(); handleBack(); break;
        case "Escape": e.preventDefault(); exit(); break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, handleNext, handleBack, exit]);

  if (instruction === undefined) {
    return <div className="screen instruction-runner"><div className="home-tab-loading">Загрузка…</div></div>;
  }

  if (instruction === null) {
    return (
      <div className="screen instruction-runner">
        <div className="dn-body">
          <p>Инструкция не найдена.</p>
          <button type="button" className="dn-btn" onClick={exit}>К списку инструкций</button>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="screen instruction-runner">
        <div className="dn-body">
          <div className="dn-badge">✓</div>
          <div className="dn-title">Готово!</div>
          <p className="dn-sub">Инструкция «{instruction.title}» пройдена до конца.</p>
          <button type="button" className="dn-btn" onClick={exit}>К списку инструкций</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen instruction-runner">
      <div className="rn-top">
        <button type="button" className="rn-close" onClick={exit} aria-label="Закрыть">✕</button>
        <div className="rn-progress-wrap">
          <div className="rn-progress">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`rn-seg${i < stepIndex ? " rn-seg--done" : i === stepIndex ? " rn-seg--current" : " rn-seg--todo"}`}
              >
                <span />
              </div>
            ))}
          </div>
          <div className="rn-count">Шаг {stepIndex + 1} из {steps.length}</div>
        </div>
      </div>
      <div className="rn-body">
        <div className="rn-kicker">{instruction.emoji} {instruction.title}</div>
        <div className="rn-step">{steps[stepIndex]}</div>
      </div>
      <div className="rn-foot">
        <button type="button" className="rn-btn rn-btn--back" onClick={handleBack}>Назад</button>
        <button type="button" className="rn-btn rn-btn--next" onClick={handleNext}>Дальше</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/instructions/InstructionRunnerScreen.jsx
git commit -m "feat(instructions): add InstructionRunnerScreen step-through UI"
```

(`instructions.css` doesn't exist yet — Task 8 creates it. The import is harmless before that: Vite/Vitest don't eagerly resolve unused CSS at commit time, and Task 8 lands before the app is run end-to-end in Task 9.)

---

### Task 6: InstructionConstructorScreen (create/edit/delete form)

**Files:**
- Create: `src/features/instructions/InstructionConstructorScreen.jsx`

**Interfaces:**
- Consumes: `useAppStore` fields `instructionConstructorId`, `setScreen`; `getUserInstructions`, `addInstruction`, `updateInstruction`, `deleteInstruction` (Task 4); `validateInstructionDraft` (Task 3); `BackArrowIcon` from `@/shared/components/ArrowIcons`.
- Produces: default export `InstructionConstructorScreen` React component — consumed by `src/App.jsx` (Task 7).

No dedicated unit test — same rationale as Task 5. Verified in Task 9.

- [ ] **Step 1: Write the component**

Create `src/features/instructions/InstructionConstructorScreen.jsx`:

```jsx
import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { getUserInstructions, addInstruction, updateInstruction, deleteInstruction } from "./instructionsApi";
import { validateInstructionDraft } from "./instructionValidation";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import "./instructions.css";

const EMOJI_CHOICES = ["🎒", "🧦", "🪥", "🛏️", "🧸", "🧽", "🧥", "🍽️", "📚", "🧴"];

export default function InstructionConstructorScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const instructionConstructorId = useAppStore((s) => s.instructionConstructorId);
  const isEditing = !!instructionConstructorId;

  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState(EMOJI_CHOICES[0]);
  const [steps, setSteps] = useState([""]);
  const [loaded, setLoaded] = useState(!isEditing);
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    getUserInstructions().then((all) => {
      if (cancelled) return;
      const existing = all.find((i) => i.id === instructionConstructorId);
      if (existing) {
        setTitle(existing.title);
        setEmoji(existing.emoji);
        setSteps(existing.steps.length ? existing.steps : [""]);
      }
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [isEditing, instructionConstructorId]);

  function updateStep(index, value) {
    setSteps((s) => s.map((step, i) => (i === index ? value : step)));
  }

  function addStep() {
    setSteps((s) => [...s, ""]);
  }

  function removeStep(index) {
    setSteps((s) => (s.length > 1 ? s.filter((_, i) => i !== index) : s));
  }

  function moveStep(index, direction) {
    setSteps((s) => {
      const target = index + direction;
      if (target < 0 || target >= s.length) return s;
      const next = [...s];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function exit() {
    setScreen("home");
  }

  async function handleSave() {
    const { valid, errors: validationErrors } = validateInstructionDraft({ title, steps });
    setErrors(validationErrors);
    if (!valid) return;
    setSaving(true);
    const cleanSteps = steps.map((s) => s.trim()).filter(Boolean);
    try {
      if (isEditing) {
        await updateInstruction(instructionConstructorId, { title: title.trim(), emoji, steps: cleanSteps });
      } else {
        await addInstruction({ title: title.trim(), emoji, steps: cleanSteps });
      }
      exit();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await deleteInstruction(instructionConstructorId);
    exit();
  }

  if (!loaded) {
    return <div className="screen instruction-constructor"><div className="home-tab-loading">Загрузка…</div></div>;
  }

  return (
    <div className="screen instruction-constructor">
      <div className="screen-header">
        <button className="back-btn" onClick={exit}><BackArrowIcon /></button>
        <h1 className="screen-title">{isEditing ? "Редактировать инструкцию" : "Новая инструкция"}</h1>
      </div>
      <div className="cn-scroll">
        <div className="cn-field">
          <label>Значок</label>
          <div className="cn-emoji-row">
            {EMOJI_CHOICES.map((e) => (
              <button
                type="button"
                key={e}
                className={`cn-emoji-pick${emoji === e ? " cn-emoji-pick--selected" : ""}`}
                onClick={() => setEmoji(e)}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="cn-field">
          <label>Название</label>
          <input
            className="cn-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например, Собираем портфель"
          />
          {errors.title && <div className="cn-error">{errors.title}</div>}
        </div>
        <div className="cn-field">
          <label>Шаги</label>
          <div className="cn-steps">
            {steps.map((step, i) => (
              <div className="cn-step-row" key={i}>
                <div className="cn-step-arrows">
                  <button type="button" disabled={i === 0} onClick={() => moveStep(i, -1)} aria-label="Сдвинуть вверх">↑</button>
                  <button type="button" disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)} aria-label="Сдвинуть вниз">↓</button>
                </div>
                <div className="cn-step-num">{i + 1}</div>
                <textarea
                  className="cn-step-text"
                  value={step}
                  onChange={(e) => updateStep(i, e.target.value)}
                  placeholder="Что нужно сделать на этом шаге?"
                />
                <button
                  type="button"
                  className="cn-step-del"
                  onClick={() => removeStep(i)}
                  aria-label="Удалить шаг"
                  disabled={steps.length === 1}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {errors.steps && <div className="cn-error">{errors.steps}</div>}
          <button type="button" className="cn-add-step" onClick={addStep}>+ Добавить шаг</button>
        </div>
      </div>
      <div className="cn-foot">
        {isEditing && (
          confirmDelete ? (
            <>
              <button type="button" className="cn-delete" onClick={() => setConfirmDelete(false)}>Отмена</button>
              <button type="button" className="cn-delete cn-delete--confirm" onClick={handleDelete}>Точно удалить</button>
            </>
          ) : (
            <button type="button" className="cn-delete" onClick={() => setConfirmDelete(true)}>Удалить</button>
          )
        )}
        <button type="button" className="cn-save" onClick={handleSave} disabled={saving}>Сохранить</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/instructions/InstructionConstructorScreen.jsx
git commit -m "feat(instructions): add InstructionConstructorScreen create/edit/delete form"
```

---

### Task 7: Register the two new screens in App.jsx

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: default exports from `InstructionRunnerScreen.jsx`, `InstructionConstructorScreen.jsx` (Tasks 5-6).
- Produces: `screen` state values `"instruction_runner"` and `"instruction_constructor"` become navigable via `setScreen(...)` — consumed by `InstructionsTab` (Task 9).

- [ ] **Step 1: Add the imports**

In `src/App.jsx`, after this existing line (~40):

```js
import PlannerPutawayScreen from "@/features/planner/PlannerPutawayScreen";
```

add:

```js
import InstructionRunnerScreen from "@/features/instructions/InstructionRunnerScreen";
import InstructionConstructorScreen from "@/features/instructions/InstructionConstructorScreen";
```

- [ ] **Step 2: Register the screens**

In the `SCREENS` object (~line 62-87), after:

```js
  planner_putaway: PlannerPutawayScreen,
```

add:

```js
  instruction_runner: InstructionRunnerScreen,
  instruction_constructor: InstructionConstructorScreen,
```

- [ ] **Step 3: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds with no errors (this project has no dedicated `src/App.test.jsx`, so a successful build is the check for this wiring step).

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat(instructions): register instruction_runner and instruction_constructor screens"
```

---

### Task 8: instructions.css

**Files:**
- Create: `src/features/instructions/instructions.css`

**Interfaces:**
- Produces: all class names referenced by `InstructionRunnerScreen.jsx` (Task 5), `InstructionConstructorScreen.jsx` (Task 6), and `InstructionsTab.jsx` (Task 9 — written next, so this task also anticipates its `.ig-*` classes based on the approved mockup).
- Includes the mandatory iOS safe-area padding on `.rn-top` / `.rn-foot` / `.cn-foot` per `CLAUDE.md` (the Constructor's top bar reuses the existing `.screen-header` class from `src/styles.css`, which already has safe-area baked in — see line 17307-17310 of that file — so it needs no new rule here).

- [ ] **Step 1: Write the stylesheet**

Create `src/features/instructions/instructions.css` (adapted from the approved brainstorming mockup, in the app's existing warm-cream/teal visual language):

```css
/* ── Instructions grid (InstructionsTab) ─────────────────────────────────── */

.instructions-home {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.ig-head {
  padding: 4px 4px 4px;
  flex-shrink: 0;
}

.ig-eyebrow {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #2f5b57;
  opacity: 0.7;
}

.ig-title {
  font-family: "DM Serif Display", Georgia, serif;
  font-size: 24px;
  font-style: italic;
  color: #1c3634;
  margin: 2px 0 2px;
}

.ig-sub {
  font-size: 13px;
  color: #7d8f8a;
  font-weight: 600;
  margin: 0;
}

.ig-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 14px 2px 10px;
}

.ig-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.ig-card {
  aspect-ratio: 1 / 0.92;
  border-radius: 20px;
  border: 1px solid #e7dccf;
  background: #ffffff;
  box-shadow: 0 8px 20px rgba(71, 61, 48, 0.06);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  padding: 14px;
  cursor: pointer;
  position: relative;
  text-align: left;
  font-family: inherit;
}

.ig-card__main-btn {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
}

.ig-card__emoji {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: linear-gradient(150deg, #5cb0a3, #276b62);
  box-shadow: 0 6px 14px rgba(39, 107, 98, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.ig-card--mine .ig-card__emoji {
  background: linear-gradient(150deg, #e3a24f, #b5723a);
  box-shadow: 0 6px 14px rgba(154, 96, 30, 0.28);
}

.ig-card__title {
  font-size: 14.5px;
  font-weight: 800;
  color: #1c3634;
  line-height: 1.25;
  margin-top: 8px;
}

.ig-card__tag {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #a5652a;
  background: rgba(227, 162, 79, 0.16);
  padding: 3px 6px;
  border-radius: 6px;
}

.ig-card__pencil {
  position: absolute;
  bottom: 10px;
  right: 10px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(74, 155, 143, 0.12);
  color: #276b62;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  cursor: pointer;
}

.ig-card--add {
  border-style: dashed;
  background:
    repeating-linear-gradient(135deg, rgba(199, 186, 166, 0.14) 0 10px, transparent 10px 20px),
    rgba(250, 247, 242, 0.72);
  box-shadow: none;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 6px;
}

.ig-card--add .ig-card__plus {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px dashed rgba(74, 155, 143, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #276b62;
  font-weight: 700;
}

.ig-card--add .ig-card__title {
  font-size: 13px;
  color: #2f5b57;
  margin-top: 0;
}

.ig-card--add .ig-card__lock {
  font-size: 11px;
  color: #8a9e99;
  font-weight: 700;
}

/* ── Runner (InstructionRunnerScreen) ────────────────────────────────────── */

.instruction-runner {
  background:
    radial-gradient(circle at top, rgba(74, 155, 143, 0.12), transparent 34%),
    linear-gradient(180deg, #f7f1e7 0%, #f2ebe2 100%);
}

.rn-top {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: calc(10px + var(--app-safe-top, 0px)) 18px 6px;
  flex-shrink: 0;
}

.rn-close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(38, 49, 49, 0.06);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #7d8f8a;
  font-size: 15px;
  flex-shrink: 0;
  cursor: pointer;
}

.rn-progress-wrap { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.rn-progress { display: flex; gap: 4px; }
.rn-seg { flex: 1; height: 7px; border-radius: 999px; background: #e8e2d5; overflow: hidden; }
.rn-seg > span { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #4a9b8f, #8abfae); }
.rn-seg--done > span { width: 100%; }
.rn-seg--current > span { width: 100%; opacity: 0.55; }
.rn-seg--todo > span { width: 0%; }
.rn-count { font-size: 11.5px; font-weight: 700; color: #7d8f8a; font-variant-numeric: tabular-nums; }

.rn-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px 26px 40px;
  text-align: center;
  gap: 18px;
}

.rn-kicker {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #2f5b57;
  opacity: 0.65;
}

.rn-step {
  font-family: "DM Serif Display", Georgia, serif;
  font-size: 28px;
  line-height: 1.28;
  color: #1c3634;
  max-width: 420px;
}

.rn-foot {
  display: flex;
  gap: 10px;
  padding: 10px 18px calc(18px + var(--app-safe-bottom, 0px));
  flex-shrink: 0;
}

.rn-btn { flex: 1; border: none; border-radius: 16px; padding: 15px 16px; font-family: inherit; font-size: 15.5px; font-weight: 800; cursor: pointer; }
.rn-btn--back { background: #fff; border: 1px solid #e7dccf; color: #263131; flex: 0.7; }
.rn-btn--next { background: linear-gradient(150deg, #5cb0a3, #276b62); color: #fff; box-shadow: 0 10px 22px rgba(39, 107, 98, 0.3); }

/* ── Done state (shared by Runner) ───────────────────────────────────────── */

.dn-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 30px;
  text-align: center;
}
.dn-badge {
  width: 92px; height: 92px; border-radius: 50%;
  background: linear-gradient(150deg, #5cb0a3, #276b62);
  box-shadow: 0 14px 30px rgba(39, 107, 98, 0.32);
  display: flex; align-items: center; justify-content: center;
  font-size: 42px; color: #fff;
}
.dn-title { font-family: "DM Serif Display", Georgia, serif; font-style: italic; font-size: 28px; color: #1c3634; }
.dn-sub { font-size: 14.5px; color: #7d8f8a; font-weight: 600; max-width: 320px; }
.dn-btn {
  margin-top: 10px; border: none; border-radius: 16px; padding: 14px 26px;
  background: linear-gradient(150deg, #5cb0a3, #276b62); color: #fff;
  font-family: inherit; font-weight: 800; font-size: 15px;
  box-shadow: 0 10px 22px rgba(39, 107, 98, 0.3); cursor: pointer;
}

/* ── Constructor (InstructionConstructorScreen) ──────────────────────────── */

.instruction-constructor { background: #f7f1e7; }

.cn-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px 18px 10px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.cn-field label {
  display: block;
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #2f5b57;
  opacity: 0.75;
  margin-bottom: 6px;
}

.cn-emoji-row { display: flex; gap: 8px; flex-wrap: wrap; }
.cn-emoji-pick {
  width: 42px; height: 42px; border-radius: 12px; background: #fff;
  border: 1.5px solid #e7dccf; display: flex; align-items: center; justify-content: center;
  font-size: 19px; cursor: pointer;
}
.cn-emoji-pick--selected { border-color: #4a9b8f; background: rgba(74, 155, 143, 0.1); }

.cn-input {
  width: 100%; border-radius: 14px; border: 1.5px solid #e7dccf; background: #fff;
  padding: 13px 14px; font-family: inherit; font-size: 16px; font-weight: 700; color: #1c3634;
}
.cn-input:focus-visible { outline: 2px solid #4a9b8f; outline-offset: 1px; }

.cn-error { color: #b5533f; font-size: 12.5px; font-weight: 700; margin-top: 6px; }

.cn-steps { display: flex; flex-direction: column; gap: 10px; }
.cn-step-row { display: flex; align-items: flex-start; gap: 8px; }

.cn-step-arrows {
  display: flex; flex-direction: column; gap: 2px; flex-shrink: 0; margin-top: 6px;
}
.cn-step-arrows button {
  width: 22px; height: 20px; border-radius: 6px; border: 1px solid #e7dccf; background: #fff;
  color: #276b62; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.cn-step-arrows button:disabled { opacity: 0.3; cursor: default; }

.cn-step-num {
  width: 26px; height: 26px; border-radius: 50%; background: rgba(74, 155, 143, 0.14);
  color: #276b62; font-weight: 800; font-size: 12px; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; margin-top: 8px; font-variant-numeric: tabular-nums;
}

.cn-step-text {
  flex: 1; border-radius: 14px; border: 1.5px solid #e7dccf; background: #fff;
  padding: 11px 12px; font-family: inherit; font-size: 14.5px; font-weight: 600; color: #263131;
  resize: none; min-height: 44px; line-height: 1.35;
}
.cn-step-text:focus-visible { outline: 2px solid #4a9b8f; outline-offset: 1px; }

.cn-step-del {
  width: 26px; height: 26px; border-radius: 50%; background: rgba(181, 83, 63, 0.1);
  color: #b5533f; display: flex; align-items: center; justify-content: center; font-size: 13px;
  flex-shrink: 0; margin-top: 8px; border: none; cursor: pointer;
}
.cn-step-del:disabled { opacity: 0.3; cursor: default; }

.cn-add-step {
  align-self: flex-start; margin-top: 10px; border: 1.5px dashed rgba(74, 155, 143, 0.4);
  background: rgba(74, 155, 143, 0.06); color: #276b62; font-family: inherit; font-weight: 800;
  font-size: 13px; padding: 8px 14px; border-radius: 12px; cursor: pointer;
}

.cn-foot {
  flex-shrink: 0;
  padding: 10px 18px calc(14px + var(--app-safe-bottom, 0px));
  display: flex; gap: 10px;
  border-top: 1px solid #ece4d8;
  background: rgba(250, 247, 242, 0.92);
}
.cn-save {
  flex: 1; border: none; border-radius: 16px; padding: 15px 16px;
  background: linear-gradient(150deg, #5cb0a3, #276b62); color: #fff;
  font-family: inherit; font-weight: 800; font-size: 15.5px; cursor: pointer;
  box-shadow: 0 10px 22px rgba(39, 107, 98, 0.3);
}
.cn-delete {
  border: 1px solid rgba(181, 83, 63, 0.35); background: #fff; color: #b5533f;
  border-radius: 16px; padding: 15px 16px; font-family: inherit; font-weight: 800;
  font-size: 14px; cursor: pointer;
}
.cn-delete--confirm { border-color: #b5533f; background: #b5533f; color: #fff; }
```

- [ ] **Step 2: Commit**

```bash
git add src/features/instructions/instructions.css
git commit -m "feat(instructions): add instructions.css styling for runner and constructor"
```

---

### Task 9: InstructionsTab (grid picker) + PIN gate

**Files:**
- Create: `src/features/instructions/InstructionsTab.jsx`

**Interfaces:**
- Consumes: `useAppStore` fields `settings`, `patchSettings`, `setActiveInstructionId`, `setInstructionConstructorId`; `getAllInstructions` (Task 4); `PinGateModal` from `@/shared/components/PinGateModal`; `getDb, kv` from `@/core/db`; `api` from `@/core/api`.
- Produces: default export `InstructionsTab({ setScreen })` — consumed by `HomeScreen.jsx` (Task 11).

No dedicated unit test — same rationale as Tasks 5-6. Verified in the manual pass (Task 12).

- [ ] **Step 1: Write the component**

Create `src/features/instructions/InstructionsTab.jsx`:

```jsx
import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { api } from "@/core/api";
import PinGateModal from "@/shared/components/PinGateModal";
import { getAllInstructions } from "./instructionsApi";
import "./instructions.css";

export default function InstructionsTab({ setScreen }) {
  const settings = useAppStore((s) => s.settings);
  const patchSettings = useAppStore((s) => s.patchSettings);
  const setActiveInstructionId = useAppStore((s) => s.setActiveInstructionId);
  const setInstructionConstructorId = useAppStore((s) => s.setInstructionConstructorId);
  const adultPinHash = settings.adultPinHash ?? null;

  const [instructions, setInstructions] = useState(undefined); // undefined = loading
  const [pinGateAction, setPinGateAction] = useState(null); // null | { type: "create" } | { type: "edit", id }

  useEffect(() => {
    let cancelled = false;
    getAllInstructions().then((all) => { if (!cancelled) setInstructions(all); });
    return () => { cancelled = true; };
  }, []);

  function openInstruction(id) {
    setActiveInstructionId(id);
    setScreen("instruction_runner");
  }

  function requestCreate() {
    setPinGateAction({ type: "create" });
  }

  function requestEdit(id) {
    setPinGateAction({ type: "edit", id });
  }

  // First-time PIN setup — mirrors SettingsScreen.jsx's handleSetNewPin so a
  // family with no adult PIN yet actually gets one persisted, instead of the
  // gate silently granting access every time without ever saving anything.
  async function handleSetPin(hash) {
    patchSettings({ adultPinHash: hash });
    const db = await getDb();
    await kv.set(db, "settings", { ...useAppStore.getState().settings, adultPinHash: hash });
    api.patch("/account/settings", { adultPinHash: hash }).catch(() => {});
  }

  function handlePinSuccess() {
    const action = pinGateAction;
    setPinGateAction(null);
    if (!action) return;
    setInstructionConstructorId(action.type === "edit" ? action.id : null);
    setScreen("instruction_constructor");
  }

  if (instructions === undefined) {
    return <div className="home-tab-loading">Загрузка…</div>;
  }

  return (
    <div className="instructions-home">
      <div className="ig-head">
        <div className="ig-eyebrow">Инструкции</div>
        <h1 className="ig-title">Что разберём сегодня?</h1>
        <p className="ig-sub">Пошаговые подсказки для важных дел</p>
      </div>
      <div className="ig-scroll">
        <div className="ig-grid">
          {instructions.map((instruction) => (
            instruction.builtin ? (
              <button
                type="button"
                key={instruction.id}
                className="ig-card"
                onClick={() => openInstruction(instruction.id)}
              >
                <span className="ig-card__emoji">{instruction.emoji}</span>
                <span className="ig-card__title">{instruction.title}</span>
              </button>
            ) : (
              <div key={instruction.id} className="ig-card ig-card--mine">
                <span className="ig-card__tag">Моя</span>
                <button type="button" className="ig-card__main-btn" onClick={() => openInstruction(instruction.id)}>
                  <span className="ig-card__emoji">{instruction.emoji}</span>
                  <span className="ig-card__title">{instruction.title}</span>
                </button>
                <button
                  type="button"
                  className="ig-card__pencil"
                  onClick={() => requestEdit(instruction.id)}
                  aria-label="Редактировать"
                >
                  ✎
                </button>
              </div>
            )
          ))}
          <button type="button" className="ig-card ig-card--add" onClick={requestCreate}>
            <span className="ig-card__plus">+</span>
            <span className="ig-card__title">Создать свою</span>
            <span className="ig-card__lock">🔒 для родителя</span>
          </button>
        </div>
      </div>

      {pinGateAction && (
        <PinGateModal
          pinHash={adultPinHash}
          onSuccess={handlePinSuccess}
          onSetPin={handleSetPin}
          onCancel={() => setPinGateAction(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/instructions/InstructionsTab.jsx
git commit -m "feat(instructions): add InstructionsTab grid picker with PIN-gated create/edit"
```

---

### Task 10: admin.html featureFlag entry

**Files:**
- Modify: `public/admin.html`

**Interfaces:**
- Produces: the `instructions` flag becomes toggleable per-account from the existing admin panel — consumed operationally (no code consumer; `HomeScreen.jsx`, Task 11, reads `account.featureFlags` which this flag populates).

- [ ] **Step 1: Add the flag entry**

In `public/admin.html`, find (around line 220-224):

```js
  const KNOWN_FLAGS = [
    { key: 'planner',      label: 'Планировщик' },
    { key: 'beta',         label: 'Видеть beta-темы' },
    { key: 'experimental', label: 'Видеть experimental-темы' },
  ];
```

change to:

```js
  const KNOWN_FLAGS = [
    { key: 'planner',      label: 'Планировщик' },
    { key: 'instructions', label: 'Инструкции' },
    { key: 'beta',         label: 'Видеть beta-темы' },
    { key: 'experimental', label: 'Видеть experimental-темы' },
  ];
```

- [ ] **Step 2: Commit**

```bash
git add public/admin.html
git commit -m "feat(instructions): add instructions featureFlag toggle to admin panel"
```

---

### Task 11: HomeScreen — third tab + featureFlag gating

**Files:**
- Modify: `src/features/home/HomeScreen.jsx`

**Interfaces:**
- Consumes: `InstructionsTab` (Task 9).
- Produces: the «Инструкции» tab appears in `HomeTabs` and renders `InstructionsTab` when `account.featureFlags` includes `"instructions"`.

- [ ] **Step 1: Add the import**

In `src/features/home/HomeScreen.jsx`, after this existing line (~21):

```js
import "@/features/planner/planner.css";
```

add:

```js
import InstructionsTab from "@/features/instructions/InstructionsTab";
```

- [ ] **Step 2: Add the tab icon**

After the existing `PlannerTabIcon` function (~lines 95-103):

```js
function PlannerTabIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="3.5" y="3.5" width="15" height="15" rx="4" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7 8.5l1.5 1.5L11.5 7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 14h8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
```

add:

```js
function InstructionsTabIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path d="M8 6h11M8 11h11M8 16h11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="m3 6 1 1 2-2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m3 11 1 1 2-2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m3 16 1 1 2-2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

- [ ] **Step 3: Extend HomeTabs with the third tab**

Replace the `HomeTabs` function (~lines 105-128):

```js
function HomeTabs({ active, onChange, showPlanner }) {
  return (
    <nav className="home-tabbar" role="tablist">
      <button
        role="tab"
        className={`home-tabbar__item${active === 'session' ? ' home-tabbar__item--active' : ''}`}
        onClick={() => onChange('session')}
      >
        <SessionTabIcon />
        <span>Занятие</span>
      </button>
      {showPlanner && (
        <button
          role="tab"
          className={`home-tabbar__item${active === 'planner' ? ' home-tabbar__item--active' : ''}`}
          onClick={() => onChange('planner')}
        >
          <PlannerTabIcon />
          <span>Планировщик</span>
        </button>
      )}
    </nav>
  );
}
```

with:

```js
function HomeTabs({ active, onChange, showPlanner, showInstructions }) {
  return (
    <nav className="home-tabbar" role="tablist">
      <button
        role="tab"
        className={`home-tabbar__item${active === 'session' ? ' home-tabbar__item--active' : ''}`}
        onClick={() => onChange('session')}
      >
        <SessionTabIcon />
        <span>Занятие</span>
      </button>
      {showPlanner && (
        <button
          role="tab"
          className={`home-tabbar__item${active === 'planner' ? ' home-tabbar__item--active' : ''}`}
          onClick={() => onChange('planner')}
        >
          <PlannerTabIcon />
          <span>Планировщик</span>
        </button>
      )}
      {showInstructions && (
        <button
          role="tab"
          className={`home-tabbar__item${active === 'instructions' ? ' home-tabbar__item--active' : ''}`}
          onClick={() => onChange('instructions')}
        >
          <InstructionsTabIcon />
          <span>Инструкции</span>
        </button>
      )}
    </nav>
  );
}
```

- [ ] **Step 4: Compute access and wire the content switch**

In `HomeScreen()`, find (~line 726):

```js
  const hasPlannerAccess = Array.isArray(account?.featureFlags) && account.featureFlags.includes("planner");
```

add right after it:

```js
  const hasInstructionsAccess = Array.isArray(account?.featureFlags) && account.featureFlags.includes("instructions");
```

Then find the content switch (~lines 804-826):

```jsx
      <div className="home-main">
        <div className="home-tab-content">
          {activeTab === 'planner' && hasPlannerAccess ? (
            <PlannerTab student={student} setScreen={setScreen} />
          ) : (
            <SessionTab
```

change the condition to:

```jsx
      <div className="home-main">
        <div className="home-tab-content">
          {activeTab === 'instructions' && hasInstructionsAccess ? (
            <InstructionsTab setScreen={setScreen} />
          ) : activeTab === 'planner' && hasPlannerAccess ? (
            <PlannerTab student={student} setScreen={setScreen} />
          ) : (
            <SessionTab
```

(leave the rest of the `SessionTab` props and closing `)}` untouched.)

- [ ] **Step 5: Pass the new prop to HomeTabs**

Find (~line 829):

```jsx
      <HomeTabs active={activeTab} onChange={changeTab} showPlanner={hasPlannerAccess} />
```

change to:

```jsx
      <HomeTabs active={activeTab} onChange={changeTab} showPlanner={hasPlannerAccess} showInstructions={hasInstructionsAccess} />
```

- [ ] **Step 6: Verify the app builds**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/home/HomeScreen.jsx
git commit -m "feat(instructions): wire Instructions tab into HomeScreen behind featureFlag"
```

---

### Task 12: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Grant yourself the flag locally**

Start the backend and frontend dev servers per this project's usual dev workflow, log in with a test account, then either:
- Use `public/admin.html` (Task 10) with an admin token to toggle `instructions` on for that account, or
- Temporarily set it directly via the backend repository function `setAccountFeatureFlags` for the test account.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`

- [ ] **Step 3: Walk the golden path in a browser**

- Open the app, confirm the «Инструкции» tab appears in the bottom tab bar (list-checks icon) next to «Занятие» and «Планировщик».
- Tap «Инструкции» → grid shows the «🧽 Уборка на кухне» card.
- Tap the card → runner shows step 1 of 6, progress bar with one filled segment; tap «Дальше» through all 6 steps; confirm keyboard (ArrowRight/Enter/Space to advance, ArrowLeft/Backspace to go back, Escape to exit) works too.
- On the last step, tap «Дальше» → «Готово!» screen appears; tap «К списку инструкций» → back on the grid.
- Tap «+ Создать свою» → PIN gate appears (first time: set a PIN; subsequent times: enter it).
- On success, Constructor opens empty: pick an emoji, type a title, add 2-3 steps, reorder one with ↑/↓, delete one, tap «Сохранить». Confirm it lands back on the grid with the new card tagged «Моя».
- Tap the pencil on the new card → PIN gate again → Constructor opens pre-filled with the saved data. Change the title, save, confirm the grid reflects the change.
- Open it again, tap «Удалить» → confirm step appears → tap «Точно удалить» → card disappears from the grid.
- Reload the page (or reopen the app) — confirm the built-in card is still there and any remaining custom card survived the reload (round-tripped through IndexedDB).

- [ ] **Step 4: Check the iOS safe-area behavior**

In the browser devtools console, on the Runner and Constructor screens:

```js
document.documentElement.classList.add('app-ios-standalone');
document.documentElement.style.setProperty('--app-safe-top', '59px');
document.documentElement.style.setProperty('--app-safe-bottom', '34px');
```

Confirm the close button / progress bar (Runner) and Save/Delete buttons (Constructor) are not cramped against the simulated notch/home-indicator.

- [ ] **Step 5: Confirm the flag actually gates the tab**

Toggle the `instructions` flag off for the test account via `admin.html`, reload the app, confirm the «Инструкции» tab disappears from the tab bar (same behavior as removing `planner`).

This task has no commit — it's a verification pass. If any step fails, fix the relevant task's code and re-run this checklist before considering the plan complete.

---

## Self-Review

**Spec coverage** — every section of `docs/superpowers/specs/2026-07-12-instructions-design.md` maps to a task:
- Third tab + featureFlag gating → Task 11 (+ Task 10 for the admin toggle).
- Instruction data model (built-in + user, shared shape) → Tasks 2 and 4.
- Grid picker with «Моя» tag and «+ Создать свою» → Task 9.
- Runner (one step per screen, segmented progress, keyboard nav, Done screen) → Task 5.
- Constructor (emoji, title, steps with add/remove/reorder-by-arrows, validation, full CRUD, PIN gate) → Tasks 3, 6, 9.
- Sync via `account_kv` / `syncQueue`, no backend changes → Task 4 (uses only existing `kv.upsert` and `GET /account/kv?prefix=` — verified against `backend/lib/sync-processor.mjs` and `backend/server.mjs` during planning, no backend task needed).
- iOS safe-area rule → Task 8 (CSS) + Task 12 (manual check).

**Placeholder scan** — no TBD/TODO, no "add appropriate error handling"-style steps; every step has literal code or an exact command.

**Type consistency** — `Instruction` shape (`id, title, emoji, steps, builtin, updatedAt`) is identical across `builtinInstructions.js`, `instructionsApi.js`, `InstructionRunnerScreen.jsx`, `InstructionConstructorScreen.jsx`, and `InstructionsTab.jsx`. Function names (`getAllInstructions`, `getUserInstructions`, `addInstruction`, `updateInstruction`, `deleteInstruction`) are used with matching signatures everywhere they're consumed.
